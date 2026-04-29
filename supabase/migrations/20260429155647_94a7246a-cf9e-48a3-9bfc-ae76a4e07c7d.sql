
CREATE TABLE public.helpdesk_macros (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  body TEXT NOT NULL,
  shortcut TEXT,
  is_shared BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  usage_count INTEGER NOT NULL DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_helpdesk_macros_org ON public.helpdesk_macros(organization_id);
CREATE INDEX idx_helpdesk_macros_shortcut ON public.helpdesk_macros(organization_id, shortcut);

ALTER TABLE public.helpdesk_macros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view shared or own macros"
  ON public.helpdesk_macros FOR SELECT
  USING (
    public.is_org_member(auth.uid(), organization_id)
    AND (is_shared = true OR created_by = auth.uid())
  );

CREATE POLICY "Org members can create macros"
  ON public.helpdesk_macros FOR INSERT
  WITH CHECK (
    public.is_org_member(auth.uid(), organization_id)
    AND created_by = auth.uid()
  );

CREATE POLICY "Creators or admins can update macros"
  ON public.helpdesk_macros FOR UPDATE
  USING (
    public.is_org_member(auth.uid(), organization_id)
    AND (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role))
  );

CREATE POLICY "Creators or admins can delete macros"
  ON public.helpdesk_macros FOR DELETE
  USING (
    public.is_org_member(auth.uid(), organization_id)
    AND (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role))
  );

CREATE TRIGGER update_helpdesk_macros_updated_at
  BEFORE UPDATE ON public.helpdesk_macros
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.helpdesk_macro_usage (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  macro_id UUID NOT NULL REFERENCES public.helpdesk_macros(id) ON DELETE CASCADE,
  ticket_id UUID,
  used_by UUID,
  organization_id UUID NOT NULL,
  used_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_helpdesk_macro_usage_macro ON public.helpdesk_macro_usage(macro_id);
CREATE INDEX idx_helpdesk_macro_usage_org ON public.helpdesk_macro_usage(organization_id);

ALTER TABLE public.helpdesk_macro_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view macro usage"
  ON public.helpdesk_macro_usage FOR SELECT
  USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org members can record macro usage"
  ON public.helpdesk_macro_usage FOR INSERT
  WITH CHECK (
    public.is_org_member(auth.uid(), organization_id)
    AND used_by = auth.uid()
  );
