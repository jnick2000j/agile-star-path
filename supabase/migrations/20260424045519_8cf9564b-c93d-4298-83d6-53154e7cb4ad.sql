
CREATE TABLE IF NOT EXISTS public.helpdesk_workflow_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
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
CREATE INDEX IF NOT EXISTS idx_workflow_categories_org ON public.helpdesk_workflow_categories(organization_id);

CREATE TABLE IF NOT EXISTS public.helpdesk_workflows (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  trigger_event TEXT NOT NULL,
  trigger_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  category_id UUID REFERENCES public.helpdesk_workflow_categories(id) ON DELETE SET NULL,
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
CREATE INDEX IF NOT EXISTS idx_workflows_org ON public.helpdesk_workflows(organization_id);
CREATE INDEX IF NOT EXISTS idx_workflows_trigger ON public.helpdesk_workflows(organization_id, trigger_event) WHERE is_enabled = true;
CREATE INDEX IF NOT EXISTS idx_workflows_category ON public.helpdesk_workflows(category_id);

CREATE TABLE IF NOT EXISTS public.helpdesk_workflow_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  workflow_id UUID NOT NULL REFERENCES public.helpdesk_workflows(id) ON DELETE CASCADE,
  ticket_id UUID REFERENCES public.helpdesk_tickets(id) ON DELETE SET NULL,
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
CREATE INDEX IF NOT EXISTS idx_workflow_runs_org ON public.helpdesk_workflow_runs(organization_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_workflow ON public.helpdesk_workflow_runs(workflow_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_ticket ON public.helpdesk_workflow_runs(ticket_id);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_status ON public.helpdesk_workflow_runs(organization_id, status);

CREATE TABLE IF NOT EXISTS public.helpdesk_workflow_step_executions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id UUID NOT NULL REFERENCES public.helpdesk_workflow_runs(id) ON DELETE CASCADE,
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
CREATE INDEX IF NOT EXISTS idx_step_executions_run ON public.helpdesk_workflow_step_executions(run_id, step_index);

CREATE TABLE IF NOT EXISTS public.helpdesk_workflow_approvals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  run_id UUID NOT NULL REFERENCES public.helpdesk_workflow_runs(id) ON DELETE CASCADE,
  step_execution_id UUID REFERENCES public.helpdesk_workflow_step_executions(id) ON DELETE CASCADE,
  ticket_id UUID REFERENCES public.helpdesk_tickets(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  context JSONB NOT NULL DEFAULT '{}'::jsonb,
  assigned_to_user_id UUID,
  assigned_to_role TEXT,
  decision TEXT NOT NULL DEFAULT 'pending',
  decided_by UUID,
  decided_at TIMESTAMPTZ,
  decision_comment TEXT,
  due_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_workflow_approvals_org ON public.helpdesk_workflow_approvals(organization_id);
CREATE INDEX IF NOT EXISTS idx_workflow_approvals_pending ON public.helpdesk_workflow_approvals(organization_id, decision) WHERE decision = 'pending';
CREATE INDEX IF NOT EXISTS idx_workflow_approvals_user ON public.helpdesk_workflow_approvals(assigned_to_user_id) WHERE decision = 'pending';
CREATE INDEX IF NOT EXISTS idx_workflow_approvals_run ON public.helpdesk_workflow_approvals(run_id);

DROP TRIGGER IF EXISTS trg_workflow_categories_updated_at ON public.helpdesk_workflow_categories;
CREATE TRIGGER trg_workflow_categories_updated_at BEFORE UPDATE ON public.helpdesk_workflow_categories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_workflows_updated_at ON public.helpdesk_workflows;
CREATE TRIGGER trg_workflows_updated_at BEFORE UPDATE ON public.helpdesk_workflows FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_workflow_runs_updated_at ON public.helpdesk_workflow_runs;
CREATE TRIGGER trg_workflow_runs_updated_at BEFORE UPDATE ON public.helpdesk_workflow_runs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_workflow_approvals_updated_at ON public.helpdesk_workflow_approvals;
CREATE TRIGGER trg_workflow_approvals_updated_at BEFORE UPDATE ON public.helpdesk_workflow_approvals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Helper: helpdesk admin = global admin OR org admin in this org
CREATE OR REPLACE FUNCTION public.is_helpdesk_admin(_user_id UUID, _org_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_organization_roles uor
    WHERE uor.user_id = _user_id
      AND uor.organization_id = _org_id
      AND uor.role IN ('admin'::app_role, 'org_admin'::app_role)
  ) OR public.is_admin(_user_id);
$$;

-- Helper: org member
CREATE OR REPLACE FUNCTION public.is_org_member(_user_id UUID, _org_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_organization_roles
    WHERE user_id = _user_id AND organization_id = _org_id
  );
$$;

ALTER TABLE public.helpdesk_workflow_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.helpdesk_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.helpdesk_workflow_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.helpdesk_workflow_step_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.helpdesk_workflow_approvals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view categories" ON public.helpdesk_workflow_categories;
CREATE POLICY "Members can view categories" ON public.helpdesk_workflow_categories FOR SELECT USING (public.is_org_member(auth.uid(), organization_id));
DROP POLICY IF EXISTS "Helpdesk admins can manage categories" ON public.helpdesk_workflow_categories;
CREATE POLICY "Helpdesk admins can manage categories" ON public.helpdesk_workflow_categories FOR ALL USING (public.is_helpdesk_admin(auth.uid(), organization_id)) WITH CHECK (public.is_helpdesk_admin(auth.uid(), organization_id));

DROP POLICY IF EXISTS "Members can view workflows" ON public.helpdesk_workflows;
CREATE POLICY "Members can view workflows" ON public.helpdesk_workflows FOR SELECT USING (public.is_org_member(auth.uid(), organization_id));
DROP POLICY IF EXISTS "Helpdesk admins can manage workflows" ON public.helpdesk_workflows;
CREATE POLICY "Helpdesk admins can manage workflows" ON public.helpdesk_workflows FOR ALL USING (public.is_helpdesk_admin(auth.uid(), organization_id)) WITH CHECK (public.is_helpdesk_admin(auth.uid(), organization_id));

DROP POLICY IF EXISTS "Members can view runs" ON public.helpdesk_workflow_runs;
CREATE POLICY "Members can view runs" ON public.helpdesk_workflow_runs FOR SELECT USING (public.is_org_member(auth.uid(), organization_id));
DROP POLICY IF EXISTS "Helpdesk admins can update runs" ON public.helpdesk_workflow_runs;
CREATE POLICY "Helpdesk admins can update runs" ON public.helpdesk_workflow_runs FOR UPDATE USING (public.is_helpdesk_admin(auth.uid(), organization_id)) WITH CHECK (public.is_helpdesk_admin(auth.uid(), organization_id));

DROP POLICY IF EXISTS "Members can view step executions" ON public.helpdesk_workflow_step_executions;
CREATE POLICY "Members can view step executions" ON public.helpdesk_workflow_step_executions FOR SELECT USING (public.is_org_member(auth.uid(), organization_id));

DROP POLICY IF EXISTS "Members can view approvals in org" ON public.helpdesk_workflow_approvals;
CREATE POLICY "Members can view approvals in org" ON public.helpdesk_workflow_approvals FOR SELECT USING (public.is_org_member(auth.uid(), organization_id));
DROP POLICY IF EXISTS "Approver or admin can decide approvals" ON public.helpdesk_workflow_approvals;
CREATE POLICY "Approver or admin can decide approvals" ON public.helpdesk_workflow_approvals FOR UPDATE
  USING (public.is_helpdesk_admin(auth.uid(), organization_id) OR assigned_to_user_id = auth.uid())
  WITH CHECK (public.is_helpdesk_admin(auth.uid(), organization_id) OR assigned_to_user_id = auth.uid());
