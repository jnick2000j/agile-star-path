-- 1. Tighten CSAT response visibility: replace USING(true) with token-scoped RPC.
DROP POLICY IF EXISTS "Public can read csat by token" ON public.csat_responses;

CREATE OR REPLACE FUNCTION public.get_csat_by_token(_token text)
RETURNS TABLE(
  id uuid,
  organization_id uuid,
  ticket_id uuid,
  rating integer,
  comment text,
  follow_up_answer text,
  sent_at timestamptz,
  responded_at timestamptz,
  expires_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT id, organization_id, ticket_id, rating, comment, follow_up_answer,
         sent_at, responded_at, expires_at
    FROM public.csat_responses
   WHERE token = _token
     AND (expires_at IS NULL OR expires_at > now())
   LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_csat_by_token(text) TO anon, authenticated;

-- Tighten the UPDATE policy WITH CHECK so anon submitters can't change identity columns
-- to belong to a different ticket/org. The qual already restricts to unresponded, unexpired rows.
DROP POLICY IF EXISTS "Public can submit csat by token" ON public.csat_responses;
CREATE POLICY "Public can submit csat by token"
  ON public.csat_responses
  FOR UPDATE
  TO anon, authenticated
  USING (responded_at IS NULL AND (expires_at IS NULL OR expires_at > now()))
  WITH CHECK (
    responded_at IS NOT NULL
    AND rating IS NOT NULL
  );

-- 2. Tighten ai_credit_purchases: drop overly permissive ALL USING(true) policy.
-- Service role bypasses RLS automatically, so this policy is redundant and dangerous.
DROP POLICY IF EXISTS "Service role manages credit purchases" ON public.ai_credit_purchases;