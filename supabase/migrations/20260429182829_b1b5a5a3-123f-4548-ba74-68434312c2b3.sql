-- 1. Catalog item task templates
CREATE TABLE public.service_catalog_item_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.service_catalog_items(id) ON DELETE CASCADE,
  step_order INT NOT NULL DEFAULT 1,
  title TEXT NOT NULL,
  description TEXT,
  default_assignee_id UUID,
  default_priority TEXT NOT NULL DEFAULT 'medium',
  estimated_hours NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_svc_item_tasks_item ON public.service_catalog_item_tasks(item_id, step_order);

ALTER TABLE public.service_catalog_item_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View item tasks in org" ON public.service_catalog_item_tasks
  FOR SELECT USING (public.has_org_access(auth.uid(), organization_id, 'viewer'));
CREATE POLICY "Manage item tasks in org" ON public.service_catalog_item_tasks
  FOR ALL USING (public.has_org_access(auth.uid(), organization_id, 'manager'))
  WITH CHECK (public.has_org_access(auth.uid(), organization_id, 'manager'));

CREATE TRIGGER trg_svc_item_tasks_updated
  BEFORE UPDATE ON public.service_catalog_item_tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Function: spawn next pending task ticket for a service request
CREATE OR REPLACE FUNCTION public.helpdesk_spawn_next_catalog_task(_parent_ticket_id UUID)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_org UUID;
  v_item_id UUID;
  v_existing_count INT;
  v_next RECORD;
  v_new_id UUID;
  v_subject TEXT;
  v_parent RECORD;
BEGIN
  SELECT t.*, (t.metadata->>'catalog_item_id')::uuid AS item_id
    INTO v_parent
    FROM public.helpdesk_tickets t
   WHERE t.id = _parent_ticket_id;
  IF v_parent.id IS NULL THEN RETURN NULL; END IF;
  v_org := v_parent.organization_id;
  v_item_id := v_parent.item_id;
  IF v_item_id IS NULL THEN RETURN NULL; END IF;

  -- Count already-spawned task tickets
  SELECT COUNT(*) INTO v_existing_count
    FROM public.helpdesk_tickets
   WHERE parent_ticket_id = _parent_ticket_id
     AND (metadata->>'catalog_task_id') IS NOT NULL;

  -- Pick the next task in order
  SELECT * INTO v_next
    FROM public.service_catalog_item_tasks
   WHERE item_id = v_item_id
   ORDER BY step_order ASC, created_at ASC
   OFFSET v_existing_count
   LIMIT 1;

  IF v_next.id IS NULL THEN
    -- No more tasks; mark parent fulfilled
    UPDATE public.helpdesk_tickets
       SET metadata = COALESCE(metadata,'{}'::jsonb) || jsonb_build_object('catalog_tasks_complete', true)
     WHERE id = _parent_ticket_id;
    RETURN NULL;
  END IF;

  v_subject := '[Task ' || v_next.step_order || '] ' || v_next.title;

  INSERT INTO public.helpdesk_tickets (
    organization_id, subject, description, ticket_type, priority,
    source, reporter_user_id, reporter_name, reporter_email,
    assignee_id, parent_ticket_id, created_by, status, metadata
  ) VALUES (
    v_org, v_subject, COALESCE(v_next.description, v_next.title),
    v_parent.ticket_type, v_next.default_priority,
    'system', v_parent.reporter_user_id, v_parent.reporter_name, v_parent.reporter_email,
    v_next.default_assignee_id, _parent_ticket_id, v_parent.reporter_user_id, 'open',
    jsonb_build_object(
      'catalog_item_id', v_item_id,
      'catalog_task_id', v_next.id,
      'catalog_task_step', v_next.step_order
    )
  ) RETURNING id INTO v_new_id;

  -- Audit log on parent
  INSERT INTO public.helpdesk_ticket_activity (ticket_id, organization_id, actor_user_id, event_type, to_value)
  VALUES (_parent_ticket_id, v_org, NULL, 'catalog_task_spawned',
          jsonb_build_object('child_ticket_id', v_new_id, 'task_id', v_next.id, 'step', v_next.step_order, 'title', v_next.title));

  RETURN v_new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.helpdesk_spawn_next_catalog_task(uuid) TO authenticated;

-- 3. Trigger: when a catalog task ticket is resolved/closed, spawn next
CREATE OR REPLACE FUNCTION public.helpdesk_on_catalog_task_close()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.parent_ticket_id IS NOT NULL
     AND (NEW.metadata->>'catalog_task_id') IS NOT NULL
     AND NEW.status IN ('resolved','closed')
     AND OLD.status NOT IN ('resolved','closed') THEN
    PERFORM public.helpdesk_spawn_next_catalog_task(NEW.parent_ticket_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_helpdesk_catalog_task_close ON public.helpdesk_tickets;
CREATE TRIGGER trg_helpdesk_catalog_task_close
  AFTER UPDATE OF status ON public.helpdesk_tickets
  FOR EACH ROW EXECUTE FUNCTION public.helpdesk_on_catalog_task_close();