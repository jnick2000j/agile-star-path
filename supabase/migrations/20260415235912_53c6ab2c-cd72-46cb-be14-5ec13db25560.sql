
-- Add new stakeholder role variants to the enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'org_stakeholder';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'programme_stakeholder';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'project_stakeholder';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'product_stakeholder';

-- Insert system custom_roles for new stakeholder types
INSERT INTO public.custom_roles (name, is_system, description, color, icon,
  can_manage_programmes, can_manage_projects, can_manage_products, can_manage_users,
  can_view_reports, can_manage_risks, can_manage_issues, can_manage_benefits,
  can_manage_stakeholders, can_manage_requirements, can_manage_milestones,
  can_manage_stage_gates, can_manage_change_requests, can_manage_exceptions,
  can_manage_quality, can_manage_work_packages, can_manage_tranches, can_manage_lessons)
VALUES
  ('org_stakeholder', true, 'View-only access to all items in the organization', '#6B7280', 'Building2',
   false, false, false, false, true, false, false, false, false, false, false, false, false, false, false, false, false, false),
  ('programme_stakeholder', true, 'View-only access to assigned programmes', '#8B5CF6', 'Briefcase',
   false, false, false, false, true, false, false, false, false, false, false, false, false, false, false, false, false, false),
  ('project_stakeholder', true, 'View-only access to assigned projects', '#10B981', 'FolderKanban',
   false, false, false, false, true, false, false, false, false, false, false, false, false, false, false, false, false, false),
  ('product_stakeholder', true, 'View-only access to assigned products', '#F59E0B', 'Package',
   false, false, false, false, true, false, false, false, false, false, false, false, false, false, false, false, false, false)
ON CONFLICT (name) DO NOTHING;
