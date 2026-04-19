-- Workflow notifiers: people CC'd on approval activity (no decision authority)
CREATE TABLE public.workflow_notifiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  user_id UUID NOT NULL,
  notify_role TEXT,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (entity_type, entity_id, user_id)
);

CREATE INDEX idx_workflow_notifiers_entity ON public.workflow_notifiers (entity_type, entity_id);
CREATE INDEX idx_workflow_notifiers_org ON public.workflow_notifiers (organization_id);
CREATE INDEX idx_workflow_notifiers_user ON public.workflow_notifiers (user_id);

ALTER TABLE public.workflow_notifiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members view notifiers"
  ON public.workflow_notifiers FOR SELECT
  USING (
    organization_id IS NULL
    OR public.has_org_access(auth.uid(), organization_id, 'viewer')
    OR public.is_admin(auth.uid())
  );

CREATE POLICY "Org editors manage notifiers"
  ON public.workflow_notifiers FOR INSERT
  WITH CHECK (
    organization_id IS NULL
    OR public.has_org_access(auth.uid(), organization_id, 'editor')
    OR public.is_admin(auth.uid())
  );

CREATE POLICY "Org editors delete notifiers"
  ON public.workflow_notifiers FOR DELETE
  USING (
    organization_id IS NULL
    OR public.has_org_access(auth.uid(), organization_id, 'editor')
    OR public.is_admin(auth.uid())
  );

CREATE POLICY "Org editors update notifiers"
  ON public.workflow_notifiers FOR UPDATE
  USING (
    organization_id IS NULL
    OR public.has_org_access(auth.uid(), organization_id, 'editor')
    OR public.is_admin(auth.uid())
  );