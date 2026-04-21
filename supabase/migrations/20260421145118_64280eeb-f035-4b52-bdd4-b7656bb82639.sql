
-- 1) Custom AI credit packs catalog
CREATE TABLE IF NOT EXISTS public.ai_credit_packs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_key text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  credits integer NOT NULL CHECK (credits > 0),
  amount_usd numeric(10,2) NOT NULL CHECK (amount_usd >= 0),
  currency text NOT NULL DEFAULT 'usd',
  stripe_product_id text,
  stripe_price_lookup_key text,
  is_active boolean NOT NULL DEFAULT true,
  highlight boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 100,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_credit_packs_active_sort
  ON public.ai_credit_packs(is_active, sort_order);

ALTER TABLE public.ai_credit_packs ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read active packs (so org members see them in Billing).
CREATE POLICY "Anyone can view active credit packs"
  ON public.ai_credit_packs FOR SELECT
  TO authenticated
  USING (is_active = true OR public.is_admin(auth.uid()));

-- Only platform admins manage the catalog.
CREATE POLICY "Platform admins manage credit packs"
  ON public.ai_credit_packs FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- updated_at trigger
DROP TRIGGER IF EXISTS trg_ai_credit_packs_updated ON public.ai_credit_packs;
CREATE TRIGGER trg_ai_credit_packs_updated
  BEFORE UPDATE ON public.ai_credit_packs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed the default 500/$25 pack (idempotent).
INSERT INTO public.ai_credit_packs
  (pack_key, name, description, credits, amount_usd, stripe_product_id, stripe_price_lookup_key, highlight, sort_order)
VALUES
  ('ai_credits_pack_500', 'Starter top-up',
   '500 extra AI credits added to this month''s allowance. Credits expire at the end of the current month.',
   500, 25.00, 'ai_credits_pack_500', 'ai_credits_pack_500_price', true, 10)
ON CONFLICT (pack_key) DO UPDATE SET
  stripe_product_id = EXCLUDED.stripe_product_id,
  stripe_price_lookup_key = EXCLUDED.stripe_price_lookup_key,
  updated_at = now();

-- 2) Purchase history RPC (RLS already protects ai_credit_purchases)
CREATE OR REPLACE FUNCTION public.get_org_credit_purchase_history(_org_id uuid, _limit integer DEFAULT 25)
RETURNS TABLE (
  id uuid,
  pack_id text,
  credits integer,
  amount_cents integer,
  currency text,
  status text,
  environment text,
  period_start date,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, pack_id, credits, amount_cents, currency, status, environment, period_start, created_at
    FROM public.ai_credit_purchases
   WHERE organization_id = _org_id
   ORDER BY created_at DESC
   LIMIT GREATEST(1, LEAST(_limit, 200));
$$;
