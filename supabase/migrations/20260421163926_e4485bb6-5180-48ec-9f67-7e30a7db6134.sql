
-- ============================================================
-- License-key mode for on-premises / PO-billed deployments
-- ============================================================

CREATE TABLE IF NOT EXISTS public.organization_licenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  license_key TEXT NOT NULL UNIQUE,
  deployment_mode TEXT NOT NULL DEFAULT 'on_prem' CHECK (deployment_mode IN ('cloud', 'on_prem', 'hybrid')),
  plan_id UUID REFERENCES public.subscription_plans(id) ON DELETE SET NULL,
  plan_tier TEXT,
  seats INTEGER NOT NULL DEFAULT 10,
  ai_credits_monthly INTEGER NOT NULL DEFAULT 0,
  features_override JSONB NOT NULL DEFAULT '{}'::jsonb,
  valid_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_until TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'expired', 'revoked')),
  customer_reference TEXT,
  notes TEXT,
  issued_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_licenses_org ON public.organization_licenses(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_licenses_status ON public.organization_licenses(status) WHERE status = 'active';

ALTER TABLE public.organization_licenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins manage licenses"
  ON public.organization_licenses
  FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Org admins can view their license"
  ON public.organization_licenses
  FOR SELECT
  TO authenticated
  USING (public.has_org_access(auth.uid(), organization_id, 'admin'));

CREATE TRIGGER trg_org_licenses_updated_at
  BEFORE UPDATE ON public.organization_licenses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ----------------------------------------------------------------
-- Helper: does this org have an active, unexpired license?
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.has_active_license(_org_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_licenses
    WHERE organization_id = _org_id
      AND status = 'active'
      AND valid_from <= now()
      AND (valid_until IS NULL OR valid_until > now())
  );
$$;

-- ----------------------------------------------------------------
-- Helper: license entitlements snapshot
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_license_entitlements(_org_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _lic public.organization_licenses;
BEGIN
  SELECT * INTO _lic FROM public.organization_licenses
   WHERE organization_id = _org_id
     AND status = 'active'
     AND valid_from <= now()
     AND (valid_until IS NULL OR valid_until > now())
   ORDER BY issued_at DESC
   LIMIT 1;

  IF _lic.id IS NULL THEN
    RETURN jsonb_build_object('has_license', false);
  END IF;

  RETURN jsonb_build_object(
    'has_license', true,
    'license_id', _lic.id,
    'deployment_mode', _lic.deployment_mode,
    'plan_id', _lic.plan_id,
    'plan_tier', _lic.plan_tier,
    'seats', _lic.seats,
    'ai_credits_monthly', _lic.ai_credits_monthly,
    'features_override', _lic.features_override,
    'valid_from', _lic.valid_from,
    'valid_until', _lic.valid_until,
    'customer_reference', _lic.customer_reference
  );
END;
$$;

-- ----------------------------------------------------------------
-- Update check_plan_limit to honor licenses first
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_plan_limit(_org_id uuid, _resource_type text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _plan subscription_plans;
  _current_count integer;
  _max_allowed integer;
  _lic public.organization_licenses;
BEGIN
  -- 1. License path (on-prem / PO-billed customers)
  SELECT * INTO _lic FROM public.organization_licenses
   WHERE organization_id = _org_id
     AND status = 'active'
     AND valid_from <= now()
     AND (valid_until IS NULL OR valid_until > now())
   ORDER BY issued_at DESC
   LIMIT 1;

  IF _lic.id IS NOT NULL THEN
    CASE _resource_type
      WHEN 'users' THEN _max_allowed := _lic.seats;
      ELSE
        -- License doesn't constrain other entity counts; fall through to plan-derived limits if a plan_id is set.
        IF _lic.plan_id IS NOT NULL THEN
          SELECT * INTO _plan FROM subscription_plans WHERE id = _lic.plan_id;
        END IF;
    END CASE;
  END IF;

  -- 2. Subscription path (cloud / Stripe customers) — only if license didn't already resolve the limit
  IF _max_allowed IS NULL THEN
    IF _plan.id IS NULL THEN
      SELECT sp.* INTO _plan
        FROM organization_subscriptions os
        JOIN subscription_plans sp ON sp.id = os.plan_id
       WHERE os.organization_id = _org_id
         AND os.status IN ('active', 'trialing');
    END IF;

    IF _plan IS NULL THEN
      RETURN FALSE;
    END IF;

    CASE _resource_type
      WHEN 'users'      THEN _max_allowed := _plan.max_users;
      WHEN 'programmes' THEN _max_allowed := _plan.max_programmes;
      WHEN 'projects'   THEN _max_allowed := _plan.max_projects;
      WHEN 'products'   THEN _max_allowed := _plan.max_products;
      ELSE RETURN TRUE;
    END CASE;
  END IF;

  IF _max_allowed = -1 THEN RETURN TRUE; END IF;

  CASE _resource_type
    WHEN 'users' THEN
      SELECT COUNT(*) INTO _current_count FROM user_organization_access WHERE organization_id = _org_id;
    WHEN 'programmes' THEN
      SELECT COUNT(*) INTO _current_count FROM programmes WHERE organization_id = _org_id;
    WHEN 'projects' THEN
      SELECT COUNT(*) INTO _current_count FROM projects WHERE organization_id = _org_id;
    WHEN 'products' THEN
      SELECT COUNT(*) INTO _current_count FROM products WHERE organization_id = _org_id;
    ELSE RETURN TRUE;
  END CASE;

  RETURN _current_count < _max_allowed;
END;
$function$;
