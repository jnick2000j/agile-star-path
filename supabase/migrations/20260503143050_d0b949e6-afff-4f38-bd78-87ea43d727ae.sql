-- Store contacts (reporter, customer, organization, participants) imported from JSM
CREATE TABLE public.migration_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  job_id UUID REFERENCES public.migration_jobs(id) ON DELETE SET NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  external_id TEXT,
  external_key TEXT,
  -- role: 'reporter' | 'participant' | 'customer_organization' | 'assignee'
  role TEXT NOT NULL,
  account_id TEXT,
  display_name TEXT,
  email TEXT,
  customer_organization_id TEXT,
  customer_organization_name TEXT,
  raw JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_migration_contacts_entity ON public.migration_contacts(entity_type, entity_id);
CREATE INDEX idx_migration_contacts_org ON public.migration_contacts(organization_id);
CREATE INDEX idx_migration_contacts_job ON public.migration_contacts(job_id);

ALTER TABLE public.migration_contacts ENABLE ROW LEVEL SECURITY;

-- Org members can read; only admins can insert/modify (writes happen via service role anyway)
CREATE POLICY "Org members can view migration contacts"
ON public.migration_contacts
FOR SELECT
TO authenticated
USING (public.has_org_access(auth.uid(), organization_id));

CREATE POLICY "Admins can manage migration contacts"
ON public.migration_contacts
FOR ALL
TO authenticated
USING (public.has_org_access(auth.uid(), organization_id) AND public.is_admin(auth.uid()))
WITH CHECK (public.has_org_access(auth.uid(), organization_id) AND public.is_admin(auth.uid()));