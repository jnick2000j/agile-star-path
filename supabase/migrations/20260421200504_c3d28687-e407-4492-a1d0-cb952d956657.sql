-- Clean any orphans first (defensive)
DELETE FROM public.workflow_evidence   WHERE organization_id IS NULL;
DELETE FROM public.workflow_notifiers  WHERE organization_id IS NULL;
DELETE FROM public.workflow_approvals  WHERE organization_id IS NULL;

-- Enforce NOT NULL
ALTER TABLE public.workflow_approvals ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.workflow_evidence  ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.workflow_notifiers ALTER COLUMN organization_id SET NOT NULL;

-- Rewrite SELECT policies
DROP POLICY IF EXISTS "Org members view workflow approvals" ON public.workflow_approvals;
CREATE POLICY "Org members view workflow approvals" ON public.workflow_approvals FOR SELECT
USING (has_org_access(auth.uid(), organization_id, 'viewer') OR is_admin(auth.uid()));

DROP POLICY IF EXISTS "Org members view workflow evidence" ON public.workflow_evidence;
CREATE POLICY "Org members view workflow evidence" ON public.workflow_evidence FOR SELECT
USING (has_org_access(auth.uid(), organization_id, 'viewer') OR is_admin(auth.uid()));

DROP POLICY IF EXISTS "Org members view notifiers" ON public.workflow_notifiers;
CREATE POLICY "Org members view notifiers" ON public.workflow_notifiers FOR SELECT
USING (has_org_access(auth.uid(), organization_id, 'viewer') OR is_admin(auth.uid()));
