DROP POLICY IF EXISTS "Service can insert residency audit" ON public.residency_audit_log;
CREATE POLICY "Members can insert residency audit"
  ON public.residency_audit_log FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND public.has_org_access(auth.uid(), organization_id, 'viewer')
  );