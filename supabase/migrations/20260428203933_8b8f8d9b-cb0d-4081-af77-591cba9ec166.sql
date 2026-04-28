-- 1) Seed three module-toggle features into the catalog
INSERT INTO public.plan_features (feature_key, name, description, category, feature_type, default_value, display_order, is_active)
VALUES
  ('feature_module_programmes', 'Programmes module', 'Enables the Programmes (MSP) module for the organization.', 'modules', 'boolean', 'true'::jsonb, 10, true),
  ('feature_module_projects', 'Projects module', 'Enables the Projects (PRINCE2/Agile) module for the organization.', 'modules', 'boolean', 'true'::jsonb, 11, true),
  ('feature_module_products', 'Products module', 'Enables the Products (roadmap, backlog) module for the organization.', 'modules', 'boolean', 'true'::jsonb, 12, true)
ON CONFLICT (feature_key) DO NOTHING;

-- 2) Allow org admins to manage module-toggle overrides for their own org
-- (limited to the three module keys so admins cannot self-grant arbitrary premium features)
CREATE POLICY "Org admins manage module overrides"
ON public.organization_plan_overrides
FOR ALL
TO authenticated
USING (
  has_org_access(auth.uid(), organization_id, 'admin'::text)
  AND feature_key IN ('feature_module_programmes', 'feature_module_projects', 'feature_module_products')
)
WITH CHECK (
  has_org_access(auth.uid(), organization_id, 'admin'::text)
  AND feature_key IN ('feature_module_programmes', 'feature_module_projects', 'feature_module_products')
);