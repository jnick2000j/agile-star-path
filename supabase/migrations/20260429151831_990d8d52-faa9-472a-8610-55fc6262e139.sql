
-- ===== ESCALATION RULES =====
CREATE TABLE public.helpdesk_escalation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  -- Matching
  priority TEXT,
  ticket_type TEXT,
  -- Trigger
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('response_breach','resolution_breach','time_open','time_unassigned','approaching_response','approaching_resolution')),
  threshold_minutes INT NOT NULL DEFAULT 0,
  -- Action
  action TEXT NOT NULL CHECK (action IN ('notify','reassign','raise_priority','add_watcher')),
  target_user_id UUID REFERENCES public.profiles(id),
  target_role TEXT,
  notify_emails TEXT[] DEFAULT '{}',
  raise_to_priority TEXT,
  -- Throttling
  cooldown_minutes INT NOT NULL DEFAULT 60,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.helpdesk_escalation_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ESC rules read" ON public.helpdesk_escalation_rules FOR SELECT TO authenticated
  USING (public.has_org_access(auth.uid(), organization_id, 'viewer'));
CREATE POLICY "ESC rules insert" ON public.helpdesk_escalation_rules FOR INSERT TO authenticated
  WITH CHECK (public.has_org_access(auth.uid(), organization_id, 'admin'));
CREATE POLICY "ESC rules update" ON public.helpdesk_escalation_rules FOR UPDATE TO authenticated
  USING (public.has_org_access(auth.uid(), organization_id, 'admin'));
CREATE POLICY "ESC rules delete" ON public.helpdesk_escalation_rules FOR DELETE TO authenticated
  USING (public.has_org_access(auth.uid(), organization_id, 'admin'));
CREATE TRIGGER trg_esc_rules_updated_at BEFORE UPDATE ON public.helpdesk_escalation_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===== ESCALATION EVENTS =====
CREATE TABLE public.helpdesk_escalation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  rule_id UUID REFERENCES public.helpdesk_escalation_rules(id) ON DELETE SET NULL,
  ticket_id UUID NOT NULL REFERENCES public.helpdesk_tickets(id) ON DELETE CASCADE,
  trigger_type TEXT NOT NULL,
  action TEXT NOT NULL,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.helpdesk_escalation_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ESC events read" ON public.helpdesk_escalation_events FOR SELECT TO authenticated
  USING (public.has_org_access(auth.uid(), organization_id, 'viewer'));
CREATE POLICY "ESC events insert" ON public.helpdesk_escalation_events FOR INSERT TO authenticated
  WITH CHECK (public.has_org_access(auth.uid(), organization_id, 'editor'));

CREATE INDEX idx_esc_rules_org_enabled ON public.helpdesk_escalation_rules(organization_id, is_enabled);
CREATE INDEX idx_esc_events_ticket ON public.helpdesk_escalation_events(ticket_id, created_at DESC);
CREATE INDEX idx_esc_events_rule_recent ON public.helpdesk_escalation_events(rule_id, ticket_id, created_at DESC);
