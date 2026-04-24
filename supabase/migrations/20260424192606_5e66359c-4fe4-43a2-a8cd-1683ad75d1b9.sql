CREATE TABLE IF NOT EXISTS public.task_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL,
  author_id UUID NOT NULL,
  body TEXT,
  previous_status public.task_status NULL,
  new_status public.task_status NULL,
  completion_percentage INTEGER NULL CHECK (completion_percentage IS NULL OR (completion_percentage >= 0 AND completion_percentage <= 100)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_task_comments_task ON public.task_comments(task_id);
CREATE INDEX IF NOT EXISTS idx_task_comments_org ON public.task_comments(organization_id);

ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;

-- View: anyone who can see the parent task can see its comments
CREATE POLICY "View task comments via task access" ON public.task_comments
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = task_comments.task_id
      AND (
        t.organization_id IS NULL
        OR public.has_org_access(auth.uid(), t.organization_id)
        OR auth.uid() = t.assigned_to
        OR auth.uid() = t.created_by
        OR public.is_admin(auth.uid())
      )
  )
);

-- Insert: must be the author and have access to the task
CREATE POLICY "Authors create task comments" ON public.task_comments
FOR INSERT WITH CHECK (
  auth.uid() = author_id
  AND EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = task_comments.task_id
      AND (
        t.organization_id IS NULL
        OR public.has_org_access(auth.uid(), t.organization_id)
        OR auth.uid() = t.assigned_to
        OR auth.uid() = t.created_by
        OR public.is_admin(auth.uid())
      )
  )
);

-- Update / Delete: only the author or an admin
CREATE POLICY "Authors update own task comments" ON public.task_comments
FOR UPDATE USING (auth.uid() = author_id OR public.is_admin(auth.uid()));

CREATE POLICY "Authors delete own task comments" ON public.task_comments
FOR DELETE USING (auth.uid() = author_id OR public.is_admin(auth.uid()));

-- Updated-at trigger
CREATE TRIGGER trg_task_comments_updated_at
BEFORE UPDATE ON public.task_comments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();