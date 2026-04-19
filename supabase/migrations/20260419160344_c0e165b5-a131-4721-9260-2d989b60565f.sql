
-- =========================================
-- SSO Configurations Table
-- =========================================
CREATE TABLE public.sso_configurations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  metadata_url TEXT,
  entity_id TEXT,
  acs_url TEXT,
  allowed_domains TEXT[] NOT NULL DEFAULT '{}',
  default_access_level TEXT NOT NULL DEFAULT 'viewer',
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT,
  provisioning_notes TEXT,
  requested_by UUID,
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  activated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT sso_status_check CHECK (status IN ('pending', 'active', 'rejected', 'disabled')),
  CONSTRAINT sso_default_access_check CHECK (default_access_level IN ('viewer', 'editor', 'manager'))
);

-- Only one active config per org
CREATE UNIQUE INDEX sso_configurations_one_active_per_org
  ON public.sso_configurations(organization_id)
  WHERE status = 'active';

CREATE INDEX sso_configurations_org_idx ON public.sso_configurations(organization_id);
CREATE INDEX sso_configurations_status_idx ON public.sso_configurations(status);

ALTER TABLE public.sso_configurations ENABLE ROW LEVEL SECURITY;

-- Helper: check if org is on a paid plan
CREATE OR REPLACE FUNCTION public.has_paid_plan(_org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM organization_subscriptions os
    JOIN subscription_plans sp ON sp.id = os.plan_id
    WHERE os.organization_id = _org_id
      AND os.status IN ('active', 'trialing')
      AND COALESCE(sp.price_monthly, 0) > 0
  );
$$;

-- RLS: Org admins on paid plans can request/view their SSO config
CREATE POLICY "Org admins can view their SSO config"
  ON public.sso_configurations FOR SELECT
  USING (
    has_org_access(auth.uid(), organization_id, 'admin')
    OR is_admin(auth.uid())
  );

CREATE POLICY "Org admins on paid plans can request SSO"
  ON public.sso_configurations FOR INSERT
  WITH CHECK (
    has_org_access(auth.uid(), organization_id, 'admin')
    AND has_paid_plan(organization_id)
    AND auth.uid() = requested_by
  );

CREATE POLICY "Platform admins can update SSO configs"
  ON public.sso_configurations FOR UPDATE
  USING (is_admin(auth.uid()));

CREATE POLICY "Platform admins can delete SSO configs"
  ON public.sso_configurations FOR DELETE
  USING (is_admin(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_sso_configurations_updated_at
  BEFORE UPDATE ON public.sso_configurations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================
-- Audit Log Table
-- =========================================
CREATE TABLE public.auth_audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type TEXT NOT NULL,
  event_category TEXT NOT NULL DEFAULT 'auth',
  user_id UUID,
  user_email TEXT,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  target_user_id UUID,
  target_entity_type TEXT,
  target_entity_id UUID,
  ip_address TEXT,
  user_agent TEXT,
  status TEXT NOT NULL DEFAULT 'success',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT audit_status_check CHECK (status IN ('success', 'failure', 'pending'))
);

CREATE INDEX auth_audit_log_user_idx ON public.auth_audit_log(user_id);
CREATE INDEX auth_audit_log_org_idx ON public.auth_audit_log(organization_id);
CREATE INDEX auth_audit_log_event_type_idx ON public.auth_audit_log(event_type);
CREATE INDEX auth_audit_log_category_idx ON public.auth_audit_log(event_category);
CREATE INDEX auth_audit_log_created_idx ON public.auth_audit_log(created_at DESC);

ALTER TABLE public.auth_audit_log ENABLE ROW LEVEL SECURITY;

-- RLS: read-only for org admins (their org) and platform admins (all)
CREATE POLICY "Org admins can view org audit log"
  ON public.auth_audit_log FOR SELECT
  USING (
    is_admin(auth.uid())
    OR (organization_id IS NOT NULL AND has_org_access(auth.uid(), organization_id, 'admin'))
    OR auth.uid() = user_id
  );

-- Inserts only via security-definer function — no direct user inserts
-- (No INSERT policy = no direct inserts allowed)

-- Helper function to log audit events safely
CREATE OR REPLACE FUNCTION public.log_audit_event(
  _event_type TEXT,
  _event_category TEXT DEFAULT 'auth',
  _organization_id UUID DEFAULT NULL,
  _target_user_id UUID DEFAULT NULL,
  _target_entity_type TEXT DEFAULT NULL,
  _target_entity_id UUID DEFAULT NULL,
  _status TEXT DEFAULT 'success',
  _metadata JSONB DEFAULT '{}'::jsonb,
  _ip_address TEXT DEFAULT NULL,
  _user_agent TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _log_id UUID;
  _user_id UUID;
  _user_email TEXT;
BEGIN
  _user_id := auth.uid();

  IF _user_id IS NOT NULL THEN
    SELECT email INTO _user_email FROM profiles WHERE user_id = _user_id LIMIT 1;
  END IF;

  INSERT INTO auth_audit_log (
    event_type, event_category, user_id, user_email, organization_id,
    target_user_id, target_entity_type, target_entity_id,
    ip_address, user_agent, status, metadata
  ) VALUES (
    _event_type, _event_category, _user_id, _user_email, _organization_id,
    _target_user_id, _target_entity_type, _target_entity_id,
    _ip_address, _user_agent, _status, _metadata
  )
  RETURNING id INTO _log_id;

  RETURN _log_id;
END;
$$;

-- Helper: look up active SSO config by email domain (for SAML auto-provisioning logic)
CREATE OR REPLACE FUNCTION public.get_org_sso_config_by_domain(_email TEXT)
RETURNS TABLE(
  organization_id UUID,
  organization_name TEXT,
  default_access_level TEXT,
  sso_config_id UUID
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    sc.organization_id,
    o.name AS organization_name,
    sc.default_access_level,
    sc.id AS sso_config_id
  FROM sso_configurations sc
  JOIN organizations o ON o.id = sc.organization_id
  WHERE sc.status = 'active'
    AND lower(split_part(_email, '@', 2)) = ANY(
      SELECT lower(unnest(sc.allowed_domains))
    )
  LIMIT 1;
$$;
