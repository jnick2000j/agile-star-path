-- Add language preference to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS preferred_language text NOT NULL DEFAULT 'en';

-- Cache approved AI summary translations
ALTER TABLE public.ai_summaries
  ADD COLUMN IF NOT EXISTS translations jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Track target language on audit log entries
ALTER TABLE public.ai_audit_log
  ADD COLUMN IF NOT EXISTS target_language text;

-- Helpful index for filtering translated summaries
CREATE INDEX IF NOT EXISTS idx_ai_summaries_translations_keys
  ON public.ai_summaries USING gin (translations);
