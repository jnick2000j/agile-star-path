-- ========================================
-- PRINCE2 Task & Milestone Management Schema
-- ========================================

-- Task status enum
CREATE TYPE public.task_status AS ENUM ('not_started', 'in_progress', 'on_hold', 'completed', 'cancelled');

-- Milestone status enum
CREATE TYPE public.milestone_status AS ENUM ('planned', 'in_progress', 'achieved', 'missed', 'deferred');

-- Stage gate decision enum
CREATE TYPE public.gate_decision AS ENUM ('pending', 'approved', 'conditional', 'rejected', 'deferred');

-- Change request status enum
CREATE TYPE public.change_status AS ENUM ('pending', 'under_review', 'approved', 'rejected', 'implemented', 'withdrawn');

-- Exception status enum
CREATE TYPE public.exception_status AS ENUM ('raised', 'under_review', 'escalated', 'resolved', 'closed');

-- Quality record status enum
CREATE TYPE public.quality_status AS ENUM ('planned', 'in_progress', 'passed', 'failed', 'conditional');

-- ========================================
-- Tasks Table (with hierarchy support)
-- ========================================
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  status task_status NOT NULL DEFAULT 'not_started',
  priority TEXT NOT NULL DEFAULT 'medium',
  
  -- Parent task for hierarchy
  parent_task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  
  -- Link to entity (one of these will be set)
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  programme_id UUID REFERENCES public.programmes(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  work_package_id UUID,
  
  -- Assignment
  assigned_to UUID,
  
  -- Dates
  planned_start DATE,
  planned_end DATE,
  actual_start DATE,
  actual_end DATE,
  
  -- PRINCE2 specifics
  story_points INTEGER,
  estimated_hours NUMERIC(10,2),
  actual_hours NUMERIC(10,2),
  
  -- Dependencies (stored as JSON array of task IDs)
  depends_on UUID[],
  
  -- Organization scoping
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- RLS Policies for tasks
CREATE POLICY "Users can view org tasks" ON public.tasks
FOR SELECT USING (
  organization_id IS NULL 
  OR has_org_access(auth.uid(), organization_id)
  OR auth.uid() = assigned_to
  OR auth.uid() = created_by
  OR is_admin(auth.uid())
);

CREATE POLICY "Users can create tasks" ON public.tasks
FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Assignees and creators can update tasks" ON public.tasks
FOR UPDATE USING (
  auth.uid() = assigned_to 
  OR auth.uid() = created_by 
  OR is_admin(auth.uid())
);

CREATE POLICY "Admins can delete tasks" ON public.tasks
FOR DELETE USING (is_admin(auth.uid()));

-- ========================================
-- Milestones Table
-- ========================================
CREATE TABLE public.milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  status milestone_status NOT NULL DEFAULT 'planned',
  milestone_type TEXT NOT NULL DEFAULT 'deliverable',
  
  -- Link to entity
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  programme_id UUID REFERENCES public.programmes(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  
  -- Dates
  target_date DATE NOT NULL,
  actual_date DATE,
  
  -- PRINCE2 specifics
  deliverables TEXT[],
  acceptance_criteria TEXT,
  is_stage_boundary BOOLEAN DEFAULT false,
  
  -- Organization scoping
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  owner_id UUID,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view org milestones" ON public.milestones
FOR SELECT USING (
  organization_id IS NULL 
  OR has_org_access(auth.uid(), organization_id)
  OR auth.uid() = owner_id
  OR auth.uid() = created_by
  OR is_admin(auth.uid())
);

CREATE POLICY "Users can create milestones" ON public.milestones
FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Owners can update milestones" ON public.milestones
FOR UPDATE USING (
  auth.uid() = owner_id 
  OR auth.uid() = created_by 
  OR is_admin(auth.uid())
);

CREATE POLICY "Admins can delete milestones" ON public.milestones
FOR DELETE USING (is_admin(auth.uid()));

-- ========================================
-- Stage Gates Table (PRINCE2)
-- ========================================
CREATE TABLE public.stage_gates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  stage_number INTEGER NOT NULL,
  description TEXT,
  
  -- Link to entity
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  programme_id UUID REFERENCES public.programmes(id) ON DELETE CASCADE,
  
  -- Gate review details
  gate_decision gate_decision NOT NULL DEFAULT 'pending',
  decision_date DATE,
  decision_notes TEXT,
  
  -- Criteria
  entry_criteria TEXT[],
  exit_criteria TEXT[],
  criteria_met JSONB DEFAULT '{}',
  
  -- Review details
  review_date DATE,
  reviewed_by UUID,
  attendees UUID[],
  
  -- Dates
  planned_date DATE,
  actual_date DATE,
  
  -- Organization scoping
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.stage_gates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view org stage gates" ON public.stage_gates
FOR SELECT USING (
  organization_id IS NULL 
  OR has_org_access(auth.uid(), organization_id)
  OR auth.uid() = reviewed_by
  OR auth.uid() = created_by
  OR is_admin(auth.uid())
);

CREATE POLICY "Users can create stage gates" ON public.stage_gates
FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Reviewers can update stage gates" ON public.stage_gates
FOR UPDATE USING (
  auth.uid() = reviewed_by 
  OR auth.uid() = created_by 
  OR is_admin(auth.uid())
);

CREATE POLICY "Admins can delete stage gates" ON public.stage_gates
FOR DELETE USING (is_admin(auth.uid()));

-- ========================================
-- Change Requests Table (PRINCE2)
-- ========================================
CREATE TABLE public.change_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_number TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  change_type TEXT NOT NULL DEFAULT 'scope',
  
  -- Link to entity
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  programme_id UUID REFERENCES public.programmes(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  
  -- Status and priority
  status change_status NOT NULL DEFAULT 'pending',
  priority TEXT NOT NULL DEFAULT 'medium',
  
  -- Impact assessment
  impact_summary TEXT,
  cost_impact NUMERIC(15,2),
  time_impact_days INTEGER,
  risk_impact TEXT,
  quality_impact TEXT,
  
  -- Justification
  reason TEXT,
  benefits TEXT,
  
  -- Dates
  date_raised DATE NOT NULL DEFAULT CURRENT_DATE,
  date_required DATE,
  date_decided DATE,
  date_implemented DATE,
  
  -- Decision
  decided_by UUID,
  decision_notes TEXT,
  
  -- Organization scoping
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  raised_by UUID,
  owner_id UUID,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.change_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view org change requests" ON public.change_requests
FOR SELECT USING (
  organization_id IS NULL 
  OR has_org_access(auth.uid(), organization_id)
  OR auth.uid() = raised_by
  OR auth.uid() = owner_id
  OR auth.uid() = created_by
  OR is_admin(auth.uid())
);

CREATE POLICY "Users can create change requests" ON public.change_requests
FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Owners can update change requests" ON public.change_requests
FOR UPDATE USING (
  auth.uid() = owner_id 
  OR auth.uid() = raised_by
  OR auth.uid() = created_by 
  OR is_admin(auth.uid())
);

CREATE POLICY "Admins can delete change requests" ON public.change_requests
FOR DELETE USING (is_admin(auth.uid()));

-- ========================================
-- Exceptions Table (PRINCE2)
-- ========================================
CREATE TABLE public.exceptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_number TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  exception_type TEXT NOT NULL DEFAULT 'time',
  
  -- Link to entity
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  programme_id UUID REFERENCES public.programmes(id) ON DELETE CASCADE,
  
  -- Status
  status exception_status NOT NULL DEFAULT 'raised',
  severity TEXT NOT NULL DEFAULT 'medium',
  
  -- Tolerance details
  tolerance_type TEXT,
  original_tolerance TEXT,
  current_forecast TEXT,
  variance TEXT,
  
  -- Cause and impact
  cause TEXT,
  impact TEXT,
  options TEXT[],
  recommendation TEXT,
  
  -- Escalation details
  escalated_to UUID,
  escalation_date DATE,
  escalation_notes TEXT,
  
  -- Resolution
  resolution TEXT,
  resolution_date DATE,
  resolved_by UUID,
  
  -- Dates
  date_raised DATE NOT NULL DEFAULT CURRENT_DATE,
  
  -- Organization scoping
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  raised_by UUID,
  owner_id UUID,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.exceptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view org exceptions" ON public.exceptions
FOR SELECT USING (
  organization_id IS NULL 
  OR has_org_access(auth.uid(), organization_id)
  OR auth.uid() = raised_by
  OR auth.uid() = owner_id
  OR auth.uid() = escalated_to
  OR auth.uid() = created_by
  OR is_admin(auth.uid())
);

CREATE POLICY "Users can create exceptions" ON public.exceptions
FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Owners can update exceptions" ON public.exceptions
FOR UPDATE USING (
  auth.uid() = owner_id 
  OR auth.uid() = raised_by
  OR auth.uid() = escalated_to
  OR auth.uid() = created_by 
  OR is_admin(auth.uid())
);

CREATE POLICY "Admins can delete exceptions" ON public.exceptions
FOR DELETE USING (is_admin(auth.uid()));

-- ========================================
-- Quality Records Table (PRINCE2)
-- ========================================
CREATE TABLE public.quality_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_number TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  quality_type TEXT NOT NULL DEFAULT 'review',
  
  -- Link to entity
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  programme_id UUID REFERENCES public.programmes(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  
  -- Link to product/deliverable being reviewed
  deliverable_name TEXT,
  deliverable_version TEXT,
  
  -- Status
  status quality_status NOT NULL DEFAULT 'planned',
  
  -- Review details
  review_method TEXT,
  planned_date DATE,
  actual_date DATE,
  
  -- Criteria and results
  quality_criteria TEXT[],
  acceptance_criteria TEXT,
  results TEXT,
  defects_found INTEGER DEFAULT 0,
  
  -- Sign-off
  approved BOOLEAN DEFAULT false,
  approved_by UUID,
  approval_date DATE,
  approval_comments TEXT,
  
  -- Participants
  reviewer_id UUID,
  reviewers UUID[],
  
  -- Organization scoping
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  owner_id UUID,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.quality_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view org quality records" ON public.quality_records
FOR SELECT USING (
  organization_id IS NULL 
  OR has_org_access(auth.uid(), organization_id)
  OR auth.uid() = reviewer_id
  OR auth.uid() = owner_id
  OR auth.uid() = approved_by
  OR auth.uid() = created_by
  OR is_admin(auth.uid())
);

CREATE POLICY "Users can create quality records" ON public.quality_records
FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Owners can update quality records" ON public.quality_records
FOR UPDATE USING (
  auth.uid() = owner_id 
  OR auth.uid() = reviewer_id
  OR auth.uid() = created_by 
  OR is_admin(auth.uid())
);

CREATE POLICY "Admins can delete quality records" ON public.quality_records
FOR DELETE USING (is_admin(auth.uid()));

-- ========================================
-- Tranches Table (MSP Programme Management)
-- ========================================
CREATE TABLE public.tranches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  
  -- Programme link
  programme_id UUID NOT NULL REFERENCES public.programmes(id) ON DELETE CASCADE,
  
  -- Sequence
  sequence_number INTEGER NOT NULL,
  
  -- Status and dates
  status TEXT NOT NULL DEFAULT 'planned',
  planned_start DATE,
  planned_end DATE,
  actual_start DATE,
  actual_end DATE,
  
  -- Objectives
  objectives TEXT[],
  
  -- Gate review
  gate_review_date DATE,
  gate_decision gate_decision DEFAULT 'pending',
  gate_notes TEXT,
  
  -- Progress
  progress INTEGER DEFAULT 0,
  
  -- Organization scoping
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  owner_id UUID,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tranches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view org tranches" ON public.tranches
FOR SELECT USING (
  organization_id IS NULL 
  OR has_org_access(auth.uid(), organization_id)
  OR auth.uid() = owner_id
  OR auth.uid() = created_by
  OR is_admin(auth.uid())
);

CREATE POLICY "Users can create tranches" ON public.tranches
FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Owners can update tranches" ON public.tranches
FOR UPDATE USING (
  auth.uid() = owner_id 
  OR auth.uid() = created_by 
  OR is_admin(auth.uid())
);

CREATE POLICY "Admins can delete tranches" ON public.tranches
FOR DELETE USING (is_admin(auth.uid()));

-- ========================================
-- Indexes for performance
-- ========================================
CREATE INDEX idx_tasks_project ON public.tasks(project_id);
CREATE INDEX idx_tasks_programme ON public.tasks(programme_id);
CREATE INDEX idx_tasks_product ON public.tasks(product_id);
CREATE INDEX idx_tasks_assigned ON public.tasks(assigned_to);
CREATE INDEX idx_tasks_parent ON public.tasks(parent_task_id);
CREATE INDEX idx_tasks_org ON public.tasks(organization_id);

CREATE INDEX idx_milestones_project ON public.milestones(project_id);
CREATE INDEX idx_milestones_programme ON public.milestones(programme_id);
CREATE INDEX idx_milestones_product ON public.milestones(product_id);
CREATE INDEX idx_milestones_org ON public.milestones(organization_id);

CREATE INDEX idx_stage_gates_project ON public.stage_gates(project_id);
CREATE INDEX idx_stage_gates_programme ON public.stage_gates(programme_id);
CREATE INDEX idx_stage_gates_org ON public.stage_gates(organization_id);

CREATE INDEX idx_change_requests_project ON public.change_requests(project_id);
CREATE INDEX idx_change_requests_programme ON public.change_requests(programme_id);
CREATE INDEX idx_change_requests_product ON public.change_requests(product_id);
CREATE INDEX idx_change_requests_org ON public.change_requests(organization_id);

CREATE INDEX idx_exceptions_project ON public.exceptions(project_id);
CREATE INDEX idx_exceptions_programme ON public.exceptions(programme_id);
CREATE INDEX idx_exceptions_org ON public.exceptions(organization_id);

CREATE INDEX idx_quality_records_project ON public.quality_records(project_id);
CREATE INDEX idx_quality_records_programme ON public.quality_records(programme_id);
CREATE INDEX idx_quality_records_product ON public.quality_records(product_id);
CREATE INDEX idx_quality_records_org ON public.quality_records(organization_id);

CREATE INDEX idx_tranches_programme ON public.tranches(programme_id);
CREATE INDEX idx_tranches_org ON public.tranches(organization_id);

-- ========================================
-- Triggers for updated_at
-- ========================================
CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_milestones_updated_at
  BEFORE UPDATE ON public.milestones
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_stage_gates_updated_at
  BEFORE UPDATE ON public.stage_gates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_change_requests_updated_at
  BEFORE UPDATE ON public.change_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_exceptions_updated_at
  BEFORE UPDATE ON public.exceptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_quality_records_updated_at
  BEFORE UPDATE ON public.quality_records
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tranches_updated_at
  BEFORE UPDATE ON public.tranches
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();