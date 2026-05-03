CREATE TABLE public.migration_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  source text NOT NULL,
  source_label text,
  status text NOT NULL DEFAULT 'draft',
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  field_map jsonb NOT NULL DEFAULT '{}'::jsonb,
  totals jsonb NOT NULL DEFAULT '{}'::jsonb,
  progress jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_summary text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz
);
CREATE INDEX idx_migration_jobs_org ON public.migration_jobs(organization_id, created_at DESC);
ALTER TABLE public.migration_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage migration jobs"
ON public.migration_jobs FOR ALL
USING (public.has_org_access(auth.uid(), organization_id) AND public.is_admin(auth.uid()))
WITH CHECK (public.has_org_access(auth.uid(), organization_id) AND public.is_admin(auth.uid()));
CREATE TRIGGER trg_migration_jobs_updated_at
BEFORE UPDATE ON public.migration_jobs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.migration_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.migration_jobs(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL,
  entity_type text NOT NULL,
  external_id text NOT NULL,
  external_key text,
  internal_id uuid,
  status text NOT NULL DEFAULT 'pending',
  error text,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_migration_items_job ON public.migration_items(job_id, entity_type);
CREATE UNIQUE INDEX uq_migration_items_external ON public.migration_items(job_id, entity_type, external_id);
ALTER TABLE public.migration_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage migration items"
ON public.migration_items FOR ALL
USING (public.has_org_access(auth.uid(), organization_id) AND public.is_admin(auth.uid()))
WITH CHECK (public.has_org_access(auth.uid(), organization_id) AND public.is_admin(auth.uid()));

CREATE TABLE public.migration_field_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  source text NOT NULL,
  entity_type text NOT NULL,
  name text NOT NULL,
  mapping jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_default boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_migration_mappings_org ON public.migration_field_mappings(organization_id, source, entity_type);
ALTER TABLE public.migration_field_mappings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage migration mappings"
ON public.migration_field_mappings FOR ALL
USING (public.has_org_access(auth.uid(), organization_id) AND public.is_admin(auth.uid()))
WITH CHECK (public.has_org_access(auth.uid(), organization_id) AND public.is_admin(auth.uid()));
CREATE TRIGGER trg_migration_mappings_updated_at
BEFORE UPDATE ON public.migration_field_mappings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();