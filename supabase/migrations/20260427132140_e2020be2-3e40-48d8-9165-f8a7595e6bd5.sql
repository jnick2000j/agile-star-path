-- 1. Per-user dashboard & sidebar preferences
CREATE TABLE public.user_dashboard_prefs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  default_tab TEXT NOT NULL DEFAULT 'my-work',
  quick_actions JSONB NOT NULL DEFAULT '["new-task","new-project","log-update","raise-risk","open-ticket"]'::jsonb,
  sidebar_favorites JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_dashboard_prefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own dashboard prefs" ON public.user_dashboard_prefs
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own dashboard prefs" ON public.user_dashboard_prefs
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own dashboard prefs" ON public.user_dashboard_prefs
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own dashboard prefs" ON public.user_dashboard_prefs
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER trg_user_dashboard_prefs_updated_at
  BEFORE UPDATE ON public.user_dashboard_prefs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. User-pinned entities (projects, programmes, products, tasks, etc.)
CREATE TABLE public.user_pinned_entities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  entity_type TEXT NOT NULL, -- 'project' | 'programme' | 'product' | 'task' | 'register' | etc.
  entity_id UUID,
  label TEXT NOT NULL,
  href TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, entity_type, entity_id, href)
);

CREATE INDEX idx_user_pinned_entities_user ON public.user_pinned_entities(user_id, position);

ALTER TABLE public.user_pinned_entities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own pins" ON public.user_pinned_entities
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own pins" ON public.user_pinned_entities
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own pins" ON public.user_pinned_entities
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own pins" ON public.user_pinned_entities
  FOR DELETE USING (auth.uid() = user_id);

-- 3. Recent entity views (auto-tracked, cap at 20 per user)
CREATE TABLE public.user_recent_entities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  label TEXT NOT NULL,
  href TEXT NOT NULL,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, entity_type, entity_id, href)
);

CREATE INDEX idx_user_recent_entities_user_viewed ON public.user_recent_entities(user_id, viewed_at DESC);

ALTER TABLE public.user_recent_entities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own recents" ON public.user_recent_entities
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own recents" ON public.user_recent_entities
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own recents" ON public.user_recent_entities
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own recents" ON public.user_recent_entities
  FOR DELETE USING (auth.uid() = user_id);

-- Trim recents to most recent 20 per user
CREATE OR REPLACE FUNCTION public.trim_user_recent_entities()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.user_recent_entities
  WHERE user_id = NEW.user_id
    AND id NOT IN (
      SELECT id FROM public.user_recent_entities
      WHERE user_id = NEW.user_id
      ORDER BY viewed_at DESC
      LIMIT 20
    );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_trim_user_recent_entities
  AFTER INSERT OR UPDATE ON public.user_recent_entities
  FOR EACH ROW EXECUTE FUNCTION public.trim_user_recent_entities();