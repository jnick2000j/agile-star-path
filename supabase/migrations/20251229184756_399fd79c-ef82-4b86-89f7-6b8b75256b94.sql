-- Add a global branding settings row (organization_id = NULL for global/login page branding)
-- First, we need to allow organization_id to be NULL for global branding
-- The branding_settings table already allows NULL organization_id

-- Insert default global branding if it doesn't exist
INSERT INTO public.branding_settings (organization_id, primary_color, secondary_color, accent_color, font_family, logo_url)
SELECT NULL, '#2563eb', '#1e293b', '#3b82f6', 'Inter', NULL
WHERE NOT EXISTS (
  SELECT 1 FROM public.branding_settings WHERE organization_id IS NULL
);

-- Create index for faster lookup of global branding
CREATE INDEX IF NOT EXISTS idx_branding_settings_global ON public.branding_settings (organization_id) WHERE organization_id IS NULL;