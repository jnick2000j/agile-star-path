
-- Schedule SIEM exporter flush every 5 minutes via pg_cron + pg_net
-- Iterates over each active exporter and invokes the siem-export edge function
-- with the exporter_id, using the service-role key for authorization.

-- Helper that fans out one HTTP call per active exporter
CREATE OR REPLACE FUNCTION public.cron_flush_siem_exporters()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _exp RECORD;
  _count INT := 0;
  _service_key TEXT := current_setting('app.settings.service_role_key', true);
  _project_url TEXT := current_setting('app.settings.project_url', true);
BEGIN
  -- Fall back to env-derived defaults if app.settings are not configured
  IF _service_key IS NULL OR _service_key = '' THEN
    _service_key := current_setting('supabase.service_role_key', true);
  END IF;
  IF _project_url IS NULL OR _project_url = '' THEN
    _project_url := 'https://lpsbudbighowwdmgdfyc.supabase.co';
  END IF;

  IF _service_key IS NULL OR _service_key = '' THEN
    RETURN jsonb_build_object('status', 'skipped', 'reason', 'service_role_key not configured');
  END IF;

  FOR _exp IN
    SELECT id, organization_id
      FROM siem_exporters
     WHERE is_active = true
       AND consecutive_failures < 10  -- stop spamming dead endpoints
  LOOP
    PERFORM net.http_post(
      url     := _project_url || '/functions/v1/siem-export',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || _service_key
      ),
      body    := jsonb_build_object('exporter_id', _exp.id)
    );
    _count := _count + 1;
  END LOOP;

  RETURN jsonb_build_object('status','ok','exporters_dispatched', _count, 'at', now());
END;
$$;

-- Drop existing schedule if present (idempotent re-run)
DO $$
BEGIN
  PERFORM cron.unschedule('siem-exporter-flush');
EXCEPTION WHEN others THEN
  -- schedule did not exist; ignore
  NULL;
END $$;

-- Schedule every 5 minutes
SELECT cron.schedule(
  'siem-exporter-flush',
  '*/5 * * * *',
  $$ SELECT public.cron_flush_siem_exporters(); $$
);

GRANT EXECUTE ON FUNCTION public.cron_flush_siem_exporters() TO service_role;
