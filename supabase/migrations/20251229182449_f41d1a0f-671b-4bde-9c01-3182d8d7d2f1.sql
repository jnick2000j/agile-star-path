-- Create business_requirements table (aligned with MSP)
CREATE TABLE public.business_requirements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES public.organizations(id),
  programme_id UUID REFERENCES public.programmes(id) ON DELETE SET NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  reference_number TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'functional',
  priority TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'draft',
  source TEXT,
  rationale TEXT,
  acceptance_criteria TEXT,
  owner_id UUID,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create technical_requirements table
CREATE TABLE public.technical_requirements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES public.organizations(id),
  programme_id UUID REFERENCES public.programmes(id) ON DELETE SET NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  business_requirement_id UUID REFERENCES public.business_requirements(id) ON DELETE SET NULL,
  reference_number TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'architecture',
  priority TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'draft',
  technical_specification TEXT,
  acceptance_criteria TEXT,
  dependencies TEXT,
  owner_id UUID,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create programme_definition table for MSP Programme Definition
CREATE TABLE public.programme_definitions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  programme_id UUID REFERENCES public.programmes(id) ON DELETE CASCADE NOT NULL UNIQUE,
  organization_id UUID REFERENCES public.organizations(id),
  vision_statement TEXT,
  strategic_objectives TEXT,
  scope_statement TEXT,
  out_of_scope TEXT,
  success_criteria TEXT,
  key_assumptions TEXT,
  constraints TEXT,
  dependencies TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create success_plans table for MSP Success Plan
CREATE TABLE public.success_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  programme_id UUID REFERENCES public.programmes(id) ON DELETE CASCADE NOT NULL UNIQUE,
  organization_id UUID REFERENCES public.organizations(id),
  target_outcomes TEXT,
  success_measures TEXT,
  key_milestones TEXT,
  critical_success_factors TEXT,
  risk_mitigation TEXT,
  resource_requirements TEXT,
  timeline_summary TEXT,
  review_schedule TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.business_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.technical_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.programme_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.success_plans ENABLE ROW LEVEL SECURITY;

-- RLS for business_requirements
CREATE POLICY "Users can view org business requirements"
ON public.business_requirements FOR SELECT
USING (organization_id IS NULL OR has_org_access(auth.uid(), organization_id) OR auth.uid() = owner_id OR auth.uid() = created_by OR is_admin(auth.uid()));

CREATE POLICY "Users can create business requirements"
ON public.business_requirements FOR INSERT
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update business requirements"
ON public.business_requirements FOR UPDATE
USING (auth.uid() = owner_id OR auth.uid() = created_by OR is_admin(auth.uid()));

CREATE POLICY "Admins can delete business requirements"
ON public.business_requirements FOR DELETE
USING (is_admin(auth.uid()));

-- RLS for technical_requirements
CREATE POLICY "Users can view org technical requirements"
ON public.technical_requirements FOR SELECT
USING (organization_id IS NULL OR has_org_access(auth.uid(), organization_id) OR auth.uid() = owner_id OR auth.uid() = created_by OR is_admin(auth.uid()));

CREATE POLICY "Users can create technical requirements"
ON public.technical_requirements FOR INSERT
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update technical requirements"
ON public.technical_requirements FOR UPDATE
USING (auth.uid() = owner_id OR auth.uid() = created_by OR is_admin(auth.uid()));

CREATE POLICY "Admins can delete technical requirements"
ON public.technical_requirements FOR DELETE
USING (is_admin(auth.uid()));

-- RLS for programme_definitions
CREATE POLICY "Users can view org programme definitions"
ON public.programme_definitions FOR SELECT
USING (organization_id IS NULL OR has_org_access(auth.uid(), organization_id) OR auth.uid() = created_by OR is_admin(auth.uid()));

CREATE POLICY "Users can create programme definitions"
ON public.programme_definitions FOR INSERT
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update programme definitions"
ON public.programme_definitions FOR UPDATE
USING (auth.uid() = created_by OR is_admin(auth.uid()));

CREATE POLICY "Admins can delete programme definitions"
ON public.programme_definitions FOR DELETE
USING (is_admin(auth.uid()));

-- RLS for success_plans
CREATE POLICY "Users can view org success plans"
ON public.success_plans FOR SELECT
USING (organization_id IS NULL OR has_org_access(auth.uid(), organization_id) OR auth.uid() = created_by OR is_admin(auth.uid()));

CREATE POLICY "Users can create success plans"
ON public.success_plans FOR INSERT
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update success plans"
ON public.success_plans FOR UPDATE
USING (auth.uid() = created_by OR is_admin(auth.uid()));

CREATE POLICY "Admins can delete success plans"
ON public.success_plans FOR DELETE
USING (is_admin(auth.uid()));

-- Add updated_at triggers
CREATE TRIGGER update_business_requirements_updated_at
  BEFORE UPDATE ON public.business_requirements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_technical_requirements_updated_at
  BEFORE UPDATE ON public.technical_requirements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_programme_definitions_updated_at
  BEFORE UPDATE ON public.programme_definitions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_success_plans_updated_at
  BEFORE UPDATE ON public.success_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();