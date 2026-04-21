
-- 1. Suspension columns on organizations
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS is_suspended boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS suspended_at timestamptz,
  ADD COLUMN IF NOT EXISTS suspended_reason text,
  ADD COLUMN IF NOT EXISTS suspended_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS suspension_kind text;

ALTER TABLE public.organizations
  DROP CONSTRAINT IF EXISTS organizations_suspension_kind_check;
ALTER TABLE public.organizations
  ADD CONSTRAINT organizations_suspension_kind_check
  CHECK (suspension_kind IS NULL OR suspension_kind IN ('non_payment','admin_action','license_expired','security','other'));

CREATE INDEX IF NOT EXISTS idx_organizations_suspended ON public.organizations(is_suspended) WHERE is_suspended = true;

-- 2. Lightweight helper to check suspension
CREATE OR REPLACE FUNCTION public.is_org_suspended(_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT is_suspended FROM public.organizations WHERE id = _org_id), false);
$$;

-- 3. RPC: platform admin suspends or reinstates an organization
CREATE OR REPLACE FUNCTION public.set_organization_suspension(
  _org_id uuid,
  _suspend boolean,
  _kind text DEFAULT NULL,
  _reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _caller uuid := auth.uid();
BEGIN
  IF NOT public.is_admin(_caller) THEN
    RAISE EXCEPTION 'Only platform administrators can change organization suspension state';
  END IF;

  IF _suspend THEN
    UPDATE public.organizations
       SET is_suspended    = true,
           suspended_at    = now(),
           suspended_by    = _caller,
           suspension_kind = COALESCE(_kind, 'admin_action'),
           suspended_reason = _reason
     WHERE id = _org_id;
  ELSE
    UPDATE public.organizations
       SET is_suspended     = false,
           suspended_at     = NULL,
           suspended_by     = NULL,
           suspension_kind  = NULL,
           suspended_reason = NULL
     WHERE id = _org_id;
  END IF;

  PERFORM public.log_audit_event(
    CASE WHEN _suspend THEN 'organization.suspended' ELSE 'organization.reinstated' END,
    'platform',
    _org_id,
    NULL, 'organization', _org_id,
    'success',
    jsonb_build_object('kind', _kind, 'reason', _reason)
  );

  RETURN jsonb_build_object(
    'organization_id', _org_id,
    'is_suspended', _suspend,
    'changed_by', _caller,
    'at', now()
  );
END;
$$;

-- 4. RPC: platform admin updates a license status
CREATE OR REPLACE FUNCTION public.set_license_status(
  _license_id uuid,
  _status text,
  _reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _caller uuid := auth.uid();
  _row public.organization_licenses;
BEGIN
  IF NOT public.is_admin(_caller) THEN
    RAISE EXCEPTION 'Only platform administrators can change license status';
  END IF;
  IF _status NOT IN ('active','suspended','expired','revoked') THEN
    RAISE EXCEPTION 'Invalid status: %', _status;
  END IF;

  UPDATE public.organization_licenses
     SET status = _status,
         notes  = COALESCE(notes,'') || CASE WHEN _reason IS NULL THEN '' ELSE E'\n[' || now()::text || '] ' || _status || ': ' || _reason END
   WHERE id = _license_id
   RETURNING * INTO _row;

  IF _row.id IS NULL THEN
    RAISE EXCEPTION 'License % not found', _license_id;
  END IF;

  PERFORM public.log_audit_event(
    'license.status_changed',
    'platform',
    _row.organization_id,
    NULL, 'license', _license_id,
    'success',
    jsonb_build_object('new_status', _status, 'reason', _reason)
  );

  RETURN jsonb_build_object('license_id', _license_id, 'status', _status);
END;
$$;
