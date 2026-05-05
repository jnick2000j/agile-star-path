-- 1. Allow org admins to see profiles of users within organizations they administer.
CREATE POLICY "Org admins view profiles in their orgs"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.user_organization_access uoa
    WHERE uoa.user_id = profiles.user_id
      AND public.is_org_admin(auth.uid(), uoa.organization_id)
  )
);

-- 2. Platform-admin-only listing of users with no organization assignment.
--    Platform admins themselves are intentionally excluded (they are not orphans).
CREATE OR REPLACE FUNCTION public.list_orphan_users()
RETURNS TABLE (
  user_id uuid,
  email text,
  full_name text,
  first_name text,
  last_name text,
  created_at timestamptz,
  archived boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.user_id, p.email, p.full_name, p.first_name, p.last_name, p.created_at, COALESCE(p.archived, false)
    FROM public.profiles p
   WHERE public.is_admin(auth.uid())
     AND NOT EXISTS (
       SELECT 1 FROM public.user_organization_access uoa WHERE uoa.user_id = p.user_id
     )
     AND NOT EXISTS (
       SELECT 1 FROM public.user_roles ur WHERE ur.user_id = p.user_id AND ur.role = 'admin'
     )
   ORDER BY p.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.list_orphan_users() TO authenticated;