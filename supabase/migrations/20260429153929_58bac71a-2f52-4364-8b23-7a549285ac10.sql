CREATE TABLE public.helpdesk_intake_channels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  name TEXT NOT NULL,
  channel_type TEXT NOT NULL DEFAULT 'widget',
  public_token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(20), 'hex'),
  is_active BOOLEAN NOT NULL DEFAULT true,
  default_priority TEXT NOT NULL DEFAULT 'medium',
  default_category_id UUID,
  default_assignee_id UUID,
  branding JSONB NOT NULL DEFAULT '{}'::jsonb,
  allowed_origins TEXT[] DEFAULT ARRAY['*'],
  rate_limit_per_hour INTEGER NOT NULL DEFAULT 30,
  require_email BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_intake_channels_org ON public.helpdesk_intake_channels(organization_id);

ALTER TABLE public.helpdesk_intake_channels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members manage intake channels"
ON public.helpdesk_intake_channels FOR ALL
USING (public.has_org_access(auth.uid(), organization_id))
WITH CHECK (public.has_org_access(auth.uid(), organization_id));

CREATE TRIGGER trg_intake_channels_updated
BEFORE UPDATE ON public.helpdesk_intake_channels
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.helpdesk_intake_submissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  channel_id UUID NOT NULL REFERENCES public.helpdesk_intake_channels(id) ON DELETE CASCADE,
  ticket_id UUID,
  submitter_email TEXT,
  submitter_name TEXT,
  subject TEXT,
  ip_address TEXT,
  user_agent TEXT,
  status TEXT NOT NULL DEFAULT 'success',
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_intake_submissions_channel ON public.helpdesk_intake_submissions(channel_id, created_at DESC);
CREATE INDEX idx_intake_submissions_ip ON public.helpdesk_intake_submissions(channel_id, ip_address, created_at DESC);

ALTER TABLE public.helpdesk_intake_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members view intake submissions"
ON public.helpdesk_intake_submissions FOR SELECT
USING (public.has_org_access(auth.uid(), organization_id));