-- Add additional RBAC permissions for new application features
ALTER TABLE public.custom_roles
ADD COLUMN IF NOT EXISTS can_manage_risks boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS can_manage_issues boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS can_manage_benefits boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS can_manage_stakeholders boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS can_manage_requirements boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS can_manage_milestones boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS can_manage_stage_gates boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS can_manage_change_requests boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS can_manage_exceptions boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS can_manage_quality boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS can_manage_work_packages boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS can_manage_tranches boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS can_manage_lessons boolean DEFAULT false;

-- Update existing Administrator role with all permissions
UPDATE public.custom_roles
SET 
  can_manage_risks = true,
  can_manage_issues = true,
  can_manage_benefits = true,
  can_manage_stakeholders = true,
  can_manage_requirements = true,
  can_manage_milestones = true,
  can_manage_stage_gates = true,
  can_manage_change_requests = true,
  can_manage_exceptions = true,
  can_manage_quality = true,
  can_manage_work_packages = true,
  can_manage_tranches = true,
  can_manage_lessons = true
WHERE name = 'Administrator' OR is_system = true;