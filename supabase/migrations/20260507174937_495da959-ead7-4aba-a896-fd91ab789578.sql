
-- Saved Views: platform-wide customizable filters/columns/grouping/layout per register
CREATE TABLE IF NOT EXISTS public.saved_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  owner_user_id UUID NOT NULL,
  scope TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  is_shared BOOLEAN NOT NULL DEFAULT false,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_saved_views_org_scope ON public.saved_views(organization_id, scope);
CREATE INDEX IF NOT EXISTS idx_saved_views_owner ON public.saved_views(owner_user_id);

CREATE TABLE IF NOT EXISTS public.saved_view_org_defaults (
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  scope TEXT NOT NULL,
  view_id UUID NOT NULL REFERENCES public.saved_views(id) ON DELETE CASCADE,
  set_by UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, scope)
);

CREATE TABLE IF NOT EXISTS public.saved_view_user_defaults (
  user_id UUID NOT NULL,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  scope TEXT NOT NULL,
  view_id UUID NOT NULL REFERENCES public.saved_views(id) ON DELETE CASCADE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, organization_id, scope)
);

ALTER TABLE public.saved_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_view_org_defaults ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_view_user_defaults ENABLE ROW LEVEL SECURITY;

-- saved_views policies
CREATE POLICY "saved_views_select" ON public.saved_views FOR SELECT
USING (
  public.is_org_member(auth.uid(), organization_id)
  AND (is_shared = true OR owner_user_id = auth.uid())
);

CREATE POLICY "saved_views_insert" ON public.saved_views FOR INSERT
WITH CHECK (
  owner_user_id = auth.uid()
  AND public.is_org_member(auth.uid(), organization_id)
  AND (is_shared = false OR public.is_org_admin(auth.uid(), organization_id))
);

CREATE POLICY "saved_views_update" ON public.saved_views FOR UPDATE
USING (
  owner_user_id = auth.uid()
  OR (is_shared = true AND public.is_org_admin(auth.uid(), organization_id))
)
WITH CHECK (
  owner_user_id = auth.uid()
  OR (is_shared = true AND public.is_org_admin(auth.uid(), organization_id))
);

CREATE POLICY "saved_views_delete" ON public.saved_views FOR DELETE
USING (
  owner_user_id = auth.uid()
  OR (is_shared = true AND public.is_org_admin(auth.uid(), organization_id))
);

-- org defaults: members read, admins write
CREATE POLICY "saved_view_org_defaults_select" ON public.saved_view_org_defaults FOR SELECT
USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "saved_view_org_defaults_write" ON public.saved_view_org_defaults FOR ALL
USING (public.is_org_admin(auth.uid(), organization_id))
WITH CHECK (public.is_org_admin(auth.uid(), organization_id));

-- user defaults: self-managed
CREATE POLICY "saved_view_user_defaults_select" ON public.saved_view_user_defaults FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "saved_view_user_defaults_write" ON public.saved_view_user_defaults FOR ALL
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- updated_at trigger
CREATE TRIGGER trg_saved_views_updated_at
BEFORE UPDATE ON public.saved_views
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
