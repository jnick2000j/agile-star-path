-- Bootstrap a platform admin on first boot.
-- The installer reads FIRST_ADMIN_EMAIL from the environment and substitutes
-- it here via gomplate / envsubst before psql runs the file.
-- After login the admin is expected to set their password and (optionally)
-- enable MFA from the Security Center.
DO $$
DECLARE
  _admin_email text := COALESCE(current_setting('app.first_admin_email', true), 'admin@local');
  _user_id uuid;
BEGIN
  -- This INSERT only succeeds on first boot; subsequent boots no-op.
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = _admin_email) THEN
    INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
    VALUES (gen_random_uuid(), _admin_email,
            crypt('changeme-' || substr(md5(random()::text), 1, 12), gen_salt('bf')),
            now(),
            jsonb_build_object('provider','email','providers',ARRAY['email']),
            jsonb_build_object('full_name','Platform Admin'))
    RETURNING id INTO _user_id;

    INSERT INTO public.user_roles (user_id, role) VALUES (_user_id, 'admin')
      ON CONFLICT DO NOTHING;

    RAISE NOTICE 'Bootstrap admin created: % — use the password reset flow on first login.', _admin_email;
  END IF;
END $$;
