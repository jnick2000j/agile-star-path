-- Audit log retention policy (per-org, with platform default)
CREATE TABLE IF NOT EXISTS public.audit_log_retention_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
  retention_days INTEGER NOT NULL DEFAULT 365 CHECK (retention_days >= 30 AND retention_days <= 2555),
  auto_purge_enabled BOOLEAN NOT NULL DEFAULT false,
  last_purged_at TIMESTAMPTZ,
  last_purged_count INTEGER DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_log_retention_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org admins manage their retention policy"
  ON public.audit_log_retention_policies FOR ALL
  USING (
    public.is_admin(auth.uid())
    OR (organization_id IS NOT NULL AND public.has_org_access(auth.uid(), organization_id, 'admin'))
  )
  WITH CHECK (
    public.is_admin(auth.uid())
    OR (organization_id IS NOT NULL AND public.has_org_access(auth.uid(), organization_id, 'admin'))
  );

CREATE POLICY "Platform admins manage default policy"
  ON public.audit_log_retention_policies FOR ALL
  USING (organization_id IS NULL AND public.is_admin(auth.uid()))
  WITH CHECK (organization_id IS NULL AND public.is_admin(auth.uid()));

CREATE TRIGGER audit_retention_updated_at
  BEFORE UPDATE ON public.audit_log_retention_policies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Effective retention (org override, else platform default, else 365)
CREATE OR REPLACE FUNCTION public.get_effective_retention_days(_org_id UUID)
RETURNS INTEGER
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT retention_days FROM audit_log_retention_policies WHERE organization_id = _org_id),
    (SELECT retention_days FROM audit_log_retention_policies WHERE organization_id IS NULL),
    365
  );
$$;

-- Purge function: deletes audit logs older than retention for orgs with auto-purge enabled
CREATE OR REPLACE FUNCTION public.purge_expired_audit_logs()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _policy RECORD;
  _deleted INTEGER;
  _total INTEGER := 0;
  _orgs_purged INTEGER := 0;
BEGIN
  FOR _policy IN
    SELECT organization_id, retention_days
      FROM audit_log_retention_policies
     WHERE auto_purge_enabled = true AND organization_id IS NOT NULL
  LOOP
    DELETE FROM auth_audit_log
     WHERE organization_id = _policy.organization_id
       AND created_at < now() - (_policy.retention_days || ' days')::INTERVAL;
    GET DIAGNOSTICS _deleted = ROW_COUNT;
    _total := _total + _deleted;
    _orgs_purged := _orgs_purged + 1;

    UPDATE audit_log_retention_policies
       SET last_purged_at = now(), last_purged_count = _deleted
     WHERE organization_id = _policy.organization_id;
  END LOOP;

  RETURN jsonb_build_object('orgs_purged', _orgs_purged, 'rows_deleted', _total, 'purged_at', now());
END;
$$;

-- Index to make retention purges and date-range queries fast
CREATE INDEX IF NOT EXISTS idx_auth_audit_log_org_created
  ON public.auth_audit_log(organization_id, created_at DESC);