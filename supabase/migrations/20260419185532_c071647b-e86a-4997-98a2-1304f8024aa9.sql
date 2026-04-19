-- Add 'modification_required' decision support and per-approval comment threads

-- 1) Comments thread on each approval row (so anyone can comment, not only the reviewer)
CREATE TABLE IF NOT EXISTS public.workflow_approval_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  approval_id UUID NOT NULL REFERENCES public.workflow_approvals(id) ON DELETE CASCADE,
  author_id UUID NOT NULL,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  comment TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wac_approval ON public.workflow_approval_comments(approval_id);
CREATE INDEX IF NOT EXISTS idx_wac_org ON public.workflow_approval_comments(organization_id);

ALTER TABLE public.workflow_approval_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view approval comments"
ON public.workflow_approval_comments
FOR SELECT TO authenticated
USING (
  organization_id IS NULL
  OR public.has_org_access(auth.uid(), organization_id, 'viewer')
  OR public.is_admin(auth.uid())
);

CREATE POLICY "Org members can add approval comments"
ON public.workflow_approval_comments
FOR INSERT TO authenticated
WITH CHECK (
  author_id = auth.uid()
  AND (
    organization_id IS NULL
    OR public.has_org_access(auth.uid(), organization_id, 'viewer')
    OR public.is_admin(auth.uid())
  )
);

CREATE POLICY "Authors can update their own approval comments"
ON public.workflow_approval_comments
FOR UPDATE TO authenticated
USING (author_id = auth.uid())
WITH CHECK (author_id = auth.uid());

CREATE POLICY "Authors or admins can delete approval comments"
ON public.workflow_approval_comments
FOR DELETE TO authenticated
USING (author_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE TRIGGER trg_wac_updated_at
BEFORE UPDATE ON public.workflow_approval_comments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Allow new "modification_required" decision value.
-- workflow_approvals.decision is stored as text (per ApprovalRow union), so no enum change needed.
-- If a CHECK constraint exists restricting decision values, drop and recreate it to include the new value.
DO $$
DECLARE
  _conname TEXT;
BEGIN
  SELECT conname INTO _conname
  FROM pg_constraint
  WHERE conrelid = 'public.workflow_approvals'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%decision%';
  IF _conname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.workflow_approvals DROP CONSTRAINT %I', _conname);
  END IF;
END $$;

ALTER TABLE public.workflow_approvals
  ADD CONSTRAINT workflow_approvals_decision_check
  CHECK (decision IN (
    'pending',
    'approve',
    'reject',
    'abstain',
    'conditional',
    'modification_required',
    'verified',
    'rejected_verification'
  ));