-- =============================================================
-- 1a. Detach cross-references from real rows that point at orphans
-- =============================================================
UPDATE public.products
   SET project_id = NULL
 WHERE project_id IN (SELECT id FROM public.projects WHERE organization_id IS NULL);

UPDATE public.products
   SET programme_id = NULL
 WHERE programme_id IN (SELECT id FROM public.programmes WHERE organization_id IS NULL);

-- Detach any other tenant FK that might point at orphans (defensive)
UPDATE public.tasks SET project_id      = NULL WHERE project_id      IN (SELECT id FROM public.projects WHERE organization_id IS NULL);
UPDATE public.tasks SET product_id      = NULL WHERE product_id      IN (SELECT id FROM public.products WHERE organization_id IS NULL);
UPDATE public.tasks SET work_package_id = NULL WHERE work_package_id IN (SELECT id FROM public.work_packages WHERE organization_id IS NULL);
UPDATE public.tasks SET sprint_id       = NULL WHERE sprint_id       IN (SELECT id FROM public.sprints WHERE organization_id IS NULL);

UPDATE public.benefits SET project_id   = NULL WHERE project_id   IN (SELECT id FROM public.projects WHERE organization_id IS NULL);
UPDATE public.benefits SET product_id   = NULL WHERE product_id   IN (SELECT id FROM public.products WHERE organization_id IS NULL);
UPDATE public.benefits SET programme_id = NULL WHERE programme_id IN (SELECT id FROM public.programmes WHERE organization_id IS NULL);

UPDATE public.risks SET project_id   = NULL WHERE project_id   IN (SELECT id FROM public.projects WHERE organization_id IS NULL);
UPDATE public.risks SET product_id   = NULL WHERE product_id   IN (SELECT id FROM public.products WHERE organization_id IS NULL);
UPDATE public.risks SET programme_id = NULL WHERE programme_id IN (SELECT id FROM public.programmes WHERE organization_id IS NULL);

UPDATE public.issues SET project_id   = NULL WHERE project_id   IN (SELECT id FROM public.projects WHERE organization_id IS NULL);
UPDATE public.issues SET product_id   = NULL WHERE product_id   IN (SELECT id FROM public.products WHERE organization_id IS NULL);
UPDATE public.issues SET programme_id = NULL WHERE programme_id IN (SELECT id FROM public.programmes WHERE organization_id IS NULL);

UPDATE public.milestones SET project_id   = NULL WHERE project_id   IN (SELECT id FROM public.projects WHERE organization_id IS NULL);
UPDATE public.milestones SET product_id   = NULL WHERE product_id   IN (SELECT id FROM public.products WHERE organization_id IS NULL);
UPDATE public.milestones SET programme_id = NULL WHERE programme_id IN (SELECT id FROM public.programmes WHERE organization_id IS NULL);

UPDATE public.work_packages SET project_id = NULL WHERE project_id IN (SELECT id FROM public.projects WHERE organization_id IS NULL);
UPDATE public.sprints       SET project_id = NULL WHERE project_id IN (SELECT id FROM public.projects WHERE organization_id IS NULL);
UPDATE public.sprints       SET product_id = NULL WHERE product_id IN (SELECT id FROM public.products WHERE organization_id IS NULL);

UPDATE public.projects SET programme_id = NULL WHERE programme_id IN (SELECT id FROM public.programmes WHERE organization_id IS NULL);

-- =============================================================
-- 1b. DELETE orphan rows (children first, then parents)
-- =============================================================
DELETE FROM public.tasks                 WHERE organization_id IS NULL;
DELETE FROM public.work_packages         WHERE organization_id IS NULL;
DELETE FROM public.sprints               WHERE organization_id IS NULL;
DELETE FROM public.benefits              WHERE organization_id IS NULL;
DELETE FROM public.products              WHERE organization_id IS NULL;
DELETE FROM public.programme_definitions WHERE organization_id IS NULL;
DELETE FROM public.weekly_reports        WHERE programme_id IN (SELECT id FROM public.programmes WHERE organization_id IS NULL);
DELETE FROM public.projects              WHERE organization_id IS NULL;
DELETE FROM public.programmes            WHERE organization_id IS NULL;

-- Defensive sweep
DELETE FROM public.risks                       WHERE organization_id IS NULL;
DELETE FROM public.issues                      WHERE organization_id IS NULL;
DELETE FROM public.milestones                  WHERE organization_id IS NULL;
DELETE FROM public.change_requests             WHERE organization_id IS NULL;
DELETE FROM public.exceptions                  WHERE organization_id IS NULL;
DELETE FROM public.stakeholders                WHERE organization_id IS NULL;
DELETE FROM public.lessons_learned             WHERE organization_id IS NULL;
DELETE FROM public.business_requirements       WHERE organization_id IS NULL;
DELETE FROM public.technical_requirements      WHERE organization_id IS NULL;
DELETE FROM public.tranches                    WHERE organization_id IS NULL;
DELETE FROM public.success_plans               WHERE organization_id IS NULL;
DELETE FROM public.stage_gates                 WHERE organization_id IS NULL;
DELETE FROM public.quality_records             WHERE organization_id IS NULL;
DELETE FROM public.entity_updates              WHERE organization_id IS NULL;
DELETE FROM public.programme_blueprint         WHERE organization_id IS NULL;
DELETE FROM public.programme_success_plan      WHERE organization_id IS NULL;
DELETE FROM public.programme_tranches          WHERE organization_id IS NULL;
DELETE FROM public.approval_evidence           WHERE organization_id IS NULL;
DELETE FROM public.benefit_measurements        WHERE organization_id IS NULL;
DELETE FROM public.benefit_profiles            WHERE organization_id IS NULL;
DELETE FROM public.exception_assessments       WHERE organization_id IS NULL;
DELETE FROM public.exception_lifecycle_events  WHERE organization_id IS NULL;
DELETE FROM public.lesson_applications         WHERE organization_id IS NULL;
DELETE FROM public.lesson_tags                 WHERE organization_id IS NULL;
DELETE FROM public.quality_criteria            WHERE organization_id IS NULL;
DELETE FROM public.quality_reviews             WHERE organization_id IS NULL;
DELETE FROM public.stage_gate_approvals        WHERE organization_id IS NULL;
DELETE FROM public.workflow_approval_comments  WHERE organization_id IS NULL;

-- =============================================================
-- 2. ENFORCE NOT NULL on organization_id
-- =============================================================
DO $$
DECLARE
  _t text;
  _tenant_tables text[] := ARRAY[
    'projects','products','tasks','work_packages','sprints','programmes',
    'programme_definitions','benefits','risks','issues','milestones',
    'change_requests','exceptions','stakeholders','lessons_learned',
    'business_requirements','technical_requirements','tranches','success_plans',
    'stage_gates','quality_records','entity_updates','programme_blueprint',
    'programme_success_plan','programme_tranches','approval_evidence',
    'benefit_measurements','benefit_profiles','exception_assessments',
    'exception_lifecycle_events','lesson_applications','lesson_tags',
    'quality_criteria','quality_reviews','stage_gate_approvals',
    'workflow_approval_comments'
  ];
BEGIN
  FOREACH _t IN ARRAY _tenant_tables LOOP
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN organization_id SET NOT NULL', _t);
  END LOOP;
END $$;

-- =============================================================
-- 3. REWRITE SELECT policies - remove (organization_id IS NULL) branch
-- =============================================================
DROP POLICY IF EXISTS "Users can view org benefits" ON public.benefits;
CREATE POLICY "Users can view org benefits" ON public.benefits FOR SELECT
USING (has_org_access(auth.uid(), organization_id) OR auth.uid() = owner_id OR auth.uid() = created_by OR is_admin(auth.uid()));

DROP POLICY IF EXISTS "Users can view org business requirements" ON public.business_requirements;
CREATE POLICY "Users can view org business requirements" ON public.business_requirements FOR SELECT
USING (has_org_access(auth.uid(), organization_id) OR auth.uid() = owner_id OR auth.uid() = created_by OR is_admin(auth.uid()));

DROP POLICY IF EXISTS "Users can view org change requests" ON public.change_requests;
CREATE POLICY "Users can view org change requests" ON public.change_requests FOR SELECT
USING (has_org_access(auth.uid(), organization_id) OR auth.uid() = raised_by OR auth.uid() = owner_id OR auth.uid() = created_by OR is_admin(auth.uid()));

DROP POLICY IF EXISTS "Users can view org updates" ON public.entity_updates;
CREATE POLICY "Users can view org updates" ON public.entity_updates FOR SELECT
USING (has_org_access(auth.uid(), organization_id) OR auth.uid() = created_by OR is_admin(auth.uid()));

DROP POLICY IF EXISTS "Users can view org exceptions" ON public.exceptions;
CREATE POLICY "Users can view org exceptions" ON public.exceptions FOR SELECT
USING (has_org_access(auth.uid(), organization_id) OR auth.uid() = raised_by OR auth.uid() = owner_id OR auth.uid() = escalated_to OR auth.uid() = created_by OR is_admin(auth.uid()));

DROP POLICY IF EXISTS "Users can view org issues" ON public.issues;
CREATE POLICY "Users can view org issues" ON public.issues FOR SELECT
USING (has_org_access(auth.uid(), organization_id) OR auth.uid() = owner_id OR auth.uid() = created_by OR is_admin(auth.uid()));

DROP POLICY IF EXISTS "Users can view org lessons" ON public.lessons_learned;
CREATE POLICY "Users can view org lessons" ON public.lessons_learned FOR SELECT
USING (has_org_access(auth.uid(), organization_id) OR auth.uid() = owner_id OR auth.uid() = created_by OR is_admin(auth.uid()));

DROP POLICY IF EXISTS "Users can view org milestones" ON public.milestones;
CREATE POLICY "Users can view org milestones" ON public.milestones FOR SELECT
USING (has_org_access(auth.uid(), organization_id) OR auth.uid() = owner_id OR auth.uid() = created_by OR is_admin(auth.uid()));

DROP POLICY IF EXISTS "Users can view org products" ON public.products;
CREATE POLICY "Users can view org products" ON public.products FOR SELECT
USING (has_org_access(auth.uid(), organization_id) OR auth.uid() = product_owner_id OR auth.uid() = created_by OR is_admin(auth.uid()));

DROP POLICY IF EXISTS "Users can view org programme definitions" ON public.programme_definitions;
CREATE POLICY "Users can view org programme definitions" ON public.programme_definitions FOR SELECT
USING (has_org_access(auth.uid(), organization_id) OR auth.uid() = created_by OR is_admin(auth.uid()));

DROP POLICY IF EXISTS "Users can view org projects" ON public.projects;
CREATE POLICY "Users can view org projects" ON public.projects FOR SELECT
USING (has_org_access(auth.uid(), organization_id) OR auth.uid() = manager_id OR auth.uid() = created_by OR has_project_access(auth.uid(), id) OR is_admin(auth.uid()));

DROP POLICY IF EXISTS "Users can view org quality records" ON public.quality_records;
CREATE POLICY "Users can view org quality records" ON public.quality_records FOR SELECT
USING (has_org_access(auth.uid(), organization_id) OR auth.uid() = reviewer_id OR auth.uid() = owner_id OR auth.uid() = approved_by OR auth.uid() = created_by OR is_admin(auth.uid()));

DROP POLICY IF EXISTS "Users can view org risks" ON public.risks;
CREATE POLICY "Users can view org risks" ON public.risks FOR SELECT
USING (has_org_access(auth.uid(), organization_id) OR auth.uid() = owner_id OR auth.uid() = created_by OR is_admin(auth.uid()));

DROP POLICY IF EXISTS "Users can view org sprints" ON public.sprints;
CREATE POLICY "Users can view org sprints" ON public.sprints FOR SELECT
USING (has_org_access(auth.uid(), organization_id) OR auth.uid() = created_by OR is_admin(auth.uid()));

DROP POLICY IF EXISTS "Users can view org stage gates" ON public.stage_gates;
CREATE POLICY "Users can view org stage gates" ON public.stage_gates FOR SELECT
USING (has_org_access(auth.uid(), organization_id) OR auth.uid() = reviewed_by OR auth.uid() = created_by OR is_admin(auth.uid()));

DROP POLICY IF EXISTS "Users can view org success plans" ON public.success_plans;
CREATE POLICY "Users can view org success plans" ON public.success_plans FOR SELECT
USING (has_org_access(auth.uid(), organization_id) OR auth.uid() = created_by OR is_admin(auth.uid()));

DROP POLICY IF EXISTS "Users can view org tasks" ON public.tasks;
CREATE POLICY "Users can view org tasks" ON public.tasks FOR SELECT
USING (has_org_access(auth.uid(), organization_id) OR auth.uid() = assigned_to OR auth.uid() = created_by OR is_admin(auth.uid()));

DROP POLICY IF EXISTS "Users can view org technical requirements" ON public.technical_requirements;
CREATE POLICY "Users can view org technical requirements" ON public.technical_requirements FOR SELECT
USING (has_org_access(auth.uid(), organization_id) OR auth.uid() = owner_id OR auth.uid() = created_by OR is_admin(auth.uid()));

DROP POLICY IF EXISTS "Users can view org tranches" ON public.tranches;
CREATE POLICY "Users can view org tranches" ON public.tranches FOR SELECT
USING (has_org_access(auth.uid(), organization_id) OR auth.uid() = owner_id OR auth.uid() = created_by OR is_admin(auth.uid()));

DROP POLICY IF EXISTS "Users can view org work packages" ON public.work_packages;
CREATE POLICY "Users can view org work packages" ON public.work_packages FOR SELECT
USING (has_org_access(auth.uid(), organization_id) OR auth.uid() = created_by OR is_admin(auth.uid()));

DROP POLICY IF EXISTS "Org members view approval evidence" ON public.approval_evidence;
CREATE POLICY "Org members view approval evidence" ON public.approval_evidence FOR SELECT
USING (has_org_access(auth.uid(), organization_id) OR is_admin(auth.uid()));

DROP POLICY IF EXISTS "Org view benefit measurements" ON public.benefit_measurements;
CREATE POLICY "Org view benefit measurements" ON public.benefit_measurements FOR SELECT
USING (has_org_access(auth.uid(), organization_id) OR is_admin(auth.uid()));

DROP POLICY IF EXISTS "Org view benefit profiles" ON public.benefit_profiles;
CREATE POLICY "Org view benefit profiles" ON public.benefit_profiles FOR SELECT
USING (has_org_access(auth.uid(), organization_id) OR is_admin(auth.uid()));

DROP POLICY IF EXISTS "Org view exception assessments" ON public.exception_assessments;
CREATE POLICY "Org view exception assessments" ON public.exception_assessments FOR SELECT
USING (has_org_access(auth.uid(), organization_id) OR is_admin(auth.uid()));

DROP POLICY IF EXISTS "Org view exception events" ON public.exception_lifecycle_events;
CREATE POLICY "Org view exception events" ON public.exception_lifecycle_events FOR SELECT
USING (has_org_access(auth.uid(), organization_id) OR is_admin(auth.uid()));

DROP POLICY IF EXISTS "Org view lesson applications" ON public.lesson_applications;
CREATE POLICY "Org view lesson applications" ON public.lesson_applications FOR SELECT
USING (has_org_access(auth.uid(), organization_id) OR is_admin(auth.uid()));

DROP POLICY IF EXISTS "Org view lesson tags" ON public.lesson_tags;
CREATE POLICY "Org view lesson tags" ON public.lesson_tags FOR SELECT
USING (has_org_access(auth.uid(), organization_id) OR is_admin(auth.uid()));

DROP POLICY IF EXISTS "Org view blueprint" ON public.programme_blueprint;
CREATE POLICY "Org view blueprint" ON public.programme_blueprint FOR SELECT
USING (has_org_access(auth.uid(), organization_id) OR is_admin(auth.uid()));

DROP POLICY IF EXISTS "Org view success plan" ON public.programme_success_plan;
CREATE POLICY "Org view success plan" ON public.programme_success_plan FOR SELECT
USING (has_org_access(auth.uid(), organization_id) OR is_admin(auth.uid()));

DROP POLICY IF EXISTS "Org view tranches" ON public.programme_tranches;
CREATE POLICY "Org view tranches" ON public.programme_tranches FOR SELECT
USING (has_org_access(auth.uid(), organization_id) OR is_admin(auth.uid()));

DROP POLICY IF EXISTS "Org view quality criteria" ON public.quality_criteria;
CREATE POLICY "Org view quality criteria" ON public.quality_criteria FOR SELECT
USING (has_org_access(auth.uid(), organization_id) OR is_admin(auth.uid()));

DROP POLICY IF EXISTS "Org view quality reviews" ON public.quality_reviews;
CREATE POLICY "Org view quality reviews" ON public.quality_reviews FOR SELECT
USING (has_org_access(auth.uid(), organization_id) OR is_admin(auth.uid()));

DROP POLICY IF EXISTS "Org members view gate approvals" ON public.stage_gate_approvals;
CREATE POLICY "Org members view gate approvals" ON public.stage_gate_approvals FOR SELECT
USING (has_org_access(auth.uid(), organization_id) OR auth.uid() = reviewer_id OR is_admin(auth.uid()));

DROP POLICY IF EXISTS "Org members can view approval comments" ON public.workflow_approval_comments;
CREATE POLICY "Org members can view approval comments" ON public.workflow_approval_comments FOR SELECT
USING (has_org_access(auth.uid(), organization_id, 'viewer') OR is_admin(auth.uid()));

DROP POLICY IF EXISTS "Users can view org weekly reports" ON public.weekly_reports;
CREATE POLICY "Users can view org weekly reports" ON public.weekly_reports FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.programmes p
    WHERE p.id = weekly_reports.programme_id
      AND has_org_access(auth.uid(), p.organization_id)
  )
  OR auth.uid() = submitted_by
  OR auth.uid() = approved_by
  OR is_admin(auth.uid())
);

DROP POLICY IF EXISTS "Users can view org programme stakeholders" ON public.programme_stakeholders;
CREATE POLICY "Users can view org programme stakeholders" ON public.programme_stakeholders FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.programmes p
    WHERE p.id = programme_stakeholders.programme_id
      AND has_org_access(auth.uid(), p.organization_id)
  )
  OR is_admin(auth.uid())
);

DROP POLICY IF EXISTS "Users can view org features" ON public.product_features;
CREATE POLICY "Users can view org features" ON public.product_features FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = product_features.product_id
      AND has_org_access(auth.uid(), p.organization_id)
  )
  OR auth.uid() = created_by
  OR is_admin(auth.uid())
);

DROP POLICY IF EXISTS "Users can view org feature dependencies" ON public.feature_dependencies;
CREATE POLICY "Users can view org feature dependencies" ON public.feature_dependencies FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.product_features pf
    JOIN public.products prod ON pf.product_id = prod.id
    WHERE pf.id = feature_dependencies.feature_id
      AND has_org_access(auth.uid(), prod.organization_id)
  )
  OR auth.uid() = created_by
  OR is_admin(auth.uid())
);

-- =============================================================
-- 4. Tighten realtime.messages SELECT policy
-- =============================================================
DROP POLICY IF EXISTS "Authenticated users with org access can receive realtime" ON realtime.messages;
DROP POLICY IF EXISTS "Authenticated users can receive realtime" ON realtime.messages;
CREATE POLICY "Authenticated users can receive realtime" ON realtime.messages
FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.user_organization_access uoa WHERE uoa.user_id = auth.uid())
  OR public.is_admin(auth.uid())
);
