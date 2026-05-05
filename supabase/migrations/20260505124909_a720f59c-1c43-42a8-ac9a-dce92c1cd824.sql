-- Add reply_to to org-level email settings
ALTER TABLE public.email_settings
  ADD COLUMN IF NOT EXISTS reply_to text;

-- Add per-queue From/Reply-To overrides for helpdesk
ALTER TABLE public.helpdesk_queues
  ADD COLUMN IF NOT EXISTS from_address text,
  ADD COLUMN IF NOT EXISTS from_name text,
  ADD COLUMN IF NOT EXISTS reply_to text;