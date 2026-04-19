-- ============================================================
-- Plan Management & Feature Gating System
-- ============================================================

-- 1. Extend subscription_plans with new fields
ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS trial_days integer NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS billing_interval text NOT NULL DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS highlight boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cta_label text;

-- 2. Feature catalog (dynamic feature schema)
CREATE TABLE IF NOT EXISTS public.plan_features (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_key text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'general',
  feature_type text NOT NULL DEFAULT 'boolean',
    -- 'boolean' | 'numeric' | 'text'
  default_value jsonb NOT NULL DEFAULT 'false'::jsonb,
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Plan-level feature values (which plan grants what)
CREATE TABLE IF NOT EXISTS public.plan_feature_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.subscription_plans(id) ON DELETE CASCADE,
  feature_key text NOT NULL REFERENCES public.plan_features(feature_key) ON DELETE CASCADE ON UPDATE CASCADE,
  value jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (plan_id, feature_key)
);

-- 4. Per-org overrides (enterprise deals, comps, beta)
CREATE TABLE IF NOT EXISTS public.organization_plan_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  feature_key text NOT NULL REFERENCES public.plan_features(feature_key) ON DELETE CASCADE ON UPDATE CASCADE,
  override_value jsonb NOT NULL,
  reason text,
  expires_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, feature_key)
);

CREATE INDEX IF NOT EXISTS idx_org_plan_overrides_org ON public.organization_plan_overrides(organization_id);
CREATE INDEX IF NOT EXISTS idx_plan_feature_values_plan ON public.plan_feature_values(plan_id);

-- 5. Triggers for updated_at
DROP TRIGGER IF EXISTS trg_plan_features_updated ON public.plan_features;
CREATE TRIGGER trg_plan_features_updated BEFORE UPDATE ON public.plan_features
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_plan_feature_values_updated ON public.plan_feature_values;
CREATE TRIGGER trg_plan_feature_values_updated BEFORE UPDATE ON public.plan_feature_values
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_org_plan_overrides_updated ON public.organization_plan_overrides;
CREATE TRIGGER trg_org_plan_overrides_updated BEFORE UPDATE ON public.organization_plan_overrides
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6. Resolver functions: org override > plan value > catalog default
CREATE OR REPLACE FUNCTION public.get_org_feature_value(_org_id uuid, _feature_key text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _val jsonb;
BEGIN
  -- 1. Per-org override (if not expired)
  SELECT override_value INTO _val
  FROM organization_plan_overrides
  WHERE organization_id = _org_id
    AND feature_key = _feature_key
    AND (expires_at IS NULL OR expires_at > now())
  LIMIT 1;
  IF _val IS NOT NULL THEN RETURN _val; END IF;

  -- 2. Plan value
  SELECT pfv.value INTO _val
  FROM organization_subscriptions os
  JOIN plan_feature_values pfv ON pfv.plan_id = os.plan_id
  WHERE os.organization_id = _org_id
    AND os.status IN ('active','trialing')
    AND pfv.feature_key = _feature_key
  LIMIT 1;
  IF _val IS NOT NULL THEN RETURN _val; END IF;

  -- 3. Catalog default
  SELECT default_value INTO _val
  FROM plan_features
  WHERE feature_key = _feature_key
  LIMIT 1;
  RETURN COALESCE(_val, 'false'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.has_feature(_org_id uuid, _feature_key text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((public.get_org_feature_value(_org_id, _feature_key))::text::boolean, false);
$$;

CREATE OR REPLACE FUNCTION public.get_org_limit(_org_id uuid, _feature_key text)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(NULLIF(public.get_org_feature_value(_org_id, _feature_key)::text, 'null')::integer, 0);
$$;

-- 7. RLS
ALTER TABLE public.plan_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_feature_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_plan_overrides ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read active features (powers pricing page + gating)
DROP POLICY IF EXISTS "Active features readable by all" ON public.plan_features;
CREATE POLICY "Active features readable by all" ON public.plan_features
  FOR SELECT USING (is_active = true OR public.is_admin(auth.uid()));

-- Plan feature values readable by all authenticated (needed for resolver + pricing page)
DROP POLICY IF EXISTS "Plan feature values readable" ON public.plan_feature_values;
CREATE POLICY "Plan feature values readable" ON public.plan_feature_values
  FOR SELECT USING (true);

-- Only platform admins can manage features and plan values
DROP POLICY IF EXISTS "Admins manage features" ON public.plan_features;
CREATE POLICY "Admins manage features" ON public.plan_features
  FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins manage plan feature values" ON public.plan_feature_values;
CREATE POLICY "Admins manage plan feature values" ON public.plan_feature_values
  FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- Org members can read their org overrides; only admins can change them
DROP POLICY IF EXISTS "Org members view overrides" ON public.organization_plan_overrides;
CREATE POLICY "Org members view overrides" ON public.organization_plan_overrides
  FOR SELECT USING (public.has_org_access(auth.uid(), organization_id, 'viewer') OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins manage overrides" ON public.organization_plan_overrides;
CREATE POLICY "Admins manage overrides" ON public.organization_plan_overrides
  FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- Allow platform admins to manage subscription_plans (extends existing policies if any)
DROP POLICY IF EXISTS "Admins manage subscription plans" ON public.subscription_plans;
CREATE POLICY "Admins manage subscription plans" ON public.subscription_plans
  FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Public can view active plans" ON public.subscription_plans;
CREATE POLICY "Public can view active plans" ON public.subscription_plans
  FOR SELECT USING (is_active = true AND is_archived = false);

-- Platform admins can manage organization subscriptions (assign plans, comp accounts, etc.)
DROP POLICY IF EXISTS "Admins manage org subscriptions" ON public.organization_subscriptions;
CREATE POLICY "Admins manage org subscriptions" ON public.organization_subscriptions
  FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- 8. Seed feature catalog
INSERT INTO public.plan_features (feature_key, name, description, category, feature_type, default_value, display_order) VALUES
  -- Numeric limits
  ('limit_users', 'Maximum users', 'Total seats per organization (-1 = unlimited)', 'limits', 'numeric', '3'::jsonb, 10),
  ('limit_programmes', 'Maximum programmes', 'Total programmes per org (-1 = unlimited)', 'limits', 'numeric', '1'::jsonb, 20),
  ('limit_projects', 'Maximum projects', 'Total projects per org (-1 = unlimited)', 'limits', 'numeric', '2'::jsonb, 30),
  ('limit_products', 'Maximum products', 'Total products per org (-1 = unlimited)', 'limits', 'numeric', '1'::jsonb, 40),
  ('limit_storage_mb', 'Storage (MB)', 'Document storage quota (-1 = unlimited)', 'limits', 'numeric', '100'::jsonb, 50),
  ('limit_ai_credits_monthly', 'AI credits / month', 'Monthly AI assistant requests (-1 = unlimited)', 'limits', 'numeric', '50'::jsonb, 60),
  ('limit_custom_roles', 'Custom roles', 'Number of custom roles allowed', 'limits', 'numeric', '0'::jsonb, 70),
  -- PRINCE2 / MSP governance
  ('feature_prince2_full', 'Full PRINCE2 controls', 'All PRINCE2 governance modules (gates, exceptions, lessons)', 'governance', 'boolean', 'false'::jsonb, 100),
  ('feature_msp_modules', 'MSP programme modules', 'Programme blueprint, tranches, success plan', 'governance', 'boolean', 'false'::jsonb, 110),
  ('feature_stage_gates', 'Stage gates approvals', 'Configurable multi-stage approval workflows', 'governance', 'boolean', 'false'::jsonb, 120),
  -- Collaboration & integrations
  ('feature_sso_saml', 'SSO / SAML', 'Single sign-on via SAML identity providers', 'security', 'boolean', 'false'::jsonb, 200),
  ('feature_audit_log_export', 'Audit log export', 'CSV export of audit log', 'security', 'boolean', 'false'::jsonb, 210),
  ('feature_advanced_rbac', 'Advanced role management', 'Custom roles & granular permissions', 'security', 'boolean', 'false'::jsonb, 220),
  -- Branding
  ('feature_custom_branding', 'Custom branding', 'Logo, colors, login page customization', 'branding', 'boolean', 'false'::jsonb, 300),
  ('feature_white_label', 'White label', 'Remove platform name & branding', 'branding', 'boolean', 'false'::jsonb, 310),
  -- Reporting & AI
  ('feature_scheduled_reports', 'Scheduled reports', 'Automated email delivery of reports', 'reporting', 'boolean', 'false'::jsonb, 400),
  ('feature_advanced_ai', 'Advanced AI assistant', 'GPT-5 / Gemini Pro tier responses', 'ai', 'boolean', 'false'::jsonb, 410),
  ('feature_ai_report_drafting', 'AI report drafting', 'Auto-draft stage gate, exception, end-stage reports', 'ai', 'boolean', 'false'::jsonb, 420),
  -- Platform
  ('feature_api_access', 'Public API access', 'REST API for third-party integrations', 'platform', 'boolean', 'false'::jsonb, 500),
  ('feature_webhooks', 'Webhooks', 'Outbound webhook events', 'platform', 'boolean', 'false'::jsonb, 510),
  ('feature_priority_support', 'Priority support', '24h SLA email support', 'support', 'boolean', 'false'::jsonb, 600)
ON CONFLICT (feature_key) DO NOTHING;

-- 9. Seed plan feature values for existing Free / Pro / Enterprise
-- Free
INSERT INTO public.plan_feature_values (plan_id, feature_key, value)
SELECT id, k, v FROM public.subscription_plans p,
  (VALUES
    ('limit_users', '3'::jsonb), ('limit_programmes', '1'::jsonb), ('limit_projects', '2'::jsonb),
    ('limit_products', '1'::jsonb), ('limit_storage_mb', '100'::jsonb), ('limit_ai_credits_monthly', '50'::jsonb),
    ('limit_custom_roles', '0'::jsonb),
    ('feature_prince2_full', 'false'::jsonb), ('feature_msp_modules', 'false'::jsonb), ('feature_stage_gates', 'false'::jsonb),
    ('feature_sso_saml', 'false'::jsonb), ('feature_audit_log_export', 'false'::jsonb), ('feature_advanced_rbac', 'false'::jsonb),
    ('feature_custom_branding', 'false'::jsonb), ('feature_white_label', 'false'::jsonb),
    ('feature_scheduled_reports', 'false'::jsonb), ('feature_advanced_ai', 'false'::jsonb), ('feature_ai_report_drafting', 'false'::jsonb),
    ('feature_api_access', 'false'::jsonb), ('feature_webhooks', 'false'::jsonb), ('feature_priority_support', 'false'::jsonb)
  ) AS f(k, v)
WHERE p.name = 'Free'
ON CONFLICT (plan_id, feature_key) DO NOTHING;

-- Pro
INSERT INTO public.plan_feature_values (plan_id, feature_key, value)
SELECT id, k, v FROM public.subscription_plans p,
  (VALUES
    ('limit_users', '25'::jsonb), ('limit_programmes', '10'::jsonb), ('limit_projects', '50'::jsonb),
    ('limit_products', '20'::jsonb), ('limit_storage_mb', '5000'::jsonb), ('limit_ai_credits_monthly', '500'::jsonb),
    ('limit_custom_roles', '5'::jsonb),
    ('feature_prince2_full', 'true'::jsonb), ('feature_msp_modules', 'true'::jsonb), ('feature_stage_gates', 'true'::jsonb),
    ('feature_sso_saml', 'true'::jsonb), ('feature_audit_log_export', 'true'::jsonb), ('feature_advanced_rbac', 'true'::jsonb),
    ('feature_custom_branding', 'true'::jsonb), ('feature_white_label', 'false'::jsonb),
    ('feature_scheduled_reports', 'true'::jsonb), ('feature_advanced_ai', 'true'::jsonb), ('feature_ai_report_drafting', 'false'::jsonb),
    ('feature_api_access', 'false'::jsonb), ('feature_webhooks', 'false'::jsonb), ('feature_priority_support', 'true'::jsonb)
  ) AS f(k, v)
WHERE p.name = 'Pro'
ON CONFLICT (plan_id, feature_key) DO NOTHING;

-- Enterprise
INSERT INTO public.plan_feature_values (plan_id, feature_key, value)
SELECT id, k, v FROM public.subscription_plans p,
  (VALUES
    ('limit_users', '-1'::jsonb), ('limit_programmes', '-1'::jsonb), ('limit_projects', '-1'::jsonb),
    ('limit_products', '-1'::jsonb), ('limit_storage_mb', '-1'::jsonb), ('limit_ai_credits_monthly', '-1'::jsonb),
    ('limit_custom_roles', '-1'::jsonb),
    ('feature_prince2_full', 'true'::jsonb), ('feature_msp_modules', 'true'::jsonb), ('feature_stage_gates', 'true'::jsonb),
    ('feature_sso_saml', 'true'::jsonb), ('feature_audit_log_export', 'true'::jsonb), ('feature_advanced_rbac', 'true'::jsonb),
    ('feature_custom_branding', 'true'::jsonb), ('feature_white_label', 'true'::jsonb),
    ('feature_scheduled_reports', 'true'::jsonb), ('feature_advanced_ai', 'true'::jsonb), ('feature_ai_report_drafting', 'true'::jsonb),
    ('feature_api_access', 'true'::jsonb), ('feature_webhooks', 'true'::jsonb), ('feature_priority_support', 'true'::jsonb)
  ) AS f(k, v)
WHERE p.name = 'Enterprise'
ON CONFLICT (plan_id, feature_key) DO NOTHING;

-- Mark Pro plan as highlighted
UPDATE public.subscription_plans SET highlight = true WHERE name = 'Pro';