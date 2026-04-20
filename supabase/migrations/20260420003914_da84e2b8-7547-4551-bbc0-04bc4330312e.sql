-- ============================================================
-- Phase 1: Granular RBAC Foundation
-- ============================================================

-- 1. Add new top-level permission flags to custom_roles
ALTER TABLE public.custom_roles
  ADD COLUMN IF NOT EXISTS can_draft_with_ai      boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_approve_ai_output  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_view_ai_advisor    boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_manage_translations boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_manage_regions     boolean NOT NULL DEFAULT false;

-- 2. Catalog of modules (single source of truth for the Role Builder UI)
CREATE TABLE IF NOT EXISTS public.permission_modules (
  module_key   text PRIMARY KEY,
  label        text NOT NULL,
  category     text NOT NULL,
  description  text,
  sort_order   int  NOT NULL DEFAULT 100,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.permission_modules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permission modules readable by all authenticated"
  ON public.permission_modules FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only admins can manage permission modules"
  ON public.permission_modules FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

INSERT INTO public.permission_modules (module_key, label, category, description, sort_order) VALUES
  ('programmes',        'Programmes',           'Core',        'Programme lifecycle management',                10),
  ('projects',          'Projects',             'Core',        'Project lifecycle management',                  20),
  ('products',          'Products',             'Core',        'Product lifecycle management',                  30),
  ('work_packages',     'Work Packages',        'Core',        'Work package planning and delivery',            40),
  ('tranches',          'Tranches',             'Core',        'Programme tranche planning',                    50),
  ('milestones',        'Milestones',           'Governance',  'Milestones and stage boundaries',               60),
  ('stage_gates',       'Stage Gates',          'Governance',  'Go/no-go decision points',                      70),
  ('change_requests',   'Change Requests',      'Governance',  'Change control workflow',                       80),
  ('exceptions',        'Exceptions',           'Governance',  'Exception lifecycle management',                90),
  ('quality',           'Quality',              'Governance',  'Quality reviews and approvals',                100),
  ('risks',             'Risks',                'Registers',   'Risk register',                                110),
  ('issues',            'Issues',               'Registers',   'Issue register',                               120),
  ('benefits',          'Benefits',             'Registers',   'Benefits register and realisation',            130),
  ('stakeholders',      'Stakeholders',         'Registers',   'Stakeholder register and engagement',          140),
  ('requirements',      'Requirements',         'Registers',   'Business and technical requirements',          150),
  ('lessons',           'Lessons Learned',      'Registers',   'Lessons learned log',                          160),
  ('tasks',             'Tasks',                'Delivery',    'Task management and assignments',              170),
  ('features',          'Features',             'Delivery',    'Product feature backlog',                      180),
  ('sprints',           'Sprints',              'Delivery',    'Sprint planning and execution',                190),
  ('timesheets',        'Timesheets',           'Delivery',    'Time tracking and approval',                   200),
  ('updates',           'Updates',              'Delivery',    'Status updates and reports',                   210),
  ('documents',         'Documents',            'Delivery',    'Document attachments',                         220),
  ('users',             'Users',                'Admin',       'User and access administration',               230),
  ('roles',             'Roles',                'Admin',       'Role and permission administration',           240),
  ('reports',           'Reports',              'Admin',       'Reports and analytics',                        250),
  ('branding',          'Branding',             'Admin',       'Organisation branding settings',               260),
  ('billing',           'Billing',              'Admin',       'Subscription and billing',                     270),
  ('ai_drafting',       'AI Drafting',          'AI',          'Use AI to draft content',                      280),
  ('ai_approval',       'AI Approval',          'AI',          'Approve AI-drafted content',                   290),
  ('ai_advisor',        'AI Advisor',           'AI',          'View AI recommendations',                      300),
  ('translations',      'Translations',         'Localisation','Manage content translations',                  310),
  ('regions',           'Regions & Compliance', 'Localisation','Manage region and residency settings',         320)
ON CONFLICT (module_key) DO NOTHING;

-- 3. Per-role module permissions (action-level CRUD)
CREATE TABLE IF NOT EXISTS public.role_module_permissions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id       uuid NOT NULL REFERENCES public.custom_roles(id) ON DELETE CASCADE,
  module_key    text NOT NULL REFERENCES public.permission_modules(module_key) ON DELETE CASCADE,
  can_view      boolean NOT NULL DEFAULT false,
  can_create    boolean NOT NULL DEFAULT false,
  can_edit      boolean NOT NULL DEFAULT false,
  can_delete    boolean NOT NULL DEFAULT false,
  can_approve   boolean NOT NULL DEFAULT false,
  can_export    boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (role_id, module_key)
);

ALTER TABLE public.role_module_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Role module permissions readable by authenticated"
  ON public.role_module_permissions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only admins can manage role module permissions"
  ON public.role_module_permissions FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_role_module_permissions_role  ON public.role_module_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_role_module_permissions_module ON public.role_module_permissions(module_key);

CREATE TRIGGER trg_role_module_permissions_updated_at
  BEFORE UPDATE ON public.role_module_permissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Optional field-level permissions (hide/lock specific fields per role)
CREATE TABLE IF NOT EXISTS public.role_field_permissions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id     uuid NOT NULL REFERENCES public.custom_roles(id) ON DELETE CASCADE,
  module_key  text NOT NULL REFERENCES public.permission_modules(module_key) ON DELETE CASCADE,
  field_name  text NOT NULL,
  visibility  text NOT NULL DEFAULT 'visible'
              CHECK (visibility IN ('visible','readonly','hidden')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (role_id, module_key, field_name)
);

ALTER TABLE public.role_field_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Role field permissions readable by authenticated"
  ON public.role_field_permissions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only admins can manage role field permissions"
  ON public.role_field_permissions FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_role_field_permissions_role ON public.role_field_permissions(role_id);

-- 5. Backfill: seed role_module_permissions from existing custom_roles boolean columns
INSERT INTO public.role_module_permissions (role_id, module_key, can_view, can_create, can_edit, can_delete, can_approve, can_export)
SELECT
  r.id,
  m.key,
  COALESCE((row_to_json(r) ->> m.col)::boolean, false) AS can_view,
  COALESCE((row_to_json(r) ->> m.col)::boolean, false) AS can_create,
  COALESCE((row_to_json(r) ->> m.col)::boolean, false) AS can_edit,
  CASE WHEN r.name = 'Administrator' THEN true ELSE false END AS can_delete,
  CASE WHEN r.name = 'Administrator' THEN true ELSE false END AS can_approve,
  COALESCE((row_to_json(r) ->> m.col)::boolean, false) AS can_export
FROM public.custom_roles r
CROSS JOIN (VALUES
  ('programmes',      'can_manage_programmes'),
  ('projects',        'can_manage_projects'),
  ('products',        'can_manage_products'),
  ('users',           'can_manage_users'),
  ('reports',         'can_view_reports'),
  ('risks',           'can_manage_risks'),
  ('issues',          'can_manage_issues'),
  ('benefits',        'can_manage_benefits'),
  ('stakeholders',    'can_manage_stakeholders'),
  ('requirements',    'can_manage_requirements'),
  ('milestones',      'can_manage_milestones'),
  ('stage_gates',     'can_manage_stage_gates'),
  ('change_requests', 'can_manage_change_requests'),
  ('exceptions',      'can_manage_exceptions'),
  ('quality',         'can_manage_quality'),
  ('work_packages',   'can_manage_work_packages'),
  ('tranches',        'can_manage_tranches'),
  ('lessons',         'can_manage_lessons')
) AS m(key, col)
ON CONFLICT (role_id, module_key) DO NOTHING;

-- Ensure Administrator gets full access to every module (incl. new AI/i18n/region modules)
INSERT INTO public.role_module_permissions (role_id, module_key, can_view, can_create, can_edit, can_delete, can_approve, can_export)
SELECT r.id, pm.module_key, true, true, true, true, true, true
FROM public.custom_roles r
CROSS JOIN public.permission_modules pm
WHERE r.name = 'Administrator'
ON CONFLICT (role_id, module_key)
DO UPDATE SET
  can_view = true, can_create = true, can_edit = true,
  can_delete = true, can_approve = true, can_export = true;

-- Flip the new top-level booleans on Administrator
UPDATE public.custom_roles
   SET can_draft_with_ai = true,
       can_approve_ai_output = true,
       can_view_ai_advisor = true,
       can_manage_translations = true,
       can_manage_regions = true
 WHERE name = 'Administrator';

-- 6. Security definer helper used by app + future RLS
CREATE OR REPLACE FUNCTION public.has_module_permission(
  _user_id uuid,
  _module_key text,
  _action text DEFAULT 'view'
) RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _allowed boolean := false;
  _role_name text;
BEGIN
  IF public.is_admin(_user_id) THEN
    RETURN true;
  END IF;

  -- Map the user's profile role (string) to a custom_roles row
  SELECT role::text INTO _role_name
  FROM public.profiles
  WHERE user_id = _user_id
  LIMIT 1;

  IF _role_name IS NULL THEN
    RETURN false;
  END IF;

  EXECUTE format('SELECT COALESCE(bool_or(rmp.%I), false)
                  FROM public.role_module_permissions rmp
                  JOIN public.custom_roles cr ON cr.id = rmp.role_id
                  WHERE cr.name = $1 AND rmp.module_key = $2',
                 'can_' || _action)
    INTO _allowed
    USING _role_name, _module_key;

  RETURN COALESCE(_allowed, false);
EXCEPTION
  WHEN others THEN
    RETURN false;
END;
$$;

-- 7. AI audit log (used by Phase 2 but created now so RBAC checks can reference it)
CREATE TABLE IF NOT EXISTS public.ai_audit_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id         uuid,
  action_type     text NOT NULL,
  entity_type     text,
  entity_id       uuid,
  model           text,
  prompt_version  text,
  prompt_summary  text,
  output_summary  text,
  status          text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','approved','rejected','auto_applied')),
  reviewed_by     uuid,
  reviewed_at     timestamptz,
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view their AI audit log"
  ON public.ai_audit_log FOR SELECT
  TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR (organization_id IS NOT NULL AND public.has_org_access(auth.uid(), organization_id, 'viewer'))
  );

CREATE POLICY "Authenticated users can insert AI audit entries for their org"
  ON public.ai_audit_log FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (
      organization_id IS NULL
      OR public.has_org_access(auth.uid(), organization_id, 'viewer')
    )
  );

CREATE POLICY "Approvers can update AI audit entries"
  ON public.ai_audit_log FOR UPDATE
  TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR public.has_module_permission(auth.uid(), 'ai_approval', 'approve')
  )
  WITH CHECK (
    public.is_admin(auth.uid())
    OR public.has_module_permission(auth.uid(), 'ai_approval', 'approve')
  );

CREATE INDEX IF NOT EXISTS idx_ai_audit_log_org    ON public.ai_audit_log(organization_id);
CREATE INDEX IF NOT EXISTS idx_ai_audit_log_status ON public.ai_audit_log(status);
CREATE INDEX IF NOT EXISTS idx_ai_audit_log_entity ON public.ai_audit_log(entity_type, entity_id);