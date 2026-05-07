-- Add audience flag to catalog items and fulfillment tasks
ALTER TABLE public.service_catalog_items
  ADD COLUMN IF NOT EXISTS audience TEXT NOT NULL DEFAULT 'external'
  CHECK (audience IN ('internal','external'));

ALTER TABLE public.service_catalog_item_tasks
  ADD COLUMN IF NOT EXISTS audience TEXT NOT NULL DEFAULT 'external'
  CHECK (audience IN ('internal','external'));

-- Update spawn function to tag child tickets as internal when the task or parent item is internal
CREATE OR REPLACE FUNCTION public.helpdesk_spawn_next_catalog_task(_parent_ticket_id UUID)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_org UUID;
  v_item_id UUID;
  v_parent RECORD;
  v_next_step INT;
  v_task RECORD;
  v_new_id UUID;
  v_first_id UUID := NULL;
  v_open_in_current INT;
  v_subject TEXT;
  v_item_audience TEXT;
  v_is_internal BOOLEAN;
BEGIN
  SELECT t.*, (t.metadata->>'catalog_item_id')::uuid AS item_id
    INTO v_parent
    FROM public.helpdesk_tickets t
   WHERE t.id = _parent_ticket_id;
  IF v_parent.id IS NULL THEN RETURN NULL; END IF;
  v_org := v_parent.organization_id;
  v_item_id := v_parent.item_id;
  IF v_item_id IS NULL THEN RETURN NULL; END IF;

  SELECT audience INTO v_item_audience FROM public.service_catalog_items WHERE id = v_item_id;

  SELECT COUNT(*) INTO v_open_in_current
    FROM public.helpdesk_tickets
   WHERE parent_ticket_id = _parent_ticket_id
     AND (metadata->>'catalog_task_id') IS NOT NULL
     AND status NOT IN ('resolved','closed','cancelled');
  IF v_open_in_current > 0 THEN
    RETURN NULL;
  END IF;

  SELECT MIN(t.step_order) INTO v_next_step
    FROM public.service_catalog_item_tasks t
   WHERE t.item_id = v_item_id
     AND NOT EXISTS (
       SELECT 1 FROM public.helpdesk_tickets ct
        WHERE ct.parent_ticket_id = _parent_ticket_id
          AND (ct.metadata->>'catalog_task_id')::uuid = t.id
     );

  IF v_next_step IS NULL THEN
    UPDATE public.helpdesk_tickets
       SET metadata = COALESCE(metadata,'{}'::jsonb) || jsonb_build_object('catalog_tasks_complete', true)
     WHERE id = _parent_ticket_id;
    RETURN NULL;
  END IF;

  FOR v_task IN
    SELECT * FROM public.service_catalog_item_tasks
     WHERE item_id = v_item_id AND step_order = v_next_step
     ORDER BY created_at ASC
  LOOP
    v_subject := '[Step ' || v_task.step_order || '] ' || v_task.title;
    v_is_internal := (v_task.audience = 'internal') OR (v_item_audience = 'internal');
    INSERT INTO public.helpdesk_tickets (
      organization_id, subject, description, ticket_type, priority,
      source, reporter_user_id, reporter_name, reporter_email,
      assignee_id, parent_ticket_id, created_by, status, metadata
    ) VALUES (
      v_org, v_subject, COALESCE(v_task.description, v_task.title),
      v_parent.ticket_type, v_task.default_priority,
      'system', v_parent.reporter_user_id, v_parent.reporter_name, v_parent.reporter_email,
      v_task.default_assignee_id, _parent_ticket_id, v_parent.reporter_user_id, 'open',
      jsonb_build_object(
        'catalog_item_id', v_item_id,
        'catalog_task_id', v_task.id,
        'catalog_task_step', v_task.step_order,
        'audience', CASE WHEN v_is_internal THEN 'internal' ELSE 'external' END,
        'internal', v_is_internal
      )
    ) RETURNING id INTO v_new_id;

    IF v_new_id IS NOT NULL THEN
      UPDATE public.helpdesk_tickets
         SET assignee_id = COALESCE(v_task.default_assignee_id, assignee_id),
             queue_id = COALESCE(v_task.default_queue_id, queue_id)
       WHERE id = v_new_id;
    END IF;

    IF v_first_id IS NULL THEN v_first_id := v_new_id; END IF;

    INSERT INTO public.helpdesk_ticket_activity (ticket_id, organization_id, actor_user_id, event_type, to_value)
    VALUES (_parent_ticket_id, v_org, NULL, 'catalog_task_spawned',
            jsonb_build_object('child_ticket_id', v_new_id, 'task_id', v_task.id, 'step', v_task.step_order, 'title', v_task.title, 'internal', v_is_internal));
  END LOOP;

  RETURN v_first_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.helpdesk_spawn_next_catalog_task(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.helpdesk_spawn_next_catalog_task(uuid) FROM anon;