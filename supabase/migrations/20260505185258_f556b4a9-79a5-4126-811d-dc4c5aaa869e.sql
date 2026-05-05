-- Update create_org_for_new_user to reject duplicate or near-duplicate organization names.
-- Normalisation: lowercase, strip non-alphanumerics. Two names collide when their normalised form matches.

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
  _normalized text;
  _existing_name text;
BEGIN
  _user_id := auth.uid();

  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Re-use existing org for this user if they already created one.
  SELECT uoa.organization_id INTO _org_id
  FROM public.user_organization_access uoa
  JOIN public.organizations o ON o.id = uoa.organization_id
  WHERE uoa.user_id = _user_id
    AND o.created_by = _user_id
  ORDER BY uoa.created_at NULLS LAST
  LIMIT 1;

  IF _org_id IS NOT NULL THEN
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

  -- Duplicate / similar name guard
  _normalized := lower(regexp_replace(trim(_org_name), '[^a-zA-Z0-9]+', '', 'g'));

  IF _normalized = '' THEN
    RAISE EXCEPTION 'Organization name must contain letters or numbers';
  END IF;

  SELECT name INTO _existing_name
  FROM public.organizations
  WHERE lower(regexp_replace(trim(name), '[^a-zA-Z0-9]+', '', 'g')) = _normalized
  LIMIT 1;

  IF _existing_name IS NOT NULL THEN
    RAISE EXCEPTION 'An organization with a similar name already exists: "%". Please choose a different name.', _existing_name
      USING ERRCODE = 'unique_violation';
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

  INSERT INTO public.organization_subscriptions (organization_id, status)
  VALUES (_org_id, 'trialing')
  ON CONFLICT (organization_id) DO NOTHING;

  RETURN _org_id;
END;
$function$;