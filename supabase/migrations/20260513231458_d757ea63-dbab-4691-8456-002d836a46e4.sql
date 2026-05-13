ALTER TABLE public.user_dashboard_widgets
  ADD COLUMN IF NOT EXISTS dashboard_scope text NOT NULL DEFAULT 'portfolio';

ALTER TABLE public.user_dashboard_widgets
  DROP CONSTRAINT IF EXISTS user_dashboard_widgets_dashboard_scope_check;

ALTER TABLE public.user_dashboard_widgets
  ADD CONSTRAINT user_dashboard_widgets_dashboard_scope_check
  CHECK (dashboard_scope IN ('portfolio','my-work'));

CREATE INDEX IF NOT EXISTS idx_user_dashboard_widgets_user_scope
  ON public.user_dashboard_widgets (user_id, dashboard_scope, position);