CREATE OR REPLACE FUNCTION public.create_org_for_new_user(_org_name text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _user_id uuid;
  _org_id uuid;
  _slug text;
  _plan_id uuid;
  _org_admin_role_id uuid;
BEGIN
  _user_id := auth.uid();

  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF EXISTS (SELECT 1 FROM user_organization_access WHERE user_id = _user_id) THEN
    SELECT organization_id INTO _org_id FROM user_organization_access WHERE user_id = _user_id LIMIT 1;
    RETURN _org_id;
  END IF;

  _slug := lower(regexp_replace(trim(_org_name), '[^a-zA-Z0-9]+', '-', 'g'));
  _slug := trim(both '-' from _slug);

  IF EXISTS (SELECT 1 FROM organizations WHERE slug = _slug) THEN
    _slug := _slug || '-' || substr(gen_random_uuid()::text, 1, 8);
  END IF;

  INSERT INTO organizations (name, slug, created_by)
  VALUES (_org_name, _slug, _user_id)
  RETURNING id INTO _org_id;

  INSERT INTO user_organization_access (user_id, organization_id, access_level)
  VALUES (_user_id, _org_id, 'admin');

  -- Promote the creator to org_admin so they get the in-app Admin Panel tab.
  UPDATE profiles
     SET default_organization_id = _org_id,
         role = 'org_admin'
   WHERE user_id = _user_id;

  -- Assign the system "Org Admin" custom role at the organization scope
  -- so the role-catalog-based RBAC helpers grant full rights.
  SELECT id INTO _org_admin_role_id
    FROM custom_roles
   WHERE is_system = true AND name = 'Org Admin'
   LIMIT 1;

  IF _org_admin_role_id IS NOT NULL THEN
    INSERT INTO user_organization_custom_roles (user_id, organization_id, custom_role_id, granted_by)
    VALUES (_user_id, _org_id, _org_admin_role_id, _user_id)
    ON CONFLICT DO NOTHING;
  END IF;

  SELECT id INTO _plan_id FROM subscription_plans WHERE name ILIKE '%free%' LIMIT 1;
  IF _plan_id IS NOT NULL THEN
    INSERT INTO organization_subscriptions (organization_id, plan_id, status)
    VALUES (_org_id, _plan_id, 'active');
  END IF;

  RETURN _org_id;
END;
$function$;