-- Add logo size and visibility controls
ALTER TABLE public.branding_settings
ADD COLUMN IF NOT EXISTS logo_size text DEFAULT 'medium',
ADD COLUMN IF NOT EXISTS show_logo boolean DEFAULT true;