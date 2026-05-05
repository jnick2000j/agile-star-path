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

    UPDATE public.user_organization_access
    SET access_level = 'admin',
        is_disabled = false,
        disabled_at = NULL,
        disabled_by = NULL,
        disabled_reason = NULL
    WHERE user_id = _user_id AND organization_id = _org_id;

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

  INSERT INTO public.user_organization_access (user_id, organization_id, access_level, is_disabled)
  VALUES (_user_id, _org_id, 'admin', false)
  ON CONFLICT (user_id, organization_id)
  DO UPDATE SET access_level = 'admin',
                is_disabled = false,
                disabled_at = NULL,
                disabled_by = NULL,
                disabled_reason = NULL;

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