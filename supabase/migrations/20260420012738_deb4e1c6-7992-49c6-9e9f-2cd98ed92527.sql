-- 1. Add residency fields to organizations
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS data_region TEXT NOT NULL DEFAULT 'global',
  ADD COLUMN IF NOT EXISTS residency_enforcement TEXT NOT NULL DEFAULT 'warn',
  ADD COLUMN IF NOT EXISTS residency_locked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS residency_locked_by UUID,
  ADD COLUMN IF NOT EXISTS allow_cross_region_ai BOOLEAN NOT NULL DEFAULT true;

-- Constrain values
DO $$ BEGIN
  ALTER TABLE public.organizations
    ADD CONSTRAINT organizations_data_region_check
    CHECK (data_region IN ('global','eu','us','uk','apac','ca'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.organizations
    ADD CONSTRAINT organizations_residency_enforcement_check
    CHECK (residency_enforcement IN ('warn','block'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Residency audit log
CREATE TABLE IF NOT EXISTS public.residency_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID,
  operation TEXT NOT NULL,
  org_region TEXT NOT NULL,
  processing_region TEXT,
  decision TEXT NOT NULL CHECK (decision IN ('allowed','warned','blocked')),
  enforcement_mode TEXT NOT NULL CHECK (enforcement_mode IN ('warn','block')),
  resource_type TEXT,
  resource_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_residency_audit_org_created
  ON public.residency_audit_log(organization_id, created_at DESC);

ALTER TABLE public.residency_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org admins view residency audit" ON public.residency_audit_log;
CREATE POLICY "Org admins view residency audit"
  ON public.residency_audit_log FOR SELECT
  USING (public.has_org_access(auth.uid(), organization_id, 'admin'));

DROP POLICY IF EXISTS "Service can insert residency audit" ON public.residency_audit_log;
CREATE POLICY "Service can insert residency audit"
  ON public.residency_audit_log FOR INSERT
  WITH CHECK (true);

-- 3. Compliance attestations
CREATE TABLE IF NOT EXISTS public.compliance_attestations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  standard TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','expired','revoked','pending')),
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  expires_at DATE,
  evidence_url TEXT,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, standard)
);

ALTER TABLE public.compliance_attestations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members view attestations" ON public.compliance_attestations;
CREATE POLICY "Org members view attestations"
  ON public.compliance_attestations FOR SELECT
  USING (public.has_org_access(auth.uid(), organization_id, 'viewer'));

DROP POLICY IF EXISTS "Org admins manage attestations" ON public.compliance_attestations;
CREATE POLICY "Org admins manage attestations"
  ON public.compliance_attestations FOR ALL
  USING (public.has_org_access(auth.uid(), organization_id, 'admin'))
  WITH CHECK (public.has_org_access(auth.uid(), organization_id, 'admin'));

DROP TRIGGER IF EXISTS update_compliance_attestations_updated_at ON public.compliance_attestations;
CREATE TRIGGER update_compliance_attestations_updated_at
  BEFORE UPDATE ON public.compliance_attestations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Residency check helper
CREATE OR REPLACE FUNCTION public.check_residency_policy(
  _org_id UUID,
  _processing_region TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _org_region TEXT;
  _mode TEXT;
  _allow_cross BOOLEAN;
  _decision TEXT;
BEGIN
  SELECT data_region, residency_enforcement, allow_cross_region_ai
    INTO _org_region, _mode, _allow_cross
    FROM organizations WHERE id = _org_id;

  IF _org_region IS NULL OR _org_region = 'global' THEN
    RETURN jsonb_build_object('decision','allowed','org_region',COALESCE(_org_region,'global'),'enforcement_mode',COALESCE(_mode,'warn'));
  END IF;

  IF _processing_region IS NULL OR _processing_region = _org_region OR _allow_cross THEN
    _decision := CASE WHEN _processing_region = _org_region THEN 'allowed' ELSE 'warned' END;
  ELSE
    _decision := CASE WHEN _mode = 'block' THEN 'blocked' ELSE 'warned' END;
  END IF;

  RETURN jsonb_build_object(
    'decision', _decision,
    'org_region', _org_region,
    'enforcement_mode', _mode,
    'processing_region', _processing_region
  );
END;
$$;

-- 5. Lock guard trigger: once locked, only admins of the platform can change region
CREATE OR REPLACE FUNCTION public.guard_residency_lock()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.residency_locked_at IS NOT NULL
     AND NEW.data_region IS DISTINCT FROM OLD.data_region
     AND NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Data region is locked for this organization. Contact a platform administrator to change it.';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_guard_residency_lock ON public.organizations;
CREATE TRIGGER trg_guard_residency_lock
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.guard_residency_lock();