
-- 1. Fix notifications INSERT policy: restrict to service role only (edge functions bypass RLS)
DROP POLICY IF EXISTS "System can create notifications" ON public.notifications;

-- 2. Fix profiles UPDATE policy: prevent role self-elevation
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
  AND (
    role IS NOT DISTINCT FROM (SELECT p.role FROM public.profiles p WHERE p.user_id = auth.uid())
    OR public.is_admin(auth.uid())
  )
);

-- 3. Fix status_history public SELECT policy
DROP POLICY IF EXISTS "Anyone can view status history" ON public.status_history;
CREATE POLICY "Users can view org status history" ON public.status_history
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.programmes p WHERE p.id = status_history.entity_id AND has_org_access(auth.uid(), p.organization_id)
  )
  OR EXISTS (
    SELECT 1 FROM public.projects p WHERE p.id = status_history.entity_id AND has_org_access(auth.uid(), p.organization_id)
  )
  OR EXISTS (
    SELECT 1 FROM public.products p WHERE p.id = status_history.entity_id AND has_org_access(auth.uid(), p.organization_id)
  )
  OR auth.uid() = changed_by
  OR public.is_admin(auth.uid())
);

-- 4. Fix logos bucket storage policies: restrict to org admins
DROP POLICY IF EXISTS "Org admins can upload logos" ON storage.objects;
DROP POLICY IF EXISTS "Org admins can update logos" ON storage.objects;
DROP POLICY IF EXISTS "Org admins can delete logos" ON storage.objects;

CREATE POLICY "Org admins can upload logos" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'logos'
  AND auth.uid() IS NOT NULL
  AND public.has_org_access(auth.uid(), (storage.foldername(name))[1]::uuid, 'admin')
);

CREATE POLICY "Org admins can update logos" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'logos'
  AND auth.uid() IS NOT NULL
  AND public.has_org_access(auth.uid(), (storage.foldername(name))[1]::uuid, 'admin')
);

CREATE POLICY "Org admins can delete logos" ON storage.objects
FOR DELETE USING (
  bucket_id = 'logos'
  AND auth.uid() IS NOT NULL
  AND public.has_org_access(auth.uid(), (storage.foldername(name))[1]::uuid, 'admin')
);

-- 5. Fix public bucket listing: restrict SELECT to specific file access
DROP POLICY IF EXISTS "Anyone can view logos" ON storage.objects;
CREATE POLICY "Anyone can view logos" ON storage.objects
FOR SELECT USING (bucket_id = 'logos');
