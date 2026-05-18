
-- 1. Harden has_org_access: enforce disabled flag + handle 'manager' level
CREATE OR REPLACE FUNCTION public.has_org_access(_user_id uuid, _org_id uuid, _min_level text DEFAULT 'viewer'::text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT public.is_admin(_user_id) OR (
    NOT EXISTS (
      SELECT 1 FROM public.user_organization_access uoa
      WHERE uoa.user_id = _user_id
        AND uoa.organization_id = _org_id
        AND uoa.is_disabled = true
    )
    AND EXISTS (
      SELECT 1
      FROM public.user_organization_custom_roles uocr
      JOIN public.custom_roles cr ON cr.id = uocr.custom_role_id
      WHERE uocr.user_id = _user_id
        AND uocr.organization_id = _org_id
        AND CASE _min_level
          WHEN 'admin'  THEN cr.name = 'Org Admin'
          WHEN 'manager' THEN cr.name IN ('Org Admin','Org Editor')
                              OR cr.can_manage_programmes OR cr.can_manage_projects
                              OR cr.can_manage_products  OR cr.can_manage_users
          WHEN 'editor' THEN cr.name IN ('Org Admin','Org Editor')
                              OR cr.can_manage_programmes OR cr.can_manage_projects
                              OR cr.can_manage_products  OR cr.can_manage_users
          ELSE TRUE
        END
    )
  );
$function$;

-- 2. Tighten status_history INSERT policy
DROP POLICY IF EXISTS "Authenticated users can insert status history" ON public.status_history;
CREATE POLICY "Users can insert org status history"
ON public.status_history
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = changed_by
  AND (
    is_admin(auth.uid())
    OR (entity_type = 'programme'    AND EXISTS (SELECT 1 FROM public.programmes p     WHERE p.id = entity_id  AND has_org_access(auth.uid(), p.organization_id, 'editor')))
    OR (entity_type = 'project'      AND EXISTS (SELECT 1 FROM public.projects p       WHERE p.id = entity_id  AND has_org_access(auth.uid(), p.organization_id, 'editor')))
    OR (entity_type = 'product'      AND EXISTS (SELECT 1 FROM public.products p       WHERE p.id = entity_id  AND has_org_access(auth.uid(), p.organization_id, 'editor')))
    OR (entity_type = 'work_package' AND EXISTS (SELECT 1 FROM public.work_packages wp WHERE wp.id = entity_id AND has_org_access(auth.uid(), wp.organization_id, 'editor')))
  )
);

-- 3. Tighten lesson_tag_assignments INSERT policy
DROP POLICY IF EXISTS "Authenticated assign lesson tags" ON public.lesson_tag_assignments;
CREATE POLICY "Org members assign lesson tags"
ON public.lesson_tag_assignments
FOR INSERT
TO authenticated
WITH CHECK (
  is_admin(auth.uid())
  OR (
    EXISTS (
      SELECT 1 FROM public.lesson_tags lt
      WHERE lt.id = tag_id
        AND has_org_access(auth.uid(), lt.organization_id, 'editor')
    )
    AND EXISTS (
      SELECT 1 FROM public.lessons_learned ll
      WHERE ll.id = lesson_id
        AND ll.organization_id IS NOT NULL
        AND has_org_access(auth.uid(), ll.organization_id, 'editor')
    )
  )
);

-- 4. Fix mutable search_path on lms_touch_updated_at
ALTER FUNCTION public.lms_touch_updated_at() SET search_path TO 'public';
