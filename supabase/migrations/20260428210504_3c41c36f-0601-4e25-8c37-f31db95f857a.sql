DROP POLICY IF EXISTS "Org members can view tickets" ON public.helpdesk_tickets;

CREATE POLICY "Editors and assignees can view tickets"
ON public.helpdesk_tickets
FOR SELECT
USING (
  public.has_org_access(auth.uid(), organization_id, 'editor'::text)
  OR public.is_admin(auth.uid())
  OR reporter_user_id = auth.uid()
  OR assignee_id = auth.uid()
);

DROP POLICY IF EXISTS "Authenticated users can upload documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload to documents bucket" ON storage.objects;

CREATE POLICY "Org members can upload documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'documents'
  AND auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.user_organization_access
    WHERE user_id = auth.uid()
  )
);