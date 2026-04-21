-- Default AI provider for on-prem installs: local Ollama. Customers can
-- override via the Platform Admin UI or by editing this row directly.
INSERT INTO public.ai_provider_settings
  (scope, provider, default_model, base_url, is_active, enabled_modules, notes)
VALUES
  ('global', 'ollama', 'llama3.1:8b', 'http://ollama:11434', true,
   '{"summaries": true, "advisor": true, "drafts": true, "insights": true}'::jsonb,
   'Default on-prem provider. Replace with your preferred provider in Platform Admin.')
ON CONFLICT DO NOTHING;
