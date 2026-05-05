-- 1) Add new feature_module_change_management
INSERT INTO public.plan_features (feature_key, name, description, category, feature_type, default_value, display_order, is_active)
VALUES ('feature_module_change_management', 'Change Management Module', 'Enables the Change Management (RFC/CAB/CM workflows) module.', 'modules', 'boolean', 'false'::jsonb, 50, true)
ON CONFLICT (feature_key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  feature_type = EXCLUDED.feature_type,
  is_active = true;

-- 2) Flip defaults of programmes/projects/products to false so they must be explicitly granted by a plan.
UPDATE public.plan_features SET default_value = 'false'::jsonb
WHERE feature_key IN ('feature_module_programmes','feature_module_projects','feature_module_products');

-- 3) Explicitly grant programmes/projects/products to the 3 core (PPM) plans.
WITH core_plans AS (
  SELECT id FROM public.subscription_plans WHERE plan_kind = 'core' AND is_active
), feats(feature_key) AS (
  VALUES ('feature_module_programmes'), ('feature_module_projects'), ('feature_module_products')
)
INSERT INTO public.plan_feature_values (plan_id, feature_key, value)
SELECT cp.id, f.feature_key, 'true'::jsonb
FROM core_plans cp CROSS JOIN feats f
ON CONFLICT (plan_id, feature_key) DO UPDATE SET value = EXCLUDED.value;

-- 4) Grant feature_module_change_management to ITSM plans, Change Management Add-on, and core plans (PPM keeps CM).
INSERT INTO public.plan_feature_values (plan_id, feature_key, value)
SELECT id, 'feature_module_change_management', 'true'::jsonb
FROM public.subscription_plans
WHERE is_active AND (
  plan_kind IN ('itsm','core')
  OR id = 'aaaaaaaa-1003-4000-8000-000000000002' -- Change Management Add-on
)
ON CONFLICT (plan_id, feature_key) DO UPDATE SET value = EXCLUDED.value;

-- 5) Bundle LMS with helpdesk + itsm plans (Helpdesk & Learning, ITSM & Learning per onboarding copy).
INSERT INTO public.plan_feature_values (plan_id, feature_key, value)
SELECT id, 'feature_lms', 'true'::jsonb
FROM public.subscription_plans
WHERE is_active AND plan_kind IN ('helpdesk','itsm')
ON CONFLICT (plan_id, feature_key) DO UPDATE SET value = EXCLUDED.value;