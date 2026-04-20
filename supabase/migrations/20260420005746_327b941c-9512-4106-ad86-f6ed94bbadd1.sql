DROP POLICY IF EXISTS "Service can insert insights" ON public.ai_insights;
CREATE POLICY "Editors and service can insert insights"
  ON public.ai_insights FOR INSERT
  WITH CHECK (
    auth.uid() IS NULL  -- service role bypass when called from edge fn with service key
    OR public.is_admin(auth.uid())
    OR public.has_org_access(auth.uid(), organization_id, 'editor')
  );