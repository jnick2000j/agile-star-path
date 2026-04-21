
-- 1. Track purchases of AI credit packs
CREATE TABLE public.ai_credit_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid,
  period_start date NOT NULL,
  pack_id text NOT NULL,
  credits integer NOT NULL CHECK (credits > 0),
  amount_cents integer NOT NULL CHECK (amount_cents >= 0),
  currency text NOT NULL DEFAULT 'usd',
  stripe_session_id text UNIQUE,
  stripe_payment_intent text,
  environment text NOT NULL DEFAULT 'sandbox',
  status text NOT NULL DEFAULT 'completed',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_credit_purchases_org_period
  ON public.ai_credit_purchases (organization_id, period_start DESC);

ALTER TABLE public.ai_credit_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org admins read credit purchases"
  ON public.ai_credit_purchases
  FOR SELECT
  TO authenticated
  USING (public.has_org_access(auth.uid(), organization_id, 'admin'));

CREATE POLICY "Service role manages credit purchases"
  ON public.ai_credit_purchases
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 2. Add purchased credits column to monthly usage
ALTER TABLE public.ai_credit_usage
  ADD COLUMN IF NOT EXISTS purchased integer NOT NULL DEFAULT 0;

-- 3. Grant credits (called from webhook). Idempotent on stripe_session_id.
CREATE OR REPLACE FUNCTION public.grant_ai_credits(
  _org_id uuid,
  _credits integer,
  _pack_id text,
  _amount_cents integer,
  _currency text,
  _stripe_session_id text,
  _stripe_payment_intent text,
  _environment text,
  _user_id uuid DEFAULT NULL,
  _metadata jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _period_start date := date_trunc('month', now() AT TIME ZONE 'utc')::date;
  _existing uuid;
  _new_purchased integer;
BEGIN
  IF _org_id IS NULL OR _credits IS NULL OR _credits < 1 THEN
    RAISE EXCEPTION 'Invalid grant parameters';
  END IF;

  -- Idempotency: if we already recorded this session, return current state
  IF _stripe_session_id IS NOT NULL THEN
    SELECT id INTO _existing
      FROM ai_credit_purchases
     WHERE stripe_session_id = _stripe_session_id
     LIMIT 1;
    IF _existing IS NOT NULL THEN
      RETURN jsonb_build_object('already_processed', true, 'purchase_id', _existing);
    END IF;
  END IF;

  INSERT INTO ai_credit_purchases (
    organization_id, user_id, period_start, pack_id, credits,
    amount_cents, currency, stripe_session_id, stripe_payment_intent,
    environment, status, metadata
  ) VALUES (
    _org_id, _user_id, _period_start, _pack_id, _credits,
    _amount_cents, COALESCE(_currency, 'usd'), _stripe_session_id, _stripe_payment_intent,
    COALESCE(_environment, 'sandbox'), 'completed', COALESCE(_metadata, '{}'::jsonb)
  )
  RETURNING id INTO _existing;

  INSERT INTO ai_credit_usage (organization_id, period_start, used, purchased)
  VALUES (_org_id, _period_start, 0, _credits)
  ON CONFLICT (organization_id, period_start)
  DO UPDATE SET purchased = ai_credit_usage.purchased + EXCLUDED.purchased,
                updated_at = now()
  RETURNING purchased INTO _new_purchased;

  RETURN jsonb_build_object(
    'already_processed', false,
    'purchase_id', _existing,
    'period_start', _period_start,
    'purchased_total', _new_purchased,
    'credits_added', _credits
  );
END;
$$;

REVOKE ALL ON FUNCTION public.grant_ai_credits(uuid, integer, text, integer, text, text, text, text, uuid, jsonb) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_ai_credits(uuid, integer, text, integer, text, text, text, text, uuid, jsonb) TO service_role;

-- 4. Update credit status reader to include purchased credits
CREATE OR REPLACE FUNCTION public.get_ai_credit_status(_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _quota INTEGER;
  _period_start DATE := date_trunc('month', now() AT TIME ZONE 'utc')::date;
  _period_end   DATE := (date_trunc('month', now() AT TIME ZONE 'utc') + interval '1 month')::date;
  _used INTEGER := 0;
  _purchased INTEGER := 0;
  _total_quota INTEGER;
BEGIN
  IF _org_id IS NULL THEN
    RETURN jsonb_build_object(
      'quota', 0, 'used', 0, 'remaining', 0,
      'unlimited', false, 'purchased', 0,
      'period_start', _period_start,
      'period_end', _period_end
    );
  END IF;

  SELECT COALESCE(NULLIF(public.get_org_feature_value(_org_id, 'limit_ai_credits_monthly')::text, 'null')::integer, 0)
    INTO _quota;

  SELECT COALESCE(used, 0), COALESCE(purchased, 0)
    INTO _used, _purchased
    FROM ai_credit_usage
   WHERE organization_id = _org_id
     AND period_start = _period_start;

  IF _quota = -1 THEN
    RETURN jsonb_build_object(
      'quota', -1, 'used', COALESCE(_used,0), 'remaining', -1,
      'unlimited', true, 'purchased', COALESCE(_purchased,0),
      'period_start', _period_start, 'period_end', _period_end
    );
  END IF;

  _total_quota := _quota + COALESCE(_purchased, 0);

  RETURN jsonb_build_object(
    'quota', _quota,
    'purchased', COALESCE(_purchased, 0),
    'used', COALESCE(_used, 0),
    'remaining', GREATEST(0, _total_quota - COALESCE(_used, 0)),
    'unlimited', false,
    'period_start', _period_start,
    'period_end', _period_end
  );
END;
$$;

-- 5. Update consumption function to allow spending purchased credits
CREATE OR REPLACE FUNCTION public.consume_ai_credits(
  _org_id uuid,
  _amount integer DEFAULT 1,
  _action_type text DEFAULT 'ai_call'::text,
  _model text DEFAULT NULL::text,
  _user_id uuid DEFAULT NULL::uuid,
  _metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _quota INTEGER;
  _period_start DATE := date_trunc('month', now() AT TIME ZONE 'utc')::date;
  _used INTEGER := 0;
  _purchased INTEGER := 0;
  _total_quota INTEGER;
  _new_used INTEGER;
  _allowed BOOLEAN := false;
BEGIN
  IF _org_id IS NULL THEN
    RETURN jsonb_build_object('allowed', true, 'quota', -1, 'used', 0, 'remaining', -1, 'unlimited', true);
  END IF;
  IF _amount IS NULL OR _amount < 1 THEN _amount := 1; END IF;

  SELECT COALESCE(NULLIF(public.get_org_feature_value(_org_id, 'limit_ai_credits_monthly')::text, 'null')::integer, 0)
    INTO _quota;

  IF _quota = -1 THEN
    INSERT INTO ai_credit_ledger (organization_id, user_id, period_start, amount, action_type, model, decision, metadata)
    VALUES (_org_id, _user_id, _period_start, _amount, _action_type, _model, 'allowed', _metadata);
    RETURN jsonb_build_object('allowed', true, 'quota', -1, 'used', 0, 'remaining', -1,
                              'unlimited', true, 'period_start', _period_start);
  END IF;

  INSERT INTO ai_credit_usage (organization_id, period_start, used, purchased)
  VALUES (_org_id, _period_start, 0, 0)
  ON CONFLICT (organization_id, period_start) DO NOTHING;

  SELECT used, purchased INTO _used, _purchased
    FROM ai_credit_usage
   WHERE organization_id = _org_id AND period_start = _period_start
   FOR UPDATE;

  _total_quota := _quota + COALESCE(_purchased, 0);

  IF _used + _amount <= _total_quota THEN
    UPDATE ai_credit_usage
       SET used = _used + _amount,
           last_action = _action_type,
           last_model  = _model,
           updated_at  = now()
     WHERE organization_id = _org_id AND period_start = _period_start
     RETURNING used INTO _new_used;
    _allowed := true;
  ELSE
    _new_used := _used;
    _allowed := false;
  END IF;

  INSERT INTO ai_credit_ledger (organization_id, user_id, period_start, amount, action_type, model, decision, metadata)
  VALUES (_org_id, _user_id, _period_start, _amount, _action_type, _model,
          CASE WHEN _allowed THEN 'allowed' ELSE 'blocked' END, _metadata);

  RETURN jsonb_build_object(
    'allowed', _allowed,
    'quota', _quota,
    'purchased', COALESCE(_purchased, 0),
    'used', _new_used,
    'remaining', GREATEST(0, _total_quota - _new_used),
    'unlimited', false,
    'period_start', _period_start
  );
END;
$$;
