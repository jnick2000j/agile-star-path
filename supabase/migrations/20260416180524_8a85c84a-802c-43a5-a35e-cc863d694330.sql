ALTER TABLE public.branding_settings
ADD COLUMN IF NOT EXISTS show_app_name boolean NOT NULL DEFAULT true;