-- Add ticket_id link to timesheet_entries
ALTER TABLE public.timesheet_entries
  ADD COLUMN IF NOT EXISTS ticket_id UUID NULL
    REFERENCES public.helpdesk_tickets(id) ON DELETE SET NULL;

-- Replace the has_link CHECK to include ticket_id
ALTER TABLE public.timesheet_entries
  DROP CONSTRAINT IF EXISTS timesheet_entries_has_link;

ALTER TABLE public.timesheet_entries
  ADD CONSTRAINT timesheet_entries_has_link CHECK (
    programme_id IS NOT NULL
    OR project_id IS NOT NULL
    OR product_id IS NOT NULL
    OR task_id IS NOT NULL
    OR ticket_id IS NOT NULL
  );

CREATE INDEX IF NOT EXISTS idx_timesheet_entries_ticket
  ON public.timesheet_entries(ticket_id);