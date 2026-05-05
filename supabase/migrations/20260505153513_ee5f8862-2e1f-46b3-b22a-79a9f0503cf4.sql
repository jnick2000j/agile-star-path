ALTER TABLE public.helpdesk_intake_channels
ADD COLUMN IF NOT EXISTS require_authenticated boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.helpdesk_intake_channels.require_authenticated IS
'When true, only authenticated users who are members of the organization can submit tickets through this channel.';