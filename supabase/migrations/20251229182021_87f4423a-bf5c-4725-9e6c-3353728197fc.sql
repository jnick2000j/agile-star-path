-- Create work_packages table
CREATE TABLE public.work_packages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations(id),
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'authorized', 'in_progress', 'completed', 'closed')),
  assigned_to TEXT,
  work_description TEXT,
  deliverables TEXT,
  constraints TEXT,
  tolerances TEXT,
  reporting_requirements TEXT,
  target_start DATE,
  target_end DATE,
  progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.work_packages ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view org work packages"
ON public.work_packages FOR SELECT
USING (
  organization_id IS NULL 
  OR has_org_access(auth.uid(), organization_id) 
  OR auth.uid() = created_by 
  OR is_admin(auth.uid())
);

CREATE POLICY "Users can create work packages"
ON public.work_packages FOR INSERT
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update work packages"
ON public.work_packages FOR UPDATE
USING (auth.uid() = created_by OR is_admin(auth.uid()));

CREATE POLICY "Admins can delete work packages"
ON public.work_packages FOR DELETE
USING (is_admin(auth.uid()));

-- Add updated_at trigger
CREATE TRIGGER update_work_packages_updated_at
  BEFORE UPDATE ON public.work_packages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();