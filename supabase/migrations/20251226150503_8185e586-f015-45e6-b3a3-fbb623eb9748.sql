-- Drop the overly permissive SELECT policy
DROP POLICY IF EXISTS "Authenticated users can view programmes" ON public.programmes;

-- Create secure policies for programme viewing
-- Users can view programmes in their organizations
CREATE POLICY "Users can view programmes in their org"
ON public.programmes
FOR SELECT
USING (
  has_org_access(auth.uid(), organization_id)
);

-- Users with direct programme access can view
CREATE POLICY "Users with programme access can view"
ON public.programmes
FOR SELECT
USING (
  has_programme_access(auth.uid(), id)
);

-- Programme managers can view their programmes
CREATE POLICY "Managers can view their programmes"
ON public.programmes
FOR SELECT
USING (auth.uid() = manager_id);

-- Admins can view all programmes
CREATE POLICY "Admins can view all programmes"
ON public.programmes
FOR SELECT
USING (is_admin(auth.uid()));