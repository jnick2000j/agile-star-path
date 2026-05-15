
-- 1. ICS subscription tokens
CREATE TABLE public.task_calendar_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL,
  token TEXT NOT NULL UNIQUE,
  scope TEXT NOT NULL DEFAULT 'my_tasks' CHECK (scope IN ('my_tasks', 'org_tasks')),
  revoked_at TIMESTAMPTZ,
  last_accessed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_task_calendar_tokens_user ON public.task_calendar_tokens(user_id);
CREATE INDEX idx_task_calendar_tokens_token ON public.task_calendar_tokens(token) WHERE revoked_at IS NULL;

ALTER TABLE public.task_calendar_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own calendar tokens"
  ON public.task_calendar_tokens
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_task_calendar_tokens_updated
  BEFORE UPDATE ON public.task_calendar_tokens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Google Calendar per-user connections
CREATE TABLE public.user_google_calendar_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  google_account_email TEXT NOT NULL,
  target_calendar_id TEXT NOT NULL DEFAULT 'primary',
  access_token TEXT,
  refresh_token TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ,
  sync_token TEXT,
  last_synced_at TIMESTAMPTZ,
  sync_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_google_calendar_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own google calendar connection"
  ON public.user_google_calendar_connections
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_user_google_calendar_connections_updated
  BEFORE UPDATE ON public.user_google_calendar_connections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Task <-> Google event links
CREATE TABLE public.task_calendar_event_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  google_event_id TEXT NOT NULL,
  etag TEXT,
  last_pushed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (task_id, user_id)
);

CREATE INDEX idx_task_calendar_event_links_user ON public.task_calendar_event_links(user_id);

ALTER TABLE public.task_calendar_event_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own task event links"
  ON public.task_calendar_event_links
  FOR SELECT
  USING (auth.uid() = user_id);

-- 4. Sync queue for debounced Google pushes
CREATE TABLE public.gcal_sync_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id UUID,
  action TEXT NOT NULL CHECK (action IN ('upsert', 'delete')),
  enqueued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX idx_gcal_sync_queue_pending ON public.gcal_sync_queue(user_id) WHERE processed_at IS NULL;

ALTER TABLE public.gcal_sync_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own queue entries"
  ON public.gcal_sync_queue
  FOR SELECT
  USING (auth.uid() = user_id);

-- 5. Trigger: enqueue google sync on task changes
CREATE OR REPLACE FUNCTION public.enqueue_gcal_sync()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user UUID;
  _task UUID;
  _action TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    _user := OLD.assigned_to;
    _task := OLD.id;
    _action := 'delete';
  ELSE
    _user := NEW.assigned_to;
    _task := NEW.id;
    _action := 'upsert';
  END IF;

  IF _user IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Only enqueue if user has an active Google connection
  IF NOT EXISTS (
    SELECT 1 FROM public.user_google_calendar_connections
    WHERE user_id = _user AND sync_enabled = true
  ) THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  INSERT INTO public.gcal_sync_queue (user_id, task_id, action)
  VALUES (_user, _task, _action);

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_tasks_enqueue_gcal_sync
  AFTER INSERT OR UPDATE OF planned_start, planned_end, name, description, status, assigned_to OR DELETE
  ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_gcal_sync();
