-- Stripe lookup keys for "extra organization" per-unit prices on each plan.
-- These are separate Stripe prices priced per-unit (qty = number of extras).
ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS stripe_extra_org_lookup_key_monthly text,
  ADD COLUMN IF NOT EXISTS stripe_extra_org_lookup_key_yearly text;

COMMENT ON COLUMN public.subscription_plans.stripe_extra_org_lookup_key_monthly IS
  'Stripe price lookup_key for the per-extra-org add-on (monthly). Quantity on this line item == # of orgs above included_orgs.';
COMMENT ON COLUMN public.subscription_plans.stripe_extra_org_lookup_key_yearly IS
  'Stripe price lookup_key for the per-extra-org add-on (yearly).';

-- Suggested defaults — Stripe products will need to be created with these lookup keys
-- before the sync function can attach them. Until then, the sync function will simply
-- skip quantity sync (the in-app extras count and pricing UI still work).
UPDATE public.subscription_plans
   SET stripe_extra_org_lookup_key_monthly = 'pro_extra_org_monthly',
       stripe_extra_org_lookup_key_yearly  = 'pro_extra_org_yearly'
 WHERE name = 'Pro' AND plan_kind = 'core'
   AND stripe_extra_org_lookup_key_monthly IS NULL;

-- Helper RPC: returns everything sync-billing-quantity needs in one call,
-- so the edge function doesn't need to make 4 separate queries.
CREATE OR REPLACE FUNCTION public.get_billing_account_sync_info(_account_id uuid)
RETURNS TABLE (
  account_id uuid,
  owner_organization_id uuid,
  stripe_subscription_id text,
  billing_interval text,
  environment text,
  included_orgs integer,
  active_org_count integer,
  extra_org_lookup_key text,
  extra_org_price_monthly numeric
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    ba.id,
    ba.owner_organization_id,
    os.stripe_subscription_id,
    os.billing_interval,
    os.environment,
    sp.included_orgs,
    public.count_billing_account_orgs(ba.id),
    CASE
      WHEN os.billing_interval = 'yearly'
        THEN sp.stripe_extra_org_lookup_key_yearly
      ELSE sp.stripe_extra_org_lookup_key_monthly
    END,
    sp.extra_org_price_monthly
  FROM public.billing_accounts ba
  JOIN public.organization_subscriptions os
    ON os.organization_id = ba.owner_organization_id
  JOIN public.subscription_plans sp ON sp.id = os.plan_id
 WHERE ba.id = _account_id
 LIMIT 1;
$$;