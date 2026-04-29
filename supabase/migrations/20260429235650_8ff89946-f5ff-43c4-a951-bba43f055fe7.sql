DROP POLICY IF EXISTS "Users can view org weekly reports" ON public.weekly_reports;

CREATE POLICY "Users can view org weekly reports"
ON public.weekly_reports
FOR SELECT
USING (
  (programme_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.programmes p
    WHERE p.id = weekly_reports.programme_id
      AND public.has_org_access(auth.uid(), p.organization_id)
  ))
  OR (project_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.projects pr
    WHERE pr.id = weekly_reports.project_id
      AND public.has_org_access(auth.uid(), pr.organization_id)
  ))
  OR (product_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.products pd
    WHERE pd.id = weekly_reports.product_id
      AND public.has_org_access(auth.uid(), pd.organization_id)
  ))
  OR auth.uid() = submitted_by
  OR auth.uid() = approved_by
  OR public.is_admin(auth.uid())
);