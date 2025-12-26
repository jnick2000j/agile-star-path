-- Drop the overly permissive SELECT policy
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;

-- Create secure policies for profile viewing
-- Users can view their own profile
CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
USING (auth.uid() = user_id);

-- Users can view profiles in their organizations
CREATE POLICY "Users can view profiles in their org"
ON public.profiles
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_organization_access uoa1
    JOIN public.user_organization_access uoa2 ON uoa1.organization_id = uoa2.organization_id
    WHERE uoa1.user_id = auth.uid()
    AND uoa2.user_id = profiles.user_id
  )
);

-- Admins can view all profiles
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
USING (is_admin(auth.uid()));