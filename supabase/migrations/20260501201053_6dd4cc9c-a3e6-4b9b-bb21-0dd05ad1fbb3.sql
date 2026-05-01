-- Multiple assignees (co-assignees) for helpdesk tickets
CREATE TABLE IF NOT EXISTS public.helpdesk_ticket_assignees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.helpdesk_tickets(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  is_primary boolean NOT NULL DEFAULT false,
  added_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(ticket_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_hd_assignees_ticket ON public.helpdesk_ticket_assignees(ticket_id);
CREATE INDEX IF NOT EXISTS idx_hd_assignees_user ON public.helpdesk_ticket_assignees(user_id);
CREATE INDEX IF NOT EXISTS idx_hd_assignees_org ON public.helpdesk_ticket_assignees(organization_id);

ALTER TABLE public.helpdesk_ticket_assignees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View assignees on accessible tickets"
ON public.helpdesk_ticket_assignees FOR SELECT
USING (
  has_org_access(auth.uid(), organization_id, 'viewer'::text)
  OR user_id = auth.uid()
  OR is_admin(auth.uid())
);

CREATE POLICY "Editors can add assignees"
ON public.helpdesk_ticket_assignees FOR INSERT
WITH CHECK (
  has_org_access(auth.uid(), organization_id, 'editor'::text)
  OR is_admin(auth.uid())
);

CREATE POLICY "Editors can update assignees"
ON public.helpdesk_ticket_assignees FOR UPDATE
USING (
  has_org_access(auth.uid(), organization_id, 'editor'::text)
  OR is_admin(auth.uid())
);

CREATE POLICY "Editors can remove assignees"
ON public.helpdesk_ticket_assignees FOR DELETE
USING (
  has_org_access(auth.uid(), organization_id, 'editor'::text)
  OR is_admin(auth.uid())
);

-- Keep helpdesk_tickets.assignee_id in sync as the "primary" assignee for backward compat / RLS
CREATE OR REPLACE FUNCTION public.sync_helpdesk_primary_assignee()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_ticket uuid;
  v_primary uuid;
BEGIN
  v_ticket := COALESCE(NEW.ticket_id, OLD.ticket_id);
  SELECT user_id INTO v_primary
  FROM public.helpdesk_ticket_assignees
  WHERE ticket_id = v_ticket
  ORDER BY is_primary DESC, created_at ASC
  LIMIT 1;
  UPDATE public.helpdesk_tickets SET assignee_id = v_primary WHERE id = v_ticket;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_hd_primary_assignee ON public.helpdesk_ticket_assignees;
CREATE TRIGGER trg_sync_hd_primary_assignee
AFTER INSERT OR UPDATE OR DELETE ON public.helpdesk_ticket_assignees
FOR EACH ROW EXECUTE FUNCTION public.sync_helpdesk_primary_assignee();

-- Backfill: any ticket with an existing assignee_id gets a corresponding primary row
INSERT INTO public.helpdesk_ticket_assignees (ticket_id, organization_id, user_id, is_primary)
SELECT t.id, t.organization_id, t.assignee_id, true
FROM public.helpdesk_tickets t
WHERE t.assignee_id IS NOT NULL
ON CONFLICT (ticket_id, user_id) DO NOTHING;