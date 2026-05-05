-- Track per-user account verification status independent of archive flag.
-- 'pending' = email not yet confirmed; 'active' = email confirmed and ready to use.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'account_status') THEN
    CREATE TYPE public.account_status AS ENUM ('pending', 'active');
  END IF;
END $$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS account_status public.account_status NOT NULL DEFAULT 'pending';

-- Backfill: any user already having a confirmed email is active.
UPDATE public.profiles p
SET account_status = 'active'
FROM auth.users u
WHERE p.user_id = u.id
  AND u.email_confirmed_at IS NOT NULL
  AND p.account_status <> 'active';

-- Function the edge function will call to mirror auth.users state.
CREATE OR REPLACE FUNCTION public.set_profile_account_status(_user_id uuid, _status public.account_status)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.profiles SET account_status = _status, updated_at = now()
  WHERE user_id = _user_id;
$$;

-- Helper used by the new-user trigger / handle_new_user to seed correct status.
CREATE OR REPLACE FUNCTION public.compute_initial_account_status(_user_id uuid)
RETURNS public.account_status
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT CASE
    WHEN EXISTS (
      SELECT 1 FROM auth.users WHERE id = _user_id AND email_confirmed_at IS NOT NULL
    ) THEN 'active'::public.account_status
    ELSE 'pending'::public.account_status
  END;
$$;

-- Periodic / on-demand reconciliation: any profile whose auth user is now
-- confirmed should flip to active. Called from the client after auth events.
CREATE OR REPLACE FUNCTION public.reconcile_my_account_status()
RETURNS public.account_status
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  _uid uuid := auth.uid();
  _status public.account_status;
BEGIN
  IF _uid IS NULL THEN
    RETURN NULL;
  END IF;
  SELECT compute_initial_account_status(_uid) INTO _status;
  UPDATE public.profiles SET account_status = _status, updated_at = now()
  WHERE user_id = _uid AND account_status IS DISTINCT FROM _status;
  RETURN _status;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reconcile_my_account_status() TO authenticated;