
CREATE TABLE IF NOT EXISTS public.migration_sla_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  job_id UUID REFERENCES public.migration_jobs(id) ON DELETE SET NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  external_id TEXT,
  external_key TEXT,
  sla_name TEXT NOT NULL,
  elapsed_minutes INTEGER,
  remaining_minutes INTEGER,
  goal_minutes INTEGER,
  breached BOOLEAN NOT NULL DEFAULT false,
  cycle_state TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_msm_org_entity
  ON public.migration_sla_metrics (organization_id, entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_msm_org_breached
  ON public.migration_sla_metrics (organization_id, breached);
CREATE INDEX IF NOT EXISTS idx_msm_org_sla
  ON public.migration_sla_metrics (organization_id, sla_name);

ALTER TABLE public.migration_sla_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view SLA metrics"
  ON public.migration_sla_metrics
  FOR SELECT
  TO authenticated
  USING (public.has_org_access(auth.uid(), organization_id));

CREATE POLICY "Admins can insert SLA metrics"
  ON public.migration_sla_metrics
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin(auth.uid()) AND public.has_org_access(auth.uid(), organization_id));

CREATE POLICY "Admins can update SLA metrics"
  ON public.migration_sla_metrics
  FOR UPDATE
  TO authenticated
  USING (public.is_admin(auth.uid()) AND public.has_org_access(auth.uid(), organization_id))
  WITH CHECK (public.is_admin(auth.uid()) AND public.has_org_access(auth.uid(), organization_id));

CREATE POLICY "Admins can delete SLA metrics"
  ON public.migration_sla_metrics
  FOR DELETE
  TO authenticated
  USING (public.is_admin(auth.uid()) AND public.has_org_access(auth.uid(), organization_id));

CREATE TRIGGER update_migration_sla_metrics_updated_at
  BEFORE UPDATE ON public.migration_sla_metrics
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
