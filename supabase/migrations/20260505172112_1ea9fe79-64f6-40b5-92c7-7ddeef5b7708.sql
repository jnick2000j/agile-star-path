CREATE OR REPLACE FUNCTION public.ensure_org_admin_role_for_user(_user_id uuid, _org_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _org_admin_role_id uuid;
BEGIN
  IF _user_id IS NULL OR _org_id IS NULL THEN
    RETURN;
  END IF;

  SELECT id INTO _org_admin_role_id
  FROM public.custom_roles
  WHERE is_system = true AND name = 'Org Admin'
  LIMIT 1;

  IF _org_admin_role_id IS NOT NULL THEN
    INSERT INTO public.user_organization_custom_roles (user_id, organization_id, custom_role_id, granted_by)
    VALUES (_user_id, _org_id, _org_admin_role_id, _user_id)
    ON CONFLICT DO NOTHING;
  END IF;

  INSERT INTO public.user_organization_access (user_id, organization_id, access_level)
  VALUES (_user_id, _org_id, 'admin')
  ON CONFLICT (user_id, organization_id)
  DO UPDATE SET access_level = 'admin';

  UPDATE public.profiles
  SET default_organization_id = COALESCE(default_organization_id, _org_id),
      role = CASE WHEN role = 'admin' THEN role ELSE 'org_admin' END
  WHERE user_id = _user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_org_admin_role_from_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.access_level IN ('admin', 'owner') THEN
    PERFORM public.ensure_org_admin_role_for_user(NEW.user_id, NEW.organization_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_org_admin_role_from_access ON public.user_organization_access;
CREATE TRIGGER trg_sync_org_admin_role_from_access
AFTER INSERT OR UPDATE OF access_level ON public.user_organization_access
FOR EACH ROW
WHEN (NEW.access_level IN ('admin', 'owner'))
EXECUTE FUNCTION public.sync_org_admin_role_from_access();

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
BEGIN
  _user_id := auth.uid();

  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF EXISTS (SELECT 1 FROM public.user_organization_access WHERE user_id = _user_id) THEN
    SELECT organization_id INTO _org_id
    FROM public.user_organization_access
    WHERE user_id = _user_id
    ORDER BY created_at NULLS LAST
    LIMIT 1;

    PERFORM public.ensure_org_admin_role_for_user(_user_id, _org_id);
    RETURN _org_id;
  END IF;

  _slug := lower(regexp_replace(trim(_org_name), '[^a-zA-Z0-9]+', '-', 'g'));
  _slug := trim(both '-' from _slug);

  IF _slug IS NULL OR _slug = '' THEN
    _slug := 'organization-' || substr(gen_random_uuid()::text, 1, 8);
  END IF;

  IF EXISTS (SELECT 1 FROM public.organizations WHERE slug = _slug) THEN
    _slug := _slug || '-' || substr(gen_random_uuid()::text, 1, 8);
  END IF;

  INSERT INTO public.organizations (name, slug, created_by)
  VALUES (_org_name, _slug, _user_id)
  RETURNING id INTO _org_id;

  PERFORM public.ensure_org_admin_role_for_user(_user_id, _org_id);

  SELECT id INTO _plan_id FROM public.subscription_plans WHERE name ILIKE '%free%' LIMIT 1;
  IF _plan_id IS NOT NULL THEN
    INSERT INTO public.organization_subscriptions (organization_id, plan_id, status)
    VALUES (_org_id, _plan_id, 'active')
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN _org_id;
END;
$function$;