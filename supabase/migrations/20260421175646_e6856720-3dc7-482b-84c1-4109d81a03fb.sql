-- Per-org user disable (org admin can disable a member without affecting other orgs they belong to)
ALTER TABLE public.user_organization_access
  ADD COLUMN IF NOT EXISTS is_disabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS disabled_at timestamptz,
  ADD COLUMN IF NOT EXISTS disabled_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS disabled_reason text;

CREATE INDEX IF NOT EXISTS idx_uoa_org_disabled
  ON public.user_organization_access(organization_id, is_disabled);

-- RPC: org admins (or platform admins) toggle a member's disabled state for THEIR org
CREATE OR REPLACE FUNCTION public.set_org_member_disabled(
  _org_id uuid,
  _user_id uuid,
  _disable boolean,
  _reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _caller uuid := auth.uid();
  _row public.user_organization_access;
BEGIN
  IF _caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT (public.has_org_access(_caller, _org_id, 'admin') OR public.is_admin(_caller)) THEN
    RAISE EXCEPTION 'Only organization administrators can change member status';
  END IF;

  IF _caller = _user_id AND _disable THEN
    RAISE EXCEPTION 'You cannot disable your own access';
  END IF;

  UPDATE public.user_organization_access
     SET is_disabled    = _disable,
         disabled_at    = CASE WHEN _disable THEN now() ELSE NULL END,
         disabled_by    = CASE WHEN _disable THEN _caller ELSE NULL END,
         disabled_reason = CASE WHEN _disable THEN _reason ELSE NULL END
   WHERE organization_id = _org_id
     AND user_id = _user_id
   RETURNING * INTO _row;

  IF _row.id IS NULL THEN
    RAISE EXCEPTION 'User is not a member of this organization';
  END IF;

  PERFORM public.log_audit_event(
    CASE WHEN _disable THEN 'org_member.disabled' ELSE 'org_member.enabled' END,
    'org_admin',
    _org_id,
    _user_id, 'org_member', _row.id,
    'success',
    jsonb_build_object('reason', _reason)
  );

  RETURN jsonb_build_object(
    'organization_id', _org_id,
    'user_id', _user_id,
    'is_disabled', _disable,
    'changed_by', _caller,
    'at', now()
  );
END;
$$;