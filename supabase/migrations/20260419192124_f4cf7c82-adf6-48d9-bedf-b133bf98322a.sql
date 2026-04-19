ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS timesheets_enabled BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.programmes ADD COLUMN IF NOT EXISTS timesheets_enabled BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS timesheets_enabled BOOLEAN NOT NULL DEFAULT true;