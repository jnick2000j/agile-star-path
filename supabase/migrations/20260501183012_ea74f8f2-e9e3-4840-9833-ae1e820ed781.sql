-- 1. Bidirectional link between ticket and task ------------------------------
ALTER TABLE public.helpdesk_tickets
  ADD COLUMN IF NOT EXISTS converted_to_task_id uuid
    REFERENCES public.tasks(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_helpdesk_tickets_converted_task
  ON public.helpdesk_tickets(converted_to_task_id)
  WHERE converted_to_task_id IS NOT NULL;

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS source_ticket_id uuid
    REFERENCES public.helpdesk_tickets(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_source_ticket
  ON public.tasks(source_ticket_id)
  WHERE source_ticket_id IS NOT NULL;

-- 2. Audit log of conversions ------------------------------------------------
CREATE TABLE IF NOT EXISTS public.helpdesk_ticket_task_conversions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  ticket_id uuid NOT NULL REFERENCES public.helpdesk_tickets(id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  converted_by uuid,
  reason text NOT NULL,
  task_priority text NOT NULL,
  programme_id uuid REFERENCES public.programmes(id) ON DELETE SET NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  attachments_copied integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ticket_task_conv_org ON public.helpdesk_ticket_task_conversions(organization_id);
CREATE INDEX IF NOT EXISTS idx_ticket_task_conv_ticket ON public.helpdesk_ticket_task_conversions(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_task_conv_task ON public.helpdesk_ticket_task_conversions(task_id);

ALTER TABLE public.helpdesk_ticket_task_conversions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ticket_task_conv_select"
  ON public.helpdesk_ticket_task_conversions FOR SELECT TO authenticated
  USING (public.has_org_access(auth.uid(), organization_id, 'viewer'::text));

CREATE POLICY "ticket_task_conv_insert"
  ON public.helpdesk_ticket_task_conversions FOR INSERT TO authenticated
  WITH CHECK (
    public.has_org_access(auth.uid(), organization_id, 'editor'::text)
    AND converted_by = auth.uid()
  );