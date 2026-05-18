
-- 1) Calendar integrations: route through has_org_access (enforces is_disabled)
DROP POLICY IF EXISTS "org admins manage calendar integrations" ON public.organization_calendar_integrations;
CREATE POLICY "org admins manage calendar integrations"
ON public.organization_calendar_integrations
FOR ALL
USING (
  public.is_admin(auth.uid())
  OR public.has_org_access(auth.uid(), organization_id, 'admin')
)
WITH CHECK (
  public.is_admin(auth.uid())
  OR public.has_org_access(auth.uid(), organization_id, 'admin')
);

-- 2) is_helpdesk_admin: enforce is_disabled = false
CREATE OR REPLACE FUNCTION public.is_helpdesk_admin(_user_id uuid, _org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_organization_roles uor
    WHERE uor.user_id = _user_id
      AND uor.organization_id = _org_id
      AND uor.role IN ('admin'::app_role, 'org_admin'::app_role)
      AND NOT EXISTS (
        SELECT 1 FROM public.user_organization_access uoa
        WHERE uoa.user_id = _user_id
          AND uoa.organization_id = _org_id
          AND uoa.is_disabled = true
      )
  ) OR public.is_admin(_user_id);
$$;

-- 3) helpdesk_intake_channels: viewer can SELECT, only admins can write
DROP POLICY IF EXISTS "Org members manage intake channels" ON public.helpdesk_intake_channels;
CREATE POLICY "Org members view intake channels"
ON public.helpdesk_intake_channels
FOR SELECT
USING (public.has_org_access(auth.uid(), organization_id, 'viewer'));

CREATE POLICY "Org admins insert intake channels"
ON public.helpdesk_intake_channels
FOR INSERT
WITH CHECK (public.has_org_access(auth.uid(), organization_id, 'admin'));

CREATE POLICY "Org admins update intake channels"
ON public.helpdesk_intake_channels
FOR UPDATE
USING (public.has_org_access(auth.uid(), organization_id, 'admin'))
WITH CHECK (public.has_org_access(auth.uid(), organization_id, 'admin'));

CREATE POLICY "Org admins delete intake channels"
ON public.helpdesk_intake_channels
FOR DELETE
USING (public.has_org_access(auth.uid(), organization_id, 'admin'));

-- 4) helpdesk_email_inboxes: same pattern
DROP POLICY IF EXISTS "Org members manage email inboxes" ON public.helpdesk_email_inboxes;
CREATE POLICY "Org members view email inboxes"
ON public.helpdesk_email_inboxes
FOR SELECT
USING (public.has_org_access(auth.uid(), organization_id, 'viewer'));

CREATE POLICY "Org admins insert email inboxes"
ON public.helpdesk_email_inboxes
FOR INSERT
WITH CHECK (public.has_org_access(auth.uid(), organization_id, 'admin'));

CREATE POLICY "Org admins update email inboxes"
ON public.helpdesk_email_inboxes
FOR UPDATE
USING (public.has_org_access(auth.uid(), organization_id, 'admin'))
WITH CHECK (public.has_org_access(auth.uid(), organization_id, 'admin'));

CREATE POLICY "Org admins delete email inboxes"
ON public.helpdesk_email_inboxes
FOR DELETE
USING (public.has_org_access(auth.uid(), organization_id, 'admin'));

-- 5) documents bucket: uploads must be under an org folder the user belongs to
DROP POLICY IF EXISTS "Org members can upload documents" ON storage.objects;
CREATE POLICY "Org members can upload documents"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'documents'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND public.has_org_access(
    auth.uid(),
    ((storage.foldername(name))[1])::uuid,
    'viewer'
  )
);

-- 6) lms-covers bucket: org-scoped write/update/delete (editor)
DROP POLICY IF EXISTS "Authenticated can upload LMS covers" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can update LMS covers" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can delete LMS covers" ON storage.objects;

CREATE POLICY "Org editors can upload LMS covers"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'lms-covers'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND public.has_org_access(
    auth.uid(),
    ((storage.foldername(name))[1])::uuid,
    'editor'
  )
);

CREATE POLICY "Org editors can update LMS covers"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'lms-covers'
  AND (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND public.has_org_access(
    auth.uid(),
    ((storage.foldername(name))[1])::uuid,
    'editor'
  )
);

CREATE POLICY "Org editors can delete LMS covers"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'lms-covers'
  AND (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND public.has_org_access(
    auth.uid(),
    ((storage.foldername(name))[1])::uuid,
    'editor'
  )
);
