-- ============================================================
-- 1. Subscription plan: included_orgs + extra_org_price_monthly
-- ============================================================
ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS included_orgs integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS extra_org_price_monthly numeric NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.subscription_plans.included_orgs IS
  'Number of active Organizations included in this plan. -1 = unlimited.';
COMMENT ON COLUMN public.subscription_plans.extra_org_price_monthly IS
  'Additional monthly cost (USD) per Organization above included_orgs. 0 = extra orgs not allowed.';

-- Apply recommended starting limits to seeded core plans
UPDATE public.subscription_plans
   SET included_orgs = 1, extra_org_price_monthly = 0
 WHERE name = 'Free' AND plan_kind = 'core';

UPDATE public.subscription_plans
   SET included_orgs = 1, extra_org_price_monthly = 15
 WHERE name = 'Pro' AND plan_kind = 'core';

UPDATE public.subscription_plans
   SET included_orgs = -1, extra_org_price_monthly = 0
 WHERE name = 'Enterprise' AND plan_kind = 'core';

-- ============================================================
-- 2. billing_accounts table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.billing_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  owner_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  owner_organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  stripe_customer_id text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_organization_id)
);

CREATE INDEX IF NOT EXISTS idx_billing_accounts_owner_org
  ON public.billing_accounts(owner_organization_id);
CREATE INDEX IF NOT EXISTS idx_billing_accounts_stripe_customer
  ON public.billing_accounts(stripe_customer_id);

CREATE TRIGGER trg_billing_accounts_updated_at
BEFORE UPDATE ON public.billing_accounts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.billing_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner-org admins can view their billing account"
  ON public.billing_accounts FOR SELECT
  TO authenticated
  USING (
    has_org_access(auth.uid(), owner_organization_id, 'admin')
    OR is_admin(auth.uid())
  );

CREATE POLICY "Owner-org admins can update their billing account"
  ON public.billing_accounts FOR UPDATE
  TO authenticated
  USING (
    has_org_access(auth.uid(), owner_organization_id, 'admin')
    OR is_admin(auth.uid())
  )
  WITH CHECK (
    has_org_access(auth.uid(), owner_organization_id, 'admin')
    OR is_admin(auth.uid())
  );

CREATE POLICY "Platform admins manage billing accounts"
  ON public.billing_accounts FOR ALL
  TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

-- ============================================================
-- 3. organizations.billing_account_id
-- ============================================================
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS billing_account_id uuid
    REFERENCES public.billing_accounts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_organizations_billing_account
  ON public.organizations(billing_account_id);

-- ============================================================
-- 4. Backfill: each org with a paid sub gets its own billing account
-- ============================================================
DO $$
DECLARE
  r record;
  new_acct_id uuid;
BEGIN
  FOR r IN
    SELECT o.id AS org_id, o.name AS org_name, o.created_by,
           os.stripe_customer_id
      FROM public.organizations o
      JOIN public.organization_subscriptions os ON os.organization_id = o.id
     WHERE o.billing_account_id IS NULL
  LOOP
    INSERT INTO public.billing_accounts (name, owner_user_id, owner_organization_id, stripe_customer_id)
    VALUES (r.org_name || ' — Billing', r.created_by, r.org_id, r.stripe_customer_id)
    RETURNING id INTO new_acct_id;

    UPDATE public.organizations
       SET billing_account_id = new_acct_id
     WHERE id = r.org_id;
  END LOOP;
END $$;

-- ============================================================
-- 5. Helper functions
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_billing_account_for_org(_org_id uuid)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT billing_account_id FROM public.organizations WHERE id = _org_id;
$$;

CREATE OR REPLACE FUNCTION public.count_billing_account_orgs(_account_id uuid)
RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::int
    FROM public.organizations
   WHERE billing_account_id = _account_id
     AND is_archived = false;
$$;

CREATE OR REPLACE FUNCTION public.get_billing_account_plan(_account_id uuid)
RETURNS TABLE (
  plan_id uuid,
  plan_name text,
  included_orgs integer,
  extra_org_price_monthly numeric,
  status text,
  current_period_end timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT sp.id, sp.name, sp.included_orgs, sp.extra_org_price_monthly,
         os.status, os.current_period_end
    FROM public.billing_accounts ba
    JOIN public.organization_subscriptions os
      ON os.organization_id = ba.owner_organization_id
    JOIN public.subscription_plans sp ON sp.id = os.plan_id
   WHERE ba.id = _account_id
   LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.can_downgrade_to_plan(
  _account_id uuid,
  _target_plan_id uuid
)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  active_orgs int;
  target_quota int;
BEGIN
  SELECT public.count_billing_account_orgs(_account_id) INTO active_orgs;
  SELECT included_orgs FROM public.subscription_plans WHERE id = _target_plan_id INTO target_quota;
  IF target_quota = -1 THEN RETURN true; END IF;
  RETURN active_orgs <= target_quota;
END;
$$;

-- Attach an org to a billing account (with quota enforcement)
CREATE OR REPLACE FUNCTION public.attach_org_to_billing_account(
  _org_id uuid,
  _account_id uuid
)
RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  owner_org uuid;
  active_orgs int;
  plan_quota int;
  plan_extra numeric;
BEGIN
  -- Authz: caller must be admin in the billing-account owner org, OR platform admin
  SELECT owner_organization_id INTO owner_org
    FROM public.billing_accounts WHERE id = _account_id;
  IF owner_org IS NULL THEN
    RAISE EXCEPTION 'Billing account not found';
  END IF;
  IF NOT (public.has_org_access(auth.uid(), owner_org, 'admin')
          OR public.is_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Not authorised to manage this billing account';
  END IF;

  -- Caller must also have admin access to the org being attached
  IF NOT (public.has_org_access(auth.uid(), _org_id, 'admin')
          OR public.is_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Not authorised to manage the target organisation';
  END IF;

  -- Quota: check included_orgs of the account's current plan, allow if extra_org_price_monthly > 0
  SELECT included_orgs, extra_org_price_monthly
    INTO plan_quota, plan_extra
    FROM public.get_billing_account_plan(_account_id);

  IF plan_quota IS NULL THEN
    RAISE EXCEPTION 'Billing account has no active plan';
  END IF;

  active_orgs := public.count_billing_account_orgs(_account_id);

  IF plan_quota <> -1 AND active_orgs >= plan_quota AND plan_extra <= 0 THEN
    RAISE EXCEPTION 'Plan limit reached: this plan includes % organisation(s) and does not allow extras. Upgrade to add more.', plan_quota;
  END IF;

  UPDATE public.organizations
     SET billing_account_id = _account_id
   WHERE id = _org_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.detach_org_from_billing_account(_org_id uuid)
RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  acct uuid;
  owner_org uuid;
BEGIN
  SELECT billing_account_id INTO acct FROM public.organizations WHERE id = _org_id;
  IF acct IS NULL THEN RETURN; END IF;

  SELECT owner_organization_id INTO owner_org FROM public.billing_accounts WHERE id = acct;

  -- Cannot detach the owner organisation itself
  IF owner_org = _org_id THEN
    RAISE EXCEPTION 'Cannot detach the owner organisation from its billing account';
  END IF;

  IF NOT (public.has_org_access(auth.uid(), owner_org, 'admin')
          OR public.has_org_access(auth.uid(), _org_id, 'admin')
          OR public.is_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;

  UPDATE public.organizations SET billing_account_id = NULL WHERE id = _org_id;
END;
$$;

-- ============================================================
-- 6. has_paid_plan now resolves through the Billing Account
-- ============================================================
CREATE OR REPLACE FUNCTION public.has_paid_plan(_org_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH acct AS (
    SELECT billing_account_id FROM public.organizations WHERE id = _org_id
  ),
  owner_org AS (
    SELECT ba.owner_organization_id
      FROM public.billing_accounts ba
      JOIN acct ON acct.billing_account_id = ba.id
  )
  SELECT EXISTS (
    SELECT 1
      FROM public.organization_subscriptions os
      JOIN public.subscription_plans sp ON sp.id = os.plan_id
     WHERE os.organization_id = (SELECT owner_organization_id FROM owner_org)
       AND os.status IN ('active', 'trialing')
       AND COALESCE(sp.price_monthly, 0) > 0
  )
  -- Fallback: also allow legacy direct per-org subs (orgs not yet on a billing account)
  OR EXISTS (
    SELECT 1
      FROM public.organization_subscriptions os
      JOIN public.subscription_plans sp ON sp.id = os.plan_id
     WHERE os.organization_id = _org_id
       AND os.status IN ('active', 'trialing')
       AND COALESCE(sp.price_monthly, 0) > 0
  );
$$;

-- ============================================================
-- 7. RPC: list orgs on a billing account (for UI)
-- ============================================================
CREATE OR REPLACE FUNCTION public.list_billing_account_orgs(_account_id uuid)
RETURNS TABLE (
  id uuid,
  name text,
  is_archived boolean,
  is_owner boolean,
  created_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT o.id, o.name, o.is_archived,
         (o.id = ba.owner_organization_id) AS is_owner,
         o.created_at
    FROM public.organizations o
    JOIN public.billing_accounts ba ON ba.id = _account_id
   WHERE o.billing_account_id = _account_id
   ORDER BY (o.id = ba.owner_organization_id) DESC, o.created_at ASC;
$$;