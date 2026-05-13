CREATE TABLE public.user_dashboard_widgets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  title text NOT NULL,
  widget_type text NOT NULL CHECK (widget_type IN ('note','links','metric')),
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  position integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_dashboard_widgets_user ON public.user_dashboard_widgets(user_id, position);

ALTER TABLE public.user_dashboard_widgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own widgets" ON public.user_dashboard_widgets
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own widgets" ON public.user_dashboard_widgets
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own widgets" ON public.user_dashboard_widgets
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own widgets" ON public.user_dashboard_widgets
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER trg_user_dashboard_widgets_updated_at
  BEFORE UPDATE ON public.user_dashboard_widgets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();