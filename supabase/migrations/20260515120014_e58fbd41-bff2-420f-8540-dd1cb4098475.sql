CREATE OR REPLACE FUNCTION public.platform_admin_create_organization(
  _org_name text,
  _industry_vertical text DEFAULT NULL,
  _join_as_admin boolean DEFAULT true
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _caller uuid;
  _org_id uuid;
  _slug text;
  _normalized text;
  _existing_name text;
BEGIN
  _caller := auth.uid();

  IF _caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.has_role(_caller, 'admin') THEN
    RAISE EXCEPTION 'Only platform administrators can create organizations';
  END IF;

  IF _org_name IS NULL OR length(trim(_org_name)) = 0 THEN
    RAISE EXCEPTION 'Organization name is required';
  END IF;

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

  INSERT INTO public.organizations (name, slug, created_by, industry_vertical)
  VALUES (_org_name, _slug, _caller, _industry_vertical)
  RETURNING id INTO _org_id;

  INSERT INTO public.branding_settings (organization_id)
  VALUES (_org_id)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.organization_subscriptions (organization_id, status)
  VALUES (_org_id, 'trialing')
  ON CONFLICT (organization_id) DO NOTHING;

  IF _join_as_admin THEN
    INSERT INTO public.user_organization_access (user_id, organization_id, access_level, is_disabled)
    VALUES (_caller, _org_id, 'admin', false)
    ON CONFLICT (user_id, organization_id)
    DO UPDATE SET access_level = 'admin',
                  is_disabled = false,
                  disabled_at = NULL,
                  disabled_by = NULL,
                  disabled_reason = NULL;

    PERFORM public.ensure_org_admin_role_for_user(_caller, _org_id);
  END IF;

  RETURN _org_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.platform_admin_create_organization(text, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.platform_admin_create_organization(text, text, boolean) TO authenticated;