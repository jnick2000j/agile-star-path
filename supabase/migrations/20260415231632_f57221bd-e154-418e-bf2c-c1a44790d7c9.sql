
-- Create subscription_plans table
CREATE TABLE public.subscription_plans (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  description text,
  price_monthly numeric DEFAULT 0,
  price_yearly numeric DEFAULT 0,
  max_users integer DEFAULT 3,
  max_programmes integer DEFAULT 1,
  max_projects integer DEFAULT 2,
  max_products integer DEFAULT 1,
  max_storage_mb integer DEFAULT 100,
  features jsonb DEFAULT '[]'::jsonb,
  is_active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  stripe_price_id_monthly text,
  stripe_price_id_yearly text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active plans"
  ON public.subscription_plans FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can manage plans"
  ON public.subscription_plans FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- Create organization_subscriptions table
CREATE TABLE public.organization_subscriptions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.subscription_plans(id),
  status text NOT NULL DEFAULT 'trialing',
  trial_ends_at timestamptz,
  current_period_start timestamptz DEFAULT now(),
  current_period_end timestamptz,
  stripe_subscription_id text,
  stripe_customer_id text,
  canceled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id)
);

ALTER TABLE public.organization_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org admins can view their subscription"
  ON public.organization_subscriptions FOR SELECT
  TO authenticated
  USING (public.has_org_access(auth.uid(), organization_id) OR public.is_admin(auth.uid()));

CREATE POLICY "Platform admins can manage all subscriptions"
  ON public.organization_subscriptions FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Org admins can update their subscription"
  ON public.organization_subscriptions FOR UPDATE
  TO authenticated
  USING (public.has_org_access(auth.uid(), organization_id, 'admin'));

-- Seed default plans
INSERT INTO public.subscription_plans (name, description, price_monthly, price_yearly, max_users, max_programmes, max_projects, max_products, max_storage_mb, features, sort_order) VALUES
  ('Free', 'Get started with basic project management', 0, 0, 3, 1, 2, 1, 100, '["Basic PRINCE2 controls", "1 organization", "Community support"]'::jsonb, 0),
  ('Pro', 'For growing teams with advanced needs', 29, 290, 25, 10, 50, 20, 5000, '["All PRINCE2 controls", "Advanced reporting", "Custom branding", "Priority support", "Sprint planning", "Benefits tracking"]'::jsonb, 1),
  ('Enterprise', 'For large organizations with custom requirements', 99, 990, -1, -1, -1, -1, -1, '["Unlimited everything", "SSO/SAML", "Custom integrations", "Dedicated support", "SLA guarantee", "Audit logging", "API access"]'::jsonb, 2);

-- Helper function to check plan limits
CREATE OR REPLACE FUNCTION public.check_plan_limit(
  _org_id uuid,
  _resource_type text
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _plan subscription_plans;
  _current_count integer;
  _max_allowed integer;
BEGIN
  -- Get the org's current plan
  SELECT sp.* INTO _plan
  FROM organization_subscriptions os
  JOIN subscription_plans sp ON sp.id = os.plan_id
  WHERE os.organization_id = _org_id
    AND os.status IN ('active', 'trialing');

  -- If no plan found, deny
  IF _plan IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Get the limit for the resource type
  CASE _resource_type
    WHEN 'users' THEN _max_allowed := _plan.max_users;
    WHEN 'programmes' THEN _max_allowed := _plan.max_programmes;
    WHEN 'projects' THEN _max_allowed := _plan.max_projects;
    WHEN 'products' THEN _max_allowed := _plan.max_products;
    ELSE RETURN TRUE;
  END CASE;

  -- -1 means unlimited
  IF _max_allowed = -1 THEN
    RETURN TRUE;
  END IF;

  -- Count current resources
  CASE _resource_type
    WHEN 'users' THEN
      SELECT COUNT(*) INTO _current_count FROM user_organization_access WHERE organization_id = _org_id;
    WHEN 'programmes' THEN
      SELECT COUNT(*) INTO _current_count FROM programmes WHERE organization_id = _org_id;
    WHEN 'projects' THEN
      SELECT COUNT(*) INTO _current_count FROM projects WHERE organization_id = _org_id;
    WHEN 'products' THEN
      SELECT COUNT(*) INTO _current_count FROM products WHERE organization_id = _org_id;
    ELSE
      RETURN TRUE;
  END CASE;

  RETURN _current_count < _max_allowed;
END;
$$;

-- Triggers for updated_at
CREATE TRIGGER update_subscription_plans_updated_at
  BEFORE UPDATE ON public.subscription_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_organization_subscriptions_updated_at
  BEFORE UPDATE ON public.organization_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
