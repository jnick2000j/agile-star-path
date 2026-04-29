ALTER TABLE public.helpdesk_tickets
  ADD COLUMN IF NOT EXISTS parent_ticket_id uuid
  REFERENCES public.helpdesk_tickets(id) ON DELETE SET NULL;

ALTER TABLE public.helpdesk_tickets
  DROP CONSTRAINT IF EXISTS helpdesk_tickets_parent_self_check;
ALTER TABLE public.helpdesk_tickets
  ADD CONSTRAINT helpdesk_tickets_parent_self_check
  CHECK (parent_ticket_id IS NULL OR parent_ticket_id <> id);

CREATE INDEX IF NOT EXISTS idx_helpdesk_tickets_parent
  ON public.helpdesk_tickets (parent_ticket_id);