ALTER TABLE public.branding_settings
  ADD COLUMN IF NOT EXISTS logo_header_width  integer,
  ADD COLUMN IF NOT EXISTS logo_header_height integer,
  ADD COLUMN IF NOT EXISTS logo_login_width   integer,
  ADD COLUMN IF NOT EXISTS logo_login_height  integer,
  ADD COLUMN IF NOT EXISTS logo_email_width   integer,
  ADD COLUMN IF NOT EXISTS logo_email_height  integer;

-- Enforce sensible bounds (4..512 px). NULL means "inherit from platform default".
ALTER TABLE public.branding_settings
  ADD CONSTRAINT branding_logo_header_width_range  CHECK (logo_header_width  IS NULL OR (logo_header_width  BETWEEN 4 AND 512)),
  ADD CONSTRAINT branding_logo_header_height_range CHECK (logo_header_height IS NULL OR (logo_header_height BETWEEN 4 AND 512)),
  ADD CONSTRAINT branding_logo_login_width_range   CHECK (logo_login_width   IS NULL OR (logo_login_width   BETWEEN 4 AND 512)),
  ADD CONSTRAINT branding_logo_login_height_range  CHECK (logo_login_height  IS NULL OR (logo_login_height  BETWEEN 4 AND 512)),
  ADD CONSTRAINT branding_logo_email_width_range   CHECK (logo_email_width   IS NULL OR (logo_email_width   BETWEEN 4 AND 512)),
  ADD CONSTRAINT branding_logo_email_height_range  CHECK (logo_email_height  IS NULL OR (logo_email_height  BETWEEN 4 AND 512));