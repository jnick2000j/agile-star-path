CREATE TABLE IF NOT EXISTS public.organization_calendar_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('google','microsoft')),
  enabled boolean NOT NULL DEFAULT false,
  use_custom_oauth boolean NOT NULL DEFAULT false,
  custom_client_id text,
  custom_client_secret text,
  tenant_id text,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, provider)
);

ALTER TABLE public.organization_calendar_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org admins manage calendar integrations"
ON public.organization_calendar_integrations FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (SELECT 1 FROM public.user_organization_access uoa
    WHERE uoa.user_id = auth.uid()
      AND uoa.organization_id = organization_calendar_integrations.organization_id
      AND uoa.access_level = 'admin')
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (SELECT 1 FROM public.user_organization_access uoa
    WHERE uoa.user_id = auth.uid()
      AND uoa.organization_id = organization_calendar_integrations.organization_id
      AND uoa.access_level = 'admin')
);

CREATE OR REPLACE VIEW public.org_calendar_integrations_public AS
SELECT id, organization_id, provider, enabled, use_custom_oauth, tenant_id
FROM public.organization_calendar_integrations
WHERE enabled = true;

GRANT SELECT ON public.org_calendar_integrations_public TO authenticated;

CREATE TRIGGER trg_oci_updated_at
BEFORE UPDATE ON public.organization_calendar_integrations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.user_calendar_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('google','microsoft')),
  account_email text,
  target_calendar_id text NOT NULL DEFAULT 'primary',
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  sync_token text,
  delta_link text,
  last_synced_at timestamptz,
  sync_enabled boolean NOT NULL DEFAULT true,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, provider)
);

ALTER TABLE public.user_calendar_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users manage own calendar connections"
ON public.user_calendar_connections FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_ucc_updated_at
BEFORE UPDATE ON public.user_calendar_connections
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TABLE IF EXISTS public.user_google_calendar_connections CASCADE;

ALTER TABLE public.task_calendar_event_links
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'google'
    CHECK (provider IN ('google','microsoft'));

DO $$ BEGIN
  ALTER TABLE public.task_calendar_event_links DROP CONSTRAINT task_calendar_event_links_task_id_user_id_key;
EXCEPTION WHEN undefined_object THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS task_calendar_event_links_unique
  ON public.task_calendar_event_links (task_id, user_id, provider);

ALTER TABLE IF EXISTS public.gcal_sync_queue RENAME TO calendar_sync_queue;
ALTER TABLE public.calendar_sync_queue ADD COLUMN IF NOT EXISTS provider text;

CREATE OR REPLACE FUNCTION public.enqueue_gcal_sync()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid;
  v_task uuid;
  r record;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_user := OLD.assigned_to; v_task := OLD.id;
  ELSE
    v_user := NEW.assigned_to; v_task := NEW.id;
  END IF;
  IF v_user IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;
  FOR r IN
    SELECT provider FROM public.user_calendar_connections
    WHERE user_id = v_user AND sync_enabled = true
  LOOP
    INSERT INTO public.calendar_sync_queue (task_id, user_id, provider, op, created_at)
    VALUES (v_task, v_user, r.provider, TG_OP, now());
  END LOOP;
  RETURN COALESCE(NEW, OLD);
END;
$$;
