CREATE TABLE IF NOT EXISTS public.organization_module_toggles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  module_key TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, module_key)
);

CREATE INDEX IF NOT EXISTS idx_org_module_toggles_org
  ON public.organization_module_toggles(organization_id);

ALTER TABLE public.organization_module_toggles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view module toggles"
ON public.organization_module_toggles
FOR SELECT
TO authenticated
USING (
  public.is_org_member(auth.uid(), organization_id)
  OR public.is_admin(auth.uid())
);

CREATE POLICY "Org admins can insert module toggles"
ON public.organization_module_toggles
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_org_admin(auth.uid(), organization_id)
  OR public.is_admin(auth.uid())
);

CREATE POLICY "Org admins can update module toggles"
ON public.organization_module_toggles
FOR UPDATE
TO authenticated
USING (
  public.is_org_admin(auth.uid(), organization_id)
  OR public.is_admin(auth.uid())
);

CREATE POLICY "Org admins can delete module toggles"
ON public.organization_module_toggles
FOR DELETE
TO authenticated
USING (
  public.is_org_admin(auth.uid(), organization_id)
  OR public.is_admin(auth.uid())
);

DROP TRIGGER IF EXISTS trg_org_module_toggles_updated_at ON public.organization_module_toggles;
CREATE TRIGGER trg_org_module_toggles_updated_at
BEFORE UPDATE ON public.organization_module_toggles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();