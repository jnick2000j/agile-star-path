-- Fix 1: Tighten stakeholders SELECT policy to remove public access via organization_id IS NULL
DROP POLICY IF EXISTS "Users can view org stakeholders" ON public.stakeholders;

CREATE POLICY "Users can view org stakeholders"
ON public.stakeholders
FOR SELECT
TO authenticated
USING (
  (organization_id IS NOT NULL AND has_org_access(auth.uid(), organization_id))
  OR auth.uid() = created_by
  OR is_admin(auth.uid())
);

-- Fix 2: Restrict organization_subscriptions SELECT to admins only (consistent with UPDATE policy)
DROP POLICY IF EXISTS "Org admins can view their subscription" ON public.organization_subscriptions;

CREATE POLICY "Org admins can view their subscription"
ON public.organization_subscriptions
FOR SELECT
TO authenticated
USING (
  has_org_access(auth.uid(), organization_id, 'admin'::text)
  OR is_admin(auth.uid())
);
