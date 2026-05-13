ALTER TABLE public.user_dashboard_prefs
  ADD COLUMN IF NOT EXISTS hidden_widgets jsonb NOT NULL DEFAULT '["jsm-contacts"]'::jsonb;

ALTER TABLE public.user_dashboard_prefs
  ALTER COLUMN default_tab SET DEFAULT 'portfolio';