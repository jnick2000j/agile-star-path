-- Phase 2: SSO foundation (SAML + OIDC + SCIM + JIT) — retry

DROP FUNCTION IF EXISTS public.get_org_sso_config_by_domain(text);

ALTER TABLE public.sso_configurations
  ADD COLUMN IF NOT EXISTS provider_type text NOT NULL DEFAULT 'saml',
  ADD COLUMN IF NOT EXISTS sso_config_id text,
  ADD COLUMN IF NOT EXISTS oidc_issuer_url text,
  ADD COLUMN IF NOT EXISTS oidc_client_id text,
  ADD COLUMN IF NOT EXISTS oidc_client_secret_name text,
  ADD COLUMN IF NOT EXISTS oidc_scopes text[] NOT NULL DEFAULT ARRAY['openid','email','profile'],
  ADD COLUMN IF NOT EXISTS domains_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS attribute_mapping jsonb NOT NULL DEFAULT '{
    "email": "email",
    "first_name": "first_name",
    "last_name": "last_name",
    "full_name": "full_name",
    "groups": "groups"
  }'::jsonb;

ALTER TABLE public.sso_configurations
  DROP CONSTRAINT IF EXISTS sso_provider_type_check;
ALTER TABLE public.sso_configurations
  ADD CONSTRAINT sso_provider_type_check CHECK (provider_type IN ('saml','oidc'));

-- Domain verifications
CREATE TABLE IF NOT EXISTS public.domain_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  domain text NOT NULL,
  verification_token text NOT NULL DEFAULT ('lovable-verify-' || encode(gen_random_bytes(16),'hex')),
  status text NOT NULL DEFAULT 'pending',
  verified_at timestamptz,
  last_checked_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, domain),
  CONSTRAINT domain_verification_status_check CHECK (status IN ('pending','verified','failed'))
);
CREATE INDEX IF NOT EXISTS domain_verifications_org_idx ON public.domain_verifications(organization_id);
CREATE INDEX IF NOT EXISTS domain_verifications_domain_idx ON public.domain_verifications(lower(domain));
ALTER TABLE public.domain_verifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org admins can view their domain verifications" ON public.domain_verifications;
CREATE POLICY "Org admins can view their domain verifications"
  ON public.domain_verifications FOR SELECT
  USING (public.has_org_access(auth.uid(), organization_id, 'admin') OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Org admins can create domain verifications" ON public.domain_verifications;
CREATE POLICY "Org admins can create domain verifications"
  ON public.domain_verifications FOR INSERT
  WITH CHECK (public.has_org_access(auth.uid(), organization_id, 'admin'));

DROP POLICY IF EXISTS "Org admins can update their domain verifications" ON public.domain_verifications;
CREATE POLICY "Org admins can update their domain verifications"
  ON public.domain_verifications FOR UPDATE
  USING (public.has_org_access(auth.uid(), organization_id, 'admin') OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Org admins can delete their domain verifications" ON public.domain_verifications;
CREATE POLICY "Org admins can delete their domain verifications"
  ON public.domain_verifications FOR DELETE
  USING (public.has_org_access(auth.uid(), organization_id, 'admin') OR public.is_admin(auth.uid()));

DROP TRIGGER IF EXISTS update_domain_verifications_updated_at ON public.domain_verifications;
CREATE TRIGGER update_domain_verifications_updated_at
  BEFORE UPDATE ON public.domain_verifications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- SCIM tokens
CREATE TABLE IF NOT EXISTS public.scim_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  token_hash text NOT NULL,
  token_prefix text NOT NULL,
  default_access_level text NOT NULL DEFAULT 'viewer',
  is_active boolean NOT NULL DEFAULT true,
  last_used_at timestamptz,
  expires_at timestamptz,
  created_by uuid,
  revoked_by uuid,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT scim_token_access_level_check CHECK (default_access_level IN ('viewer','editor','manager'))
);
CREATE INDEX IF NOT EXISTS scim_tokens_org_idx ON public.scim_tokens(organization_id);
CREATE INDEX IF NOT EXISTS scim_tokens_hash_idx ON public.scim_tokens(token_hash) WHERE is_active = true;
ALTER TABLE public.scim_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org admins can view their SCIM tokens" ON public.scim_tokens;
CREATE POLICY "Org admins can view their SCIM tokens"
  ON public.scim_tokens FOR SELECT
  USING (public.has_org_access(auth.uid(), organization_id, 'admin') OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Org admins can create SCIM tokens" ON public.scim_tokens;
CREATE POLICY "Org admins can create SCIM tokens"
  ON public.scim_tokens FOR INSERT
  WITH CHECK (public.has_org_access(auth.uid(), organization_id, 'admin'));

DROP POLICY IF EXISTS "Org admins can update their SCIM tokens" ON public.scim_tokens;
CREATE POLICY "Org admins can update their SCIM tokens"
  ON public.scim_tokens FOR UPDATE
  USING (public.has_org_access(auth.uid(), organization_id, 'admin') OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Org admins can delete their SCIM tokens" ON public.scim_tokens;
CREATE POLICY "Org admins can delete their SCIM tokens"
  ON public.scim_tokens FOR DELETE
  USING (public.has_org_access(auth.uid(), organization_id, 'admin') OR public.is_admin(auth.uid()));

DROP TRIGGER IF EXISTS update_scim_tokens_updated_at ON public.scim_tokens;
CREATE TRIGGER update_scim_tokens_updated_at
  BEFORE UPDATE ON public.scim_tokens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- JIT provisioning log
CREATE TABLE IF NOT EXISTS public.sso_jit_provisioning_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid,
  email text NOT NULL,
  email_domain text NOT NULL,
  provider text NOT NULL,
  sso_config_id uuid REFERENCES public.sso_configurations(id) ON DELETE SET NULL,
  access_level_granted text,
  status text NOT NULL DEFAULT 'success',
  error_message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sso_jit_log_org_idx ON public.sso_jit_provisioning_log(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS sso_jit_log_user_idx ON public.sso_jit_provisioning_log(user_id);
ALTER TABLE public.sso_jit_provisioning_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org admins can view JIT logs" ON public.sso_jit_provisioning_log;
CREATE POLICY "Org admins can view JIT logs"
  ON public.sso_jit_provisioning_log FOR SELECT
  USING (public.has_org_access(auth.uid(), organization_id, 'admin') OR public.is_admin(auth.uid()));

-- handle_new_user with JIT provisioning
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
BEGIN
  INSERT INTO public.profiles (user_id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', split_part(NEW.email, '@', 1)),
    'stakeholder'
  );

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'stakeholder');

  IF NEW.email IS NOT NULL THEN
    _email_domain := lower(split_part(NEW.email, '@', 2));
    _provider := COALESCE(NEW.raw_app_meta_data ->> 'provider', 'email');

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

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Replacement domain lookup with provider details
CREATE OR REPLACE FUNCTION public.get_org_sso_config_by_domain(_email text)
RETURNS TABLE(
  organization_id uuid,
  organization_name text,
  default_access_level text,
  sso_config_id uuid,
  provider_type text,
  saml_provider_id text,
  oidc_issuer_url text,
  oidc_client_id text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    sc.organization_id,
    o.name AS organization_name,
    sc.default_access_level,
    sc.id AS sso_config_id,
    sc.provider_type,
    sc.sso_config_id AS saml_provider_id,
    sc.oidc_issuer_url,
    sc.oidc_client_id
  FROM public.sso_configurations sc
  JOIN public.organizations o ON o.id = sc.organization_id
  WHERE sc.status = 'active'
    AND lower(split_part(_email, '@', 2)) = ANY(
      SELECT lower(unnest(sc.allowed_domains))
    )
  LIMIT 1;
$$;
