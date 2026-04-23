
-- SLA support for helpdesk
ALTER TABLE public.helpdesk_tickets
  ADD COLUMN IF NOT EXISTS sla_response_due_at timestamptz,
  ADD COLUMN IF NOT EXISTS sla_resolution_due_at timestamptz,
  ADD COLUMN IF NOT EXISTS sla_response_breached boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sla_resolution_breached boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sla_paused_at timestamptz,
  ADD COLUMN IF NOT EXISTS sla_paused_seconds integer NOT NULL DEFAULT 0;

-- SLA policy table per org+priority+type
CREATE TABLE IF NOT EXISTS public.helpdesk_sla_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  ticket_type helpdesk_ticket_type,
  priority helpdesk_ticket_priority NOT NULL,
  response_minutes integer NOT NULL DEFAULT 240,
  resolution_minutes integer NOT NULL DEFAULT 2880,
  business_hours_only boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id, ticket_type, priority)
);

ALTER TABLE public.helpdesk_sla_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members view SLA policies"
  ON public.helpdesk_sla_policies FOR SELECT
  USING (has_org_access(auth.uid(), organization_id, 'viewer') OR is_admin(auth.uid()));

CREATE POLICY "Org admins manage SLA policies"
  ON public.helpdesk_sla_policies FOR ALL
  USING (has_org_access(auth.uid(), organization_id, 'admin') OR is_admin(auth.uid()))
  WITH CHECK (has_org_access(auth.uid(), organization_id, 'admin') OR is_admin(auth.uid()));

CREATE TRIGGER trg_helpdesk_sla_policies_updated_at
  BEFORE UPDATE ON public.helpdesk_sla_policies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Outbound notification log (separate from inbound email_log for clarity)
CREATE TABLE IF NOT EXISTS public.helpdesk_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  ticket_id uuid REFERENCES public.helpdesk_tickets(id) ON DELETE CASCADE,
  notification_type text NOT NULL,
  recipient_email text NOT NULL,
  subject text,
  body text,
  status text NOT NULL DEFAULT 'queued',
  sent_at timestamptz,
  error_message text,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.helpdesk_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members view notifications"
  ON public.helpdesk_notifications FOR SELECT
  USING (has_org_access(auth.uid(), organization_id, 'viewer') OR is_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_helpdesk_notif_ticket ON public.helpdesk_notifications(ticket_id);

-- Function to compute SLA due timestamps when a ticket is created
CREATE OR REPLACE FUNCTION public.apply_helpdesk_sla()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _policy public.helpdesk_sla_policies%ROWTYPE;
  _resp_minutes integer;
  _resol_minutes integer;
BEGIN
  SELECT * INTO _policy
  FROM public.helpdesk_sla_policies
  WHERE organization_id = NEW.organization_id
    AND priority = NEW.priority
    AND (ticket_type IS NULL OR ticket_type = NEW.ticket_type)
  ORDER BY ticket_type NULLS LAST
  LIMIT 1;

  IF _policy.id IS NOT NULL THEN
    _resp_minutes := _policy.response_minutes;
    _resol_minutes := _policy.resolution_minutes;
  ELSE
    -- Sensible defaults by priority
    _resp_minutes := CASE NEW.priority
      WHEN 'urgent' THEN 60
      WHEN 'high'   THEN 240
      WHEN 'medium' THEN 480
      WHEN 'low'    THEN 1440
    END;
    _resol_minutes := CASE NEW.priority
      WHEN 'urgent' THEN 240
      WHEN 'high'   THEN 1440
      WHEN 'medium' THEN 2880
      WHEN 'low'    THEN 7200
    END;
  END IF;

  IF NEW.sla_response_due_at IS NULL THEN
    NEW.sla_response_due_at := NEW.created_at + (_resp_minutes || ' minutes')::interval;
  END IF;
  IF NEW.sla_resolution_due_at IS NULL THEN
    NEW.sla_resolution_due_at := NEW.created_at + (_resol_minutes || ' minutes')::interval;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_helpdesk_apply_sla ON public.helpdesk_tickets;
CREATE TRIGGER trg_helpdesk_apply_sla
  BEFORE INSERT ON public.helpdesk_tickets
  FOR EACH ROW EXECUTE FUNCTION public.apply_helpdesk_sla();

-- Mark breached on update if past due
CREATE OR REPLACE FUNCTION public.mark_helpdesk_sla_breaches()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.sla_response_due_at IS NOT NULL
     AND NEW.first_response_at IS NULL
     AND now() > NEW.sla_response_due_at
     AND NEW.sla_response_breached = false THEN
    NEW.sla_response_breached := true;
  END IF;

  IF NEW.sla_resolution_due_at IS NOT NULL
     AND NEW.resolved_at IS NULL
     AND NEW.status NOT IN ('resolved','closed','cancelled')
     AND now() > NEW.sla_resolution_due_at
     AND NEW.sla_resolution_breached = false THEN
    NEW.sla_resolution_breached := true;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_helpdesk_mark_breaches ON public.helpdesk_tickets;
CREATE TRIGGER trg_helpdesk_mark_breaches
  BEFORE UPDATE ON public.helpdesk_tickets
  FOR EACH ROW EXECUTE FUNCTION public.mark_helpdesk_sla_breaches();
