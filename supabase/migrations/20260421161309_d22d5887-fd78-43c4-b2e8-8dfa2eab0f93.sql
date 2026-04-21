-- ============================================================
-- PHASE 3 FOUNDATION
-- ============================================================

-- ---------- MFA ----------
CREATE TABLE public.user_mfa_factors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  factor_type text NOT NULL DEFAULT 'totp', -- totp | webauthn (future)
  friendly_name text,
  secret_encrypted text NOT NULL, -- base32 TOTP secret (server-side encrypted at rest)
  verified boolean NOT NULL DEFAULT false,
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, friendly_name)
);
CREATE INDEX idx_user_mfa_factors_user ON public.user_mfa_factors(user_id);
ALTER TABLE public.user_mfa_factors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users manage own mfa factors"
  ON public.user_mfa_factors
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "platform admins view all mfa factors"
  ON public.user_mfa_factors
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE TRIGGER trg_user_mfa_factors_updated
  BEFORE UPDATE ON public.user_mfa_factors
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.user_mfa_recovery_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  code_hash text NOT NULL, -- sha256 hex
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_user_mfa_recovery_user ON public.user_mfa_recovery_codes(user_id);
ALTER TABLE public.user_mfa_recovery_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users manage own recovery codes"
  ON public.user_mfa_recovery_codes
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE TABLE public.org_mfa_policies (
  organization_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  enforcement_mode text NOT NULL DEFAULT 'optional', -- optional | required_admins | required_all
  grace_period_days integer NOT NULL DEFAULT 7,
  allow_recovery_codes boolean NOT NULL DEFAULT true,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (enforcement_mode IN ('optional','required_admins','required_all'))
);
ALTER TABLE public.org_mfa_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members read mfa policy"
  ON public.org_mfa_policies
  FOR SELECT TO authenticated
  USING (public.has_org_access(auth.uid(), organization_id, 'viewer'));

CREATE POLICY "org admins write mfa policy"
  ON public.org_mfa_policies
  FOR ALL TO authenticated
  USING (public.has_org_access(auth.uid(), organization_id, 'admin'))
  WITH CHECK (public.has_org_access(auth.uid(), organization_id, 'admin'));

CREATE TRIGGER trg_org_mfa_policies_updated
  BEFORE UPDATE ON public.org_mfa_policies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------- Sessions & device mgmt ----------
CREATE TABLE public.user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  session_token_hash text NOT NULL UNIQUE,
  user_agent text,
  ip_address text,
  device_label text,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  revoked_by uuid,
  revoke_reason text
);
CREATE INDEX idx_user_sessions_user ON public.user_sessions(user_id) WHERE revoked_at IS NULL;
CREATE INDEX idx_user_sessions_org ON public.user_sessions(organization_id) WHERE revoked_at IS NULL;
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users view own sessions"
  ON public.user_sessions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "users revoke own sessions"
  ON public.user_sessions
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "org admins view org sessions"
  ON public.user_sessions
  FOR SELECT TO authenticated
  USING (organization_id IS NOT NULL AND public.has_org_access(auth.uid(), organization_id, 'admin'));

CREATE POLICY "org admins revoke org sessions"
  ON public.user_sessions
  FOR UPDATE TO authenticated
  USING (organization_id IS NOT NULL AND public.has_org_access(auth.uid(), organization_id, 'admin'))
  WITH CHECK (organization_id IS NOT NULL AND public.has_org_access(auth.uid(), organization_id, 'admin'));

CREATE TABLE public.org_session_policies (
  organization_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  idle_timeout_minutes integer NOT NULL DEFAULT 480,    -- 8h
  absolute_timeout_minutes integer NOT NULL DEFAULT 10080, -- 7d
  ip_allowlist text[] NOT NULL DEFAULT '{}',            -- CIDR strings
  enforce_ip_allowlist boolean NOT NULL DEFAULT false,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.org_session_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members read session policy"
  ON public.org_session_policies
  FOR SELECT TO authenticated
  USING (public.has_org_access(auth.uid(), organization_id, 'viewer'));

CREATE POLICY "org admins write session policy"
  ON public.org_session_policies
  FOR ALL TO authenticated
  USING (public.has_org_access(auth.uid(), organization_id, 'admin'))
  WITH CHECK (public.has_org_access(auth.uid(), organization_id, 'admin'));

CREATE TRIGGER trg_org_session_policies_updated
  BEFORE UPDATE ON public.org_session_policies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------- SIEM exporters ----------
CREATE TABLE public.siem_exporters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  destination_type text NOT NULL, -- webhook | s3 | datadog | splunk_hec
  endpoint_url text NOT NULL,
  auth_header_name text,
  auth_secret_name text, -- name of secret in vault (never store value)
  format text NOT NULL DEFAULT 'json', -- json | cef | leef
  event_categories text[] NOT NULL DEFAULT ARRAY['auth','sso','admin'],
  is_active boolean NOT NULL DEFAULT true,
  last_delivery_at timestamptz,
  last_delivery_status text,
  consecutive_failures integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (destination_type IN ('webhook','s3','datadog','splunk_hec')),
  CHECK (format IN ('json','cef','leef'))
);
CREATE INDEX idx_siem_exporters_org ON public.siem_exporters(organization_id);
ALTER TABLE public.siem_exporters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org admins manage siem exporters"
  ON public.siem_exporters
  FOR ALL TO authenticated
  USING (public.has_org_access(auth.uid(), organization_id, 'admin'))
  WITH CHECK (public.has_org_access(auth.uid(), organization_id, 'admin'));

CREATE TRIGGER trg_siem_exporters_updated
  BEFORE UPDATE ON public.siem_exporters
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.siem_export_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exporter_id uuid NOT NULL REFERENCES public.siem_exporters(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL,
  event_count integer NOT NULL DEFAULT 0,
  status text NOT NULL, -- success | failure | retry
  http_status integer,
  response_body text,
  attempt integer NOT NULL DEFAULT 1,
  duration_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_siem_export_log_exporter ON public.siem_export_log(exporter_id, created_at DESC);
ALTER TABLE public.siem_export_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org admins read siem export log"
  ON public.siem_export_log
  FOR SELECT TO authenticated
  USING (public.has_org_access(auth.uid(), organization_id, 'admin'));

-- ---------- SCIM full provisioning ----------
CREATE TABLE public.scim_group_role_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  scim_group_name text NOT NULL,
  access_level text NOT NULL, -- admin | manager | editor | viewer
  custom_role_id uuid REFERENCES public.custom_roles(id) ON DELETE SET NULL,
  priority integer NOT NULL DEFAULT 100,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, scim_group_name),
  CHECK (access_level IN ('admin','manager','editor','viewer'))
);
CREATE INDEX idx_scim_group_role_org ON public.scim_group_role_mappings(organization_id);
ALTER TABLE public.scim_group_role_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org admins manage scim mappings"
  ON public.scim_group_role_mappings
  FOR ALL TO authenticated
  USING (public.has_org_access(auth.uid(), organization_id, 'admin'))
  WITH CHECK (public.has_org_access(auth.uid(), organization_id, 'admin'));

CREATE TRIGGER trg_scim_mappings_updated
  BEFORE UPDATE ON public.scim_group_role_mappings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.scim_user_sync_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  external_id text NOT NULL,
  scim_username text,
  scim_groups text[] NOT NULL DEFAULT '{}',
  active boolean NOT NULL DEFAULT true,
  last_synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, external_id),
  UNIQUE (organization_id, user_id)
);
CREATE INDEX idx_scim_sync_org ON public.scim_user_sync_state(organization_id);
ALTER TABLE public.scim_user_sync_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org admins read scim sync state"
  ON public.scim_user_sync_state
  FOR SELECT TO authenticated
  USING (public.has_org_access(auth.uid(), organization_id, 'admin'));

CREATE TRIGGER trg_scim_sync_updated
  BEFORE UPDATE ON public.scim_user_sync_state
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------- Helper: resolve scim group → access level ----------
CREATE OR REPLACE FUNCTION public.resolve_scim_groups_to_access_level(
  _org_id uuid,
  _groups text[]
)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT access_level
    FROM scim_group_role_mappings
   WHERE organization_id = _org_id
     AND scim_group_name = ANY(_groups)
   ORDER BY
     CASE access_level
       WHEN 'admin'   THEN 1
       WHEN 'manager' THEN 2
       WHEN 'editor'  THEN 3
       WHEN 'viewer'  THEN 4
     END,
     priority ASC
   LIMIT 1;
$$;