CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _email_domain text;
  _sso_config record;
  _provider text;
  _providers jsonb;
  _is_sso_login boolean;
BEGIN
  INSERT INTO public.profiles (user_id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', split_part(NEW.email, '@', 1)),
    'stakeholder'
  )
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'stakeholder')
  ON CONFLICT DO NOTHING;

  _provider := COALESCE(NEW.raw_app_meta_data ->> 'provider', 'email');
  _providers := COALESCE(NEW.raw_app_meta_data -> 'providers', '[]'::jsonb);
  _is_sso_login := _provider IN ('sso', 'saml', 'oidc') OR _providers ? 'sso' OR _providers ? 'saml' OR _providers ? 'oidc';

  IF NEW.email IS NOT NULL AND _is_sso_login THEN
    _email_domain := lower(split_part(NEW.email, '@', 2));

    SELECT sc.id, sc.organization_id, sc.default_access_level, sc.provider_type
      INTO _sso_config
      FROM public.sso_configurations sc
     WHERE sc.status = 'active'
       AND _email_domain = ANY(SELECT lower(unnest(sc.allowed_domains)))
     LIMIT 1;

    IF _sso_config.organization_id IS NOT NULL THEN
      INSERT INTO public.user_organization_access (user_id, organization_id, access_level)
      VALUES (NEW.id, _sso_config.organization_id, _sso_config.default_access_level)
      ON CONFLICT (user_id, organization_id) DO NOTHING;

      UPDATE public.profiles
         SET default_organization_id = _sso_config.organization_id
       WHERE user_id = NEW.id
         AND default_organization_id IS NULL;

      INSERT INTO public.sso_jit_provisioning_log
        (organization_id, user_id, email, email_domain, provider, sso_config_id, access_level_granted, status, metadata)
      VALUES
        (_sso_config.organization_id, NEW.id, NEW.email, _email_domain, _provider,
         _sso_config.id, _sso_config.default_access_level, 'success',
         jsonb_build_object('provider_type', _sso_config.provider_type));
    END IF;
  END IF;

  RETURN NEW;
EXCEPTION WHEN others THEN
  RETURN NEW;
END;
$$;