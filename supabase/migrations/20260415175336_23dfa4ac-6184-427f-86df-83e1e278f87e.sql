ALTER TABLE public.tasks ADD COLUMN sprint_id UUID REFERENCES public.sprints(id) ON DELETE SET NULL;

CREATE INDEX idx_tasks_sprint_id ON public.tasks(sprint_id);