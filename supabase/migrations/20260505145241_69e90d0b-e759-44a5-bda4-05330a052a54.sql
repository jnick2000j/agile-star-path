-- 1) Backfill: every org-access admin gets the global "Org Admin" custom role for that org
INSERT INTO public.user_organization_custom_roles (user_id, organization_id, custom_role_id)
SELECT DISTINCT uoa.user_id, uoa.organization_id, cr.id
FROM public.user_organization_access uoa
CROSS JOIN public.custom_roles cr
WHERE uoa.access_level = 'admin'
  AND cr.name = 'Org Admin'
  AND cr.is_system = true
ON CONFLICT DO NOTHING;

-- 2) Backfill: legacy profiles.role -> matching system custom role in every org the user belongs to
WITH role_map(legacy, role_name) AS (
  VALUES
    ('org_admin'::text,            'Org Admin'),
    ('programme_owner',            'Org Admin'),
    ('project_manager',            'Org Editor'),
    ('product_manager',            'Org Editor'),
    ('product_team_member',        'Org Editor'),
    ('project_team_member',        'Org Editor'),
    ('org_stakeholder',            'Org Viewer'),
    ('programme_stakeholder',      'Org Viewer'),
    ('project_stakeholder',        'Org Viewer'),
    ('product_stakeholder',        'Org Viewer'),
    ('stakeholder',                'Org Viewer')
)
INSERT INTO public.user_organization_custom_roles (user_id, organization_id, custom_role_id)
SELECT DISTINCT p.user_id, uoa.organization_id, cr.id
FROM public.profiles p
JOIN role_map rm ON rm.legacy = p.role::text
JOIN public.user_organization_access uoa ON uoa.user_id = p.user_id
JOIN public.custom_roles cr
  ON cr.name = rm.role_name
 AND cr.is_system = true
WHERE p.role IS NOT NULL
ON CONFLICT DO NOTHING;

-- 3) Trigger: keep "Org Admin" custom role in sync with access_level='admin' grants
CREATE OR REPLACE FUNCTION public.sync_org_admin_custom_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.access_level = 'admin' THEN
    INSERT INTO public.user_organization_custom_roles (user_id, organization_id, custom_role_id)
    SELECT NEW.user_id, NEW.organization_id, cr.id
    FROM public.custom_roles cr
    WHERE cr.name = 'Org Admin'
      AND cr.is_system = true
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_org_admin_custom_role ON public.user_organization_access;
CREATE TRIGGER trg_sync_org_admin_custom_role
AFTER INSERT OR UPDATE OF access_level ON public.user_organization_access
FOR EACH ROW
EXECUTE FUNCTION public.sync_org_admin_custom_role();