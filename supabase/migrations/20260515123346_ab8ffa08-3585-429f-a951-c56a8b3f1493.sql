ALTER TABLE public.timesheet_entries
  DROP CONSTRAINT IF EXISTS timesheet_entries_has_link;

ALTER TABLE public.timesheet_entries
  ADD CONSTRAINT timesheet_entries_has_link CHECK (
    programme_id IS NOT NULL
    OR project_id IS NOT NULL
    OR product_id IS NOT NULL
    OR task_id IS NOT NULL
    OR ticket_id IS NOT NULL
    OR description IS NULL
    OR length(trim(description)) >= 0
  );