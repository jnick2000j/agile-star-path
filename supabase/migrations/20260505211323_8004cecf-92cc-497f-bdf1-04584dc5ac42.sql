-- Allow Org Admins to update and delete programmes and projects in their organization

DROP POLICY IF EXISTS "Managers and admins can update programmes" ON public.programmes;
CREATE POLICY "Managers and admins can update programmes"
ON public.programmes
FOR UPDATE
USING (
  auth.uid() = manager_id
  OR auth.uid() = created_by
  OR is_admin(auth.uid())
  OR (organization_id IS NOT NULL AND has_org_access(auth.uid(), organization_id, 'admin'))
);

DROP POLICY IF EXISTS "Admins can delete programmes" ON public.programmes;
CREATE POLICY "Admins can delete programmes"
ON public.programmes
FOR DELETE
USING (
  is_admin(auth.uid())
  OR (organization_id IS NOT NULL AND has_org_access(auth.uid(), organization_id, 'admin'))
);

DROP POLICY IF EXISTS "Managers can update projects" ON public.projects;
CREATE POLICY "Managers can update projects"
ON public.projects
FOR UPDATE
USING (
  auth.uid() = manager_id
  OR auth.uid() = created_by
  OR is_admin(auth.uid())
  OR (organization_id IS NOT NULL AND has_org_access(auth.uid(), organization_id, 'admin'))
);

DROP POLICY IF EXISTS "Admins can delete projects" ON public.projects;
CREATE POLICY "Admins can delete projects"
ON public.projects
FOR DELETE
USING (
  is_admin(auth.uid())
  OR (organization_id IS NOT NULL AND has_org_access(auth.uid(), organization_id, 'admin'))
);
