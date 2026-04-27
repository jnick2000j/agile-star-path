
-- =========================================================
-- 1. Fix profiles: restrict sensitive PII to owner + platform admins
-- =========================================================
DROP POLICY IF EXISTS "Users can view sensitive profile fields when authorised" ON public.profiles;

-- Note: existing "Users can view own profile" (auth.uid() = user_id) and
-- "Admins can view all profiles" (is_admin) remain. Removing the broad
-- org-admin SELECT path means org admins no longer see other users' phone/address PII.
-- Cross-org member directory needs (name, email, avatar) should be served via
-- a SECURITY DEFINER RPC or a view that excludes phone_number/address/mailing_address.

-- =========================================================
-- 2. Fix profiles UPDATE: prevent role escalation by non-admins
-- =========================================================
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
USING (auth.uid() = user_id OR public.is_admin(auth.uid()))
WITH CHECK (
  (
    -- Owner updating themselves: role MUST equal their current role
    auth.uid() = user_id
    AND role = public.get_user_role(auth.uid())
  )
  OR public.is_admin(auth.uid())
);

-- =========================================================
-- 3. Fix helpdesk_email_log: NULL org rows readable by platform admins only
-- =========================================================
DROP POLICY IF EXISTS "Admins read email log" ON public.helpdesk_email_log;

CREATE POLICY "Admins read email log"
ON public.helpdesk_email_log
FOR SELECT
USING (
  (
    organization_id IS NOT NULL
    AND public.has_org_access(auth.uid(), organization_id, 'admin')
  )
  OR public.is_admin(auth.uid())
);

-- =========================================================
-- 4. Fix mutable search_path on email queue functions
-- =========================================================
ALTER FUNCTION public.enqueue_email(text, jsonb)         SET search_path = public;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public;
ALTER FUNCTION public.delete_email(text, bigint)         SET search_path = public;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb)   SET search_path = public;

-- =========================================================
-- 5. Revoke EXECUTE on internal email queue SECURITY DEFINER functions
-- These are called by edge functions using the service role only.
-- =========================================================
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb)               FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint)               FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb)   FROM anon, authenticated, public;
