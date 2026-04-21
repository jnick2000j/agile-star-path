
-- Ensure the feature flag exists in the catalog
INSERT INTO public.plan_features (feature_key, name, description, feature_type, default_value, category)
VALUES (
  'feature_byo_ai_provider',
  'Bring Your Own AI Provider',
  'Allow this organization to configure a custom LLM provider (OpenAI, Anthropic, Azure OpenAI, or self-hosted Ollama/vLLM) instead of the default Lovable AI gateway.',
  'boolean',
  'false'::jsonb,
  'ai'
)
ON CONFLICT (feature_key) DO UPDATE
  SET name = EXCLUDED.name,
      description = EXCLUDED.description,
      category = EXCLUDED.category;

-- Enable for Business and Enterprise plans
INSERT INTO public.plan_feature_values (plan_id, feature_key, value)
SELECT sp.id, 'feature_byo_ai_provider', 'true'::jsonb
  FROM public.subscription_plans sp
 WHERE sp.name ILIKE '%business%' OR sp.name ILIKE '%enterprise%'
ON CONFLICT (plan_id, feature_key) DO UPDATE
  SET value = EXCLUDED.value;
