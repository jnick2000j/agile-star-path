-- Phase 18: Approval Workflows for Helpdesk service requests

CREATE TABLE public.helpdesk_approval_chains (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  trigger_ticket_type TEXT,
  trigger_category TEXT,
  trigger_min_cost NUMERIC,
  trigger_priority TEXT,
  trigger_catalog_item_id UUID,
  mode TEXT NOT NULL DEFAULT 'sequential',
  required_approvals INT NOT NULL DEFAULT 0,
  auto_approve_on_complete BOOLEAN NOT NULL DEFAULT true,
  priority INT NOT NULL DEFAULT 100,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.helpdesk_approval_chain_steps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  chain_id UUID NOT NULL REFERENCES public.helpdesk_approval_chains(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL,
  step_order INT NOT NULL DEFAULT 1,
  name TEXT NOT NULL,
  approver_type TEXT NOT NULL DEFAULT 'user',
  approver_user_id UUID,
  approver_role TEXT,
  is_optional BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_approval_chain_steps_chain ON public.helpdesk_approval_chain_steps(chain_id, step_order);
CREATE INDEX idx_approval_chains_org_active ON public.helpdesk_approval_chains(organization_id, is_active);

ALTER TABLE public.service_catalog_request_approvals
  ADD COLUMN IF NOT EXISTS chain_id UUID REFERENCES public.helpdesk_approval_chains(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS step_name TEXT,
  ADD COLUMN IF NOT EXISTS mode TEXT NOT NULL DEFAULT 'sequential',
  ADD COLUMN IF NOT EXISTS is_optional BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.helpdesk_approval_chains ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.helpdesk_approval_chain_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "approval_chains_select_org" ON public.helpdesk_approval_chains
  FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "approval_chains_admin_all" ON public.helpdesk_approval_chains
  FOR ALL TO authenticated
  USING (public.is_org_admin(auth.uid(), organization_id))
  WITH CHECK (public.is_org_admin(auth.uid(), organization_id));

CREATE POLICY "approval_chain_steps_select_org" ON public.helpdesk_approval_chain_steps
  FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "approval_chain_steps_admin_all" ON public.helpdesk_approval_chain_steps
  FOR ALL TO authenticated
  USING (public.is_org_admin(auth.uid(), organization_id))
  WITH CHECK (public.is_org_admin(auth.uid(), organization_id));

CREATE TRIGGER trg_helpdesk_approval_chains_updated
BEFORE UPDATE ON public.helpdesk_approval_chains
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.helpdesk_instantiate_approval_chain(
  _ticket_id UUID, _chain_id UUID
) RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_org UUID; v_chain RECORD; v_step RECORD;
  v_approver UUID; v_count INT := 0; v_reporter UUID;
BEGIN
  SELECT organization_id, reporter_user_id INTO v_org, v_reporter
  FROM helpdesk_tickets WHERE id = _ticket_id;
  IF v_org IS NULL THEN RETURN 0; END IF;

  SELECT * INTO v_chain FROM helpdesk_approval_chains WHERE id = _chain_id AND organization_id = v_org;
  IF v_chain IS NULL THEN RETURN 0; END IF;

  IF EXISTS (SELECT 1 FROM service_catalog_request_approvals
             WHERE ticket_id = _ticket_id AND chain_id = _chain_id) THEN
    RETURN 0;
  END IF;

  FOR v_step IN
    SELECT * FROM helpdesk_approval_chain_steps
    WHERE chain_id = _chain_id ORDER BY step_order ASC
  LOOP
    v_approver := NULL;
    IF v_step.approver_type = 'user' THEN
      v_approver := v_step.approver_user_id;
    ELSIF v_step.approver_type = 'reporter_manager' THEN
      v_approver := v_reporter;
    ELSIF v_step.approver_type = 'role' AND v_step.approver_role IS NOT NULL THEN
      SELECT ur.user_id INTO v_approver
      FROM user_roles ur
      JOIN profiles p ON p.id = ur.user_id
      WHERE ur.role::text = v_step.approver_role
        AND p.organization_id = v_org
      LIMIT 1;
    END IF;

    IF v_approver IS NULL THEN CONTINUE; END IF;

    INSERT INTO service_catalog_request_approvals (
      ticket_id, organization_id, approver_user_id, step_order,
      status, chain_id, step_name, mode, is_optional
    ) VALUES (
      _ticket_id, v_org, v_approver, v_step.step_order,
      'pending', _chain_id, v_step.name, v_chain.mode, v_step.is_optional
    );
    v_count := v_count + 1;
  END LOOP;

  UPDATE helpdesk_tickets
  SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('awaiting_approval', true, 'approval_chain_id', _chain_id::text)
  WHERE id = _ticket_id;

  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.helpdesk_evaluate_approvals(_ticket_id UUID)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_total INT; v_approved INT; v_rejected INT; v_required INT;
  v_chain RECORD; v_chain_id UUID;
BEGIN
  SELECT chain_id INTO v_chain_id FROM service_catalog_request_approvals
   WHERE ticket_id = _ticket_id AND chain_id IS NOT NULL LIMIT 1;
  IF v_chain_id IS NULL THEN RETURN 'no_chain'; END IF;

  SELECT * INTO v_chain FROM helpdesk_approval_chains WHERE id = v_chain_id;

  SELECT COUNT(*) FILTER (WHERE NOT is_optional),
         COUNT(*) FILTER (WHERE status = 'approved'),
         COUNT(*) FILTER (WHERE status = 'rejected')
    INTO v_total, v_approved, v_rejected
    FROM service_catalog_request_approvals
   WHERE ticket_id = _ticket_id AND chain_id = v_chain_id;

  IF v_rejected > 0 THEN
    UPDATE helpdesk_tickets
       SET metadata = COALESCE(metadata,'{}'::jsonb) || jsonb_build_object('awaiting_approval', false, 'approval_outcome','rejected')
     WHERE id = _ticket_id;
    RETURN 'rejected';
  END IF;

  v_required := CASE WHEN v_chain.required_approvals > 0 THEN v_chain.required_approvals ELSE v_total END;

  IF v_approved >= v_required THEN
    UPDATE helpdesk_tickets
       SET metadata = COALESCE(metadata,'{}'::jsonb) || jsonb_build_object('awaiting_approval', false, 'approval_outcome','approved')
     WHERE id = _ticket_id;
    RETURN 'approved';
  END IF;

  RETURN 'pending';
END;
$$;

CREATE OR REPLACE FUNCTION public.helpdesk_auto_trigger_approval_chain()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_chain UUID;
BEGIN
  SELECT id INTO v_chain
    FROM helpdesk_approval_chains c
   WHERE c.organization_id = NEW.organization_id
     AND c.is_active = true
     AND (c.trigger_ticket_type IS NULL OR c.trigger_ticket_type = NEW.ticket_type::text)
     AND (c.trigger_category IS NULL OR c.trigger_category = NEW.category)
     AND (c.trigger_priority IS NULL OR c.trigger_priority = NEW.priority::text)
   ORDER BY c.priority ASC, c.created_at ASC
   LIMIT 1;

  IF v_chain IS NOT NULL THEN
    PERFORM public.helpdesk_instantiate_approval_chain(NEW.id, v_chain);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_helpdesk_ticket_auto_approval
AFTER INSERT ON public.helpdesk_tickets
FOR EACH ROW EXECUTE FUNCTION public.helpdesk_auto_trigger_approval_chain();