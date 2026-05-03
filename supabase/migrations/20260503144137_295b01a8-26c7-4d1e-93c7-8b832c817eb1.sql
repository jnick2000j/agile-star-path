-- Deduplicated directory of people / customer orgs imported from external sources
CREATE TABLE public.migration_contact_directory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  contact_type TEXT NOT NULL CHECK (contact_type IN ('person', 'organization')),
  external_account_id TEXT,
  email TEXT,
  display_name TEXT,
  organization_name TEXT,
  linked_stakeholder_id UUID REFERENCES public.stakeholders(id) ON DELETE SET NULL,
  ticket_count INTEGER NOT NULL DEFAULT 0,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  raw JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Dedupe keys: per-org + source.
-- For people: prefer external_account_id, fall back to email.
-- For organizations: prefer external_account_id, fall back to organization_name.
CREATE UNIQUE INDEX idx_directory_unique_account
  ON public.migration_contact_directory (organization_id, source, contact_type, external_account_id)
  WHERE external_account_id IS NOT NULL;

CREATE UNIQUE INDEX idx_directory_unique_person_email
  ON public.migration_contact_directory (organization_id, source, lower(email))
  WHERE contact_type = 'person' AND external_account_id IS NULL AND email IS NOT NULL;

CREATE UNIQUE INDEX idx_directory_unique_org_name
  ON public.migration_contact_directory (organization_id, source, lower(organization_name))
  WHERE contact_type = 'organization' AND external_account_id IS NULL AND organization_name IS NOT NULL;

CREATE INDEX idx_directory_org ON public.migration_contact_directory(organization_id);

ALTER TABLE public.migration_contact_directory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view contact directory"
ON public.migration_contact_directory
FOR SELECT
TO authenticated
USING (public.has_org_access(auth.uid(), organization_id));

CREATE POLICY "Admins can manage contact directory"
ON public.migration_contact_directory
FOR ALL
TO authenticated
USING (public.has_org_access(auth.uid(), organization_id) AND public.is_admin(auth.uid()))
WITH CHECK (public.has_org_access(auth.uid(), organization_id) AND public.is_admin(auth.uid()));

CREATE TRIGGER trg_migration_contact_directory_updated_at
BEFORE UPDATE ON public.migration_contact_directory
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Link per-ticket contact attachments to the deduplicated directory record
ALTER TABLE public.migration_contacts
  ADD COLUMN IF NOT EXISTS directory_id UUID
    REFERENCES public.migration_contact_directory(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_migration_contacts_directory
  ON public.migration_contacts(directory_id);