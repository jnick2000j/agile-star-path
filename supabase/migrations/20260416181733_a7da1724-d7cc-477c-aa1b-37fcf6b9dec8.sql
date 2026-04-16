ALTER TABLE public.branding_settings
  ADD COLUMN IF NOT EXISTS show_tagline boolean NOT NULL DEFAULT true;