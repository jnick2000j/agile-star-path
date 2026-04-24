-- 1. Allow custom verticals: drop CHECK, add FK
ALTER TABLE public.organizations
  DROP CONSTRAINT IF EXISTS organizations_industry_vertical_check;

ALTER TABLE public.industry_verticals
  ADD COLUMN IF NOT EXISTS is_seed boolean NOT NULL DEFAULT false;

-- Mark current 4 as seed
UPDATE public.industry_verticals
  SET is_seed = true
  WHERE id IN ('it_infrastructure','software_saas','construction','professional_services');

ALTER TABLE public.organizations
  ADD CONSTRAINT organizations_industry_vertical_fkey
  FOREIGN KEY (industry_vertical) REFERENCES public.industry_verticals(id)
  ON UPDATE CASCADE ON DELETE SET DEFAULT;

-- 2. vertical_entities — custom register definitions
CREATE TABLE public.vertical_entities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vertical_id text NOT NULL REFERENCES public.industry_verticals(id) ON DELETE CASCADE,
  slug text NOT NULL,
  name text NOT NULL,
  name_plural text NOT NULL,
  description text,
  icon text DEFAULT 'FileText',
  -- field schema: array of {key,label,type,required,options?}
  fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  default_status_options text[] NOT NULL DEFAULT ARRAY['open','in_progress','closed'],
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (vertical_id, slug)
);

ALTER TABLE public.vertical_entities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view active vertical entities"
  ON public.vertical_entities FOR SELECT
  TO authenticated
  USING (is_active = true OR public.is_admin(auth.uid()));

CREATE POLICY "Platform admins manage vertical entities"
  ON public.vertical_entities FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE TRIGGER trg_vertical_entities_updated
  BEFORE UPDATE ON public.vertical_entities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_vertical_entities_vertical ON public.vertical_entities(vertical_id);

-- 3. vertical_entity_records — actual data
CREATE TABLE public.vertical_entity_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid NOT NULL REFERENCES public.vertical_entities(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  record_number text,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  priority text DEFAULT 'medium',
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  assigned_to uuid,
  due_date date,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.vertical_entity_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members view records"
  ON public.vertical_entity_records FOR SELECT
  TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.user_organization_access uoa
      WHERE uoa.user_id = auth.uid()
        AND uoa.organization_id = vertical_entity_records.organization_id
    )
  );

CREATE POLICY "Org members insert records"
  ON public.vertical_entity_records FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_organization_access uoa
      WHERE uoa.user_id = auth.uid()
        AND uoa.organization_id = vertical_entity_records.organization_id
    )
  );

CREATE POLICY "Org members update records"
  ON public.vertical_entity_records FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_organization_access uoa
      WHERE uoa.user_id = auth.uid()
        AND uoa.organization_id = vertical_entity_records.organization_id
    )
  );

CREATE POLICY "Org admins delete records"
  ON public.vertical_entity_records FOR DELETE
  TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR public.is_org_admin_of(auth.uid(), organization_id)
  );

CREATE TRIGGER trg_vertical_entity_records_updated
  BEFORE UPDATE ON public.vertical_entity_records
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_vertical_records_org ON public.vertical_entity_records(organization_id);
CREATE INDEX idx_vertical_records_entity ON public.vertical_entity_records(entity_id);
CREATE INDEX idx_vertical_records_project ON public.vertical_entity_records(project_id);