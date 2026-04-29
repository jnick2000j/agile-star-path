CREATE TABLE public.helpdesk_email_inboxes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  email_address TEXT NOT NULL UNIQUE,
  display_name TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  default_channel_id UUID REFERENCES public.helpdesk_intake_channels(id) ON DELETE SET NULL,
  default_priority TEXT NOT NULL DEFAULT 'medium',
  default_category TEXT,
  default_assignee_id UUID,
  auto_reply_enabled BOOLEAN NOT NULL DEFAULT true,
  auto_reply_subject TEXT,
  auto_reply_body TEXT,
  spam_filter_enabled BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_email_inboxes_org ON public.helpdesk_email_inboxes(organization_id);

ALTER TABLE public.helpdesk_email_inboxes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members manage email inboxes"
ON public.helpdesk_email_inboxes FOR ALL
USING (public.has_org_access(auth.uid(), organization_id))
WITH CHECK (public.has_org_access(auth.uid(), organization_id));

CREATE TRIGGER trg_email_inboxes_updated
BEFORE UPDATE ON public.helpdesk_email_inboxes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.helpdesk_email_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  inbox_id UUID REFERENCES public.helpdesk_email_inboxes(id) ON DELETE SET NULL,
  ticket_id UUID,
  direction TEXT NOT NULL DEFAULT 'inbound',
  message_id TEXT,
  in_reply_to TEXT,
  references_ids TEXT[],
  from_email TEXT NOT NULL,
  from_name TEXT,
  to_email TEXT,
  cc_emails TEXT[],
  subject TEXT,
  body_text TEXT,
  body_html TEXT,
  raw_headers JSONB,
  attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_spam BOOLEAN NOT NULL DEFAULT false,
  is_auto_reply BOOLEAN NOT NULL DEFAULT false,
  processing_status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_email_messages_org ON public.helpdesk_email_messages(organization_id, received_at DESC);
CREATE INDEX idx_email_messages_ticket ON public.helpdesk_email_messages(ticket_id);
CREATE INDEX idx_email_messages_message_id ON public.helpdesk_email_messages(message_id);
CREATE INDEX idx_email_messages_in_reply_to ON public.helpdesk_email_messages(in_reply_to);

ALTER TABLE public.helpdesk_email_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members view email messages"
ON public.helpdesk_email_messages FOR SELECT
USING (public.has_org_access(auth.uid(), organization_id));

CREATE POLICY "Org members manage email messages"
ON public.helpdesk_email_messages FOR ALL
USING (public.has_org_access(auth.uid(), organization_id))
WITH CHECK (public.has_org_access(auth.uid(), organization_id));

INSERT INTO storage.buckets (id, name, public) VALUES ('helpdesk-email-attachments', 'helpdesk-email-attachments', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Org members read email attachments"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'helpdesk-email-attachments'
  AND EXISTS (
    SELECT 1 FROM public.helpdesk_email_messages m
    WHERE m.organization_id::text = (storage.foldername(name))[1]
    AND public.has_org_access(auth.uid(), m.organization_id)
  )
);