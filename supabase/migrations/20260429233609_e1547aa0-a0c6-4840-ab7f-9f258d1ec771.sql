-- Fix 1: milestone_history INSERT must check org access via parent milestone
DROP POLICY IF EXISTS "Insert milestone history" ON public.milestone_history;
CREATE POLICY "Insert milestone history" ON public.milestone_history
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.milestones m
      WHERE m.id = milestone_history.milestone_id
        AND (
          is_admin(auth.uid())
          OR m.organization_id IS NULL
          OR has_org_access(auth.uid(), m.organization_id, 'editor')
          OR auth.uid() = m.owner_id
          OR auth.uid() = m.created_by
        )
    )
  );

-- Fix 2: csat_responses — remove broad public UPDATE policy and route submissions
-- through a SECURITY DEFINER function that validates the unique token.
DROP POLICY IF EXISTS "Public can submit csat by token" ON public.csat_responses;

CREATE OR REPLACE FUNCTION public.submit_csat_response_by_token(
  _token text,
  _rating integer,
  _comment text DEFAULT NULL,
  _follow_up_answer text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row public.csat_responses%ROWTYPE;
BEGIN
  IF _token IS NULL OR length(_token) < 16 THEN
    RAISE EXCEPTION 'invalid token';
  END IF;
  IF _rating IS NULL OR _rating < 1 OR _rating > 5 THEN
    RAISE EXCEPTION 'invalid rating';
  END IF;

  SELECT * INTO _row FROM public.csat_responses WHERE token = _token;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'survey not found';
  END IF;
  IF _row.responded_at IS NOT NULL THEN
    RAISE EXCEPTION 'already submitted';
  END IF;
  IF _row.expires_at IS NOT NULL AND _row.expires_at <= now() THEN
    RAISE EXCEPTION 'survey expired';
  END IF;

  UPDATE public.csat_responses
  SET rating = _rating,
      comment = _comment,
      follow_up_answer = _follow_up_answer,
      responded_at = now()
  WHERE id = _row.id;

  RETURN _row.id;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_csat_response_by_token(text, integer, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.submit_csat_response_by_token(text, integer, text, text) TO anon, authenticated;