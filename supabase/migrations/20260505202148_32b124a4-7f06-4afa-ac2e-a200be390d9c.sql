
CREATE TABLE public.org_email_template_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  template_key text NOT NULL,
  subject text,
  fields jsonb NOT NULL DEFAULT '{}'::jsonb,
  enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, template_key)
);

CREATE INDEX idx_org_email_template_overrides_org
  ON public.org_email_template_overrides(organization_id);

ALTER TABLE public.org_email_template_overrides ENABLE ROW LEVEL SECURITY;

-- Helper: is the caller an Org Admin of the given org?
CREATE OR REPLACE FUNCTION public.is_org_admin_of(_org_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_organization_custom_roles uocr
    JOIN public.custom_roles cr ON cr.id = uocr.custom_role_id
    WHERE uocr.user_id = auth.uid()
      AND uocr.organization_id = _org_id
      AND cr.name ILIKE 'org%admin'
  );
$$;

CREATE POLICY "View org email templates"
ON public.org_email_template_overrides FOR SELECT
USING (
  public.is_org_admin_of(organization_id)
  OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Insert org email templates"
ON public.org_email_template_overrides FOR INSERT
WITH CHECK (
  public.is_org_admin_of(organization_id)
  OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Update org email templates"
ON public.org_email_template_overrides FOR UPDATE
USING (
  public.is_org_admin_of(organization_id)
  OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Delete org email templates"
ON public.org_email_template_overrides FOR DELETE
USING (
  public.is_org_admin_of(organization_id)
  OR public.has_role(auth.uid(), 'admin')
);

CREATE TRIGGER trg_org_email_template_overrides_updated
BEFORE UPDATE ON public.org_email_template_overrides
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
