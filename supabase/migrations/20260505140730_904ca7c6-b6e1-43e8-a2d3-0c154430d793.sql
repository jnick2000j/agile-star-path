
-- =========================================================================
-- 1. Seed Org Viewer / Editor / Admin built-in roles
-- =========================================================================
INSERT INTO public.custom_roles (name, description, is_system, color, icon)
VALUES
  ('Org Viewer', 'Read-only access to the organization. Mirrors access_level=viewer.', true, '#64748b', 'Eye'),
  ('Org Editor', 'Can create and edit operational records in the organization. Mirrors access_level=editor.', true, '#0ea5e9', 'PencilLine'),
  ('Org Admin',  'Full administrative control of the organization (settings, members, billing). Mirrors access_level=admin.', true, '#ef4444', 'ShieldCheck')
ON CONFLICT (name) DO UPDATE
  SET description = EXCLUDED.description,
      is_system = true;

-- =========================================================================
-- 2. Collapse access_level: manager + owner -> admin (everywhere)
-- =========================================================================
UPDATE public.user_organization_access SET access_level = 'admin'
  WHERE access_level IN ('manager', 'owner');
UPDATE public.user_programme_access    SET access_level = 'admin'
  WHERE access_level IN ('manager', 'owner');
UPDATE public.user_project_access      SET access_level = 'admin'
  WHERE access_level IN ('manager', 'owner');
UPDATE public.user_product_access      SET access_level = 'admin'
  WHERE access_level IN ('manager', 'owner');

-- =========================================================================
-- 3. Add profiles.job_title (display-only persona)
-- =========================================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS job_title text;

-- Seed it from the existing app_role label for users who don't already have one.
UPDATE public.profiles
   SET job_title = CASE role::text
        WHEN 'admin'                  THEN 'Administrator'
        WHEN 'org_admin'              THEN 'Organization Admin'
        WHEN 'programme_owner'        THEN 'Programme Owner'
        WHEN 'project_manager'        THEN 'Project Manager'
        WHEN 'product_manager'        THEN 'Product Manager'
        WHEN 'product_team_member'    THEN 'Product Team Member'
        WHEN 'project_team_member'    THEN 'Project Team Member'
        WHEN 'org_stakeholder'        THEN 'Organization Stakeholder'
        WHEN 'programme_stakeholder'  THEN 'Programme Stakeholder'
        WHEN 'project_stakeholder'    THEN 'Project Stakeholder'
        WHEN 'product_stakeholder'    THEN 'Product Stakeholder'
        WHEN 'stakeholder'            THEN 'Stakeholder'
        ELSE NULL
      END
 WHERE job_title IS NULL
   AND role IS NOT NULL;

COMMENT ON COLUMN public.profiles.job_title IS
  'Free-text display title (persona). NOT a security primitive — does not grant any permission. Replaces the previous use of profiles.role for UI labels.';
COMMENT ON COLUMN public.profiles.role IS
  'DEPRECATED as a security primitive. Retained for backwards compatibility only. Use user_organization_access.access_level + user_organization_custom_roles for permissions, and profiles.job_title for display.';

-- =========================================================================
-- 4. Rewrite the 7 RLS policies that still use has_role(uid, 'admin'::app_role)
--    Replace with org-scoped admin checks (is_admin OR has_org_access admin).
-- =========================================================================

-- email_trigger_settings (org-scoped)
DROP POLICY IF EXISTS "Org admins can view email trigger settings"   ON public.email_trigger_settings;
DROP POLICY IF EXISTS "Org admins can update email trigger settings" ON public.email_trigger_settings;
DROP POLICY IF EXISTS "Org admins can delete email trigger settings" ON public.email_trigger_settings;

CREATE POLICY "Org admins can view email trigger settings"
ON public.email_trigger_settings FOR SELECT
USING (is_admin(auth.uid()) OR has_org_access(auth.uid(), organization_id, 'admin'));

CREATE POLICY "Org admins can update email trigger settings"
ON public.email_trigger_settings FOR UPDATE
USING (is_admin(auth.uid()) OR has_org_access(auth.uid(), organization_id, 'admin'));

CREATE POLICY "Org admins can delete email trigger settings"
ON public.email_trigger_settings FOR DELETE
USING (is_admin(auth.uid()) OR has_org_access(auth.uid(), organization_id, 'admin'));

-- helpdesk_macros (creator OR org admin)
DROP POLICY IF EXISTS "Creators or admins can update macros" ON public.helpdesk_macros;
DROP POLICY IF EXISTS "Creators or admins can delete macros" ON public.helpdesk_macros;

CREATE POLICY "Creators or admins can update macros"
ON public.helpdesk_macros FOR UPDATE
USING (
  is_org_member(auth.uid(), organization_id)
  AND (created_by = auth.uid()
       OR is_admin(auth.uid())
       OR has_org_access(auth.uid(), organization_id, 'admin'))
);

CREATE POLICY "Creators or admins can delete macros"
ON public.helpdesk_macros FOR DELETE
USING (
  is_org_member(auth.uid(), organization_id)
  AND (created_by = auth.uid()
       OR is_admin(auth.uid())
       OR has_org_access(auth.uid(), organization_id, 'admin'))
);

-- helpdesk_sla_escalation_rules (org admin only)
DROP POLICY IF EXISTS "Admins can update escalation rules" ON public.helpdesk_sla_escalation_rules;
DROP POLICY IF EXISTS "Admins can delete escalation rules" ON public.helpdesk_sla_escalation_rules;

CREATE POLICY "Admins can update escalation rules"
ON public.helpdesk_sla_escalation_rules FOR UPDATE
USING (
  is_org_member(auth.uid(), organization_id)
  AND (is_admin(auth.uid()) OR has_org_access(auth.uid(), organization_id, 'admin'))
);

CREATE POLICY "Admins can delete escalation rules"
ON public.helpdesk_sla_escalation_rules FOR DELETE
USING (
  is_org_member(auth.uid(), organization_id)
  AND (is_admin(auth.uid()) OR has_org_access(auth.uid(), organization_id, 'admin'))
);
