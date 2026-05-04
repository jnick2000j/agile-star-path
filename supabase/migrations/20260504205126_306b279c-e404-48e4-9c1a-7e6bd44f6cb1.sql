
CREATE TABLE IF NOT EXISTS public.migration_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL,
  source_system text NOT NULL,
  source_details text,
  scope text,
  expected_record_count integer,
  contact_email text,
  notes text,
  status text NOT NULL DEFAULT 'pending',
  provisioning_notes text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.migration_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "migration_requests_select_org"
ON public.migration_requests
FOR SELECT
TO authenticated
USING (has_org_access(auth.uid(), organization_id, 'viewer'::text) OR is_admin(auth.uid()));

CREATE POLICY "migration_requests_insert_admin"
ON public.migration_requests
FOR INSERT
TO authenticated
WITH CHECK (
  requested_by = auth.uid()
  AND has_org_access(auth.uid(), organization_id, 'admin'::text)
);

CREATE POLICY "migration_requests_platform_update"
ON public.migration_requests
FOR UPDATE
TO authenticated
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_migration_requests_org ON public.migration_requests(organization_id);
CREATE INDEX IF NOT EXISTS idx_migration_requests_status ON public.migration_requests(status);

CREATE TRIGGER migration_requests_set_updated_at
BEFORE UPDATE ON public.migration_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
