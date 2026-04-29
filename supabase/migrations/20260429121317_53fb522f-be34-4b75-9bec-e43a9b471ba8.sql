DO $$ BEGIN
  CREATE TYPE public.helpdesk_resolution_code AS ENUM (
    'fixed',
    'not_fixed',
    'duplicate',
    'wont_fix',
    'cannot_reproduce',
    'known_error',
    'workaround_provided'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.helpdesk_tickets
  ADD COLUMN IF NOT EXISTS resolution_code public.helpdesk_resolution_code;