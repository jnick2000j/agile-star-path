
-- Tasks delete policy
DROP POLICY IF EXISTS "Admins can delete tasks" ON public.tasks;
CREATE POLICY "Org admins, creators, and platform admins can delete tasks"
ON public.tasks
FOR DELETE
USING (
  public.is_admin(auth.uid())
  OR public.is_org_admin(auth.uid(), organization_id)
  OR auth.uid() = created_by
);

-- Sprints delete policy
DROP POLICY IF EXISTS "Admins can delete sprints" ON public.sprints;
CREATE POLICY "Org admins, creators, and platform admins can delete sprints"
ON public.sprints
FOR DELETE
USING (
  public.is_admin(auth.uid())
  OR public.is_org_admin(auth.uid(), organization_id)
  OR auth.uid() = created_by
);
