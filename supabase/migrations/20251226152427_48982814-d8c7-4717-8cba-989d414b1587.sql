-- ============================================================
-- FIX 1: STORAGE EXPOSURE - Make documents bucket private and secure
-- ============================================================

-- Make the documents bucket private
UPDATE storage.buckets SET public = false WHERE id = 'documents';

-- Drop existing overly permissive storage policies
DROP POLICY IF EXISTS "Authenticated users can view documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can update documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload to documents bucket" ON storage.objects;
DROP POLICY IF EXISTS "Users can view accessible documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own documents" ON storage.objects;

-- Create secure storage policies for documents bucket
-- Users can upload to documents bucket
CREATE POLICY "Users can upload to documents bucket"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'documents');

-- Users can view documents they uploaded or are admins
CREATE POLICY "Users can view accessible documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'documents' AND (
    -- Check if user uploaded the document
    EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.file_path = storage.objects.name
      AND d.uploaded_by = auth.uid()
    )
    OR public.is_admin(auth.uid())
    -- Check organization access via entity
    OR EXISTS (
      SELECT 1 FROM public.documents d
      JOIN public.programmes p ON d.entity_type = 'programme' AND d.entity_id = p.id
      WHERE d.file_path = storage.objects.name AND public.has_org_access(auth.uid(), p.organization_id)
    )
    OR EXISTS (
      SELECT 1 FROM public.documents d
      JOIN public.projects proj ON d.entity_type = 'project' AND d.entity_id = proj.id
      WHERE d.file_path = storage.objects.name AND public.has_org_access(auth.uid(), proj.organization_id)
    )
    OR EXISTS (
      SELECT 1 FROM public.documents d
      JOIN public.risks r ON d.entity_type = 'risk' AND d.entity_id = r.id
      WHERE d.file_path = storage.objects.name AND public.has_org_access(auth.uid(), r.organization_id)
    )
    OR EXISTS (
      SELECT 1 FROM public.documents d
      JOIN public.issues i ON d.entity_type = 'issue' AND d.entity_id = i.id
      WHERE d.file_path = storage.objects.name AND public.has_org_access(auth.uid(), i.organization_id)
    )
    OR EXISTS (
      SELECT 1 FROM public.documents d
      JOIN public.benefits b ON d.entity_type = 'benefit' AND d.entity_id = b.id
      WHERE d.file_path = storage.objects.name AND public.has_org_access(auth.uid(), b.organization_id)
    )
    OR EXISTS (
      SELECT 1 FROM public.documents d
      JOIN public.stakeholders s ON d.entity_type = 'stakeholder' AND d.entity_id = s.id
      WHERE d.file_path = storage.objects.name AND public.has_org_access(auth.uid(), s.organization_id)
    )
  )
);

-- Users can update documents they uploaded or are admins
CREATE POLICY "Users can update own documents"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'documents' AND (
    EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.file_path = storage.objects.name
      AND d.uploaded_by = auth.uid()
    )
    OR public.is_admin(auth.uid())
  )
);

-- Users can delete documents they uploaded or are admins
CREATE POLICY "Users can delete own documents"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'documents' AND (
    EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.file_path = storage.objects.name
      AND d.uploaded_by = auth.uid()
    )
    OR public.is_admin(auth.uid())
  )
);

-- ============================================================
-- FIX 1B: DOCUMENTS TABLE - Add org-scoped RLS policies
-- ============================================================

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Authenticated users can view documents" ON public.documents;

-- Create org-scoped document viewing policy
CREATE POLICY "Users can view org documents"
ON public.documents
FOR SELECT
USING (
  -- User uploaded the document
  auth.uid() = uploaded_by
  OR public.is_admin(auth.uid())
  -- Programme documents - check org access
  OR (entity_type = 'programme' AND EXISTS (
    SELECT 1 FROM public.programmes p 
    WHERE p.id = entity_id 
    AND public.has_org_access(auth.uid(), p.organization_id)
  ))
  -- Project documents - check org access
  OR (entity_type = 'project' AND EXISTS (
    SELECT 1 FROM public.projects p 
    WHERE p.id = entity_id 
    AND public.has_org_access(auth.uid(), p.organization_id)
  ))
  -- Risk documents - check org access
  OR (entity_type = 'risk' AND EXISTS (
    SELECT 1 FROM public.risks r 
    WHERE r.id = entity_id 
    AND public.has_org_access(auth.uid(), r.organization_id)
  ))
  -- Issue documents - check org access
  OR (entity_type = 'issue' AND EXISTS (
    SELECT 1 FROM public.issues i 
    WHERE i.id = entity_id 
    AND public.has_org_access(auth.uid(), i.organization_id)
  ))
  -- Benefit documents - check org access
  OR (entity_type = 'benefit' AND EXISTS (
    SELECT 1 FROM public.benefits b 
    WHERE b.id = entity_id 
    AND public.has_org_access(auth.uid(), b.organization_id)
  ))
  -- Stakeholder documents - check org access
  OR (entity_type = 'stakeholder' AND EXISTS (
    SELECT 1 FROM public.stakeholders s 
    WHERE s.id = entity_id 
    AND public.has_org_access(auth.uid(), s.organization_id)
  ))
);

-- ============================================================
-- FIX 2: PUBLIC DATA EXPOSURE - Add org-scoped RLS to core tables
-- ============================================================

-- PROJECTS TABLE
DROP POLICY IF EXISTS "Authenticated users can view projects" ON public.projects;

CREATE POLICY "Users can view org projects"
ON public.projects
FOR SELECT
USING (
  organization_id IS NULL
  OR public.has_org_access(auth.uid(), organization_id)
  OR auth.uid() = manager_id
  OR auth.uid() = created_by
  OR public.has_project_access(auth.uid(), id)
  OR public.is_admin(auth.uid())
);

-- RISKS TABLE
DROP POLICY IF EXISTS "Authenticated users can view risks" ON public.risks;

CREATE POLICY "Users can view org risks"
ON public.risks
FOR SELECT
USING (
  organization_id IS NULL
  OR public.has_org_access(auth.uid(), organization_id)
  OR auth.uid() = owner_id
  OR auth.uid() = created_by
  OR public.is_admin(auth.uid())
);

-- ISSUES TABLE
DROP POLICY IF EXISTS "Authenticated users can view issues" ON public.issues;

CREATE POLICY "Users can view org issues"
ON public.issues
FOR SELECT
USING (
  organization_id IS NULL
  OR public.has_org_access(auth.uid(), organization_id)
  OR auth.uid() = owner_id
  OR auth.uid() = created_by
  OR public.is_admin(auth.uid())
);

-- BENEFITS TABLE
DROP POLICY IF EXISTS "Authenticated users can view benefits" ON public.benefits;

CREATE POLICY "Users can view org benefits"
ON public.benefits
FOR SELECT
USING (
  organization_id IS NULL
  OR public.has_org_access(auth.uid(), organization_id)
  OR auth.uid() = owner_id
  OR auth.uid() = created_by
  OR public.is_admin(auth.uid())
);

-- STAKEHOLDERS TABLE
DROP POLICY IF EXISTS "Authenticated users can view stakeholders" ON public.stakeholders;

CREATE POLICY "Users can view org stakeholders"
ON public.stakeholders
FOR SELECT
USING (
  organization_id IS NULL
  OR public.has_org_access(auth.uid(), organization_id)
  OR auth.uid() = created_by
  OR public.is_admin(auth.uid())
);

-- LESSONS_LEARNED TABLE
DROP POLICY IF EXISTS "Authenticated users can view lessons" ON public.lessons_learned;

CREATE POLICY "Users can view org lessons"
ON public.lessons_learned
FOR SELECT
USING (
  organization_id IS NULL
  OR public.has_org_access(auth.uid(), organization_id)
  OR auth.uid() = owner_id
  OR auth.uid() = created_by
  OR public.is_admin(auth.uid())
);

-- PRODUCTS TABLE
DROP POLICY IF EXISTS "Authenticated users can view products" ON public.products;

CREATE POLICY "Users can view org products"
ON public.products
FOR SELECT
USING (
  organization_id IS NULL
  OR public.has_org_access(auth.uid(), organization_id)
  OR auth.uid() = product_owner_id
  OR auth.uid() = created_by
  OR public.is_admin(auth.uid())
);

-- PRODUCT_FEATURES TABLE
DROP POLICY IF EXISTS "Authenticated users can view features" ON public.product_features;

CREATE POLICY "Users can view org features"
ON public.product_features
FOR SELECT
USING (
  -- Check via product's organization
  EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = product_id
    AND (
      p.organization_id IS NULL
      OR public.has_org_access(auth.uid(), p.organization_id)
    )
  )
  OR auth.uid() = created_by
  OR public.is_admin(auth.uid())
);

-- SPRINTS TABLE
DROP POLICY IF EXISTS "Authenticated users can view sprints" ON public.sprints;

CREATE POLICY "Users can view org sprints"
ON public.sprints
FOR SELECT
USING (
  organization_id IS NULL
  OR public.has_org_access(auth.uid(), organization_id)
  OR auth.uid() = created_by
  OR public.is_admin(auth.uid())
);

-- WEEKLY_REPORTS TABLE
DROP POLICY IF EXISTS "Authenticated users can view weekly reports" ON public.weekly_reports;

CREATE POLICY "Users can view org weekly reports"
ON public.weekly_reports
FOR SELECT
USING (
  -- Check via programme's organization
  EXISTS (
    SELECT 1 FROM public.programmes p
    WHERE p.id = programme_id
    AND (
      p.organization_id IS NULL
      OR public.has_org_access(auth.uid(), p.organization_id)
    )
  )
  OR auth.uid() = submitted_by
  OR auth.uid() = approved_by
  OR public.is_admin(auth.uid())
);

-- FEATURE_DEPENDENCIES TABLE
DROP POLICY IF EXISTS "Authenticated users can view dependencies" ON public.feature_dependencies;

CREATE POLICY "Users can view org feature dependencies"
ON public.feature_dependencies
FOR SELECT
USING (
  -- Check via feature's product's organization
  EXISTS (
    SELECT 1 FROM public.product_features pf
    JOIN public.products prod ON pf.product_id = prod.id
    WHERE pf.id = feature_id
    AND (
      prod.organization_id IS NULL
      OR public.has_org_access(auth.uid(), prod.organization_id)
    )
  )
  OR auth.uid() = created_by
  OR public.is_admin(auth.uid())
);

-- PROGRAMME_STAKEHOLDERS TABLE - Fix the permissive ALL policy
DROP POLICY IF EXISTS "Users can manage programme stakeholders" ON public.programme_stakeholders;
DROP POLICY IF EXISTS "Authenticated users can view programme stakeholders" ON public.programme_stakeholders;

CREATE POLICY "Users can view org programme stakeholders"
ON public.programme_stakeholders
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.programmes p
    WHERE p.id = programme_id
    AND (
      p.organization_id IS NULL
      OR public.has_org_access(auth.uid(), p.organization_id)
    )
  )
  OR public.is_admin(auth.uid())
);

CREATE POLICY "Org users can manage programme stakeholders"
ON public.programme_stakeholders
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.programmes p
    WHERE p.id = programme_id
    AND (
      p.organization_id IS NULL
      OR public.has_org_access(auth.uid(), p.organization_id, 'editor')
    )
  )
  OR public.is_admin(auth.uid())
);