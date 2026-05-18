
-- 1) Tighten CSAT token visibility to org admins (or platform admins) only
DROP POLICY IF EXISTS "Org admins view csat responses" ON public.csat_responses;
CREATE POLICY "Org admins view csat responses"
ON public.csat_responses
FOR SELECT
USING (
  public.is_admin(auth.uid())
  OR public.has_org_access(auth.uid(), organization_id, 'admin')
);

-- 2) Harden is_org_member so disabled users lose access via this helper
CREATE OR REPLACE FUNCTION public.is_org_member(_user_id uuid, _org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_organization_roles uor
    JOIN public.user_organization_access uoa
      ON uoa.user_id = uor.user_id
     AND uoa.organization_id = uor.organization_id
    WHERE uor.user_id = _user_id
      AND uor.organization_id = _org_id
      AND COALESCE(uoa.is_disabled, false) = false
  );
$$;

-- 3) Replace direct user_organization_access subqueries (no is_disabled check)
--    on operational tables with has_org_access(..., 'viewer'), which enforces it.

-- punch_list_items
DROP POLICY IF EXISTS "Org members insert punch_list_items" ON public.punch_list_items;
CREATE POLICY "Org members insert punch_list_items"
ON public.punch_list_items
FOR INSERT
WITH CHECK (public.has_org_access(auth.uid(), organization_id, 'viewer'));

DROP POLICY IF EXISTS "Org members update punch_list_items" ON public.punch_list_items;
CREATE POLICY "Org members update punch_list_items"
ON public.punch_list_items
FOR UPDATE
USING (public.has_org_access(auth.uid(), organization_id, 'viewer'));

-- daily_logs
DROP POLICY IF EXISTS "Org members insert daily_logs" ON public.daily_logs;
CREATE POLICY "Org members insert daily_logs"
ON public.daily_logs
FOR INSERT
WITH CHECK (public.has_org_access(auth.uid(), organization_id, 'viewer'));

DROP POLICY IF EXISTS "Org members update daily_logs" ON public.daily_logs;
CREATE POLICY "Org members update daily_logs"
ON public.daily_logs
FOR UPDATE
USING (public.has_org_access(auth.uid(), organization_id, 'viewer'));

-- rfis
DROP POLICY IF EXISTS "Org members insert rfis" ON public.rfis;
CREATE POLICY "Org members insert rfis"
ON public.rfis
FOR INSERT
WITH CHECK (public.has_org_access(auth.uid(), organization_id, 'viewer'));

DROP POLICY IF EXISTS "Org members update rfis" ON public.rfis;
CREATE POLICY "Org members update rfis"
ON public.rfis
FOR UPDATE
USING (public.has_org_access(auth.uid(), organization_id, 'viewer'));

-- submittals
DROP POLICY IF EXISTS "Org members insert submittals" ON public.submittals;
CREATE POLICY "Org members insert submittals"
ON public.submittals
FOR INSERT
WITH CHECK (public.has_org_access(auth.uid(), organization_id, 'viewer'));

DROP POLICY IF EXISTS "Org members update submittals" ON public.submittals;
CREATE POLICY "Org members update submittals"
ON public.submittals
FOR UPDATE
USING (public.has_org_access(auth.uid(), organization_id, 'viewer'));

-- client_engagements
DROP POLICY IF EXISTS "Org members insert client_engagements" ON public.client_engagements;
CREATE POLICY "Org members insert client_engagements"
ON public.client_engagements
FOR INSERT
WITH CHECK (public.has_org_access(auth.uid(), organization_id, 'viewer'));

DROP POLICY IF EXISTS "Org members update client_engagements" ON public.client_engagements;
CREATE POLICY "Org members update client_engagements"
ON public.client_engagements
FOR UPDATE
USING (public.has_org_access(auth.uid(), organization_id, 'viewer'));

-- retainers
DROP POLICY IF EXISTS "Org members insert retainers" ON public.retainers;
CREATE POLICY "Org members insert retainers"
ON public.retainers
FOR INSERT
WITH CHECK (public.has_org_access(auth.uid(), organization_id, 'viewer'));

DROP POLICY IF EXISTS "Org members update retainers" ON public.retainers;
CREATE POLICY "Org members update retainers"
ON public.retainers
FOR UPDATE
USING (public.has_org_access(auth.uid(), organization_id, 'viewer'));

-- vertical_entity_records
DROP POLICY IF EXISTS "Org members insert vertical_entity_records" ON public.vertical_entity_records;
CREATE POLICY "Org members insert vertical_entity_records"
ON public.vertical_entity_records
FOR INSERT
WITH CHECK (public.has_org_access(auth.uid(), organization_id, 'viewer'));

DROP POLICY IF EXISTS "Org members update vertical_entity_records" ON public.vertical_entity_records;
CREATE POLICY "Org members update vertical_entity_records"
ON public.vertical_entity_records
FOR UPDATE
USING (public.has_org_access(auth.uid(), organization_id, 'viewer'));

-- project_lifecycle_phases
DROP POLICY IF EXISTS "Org members write project phases" ON public.project_lifecycle_phases;
CREATE POLICY "Org members write project phases"
ON public.project_lifecycle_phases
FOR INSERT
WITH CHECK (public.has_org_access(auth.uid(), organization_id, 'viewer'));

DROP POLICY IF EXISTS "Org members update project phases" ON public.project_lifecycle_phases;
CREATE POLICY "Org members update project phases"
ON public.project_lifecycle_phases
FOR UPDATE
USING (public.has_org_access(auth.uid(), organization_id, 'viewer'));

-- project_report_recipients
DROP POLICY IF EXISTS "Org members manage report recipients" ON public.project_report_recipients;
CREATE POLICY "Org members manage report recipients"
ON public.project_report_recipients
FOR INSERT
WITH CHECK (public.has_org_access(auth.uid(), organization_id, 'viewer'));

DROP POLICY IF EXISTS "Org members update report recipients" ON public.project_report_recipients;
CREATE POLICY "Org members update report recipients"
ON public.project_report_recipients
FOR UPDATE
USING (public.has_org_access(auth.uid(), organization_id, 'viewer'));

-- 4) ai_agent_actions: require caller to belong to the org being written to
DROP POLICY IF EXISTS "Users insert their own agent actions" ON public.ai_agent_actions;
CREATE POLICY "Users insert their own agent actions"
ON public.ai_agent_actions
FOR INSERT
WITH CHECK (
  user_id = auth.uid()
  AND (
    organization_id IS NULL
    OR public.has_org_access(auth.uid(), organization_id, 'viewer')
  )
);
