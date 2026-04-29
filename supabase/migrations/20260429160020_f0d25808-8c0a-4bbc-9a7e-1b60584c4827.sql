
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE TABLE public.helpdesk_sla_escalation_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  -- which SLA leg: 'response' or 'resolution'
  sla_leg TEXT NOT NULL DEFAULT 'resolution',
  -- 'warning' (approaching) or 'breach' (already breached)
  trigger_type TEXT NOT NULL DEFAULT 'warning',
  -- For warnings: percent of SLA elapsed (e.g. 80 means fire at 80%)
  threshold_percent INTEGER NOT NULL DEFAULT 80,
  -- Optional priority filter; null = all priorities
  priority_filter TEXT[],
  -- Actions
  raise_priority BOOLEAN NOT NULL DEFAULT false,
  reassign_to UUID,
  notify_user_ids UUID[] NOT NULL DEFAULT '{}',
  notify_assignee BOOLEAN NOT NULL DEFAULT true,
  post_internal_note BOOLEAN NOT NULL DEFAULT true,
  note_template TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_sla_leg CHECK (sla_leg IN ('response', 'resolution')),
  CONSTRAINT chk_trigger_type CHECK (trigger_type IN ('warning', 'breach')),
  CONSTRAINT chk_threshold CHECK (threshold_percent BETWEEN 1 AND 100)
);

CREATE INDEX idx_sla_esc_rules_org ON public.helpdesk_sla_escalation_rules(organization_id);
CREATE INDEX idx_sla_esc_rules_active ON public.helpdesk_sla_escalation_rules(is_active) WHERE is_active = true;

ALTER TABLE public.helpdesk_sla_escalation_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view escalation rules"
  ON public.helpdesk_sla_escalation_rules FOR SELECT
  USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Admins can create escalation rules"
  ON public.helpdesk_sla_escalation_rules FOR INSERT
  WITH CHECK (
    public.is_org_member(auth.uid(), organization_id)
    AND public.has_role(auth.uid(), 'admin'::public.app_role)
  );

CREATE POLICY "Admins can update escalation rules"
  ON public.helpdesk_sla_escalation_rules FOR UPDATE
  USING (
    public.is_org_member(auth.uid(), organization_id)
    AND public.has_role(auth.uid(), 'admin'::public.app_role)
  );

CREATE POLICY "Admins can delete escalation rules"
  ON public.helpdesk_sla_escalation_rules FOR DELETE
  USING (
    public.is_org_member(auth.uid(), organization_id)
    AND public.has_role(auth.uid(), 'admin'::public.app_role)
  );

CREATE TRIGGER update_sla_esc_rules_updated_at
  BEFORE UPDATE ON public.helpdesk_sla_escalation_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.helpdesk_sla_escalation_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  rule_id UUID REFERENCES public.helpdesk_sla_escalation_rules(id) ON DELETE SET NULL,
  ticket_id UUID NOT NULL,
  trigger_type TEXT NOT NULL,
  sla_leg TEXT NOT NULL,
  actions_taken JSONB NOT NULL DEFAULT '[]'::jsonb,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  fired_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sla_esc_events_org ON public.helpdesk_sla_escalation_events(organization_id);
CREATE INDEX idx_sla_esc_events_ticket ON public.helpdesk_sla_escalation_events(ticket_id);
CREATE INDEX idx_sla_esc_events_rule ON public.helpdesk_sla_escalation_events(rule_id);
CREATE UNIQUE INDEX uq_sla_esc_event_dedupe
  ON public.helpdesk_sla_escalation_events(rule_id, ticket_id, trigger_type, sla_leg);

ALTER TABLE public.helpdesk_sla_escalation_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view escalation events"
  ON public.helpdesk_sla_escalation_events FOR SELECT
  USING (public.is_org_member(auth.uid(), organization_id));
-- No INSERT/UPDATE/DELETE policies: only service role (edge function) can write.

-- Schedule the engine to run every 5 minutes
SELECT cron.schedule(
  'helpdesk-sla-escalation-engine',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://lpsbudbighowwdmgdfyc.supabase.co/functions/v1/sla-escalation-engine',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object('source', 'cron')
  );
  $$
);
