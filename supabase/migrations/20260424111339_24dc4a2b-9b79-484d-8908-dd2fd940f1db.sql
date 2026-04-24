
-- Generic automation workflows
CREATE TABLE public.automation_workflows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  module text NOT NULL,
  name text NOT NULL,
  description text,
  trigger_event text NOT NULL,
  match_conditions jsonb NOT NULL DEFAULT '[]'::jsonb,
  steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  priority integer NOT NULL DEFAULT 100,
  category text,
  tags text[] DEFAULT '{}',
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_automation_workflows_org_module ON public.automation_workflows(organization_id, module, is_active);
CREATE INDEX idx_automation_workflows_trigger ON public.automation_workflows(organization_id, module, trigger_event) WHERE is_active = true;

ALTER TABLE public.automation_workflows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org admins manage automation workflows"
  ON public.automation_workflows
  FOR ALL
  USING (public.is_helpdesk_admin(auth.uid(), organization_id))
  WITH CHECK (public.is_helpdesk_admin(auth.uid(), organization_id));

CREATE POLICY "Org members view active automation workflows"
  ON public.automation_workflows
  FOR SELECT
  USING (public.has_org_access(auth.uid(), organization_id, 'viewer'));

CREATE TRIGGER trg_automation_workflows_updated_at
  BEFORE UPDATE ON public.automation_workflows
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Automation runs
CREATE TABLE public.automation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  workflow_id uuid NOT NULL REFERENCES public.automation_workflows(id) ON DELETE CASCADE,
  module text NOT NULL,
  entity_type text,
  entity_id uuid,
  trigger_event text NOT NULL,
  trigger_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  current_step_index integer NOT NULL DEFAULT 0,
  step_count integer NOT NULL DEFAULT 0,
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  triggered_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_automation_runs_workflow ON public.automation_runs(workflow_id, created_at DESC);
CREATE INDEX idx_automation_runs_org ON public.automation_runs(organization_id, status, created_at DESC);
CREATE INDEX idx_automation_runs_entity ON public.automation_runs(module, entity_type, entity_id);

ALTER TABLE public.automation_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org admins manage automation runs"
  ON public.automation_runs
  FOR ALL
  USING (public.is_helpdesk_admin(auth.uid(), organization_id))
  WITH CHECK (public.is_helpdesk_admin(auth.uid(), organization_id));

CREATE POLICY "Org members view automation runs"
  ON public.automation_runs
  FOR SELECT
  USING (public.has_org_access(auth.uid(), organization_id, 'viewer'));

CREATE TRIGGER trg_automation_runs_updated_at
  BEFORE UPDATE ON public.automation_runs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Step executions
CREATE TABLE public.automation_step_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.automation_runs(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  step_index integer NOT NULL,
  step_type text NOT NULL,
  step_label text,
  status text NOT NULL DEFAULT 'pending',
  input jsonb,
  output jsonb,
  ai_model text,
  ai_tokens integer,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_automation_step_executions_run ON public.automation_step_executions(run_id, step_index);

ALTER TABLE public.automation_step_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members view step executions"
  ON public.automation_step_executions
  FOR SELECT
  USING (public.has_org_access(auth.uid(), organization_id, 'viewer'));

CREATE POLICY "Org admins manage step executions"
  ON public.automation_step_executions
  FOR ALL
  USING (public.is_helpdesk_admin(auth.uid(), organization_id))
  WITH CHECK (public.is_helpdesk_admin(auth.uid(), organization_id));

-- Approvals
CREATE TABLE public.automation_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  run_id uuid NOT NULL REFERENCES public.automation_runs(id) ON DELETE CASCADE,
  step_execution_id uuid REFERENCES public.automation_step_executions(id) ON DELETE CASCADE,
  module text NOT NULL,
  entity_type text,
  entity_id uuid,
  title text NOT NULL,
  description text,
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  assigned_to_user_id uuid,
  assigned_to_role text,
  decision text NOT NULL DEFAULT 'pending',
  decided_by uuid,
  decided_at timestamptz,
  decision_comment text,
  due_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_automation_approvals_org ON public.automation_approvals(organization_id, decision, created_at DESC);
CREATE INDEX idx_automation_approvals_assignee ON public.automation_approvals(assigned_to_user_id, decision);
CREATE INDEX idx_automation_approvals_run ON public.automation_approvals(run_id);

ALTER TABLE public.automation_approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org admins manage automation approvals"
  ON public.automation_approvals
  FOR ALL
  USING (public.is_helpdesk_admin(auth.uid(), organization_id))
  WITH CHECK (public.is_helpdesk_admin(auth.uid(), organization_id));

CREATE POLICY "Assignees view their automation approvals"
  ON public.automation_approvals
  FOR SELECT
  USING (
    assigned_to_user_id = auth.uid()
    OR public.has_org_access(auth.uid(), organization_id, 'viewer')
  );

CREATE POLICY "Assignees update their automation approvals"
  ON public.automation_approvals
  FOR UPDATE
  USING (assigned_to_user_id = auth.uid())
  WITH CHECK (assigned_to_user_id = auth.uid());

CREATE TRIGGER trg_automation_approvals_updated_at
  BEFORE UPDATE ON public.automation_approvals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
