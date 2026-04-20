
-- 1. Add catalog entry for monthly AI credits (numeric limit feature, auto-rendered in PlanEditorDialog).
INSERT INTO public.plan_features (feature_key, name, description, category, feature_type, default_value, display_order, is_active)
VALUES (
  'limit_ai_credits_monthly',
  'AI Credits / month',
  'Number of AI requests (drafts, summaries, translations, advisor turns, insights) included per calendar month. -1 = unlimited.',
  'limits',
  'numeric',
  '50'::jsonb,
  100,
  true
)
ON CONFLICT (feature_key) DO UPDATE
SET name = EXCLUDED.name,
    description = EXCLUDED.description,
    category = EXCLUDED.category,
    feature_type = EXCLUDED.feature_type,
    is_active = true;

-- 2. Seed sensible per-plan defaults (idempotent upsert).
INSERT INTO public.plan_feature_values (plan_id, feature_key, value)
SELECT id, 'limit_ai_credits_monthly',
  (CASE
    WHEN lower(name) LIKE '%enterprise%' THEN '-1'
    WHEN lower(name) LIKE '%pro%'        THEN '500'
    ELSE '25'
  END)::jsonb
FROM public.subscription_plans
ON CONFLICT (plan_id, feature_key) DO NOTHING;

-- 3. Per-org per-month usage counter.
CREATE TABLE IF NOT EXISTS public.ai_credit_usage (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  period_start    DATE NOT NULL,                       -- first day of the month (UTC)
  used            INTEGER NOT NULL DEFAULT 0,
  last_action     TEXT,
  last_model      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, period_start)
);

CREATE INDEX IF NOT EXISTS idx_ai_credit_usage_org_period
  ON public.ai_credit_usage(organization_id, period_start DESC);

ALTER TABLE public.ai_credit_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members read ai credit usage" ON public.ai_credit_usage;
CREATE POLICY "Org members read ai credit usage"
ON public.ai_credit_usage
FOR SELECT
TO authenticated
USING (public.has_org_access(auth.uid(), organization_id, 'viewer'));

-- Writes happen exclusively via SECURITY DEFINER RPCs, so no INSERT/UPDATE policies for clients.

CREATE TRIGGER trg_ai_credit_usage_updated_at
BEFORE UPDATE ON public.ai_credit_usage
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Itemised ledger so users can audit what consumed their credits.
CREATE TABLE IF NOT EXISTS public.ai_credit_ledger (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id         UUID,
  period_start    DATE NOT NULL,
  amount          INTEGER NOT NULL DEFAULT 1,
  action_type     TEXT NOT NULL,
  model           TEXT,
  decision        TEXT NOT NULL DEFAULT 'allowed', -- allowed | blocked
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_credit_ledger_org_created
  ON public.ai_credit_ledger(organization_id, created_at DESC);

ALTER TABLE public.ai_credit_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members read ai credit ledger" ON public.ai_credit_ledger;
CREATE POLICY "Org members read ai credit ledger"
ON public.ai_credit_ledger
FOR SELECT
TO authenticated
USING (public.has_org_access(auth.uid(), organization_id, 'viewer'));

-- 5. Status RPC: returns quota, used, remaining, period dates and breakdown.
CREATE OR REPLACE FUNCTION public.get_ai_credit_status(_org_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _quota INTEGER;
  _period_start DATE := date_trunc('month', now() AT TIME ZONE 'utc')::date;
  _period_end   DATE := (date_trunc('month', now() AT TIME ZONE 'utc') + interval '1 month')::date;
  _used INTEGER := 0;
BEGIN
  IF _org_id IS NULL THEN
    RETURN jsonb_build_object(
      'quota', 0, 'used', 0, 'remaining', 0,
      'unlimited', false,
      'period_start', _period_start,
      'period_end', _period_end
    );
  END IF;

  SELECT COALESCE(NULLIF(public.get_org_feature_value(_org_id, 'limit_ai_credits_monthly')::text, 'null')::integer, 0)
    INTO _quota;

  SELECT COALESCE(used, 0)
    INTO _used
    FROM ai_credit_usage
   WHERE organization_id = _org_id
     AND period_start = _period_start;

  RETURN jsonb_build_object(
    'quota', _quota,
    'used', COALESCE(_used, 0),
    'remaining', CASE WHEN _quota = -1 THEN -1
                      ELSE GREATEST(0, _quota - COALESCE(_used, 0)) END,
    'unlimited', _quota = -1,
    'period_start', _period_start,
    'period_end', _period_end
  );
END;
$$;

-- 6. Atomic consume RPC. Returns the same shape as get_ai_credit_status plus
--    `allowed` boolean. Inserts a ledger row whether the call was allowed or blocked.
CREATE OR REPLACE FUNCTION public.consume_ai_credits(
  _org_id      UUID,
  _amount      INTEGER DEFAULT 1,
  _action_type TEXT DEFAULT 'ai_call',
  _model       TEXT DEFAULT NULL,
  _user_id     UUID DEFAULT NULL,
  _metadata    JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _quota INTEGER;
  _period_start DATE := date_trunc('month', now() AT TIME ZONE 'utc')::date;
  _used INTEGER := 0;
  _new_used INTEGER;
  _allowed BOOLEAN := false;
BEGIN
  IF _org_id IS NULL THEN
    RETURN jsonb_build_object('allowed', true, 'quota', -1, 'used', 0, 'remaining', -1, 'unlimited', true);
  END IF;
  IF _amount IS NULL OR _amount < 1 THEN _amount := 1; END IF;

  SELECT COALESCE(NULLIF(public.get_org_feature_value(_org_id, 'limit_ai_credits_monthly')::text, 'null')::integer, 0)
    INTO _quota;

  -- Unlimited tier: log + allow without bumping the counter
  IF _quota = -1 THEN
    INSERT INTO ai_credit_ledger (organization_id, user_id, period_start, amount, action_type, model, decision, metadata)
    VALUES (_org_id, _user_id, _period_start, _amount, _action_type, _model, 'allowed', _metadata);
    RETURN jsonb_build_object('allowed', true, 'quota', -1, 'used', 0, 'remaining', -1,
                              'unlimited', true, 'period_start', _period_start);
  END IF;

  -- Lock the row for this org+period to prevent double-spend on concurrent calls
  INSERT INTO ai_credit_usage (organization_id, period_start, used)
  VALUES (_org_id, _period_start, 0)
  ON CONFLICT (organization_id, period_start) DO NOTHING;

  SELECT used INTO _used
    FROM ai_credit_usage
   WHERE organization_id = _org_id AND period_start = _period_start
   FOR UPDATE;

  IF _used + _amount <= _quota THEN
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
    'used', _new_used,
    'remaining', GREATEST(0, _quota - _new_used),
    'unlimited', false,
    'period_start', _period_start
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_ai_credit_status(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.consume_ai_credits(UUID, INTEGER, TEXT, TEXT, UUID, JSONB) TO authenticated, service_role;
