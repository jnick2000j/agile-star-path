-- Add Stripe lookup keys + product id to subscription_plans for sync tracking
ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS stripe_product_id text,
  ADD COLUMN IF NOT EXISTS stripe_lookup_key_monthly text,
  ADD COLUMN IF NOT EXISTS stripe_lookup_key_yearly text,
  ADD COLUMN IF NOT EXISTS last_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS sync_status text DEFAULT 'unsynced';

-- History of all price changes pushed to Stripe
CREATE TABLE IF NOT EXISTS public.plan_price_sync_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.subscription_plans(id) ON DELETE CASCADE,
  interval text NOT NULL CHECK (interval IN ('monthly','yearly')),
  old_amount numeric,
  new_amount numeric NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  old_stripe_price_id text,
  new_stripe_price_id text,
  lookup_key text,
  migration_strategy text NOT NULL DEFAULT 'grandfather',
  affected_subscribers integer DEFAULT 0,
  performed_by uuid REFERENCES auth.users(id),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_price_sync_plan ON public.plan_price_sync_history(plan_id);

ALTER TABLE public.plan_price_sync_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage sync history"
  ON public.plan_price_sync_history FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- Per-org subscription mapping for Stripe checkout sessions (separate from organization_subscriptions which tracks org's plan)
-- Re-use organization_subscriptions; add columns for environment + price tracking
ALTER TABLE public.organization_subscriptions
  ADD COLUMN IF NOT EXISTS environment text NOT NULL DEFAULT 'sandbox',
  ADD COLUMN IF NOT EXISTS stripe_price_id text,
  ADD COLUMN IF NOT EXISTS billing_interval text DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS cancel_at_period_end boolean DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_org_subs_stripe_sub ON public.organization_subscriptions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_org_subs_stripe_cust ON public.organization_subscriptions(stripe_customer_id);