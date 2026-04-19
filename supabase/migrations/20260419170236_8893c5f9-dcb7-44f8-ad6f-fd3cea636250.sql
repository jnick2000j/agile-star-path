-- Support tickets table
CREATE TABLE public.support_tickets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_by UUID NOT NULL,
  assigned_to UUID,
  type TEXT NOT NULL DEFAULT 'support', -- support | feature_request | bug | question
  priority TEXT NOT NULL DEFAULT 'medium', -- low | medium | high | urgent
  status TEXT NOT NULL DEFAULT 'open', -- open | in_progress | waiting_customer | resolved | closed
  subject TEXT NOT NULL,
  description TEXT,
  resolution TEXT,
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_support_tickets_org ON public.support_tickets(organization_id);
CREATE INDEX idx_support_tickets_status ON public.support_tickets(status);
CREATE INDEX idx_support_tickets_created_by ON public.support_tickets(created_by);

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

-- Org admins can view their org tickets; platform admins see all
CREATE POLICY "Org admins view org tickets"
  ON public.support_tickets FOR SELECT
  USING (
    public.is_admin(auth.uid())
    OR (organization_id IS NOT NULL AND public.has_org_access(auth.uid(), organization_id, 'admin'))
  );

CREATE POLICY "Org admins create tickets"
  ON public.support_tickets FOR INSERT
  WITH CHECK (
    auth.uid() = created_by
    AND (
      public.is_admin(auth.uid())
      OR (organization_id IS NOT NULL AND public.has_org_access(auth.uid(), organization_id, 'admin'))
    )
  );

CREATE POLICY "Org admins update tickets"
  ON public.support_tickets FOR UPDATE
  USING (
    public.is_admin(auth.uid())
    OR (organization_id IS NOT NULL AND public.has_org_access(auth.uid(), organization_id, 'admin'))
  );

CREATE POLICY "Platform admins delete tickets"
  ON public.support_tickets FOR DELETE
  USING (public.is_admin(auth.uid()));

CREATE TRIGGER update_support_tickets_updated_at
  BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Messages / replies on tickets
CREATE TABLE public.support_ticket_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  author_id UUID NOT NULL,
  body TEXT NOT NULL,
  is_internal BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_support_messages_ticket ON public.support_ticket_messages(ticket_id);

ALTER TABLE public.support_ticket_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View messages on accessible tickets"
  ON public.support_ticket_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.support_tickets t
      WHERE t.id = ticket_id
        AND (
          public.is_admin(auth.uid())
          OR (t.organization_id IS NOT NULL AND public.has_org_access(auth.uid(), t.organization_id, 'admin'))
        )
        AND (NOT is_internal OR public.is_admin(auth.uid()))
    )
  );

CREATE POLICY "Create messages on accessible tickets"
  ON public.support_ticket_messages FOR INSERT
  WITH CHECK (
    auth.uid() = author_id
    AND EXISTS (
      SELECT 1 FROM public.support_tickets t
      WHERE t.id = ticket_id
        AND (
          public.is_admin(auth.uid())
          OR (t.organization_id IS NOT NULL AND public.has_org_access(auth.uid(), t.organization_id, 'admin'))
        )
    )
  );

CREATE POLICY "Authors and platform admins delete messages"
  ON public.support_ticket_messages FOR DELETE
  USING (auth.uid() = author_id OR public.is_admin(auth.uid()));