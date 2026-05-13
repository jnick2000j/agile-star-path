-- Add default custom roles to SSO config and update JIT trigger to assign them + populate first/last name

ALTER TABLE public.sso_configurations
  ADD COLUMN IF NOT EXISTS default_custom_role_ids uuid[] NOT NULL DEFAULT '{}';

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _email_domain text;
  _sso_config record;
  _provider text;
  _providers jsonb;
  _is_sso_login boolean;
  _attr jsonb;
  _first_name text;
  _last_name text;
  _full_name text;
  _role_id uuid;
BEGIN
  _full_name := COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name', split_part(NEW.email, '@', 1));
  _first_name := NULLIF(NEW.raw_user_meta_data ->> 'first_name', '');
  _last_name := NULLIF(NEW.raw_user_meta_data ->> 'last_name', '');

  INSERT INTO public.profiles (user_id, email, full_name, first_name, last_name, role)
  VALUES (NEW.id, NEW.email, _full_name, _first_name, _last_name, 'stakeholder')
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'stakeholder')
  ON CONFLICT DO NOTHING;

  _provider := COALESCE(NEW.raw_app_meta_data ->> 'provider', 'email');
  _providers := COALESCE(NEW.raw_app_meta_data -> 'providers', '[]'::jsonb);
  _is_sso_login := _provider IN ('sso', 'saml', 'oidc') OR _providers ? 'sso' OR _providers ? 'saml' OR _providers ? 'oidc';

  IF NEW.email IS NOT NULL AND _is_sso_login THEN
    _email_domain := lower(split_part(NEW.email, '@', 2));

    SELECT sc.id, sc.organization_id, sc.default_access_level, sc.provider_type,
           sc.default_custom_role_ids, sc.attribute_mapping
      INTO _sso_config
      FROM public.sso_configurations sc
     WHERE sc.status = 'active'
       AND _email_domain = ANY(SELECT lower(unnest(sc.allowed_domains)))
     LIMIT 1;

    IF _sso_config.organization_id IS NOT NULL THEN
      -- Apply attribute mapping for first/last name from SSO claims if not already set
      _attr := COALESCE(_sso_config.attribute_mapping, '{}'::jsonb);
      IF _first_name IS NULL THEN
        _first_name := NULLIF(NEW.raw_user_meta_data ->> COALESCE(_attr ->> 'first_name', 'first_name'), '');
      END IF;
      IF _last_name IS NULL THEN
        _last_name := NULLIF(NEW.raw_user_meta_data ->> COALESCE(_attr ->> 'last_name', 'last_name'), '');
      END IF;

      UPDATE public.profiles
         SET default_organization_id = COALESCE(default_organization_id, _sso_config.organization_id),
             first_name = COALESCE(first_name, _first_name),
             last_name = COALESCE(last_name, _last_name)
       WHERE user_id = NEW.id;

      INSERT INTO public.user_organization_access (user_id, organization_id, access_level)
      VALUES (NEW.id, _sso_config.organization_id, _sso_config.default_access_level)
      ON CONFLICT (user_id, organization_id) DO NOTHING;

      -- Auto-assign default custom roles configured on the SSO config
      IF _sso_config.default_custom_role_ids IS NOT NULL THEN
        FOREACH _role_id IN ARRAY _sso_config.default_custom_role_ids LOOP
          INSERT INTO public.user_organization_custom_roles (user_id, organization_id, custom_role_id)
          VALUES (NEW.id, _sso_config.organization_id, _role_id)
          ON CONFLICT DO NOTHING;
        END LOOP;
      END IF;

      INSERT INTO public.sso_jit_provisioning_log
        (organization_id, user_id, email, email_domain, provider, sso_config_id, access_level_granted, status, metadata)
      VALUES
        (_sso_config.organization_id, NEW.id, NEW.email, _email_domain, _provider,
         _sso_config.id, _sso_config.default_access_level, 'success',
         jsonb_build_object(
           'provider_type', _sso_config.provider_type,
           'custom_roles_granted', COALESCE(array_length(_sso_config.default_custom_role_ids, 1), 0)
         ));
    END IF;
  END IF;

  RETURN NEW;
EXCEPTION WHEN others THEN
  -- Log JIT failures but never block signup
  BEGIN
    IF _email_domain IS NOT NULL THEN
      INSERT INTO public.sso_jit_provisioning_log
        (organization_id, user_id, email, email_domain, provider, status, error_message)
      VALUES
        (COALESCE(_sso_config.organization_id, '00000000-0000-0000-0000-000000000000'::uuid),
         NEW.id, NEW.email, _email_domain, COALESCE(_provider, 'unknown'), 'error', SQLERRM);
    END IF;
  EXCEPTION WHEN others THEN NULL;
  END;
  RETURN NEW;
END;
$function$;