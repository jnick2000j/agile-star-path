-- Add risk_id and issue_id to tasks for remediation tracking
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS risk_id uuid REFERENCES public.risks(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS issue_id uuid REFERENCES public.issues(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_risk_id ON public.tasks(risk_id);
CREATE INDEX IF NOT EXISTS idx_tasks_issue_id ON public.tasks(issue_id);