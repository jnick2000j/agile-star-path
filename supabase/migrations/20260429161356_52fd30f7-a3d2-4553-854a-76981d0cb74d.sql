CREATE TABLE public.helpdesk_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  dataset TEXT NOT NULL DEFAULT 'tickets',
  filters JSONB NOT NULL DEFAULT '{}'::jsonb,
  columns JSONB NOT NULL DEFAULT '[]'::jsonb,
  group_by TEXT,
  sort_by TEXT,
  sort_dir TEXT DEFAULT 'desc',
  schedule_interval TEXT,
  recipients TEXT[],
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  next_run_at TIMESTAMPTZ,
  last_run_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_helpdesk_reports_org ON public.helpdesk_reports(organization_id);
CREATE INDEX idx_helpdesk_reports_schedule ON public.helpdesk_reports(next_run_at) WHERE schedule_interval IS NOT NULL AND is_enabled = true;

CREATE TABLE public.helpdesk_report_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  report_id UUID NOT NULL REFERENCES public.helpdesk_reports(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'running',
  row_count INT DEFAULT 0,
  file_size_bytes INT DEFAULT 0,
  error_message TEXT,
  triggered_by UUID,
  trigger_source TEXT NOT NULL DEFAULT 'manual',
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_helpdesk_report_runs_report ON public.helpdesk_report_runs(report_id, started_at DESC);

ALTER TABLE public.helpdesk_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.helpdesk_report_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reports_select_org" ON public.helpdesk_reports
  FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "reports_insert_self" ON public.helpdesk_reports
  FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(auth.uid(), organization_id) AND created_by = auth.uid());

CREATE POLICY "reports_update_owner_or_admin" ON public.helpdesk_reports
  FOR UPDATE TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id) AND (created_by = auth.uid() OR public.is_org_admin(auth.uid(), organization_id)))
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "reports_delete_owner_or_admin" ON public.helpdesk_reports
  FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR public.is_org_admin(auth.uid(), organization_id));

CREATE POLICY "report_runs_select_org" ON public.helpdesk_report_runs
  FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "report_runs_insert_org" ON public.helpdesk_report_runs
  FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));

CREATE TRIGGER trg_helpdesk_reports_updated
BEFORE UPDATE ON public.helpdesk_reports
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.helpdesk_report_compute_next_run(_interval TEXT)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
BEGIN
  RETURN CASE _interval
    WHEN 'hourly' THEN now() + interval '1 hour'
    WHEN 'daily' THEN now() + interval '1 day'
    WHEN 'weekly' THEN now() + interval '7 days'
    WHEN 'monthly' THEN now() + interval '1 month'
    ELSE NULL
  END;
END;
$$;