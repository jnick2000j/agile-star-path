-- Helpdesk ticket attachments
CREATE TABLE IF NOT EXISTS public.helpdesk_ticket_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.helpdesk_tickets(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL,
  comment_id UUID REFERENCES public.helpdesk_ticket_comments(id) ON DELETE SET NULL,
  uploaded_by UUID,
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size BIGINT,
  mime_type TEXT,
  is_internal BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hd_attachments_ticket ON public.helpdesk_ticket_attachments(ticket_id);
CREATE INDEX IF NOT EXISTS idx_hd_attachments_org ON public.helpdesk_ticket_attachments(organization_id);

ALTER TABLE public.helpdesk_ticket_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view ticket attachments"
ON public.helpdesk_ticket_attachments FOR SELECT
USING (public.has_org_access(auth.uid(), organization_id, 'viewer'));

CREATE POLICY "Org members can upload ticket attachments"
ON public.helpdesk_ticket_attachments FOR INSERT
WITH CHECK (
  public.has_org_access(auth.uid(), organization_id, 'viewer')
  AND uploaded_by = auth.uid()
);

CREATE POLICY "Uploaders or admins can delete ticket attachments"
ON public.helpdesk_ticket_attachments FOR DELETE
USING (
  uploaded_by = auth.uid()
  OR public.has_org_access(auth.uid(), organization_id, 'manager')
);

-- Private storage bucket for helpdesk attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('helpdesk-attachments', 'helpdesk-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: path layout = {organization_id}/{ticket_id}/{filename}
CREATE POLICY "Org members can read helpdesk attachments"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'helpdesk-attachments'
  AND public.has_org_access(auth.uid(), ((storage.foldername(name))[1])::uuid, 'viewer')
);

CREATE POLICY "Org members can upload helpdesk attachments"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'helpdesk-attachments'
  AND public.has_org_access(auth.uid(), ((storage.foldername(name))[1])::uuid, 'viewer')
);

CREATE POLICY "Uploaders or managers can delete helpdesk attachments"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'helpdesk-attachments'
  AND (owner = auth.uid() OR public.has_org_access(auth.uid(), ((storage.foldername(name))[1])::uuid, 'manager'))
);