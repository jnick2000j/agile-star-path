-- Add font size control for login page header
ALTER TABLE public.branding_settings
ADD COLUMN IF NOT EXISTS header_font_size text DEFAULT 'medium';