
-- 1) ai_provider_settings catalog
CREATE TABLE IF NOT EXISTS public.ai_provider_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL CHECK (scope IN ('global', 'organization')),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('lovable', 'openai', 'anthropic', 'azure_openai', 'ollama')),
  default_model text,
  base_url text,
  api_key_secret_name text,
  enabled_modules jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_provider_settings_scope_org_chk
    CHECK ((scope = 'global' AND organization_id IS NULL) OR (scope = 'organization' AND organization_id IS NOT NULL))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_ai_provider_settings_global
  ON public.ai_provider_settings ((scope))
  WHERE scope = 'global';
CREATE UNIQUE INDEX IF NOT EXISTS uq_ai_provider_settings_org
  ON public.ai_provider_settings (organization_id)
  WHERE scope = 'organization';

ALTER TABLE public.ai_provider_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read AI provider settings"
  ON public.ai_provider_settings FOR SELECT
  TO authenticated
  USING (
    scope = 'global'
    OR (scope = 'organization' AND public.has_org_access(auth.uid(), organization_id, 'viewer'))
    OR public.is_admin(auth.uid())
  );

CREATE POLICY "Platform admins manage global AI provider"
  ON public.ai_provider_settings FOR ALL
  TO authenticated
  USING (scope = 'global' AND public.is_admin(auth.uid()))
  WITH CHECK (scope = 'global' AND public.is_admin(auth.uid()));

CREATE POLICY "Org admins manage their AI provider"
  ON public.ai_provider_settings FOR ALL
  TO authenticated
  USING (
    scope = 'organization'
    AND (public.has_org_access(auth.uid(), organization_id, 'admin') OR public.is_admin(auth.uid()))
  )
  WITH CHECK (
    scope = 'organization'
    AND (public.has_org_access(auth.uid(), organization_id, 'admin') OR public.is_admin(auth.uid()))
  );

DROP TRIGGER IF EXISTS trg_ai_provider_settings_updated ON public.ai_provider_settings;
CREATE TRIGGER trg_ai_provider_settings_updated
  BEFORE UPDATE ON public.ai_provider_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.ai_provider_settings (scope, provider, default_model, notes)
SELECT 'global', 'lovable', 'google/gemini-2.5-flash', 'Default Lovable AI Gateway. Override per-org or globally.'
WHERE NOT EXISTS (SELECT 1 FROM public.ai_provider_settings WHERE scope = 'global');

-- 2) Effective-provider resolver
CREATE OR REPLACE FUNCTION public.get_effective_ai_provider(_org_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row ai_provider_settings;
BEGIN
  IF _org_id IS NOT NULL THEN
    SELECT * INTO _row FROM ai_provider_settings
     WHERE scope = 'organization' AND organization_id = _org_id AND is_active = true
     LIMIT 1;
    IF FOUND THEN
      RETURN jsonb_build_object(
        'source', 'organization',
        'provider', _row.provider,
        'default_model', _row.default_model,
        'base_url', _row.base_url,
        'api_key_secret_name', _row.api_key_secret_name,
        'enabled_modules', _row.enabled_modules
      );
    END IF;
  END IF;

  SELECT * INTO _row FROM ai_provider_settings
   WHERE scope = 'global' AND is_active = true
   LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'source', 'global',
      'provider', _row.provider,
      'default_model', _row.default_model,
      'base_url', _row.base_url,
      'api_key_secret_name', _row.api_key_secret_name,
      'enabled_modules', _row.enabled_modules
    );
  END IF;

  RETURN jsonb_build_object(
    'source', 'fallback',
    'provider', 'lovable',
    'default_model', 'google/gemini-2.5-flash',
    'base_url', NULL,
    'api_key_secret_name', NULL,
    'enabled_modules', '{}'::jsonb
  );
END;
$$;

-- 3) Plan feature flag for cloud BYO-AI-key
INSERT INTO public.plan_features (feature_key, name, description, default_value, feature_type, category)
SELECT 'feature_byo_ai_provider',
       'Bring your own AI provider',
       'Allow org admins to configure a custom AI provider (OpenAI, Anthropic, Azure OpenAI, Ollama) with their own API key.',
       'false'::jsonb, 'boolean', 'ai'
WHERE NOT EXISTS (
  SELECT 1 FROM public.plan_features WHERE feature_key = 'feature_byo_ai_provider'
);
