-- Fix is_org_admin_of signature mismatch in DELETE policies
-- Replace with proper org-admin check using has_org_access

DROP POLICY IF EXISTS "Org admins delete punch_list_items" ON public.punch_list_items;
CREATE POLICY "Org admins delete punch_list_items" ON public.punch_list_items
  FOR DELETE USING (is_admin(auth.uid()) OR has_org_access(auth.uid(), organization_id, 'admin'));

DROP POLICY IF EXISTS "Org admins delete daily_logs" ON public.daily_logs;
CREATE POLICY "Org admins delete daily_logs" ON public.daily_logs
  FOR DELETE USING (is_admin(auth.uid()) OR has_org_access(auth.uid(), organization_id, 'admin'));

DROP POLICY IF EXISTS "Org admins delete submittals" ON public.submittals;
CREATE POLICY "Org admins delete submittals" ON public.submittals
  FOR DELETE USING (is_admin(auth.uid()) OR has_org_access(auth.uid(), organization_id, 'admin'));

DROP POLICY IF EXISTS "Org admins delete client_engagements" ON public.client_engagements;
CREATE POLICY "Org admins delete client_engagements" ON public.client_engagements
  FOR DELETE USING (is_admin(auth.uid()) OR has_org_access(auth.uid(), organization_id, 'admin'));

DROP POLICY IF EXISTS "Org admins delete retainers" ON public.retainers;
CREATE POLICY "Org admins delete retainers" ON public.retainers
  FOR DELETE USING (is_admin(auth.uid()) OR has_org_access(auth.uid(), organization_id, 'admin'));

DROP POLICY IF EXISTS "Org admins delete rfis" ON public.rfis;
CREATE POLICY "Org admins delete rfis" ON public.rfis
  FOR DELETE USING (is_admin(auth.uid()) OR has_org_access(auth.uid(), organization_id, 'admin'));

DROP POLICY IF EXISTS "Org admins delete vertical_entity_records" ON public.vertical_entity_records;
CREATE POLICY "Org admins delete vertical_entity_records" ON public.vertical_entity_records
  FOR DELETE USING (is_admin(auth.uid()) OR has_org_access(auth.uid(), organization_id, 'admin'));

DROP POLICY IF EXISTS "Org admins delete project phases" ON public.project_lifecycle_phases;
CREATE POLICY "Org admins delete project phases" ON public.project_lifecycle_phases
  FOR DELETE USING (is_admin(auth.uid()) OR has_org_access(auth.uid(), organization_id, 'admin'));

-- Tighten always-true INSERT policies on public-facing tables
-- kb_ticket_deflections: require organization_id reference a real org
DROP POLICY IF EXISTS "KBD insert" ON public.kb_ticket_deflections;
CREATE POLICY "KBD insert" ON public.kb_ticket_deflections
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    organization_id IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = organization_id)
  );

-- status_page_subscribers: require valid org and basic email shape
DROP POLICY IF EXISTS "SPS public subscribe" ON public.status_page_subscribers;
CREATE POLICY "SPS public subscribe" ON public.status_page_subscribers
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    organization_id IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = organization_id)
    AND email IS NOT NULL
    AND length(email) BETWEEN 5 AND 320
    AND email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  );