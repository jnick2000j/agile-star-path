-- ============================================================================
-- 1) ENTITY AUDIT LOG  (cross-module: helpdesk + change management)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.entity_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  entity_type TEXT NOT NULL,             -- e.g. 'helpdesk_ticket', 'helpdesk_comment', 'cm_request', 'cm_approval'
  entity_id UUID NOT NULL,
  action TEXT NOT NULL,                  -- 'created' | 'updated' | 'deleted'
  actor_user_id UUID,
  changed_fields TEXT[] NOT NULL DEFAULT '{}',
  before_data JSONB,
  after_data JSONB,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_entity_audit_org_entity ON public.entity_audit_log(organization_id, entity_type, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_entity_audit_actor ON public.entity_audit_log(actor_user_id);

ALTER TABLE public.entity_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members view audit log" ON public.entity_audit_log;
CREATE POLICY "Org members view audit log"
  ON public.entity_audit_log FOR SELECT
  USING (public.has_org_access(auth.uid(), organization_id, 'viewer'));

DROP POLICY IF EXISTS "Admins delete audit log" ON public.entity_audit_log;
CREATE POLICY "Admins delete audit log"
  ON public.entity_audit_log FOR DELETE
  USING (public.is_admin(auth.uid()));

-- Generic audit trigger function
CREATE OR REPLACE FUNCTION public.log_entity_audit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _entity_type TEXT := TG_ARGV[0];
  _org_field TEXT := COALESCE(TG_ARGV[1], 'organization_id');
  _org_id UUID;
  _entity_id UUID;
  _changed TEXT[] := ARRAY[]::TEXT[];
  _before JSONB;
  _after JSONB;
  _action TEXT;
  _key TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    _action := 'created';
    _after := to_jsonb(NEW);
    EXECUTE format('SELECT ($1).%I, ($1).id', _org_field) INTO _org_id, _entity_id USING NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    _action := 'updated';
    _before := to_jsonb(OLD);
    _after := to_jsonb(NEW);
    EXECUTE format('SELECT ($1).%I, ($1).id', _org_field) INTO _org_id, _entity_id USING NEW;
    FOR _key IN SELECT jsonb_object_keys(_after) LOOP
      IF _before->_key IS DISTINCT FROM _after->_key
         AND _key NOT IN ('updated_at') THEN
        _changed := array_append(_changed, _key);
      END IF;
    END LOOP;
    IF array_length(_changed, 1) IS NULL THEN
      RETURN NEW;
    END IF;
  ELSE -- DELETE
    _action := 'deleted';
    _before := to_jsonb(OLD);
    EXECUTE format('SELECT ($1).%I, ($1).id', _org_field) INTO _org_id, _entity_id USING OLD;
  END IF;

  INSERT INTO public.entity_audit_log (
    organization_id, entity_type, entity_id, action, actor_user_id,
    changed_fields, before_data, after_data
  ) VALUES (
    _org_id, _entity_type, _entity_id, _action, auth.uid(),
    _changed, _before, _after
  );

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

-- Attach to helpdesk + CM tables
DROP TRIGGER IF EXISTS trg_audit_helpdesk_tickets ON public.helpdesk_tickets;
CREATE TRIGGER trg_audit_helpdesk_tickets
AFTER INSERT OR UPDATE OR DELETE ON public.helpdesk_tickets
FOR EACH ROW EXECUTE FUNCTION public.log_entity_audit('helpdesk_ticket', 'organization_id');

DROP TRIGGER IF EXISTS trg_audit_helpdesk_comments ON public.helpdesk_ticket_comments;
CREATE TRIGGER trg_audit_helpdesk_comments
AFTER INSERT OR UPDATE OR DELETE ON public.helpdesk_ticket_comments
FOR EACH ROW EXECUTE FUNCTION public.log_entity_audit('helpdesk_comment', 'organization_id');

DROP TRIGGER IF EXISTS trg_audit_cm_requests ON public.change_management_requests;
CREATE TRIGGER trg_audit_cm_requests
AFTER INSERT OR UPDATE OR DELETE ON public.change_management_requests
FOR EACH ROW EXECUTE FUNCTION public.log_entity_audit('cm_request', 'organization_id');

DROP TRIGGER IF EXISTS trg_audit_cm_approvals ON public.change_management_approvals;
CREATE TRIGGER trg_audit_cm_approvals
AFTER INSERT OR UPDATE OR DELETE ON public.change_management_approvals
FOR EACH ROW EXECUTE FUNCTION public.log_entity_audit('cm_approval', 'organization_id');


-- ============================================================================
-- 2) CHANGE MANAGEMENT WORKFLOWS  (mirrors helpdesk_workflows)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.cm_workflow_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  color TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  UNIQUE(organization_id, name)
);

CREATE TABLE IF NOT EXISTS public.cm_workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  trigger_event TEXT NOT NULL,
  trigger_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  category_id UUID REFERENCES public.cm_workflow_categories(id) ON DELETE SET NULL,
  match_conditions JSONB NOT NULL DEFAULT '[]'::jsonb,
  steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  run_count INTEGER NOT NULL DEFAULT 0,
  success_count INTEGER NOT NULL DEFAULT 0,
  failure_count INTEGER NOT NULL DEFAULT 0,
  last_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  updated_by UUID
);
CREATE INDEX IF NOT EXISTS idx_cm_workflows_org ON public.cm_workflows(organization_id);
CREATE INDEX IF NOT EXISTS idx_cm_workflows_trigger ON public.cm_workflows(organization_id, trigger_event) WHERE is_enabled = true;

CREATE TABLE IF NOT EXISTS public.cm_workflow_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  workflow_id UUID NOT NULL REFERENCES public.cm_workflows(id) ON DELETE CASCADE,
  change_request_id UUID REFERENCES public.change_management_requests(id) ON DELETE SET NULL,
  trigger_event TEXT NOT NULL,
  trigger_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'running',
  current_step_index INTEGER NOT NULL DEFAULT 0,
  step_count INTEGER NOT NULL DEFAULT 0,
  context JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_message TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  triggered_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cm_runs_org ON public.cm_workflow_runs(organization_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_cm_runs_change ON public.cm_workflow_runs(change_request_id);

CREATE TABLE IF NOT EXISTS public.cm_workflow_step_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES public.cm_workflow_runs(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  step_index INTEGER NOT NULL,
  step_type TEXT NOT NULL,
  step_label TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  input JSONB NOT NULL DEFAULT '{}'::jsonb,
  output JSONB NOT NULL DEFAULT '{}'::jsonb,
  ai_model TEXT,
  ai_tokens INTEGER,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cm_step_exec_run ON public.cm_workflow_step_executions(run_id, step_index);

CREATE TABLE IF NOT EXISTS public.cm_workflow_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  run_id UUID NOT NULL REFERENCES public.cm_workflow_runs(id) ON DELETE CASCADE,
  step_execution_id UUID REFERENCES public.cm_workflow_step_executions(id) ON DELETE CASCADE,
  change_request_id UUID REFERENCES public.change_management_requests(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  context JSONB NOT NULL DEFAULT '{}'::jsonb,
  assigned_to_user_id UUID,
  assigned_to_role TEXT,
  decision TEXT NOT NULL DEFAULT 'pending',
  decided_by UUID,
  decided_at TIMESTAMPTZ,
  decision_comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cm_approvals_pending ON public.cm_workflow_approvals(organization_id, decision) WHERE decision = 'pending';

DROP TRIGGER IF EXISTS trg_cm_wf_categories_updated_at ON public.cm_workflow_categories;
CREATE TRIGGER trg_cm_wf_categories_updated_at BEFORE UPDATE ON public.cm_workflow_categories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_cm_workflows_updated_at ON public.cm_workflows;
CREATE TRIGGER trg_cm_workflows_updated_at BEFORE UPDATE ON public.cm_workflows FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_cm_runs_updated_at ON public.cm_workflow_runs;
CREATE TRIGGER trg_cm_runs_updated_at BEFORE UPDATE ON public.cm_workflow_runs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_cm_approvals_updated_at ON public.cm_workflow_approvals;
CREATE TRIGGER trg_cm_approvals_updated_at BEFORE UPDATE ON public.cm_workflow_approvals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.cm_workflow_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cm_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cm_workflow_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cm_workflow_step_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cm_workflow_approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view cm wf categories" ON public.cm_workflow_categories FOR SELECT USING (public.has_org_access(auth.uid(), organization_id, 'viewer'));
CREATE POLICY "Admins manage cm wf categories" ON public.cm_workflow_categories FOR ALL USING (public.has_org_access(auth.uid(), organization_id, 'manager')) WITH CHECK (public.has_org_access(auth.uid(), organization_id, 'manager'));

CREATE POLICY "Members view cm workflows" ON public.cm_workflows FOR SELECT USING (public.has_org_access(auth.uid(), organization_id, 'viewer'));
CREATE POLICY "Admins manage cm workflows" ON public.cm_workflows FOR ALL USING (public.has_org_access(auth.uid(), organization_id, 'manager')) WITH CHECK (public.has_org_access(auth.uid(), organization_id, 'manager'));

CREATE POLICY "Members view cm wf runs" ON public.cm_workflow_runs FOR SELECT USING (public.has_org_access(auth.uid(), organization_id, 'viewer'));
CREATE POLICY "Admins update cm wf runs" ON public.cm_workflow_runs FOR UPDATE USING (public.has_org_access(auth.uid(), organization_id, 'manager')) WITH CHECK (public.has_org_access(auth.uid(), organization_id, 'manager'));

CREATE POLICY "Members view cm wf steps" ON public.cm_workflow_step_executions FOR SELECT USING (public.has_org_access(auth.uid(), organization_id, 'viewer'));

CREATE POLICY "Members view cm approvals" ON public.cm_workflow_approvals FOR SELECT USING (public.has_org_access(auth.uid(), organization_id, 'viewer'));
CREATE POLICY "Approver or admin decides cm approvals" ON public.cm_workflow_approvals FOR UPDATE
  USING (public.has_org_access(auth.uid(), organization_id, 'manager') OR assigned_to_user_id = auth.uid())
  WITH CHECK (public.has_org_access(auth.uid(), organization_id, 'manager') OR assigned_to_user_id = auth.uid());