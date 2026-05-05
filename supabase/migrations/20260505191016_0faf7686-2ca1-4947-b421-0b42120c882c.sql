CREATE OR REPLACE FUNCTION public.admin_clear_email_confirmation(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  _caller uuid := auth.uid();
  _is_platform_admin boolean;
  _shares_org boolean;
BEGIN
  IF _caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _caller AND role = 'admin'
  ) INTO _is_platform_admin;

  IF NOT _is_platform_admin THEN
    -- Org admin who shares an org with target
    SELECT EXISTS (
      SELECT 1
      FROM public.user_organization_access caller_a
      JOIN public.user_organization_access target_a
        ON target_a.organization_id = caller_a.organization_id
      WHERE caller_a.user_id = _caller
        AND caller_a.access_level = 'admin'
        AND target_a.user_id = _user_id
    ) INTO _shares_org;

    IF NOT _shares_org THEN
      RAISE EXCEPTION 'Not authorized to reset this user';
    END IF;
  END IF;

  UPDATE auth.users
  SET email_confirmed_at = NULL,
      confirmed_at       = NULL,
      confirmation_token = '',
      confirmation_sent_at = NULL,
      recovery_token = '',
      updated_at = now()
  WHERE id = _user_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_clear_email_confirmation(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_clear_email_confirmation(uuid) TO authenticated, service_role;