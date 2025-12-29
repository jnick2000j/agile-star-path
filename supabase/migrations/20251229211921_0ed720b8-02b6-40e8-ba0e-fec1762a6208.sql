-- Add text customization columns for login page branding
ALTER TABLE public.branding_settings
ADD COLUMN IF NOT EXISTS app_name text DEFAULT 'PIMP',
ADD COLUMN IF NOT EXISTS app_tagline text DEFAULT 'Programme Information Management Platform',
ADD COLUMN IF NOT EXISTS welcome_message text DEFAULT NULL;