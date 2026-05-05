DROP POLICY IF EXISTS "System admins can create orgs" ON public.organizations;

CREATE POLICY "Authenticated users can create their own orgs"
ON public.organizations
FOR INSERT
TO authenticated
WITH CHECK (created_by = auth.uid() OR is_admin(auth.uid()));