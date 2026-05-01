-- Watchers table for helpdesk tickets
CREATE TABLE IF NOT EXISTS public.helpdesk_ticket_watchers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id UUID NOT NULL REFERENCES public.helpdesk_tickets(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  added_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (ticket_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_hd_watchers_ticket ON public.helpdesk_ticket_watchers(ticket_id);
CREATE INDEX IF NOT EXISTS idx_hd_watchers_user ON public.helpdesk_ticket_watchers(user_id);
CREATE INDEX IF NOT EXISTS idx_hd_watchers_org ON public.helpdesk_ticket_watchers(organization_id);

ALTER TABLE public.helpdesk_ticket_watchers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View watchers on accessible tickets"
ON public.helpdesk_ticket_watchers
FOR SELECT
USING (
  has_org_access(auth.uid(), organization_id, 'viewer'::text)
  OR user_id = auth.uid()
  OR is_admin(auth.uid())
);

CREATE POLICY "Org members can add watchers"
ON public.helpdesk_ticket_watchers
FOR INSERT
WITH CHECK (
  has_org_access(auth.uid(), organization_id, 'viewer'::text)
  AND (added_by = auth.uid() OR added_by IS NULL)
);

CREATE POLICY "Remove watcher self or org editor"
ON public.helpdesk_ticket_watchers
FOR DELETE
USING (
  user_id = auth.uid()
  OR has_org_access(auth.uid(), organization_id, 'editor'::text)
  OR is_admin(auth.uid())
);

-- Mentions table to track @mentions inside comments (for notifications/audit)
CREATE TABLE IF NOT EXISTS public.helpdesk_comment_mentions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  comment_id UUID NOT NULL REFERENCES public.helpdesk_ticket_comments(id) ON DELETE CASCADE,
  ticket_id UUID NOT NULL REFERENCES public.helpdesk_tickets(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  mentioned_user_id UUID NOT NULL,
  mentioned_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (comment_id, mentioned_user_id)
);

CREATE INDEX IF NOT EXISTS idx_hd_mentions_ticket ON public.helpdesk_comment_mentions(ticket_id);
CREATE INDEX IF NOT EXISTS idx_hd_mentions_user ON public.helpdesk_comment_mentions(mentioned_user_id);

ALTER TABLE public.helpdesk_comment_mentions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View mentions on accessible tickets"
ON public.helpdesk_comment_mentions
FOR SELECT
USING (
  has_org_access(auth.uid(), organization_id, 'viewer'::text)
  OR mentioned_user_id = auth.uid()
  OR is_admin(auth.uid())
);

CREATE POLICY "Org members can record mentions"
ON public.helpdesk_comment_mentions
FOR INSERT
WITH CHECK (
  has_org_access(auth.uid(), organization_id, 'viewer'::text)
);

CREATE POLICY "Editors can clean up mentions"
ON public.helpdesk_comment_mentions
FOR DELETE
USING (
  has_org_access(auth.uid(), organization_id, 'editor'::text) OR is_admin(auth.uid())
);