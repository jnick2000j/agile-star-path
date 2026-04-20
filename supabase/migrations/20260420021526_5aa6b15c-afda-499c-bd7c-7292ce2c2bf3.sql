-- Replace the public-readable SELECT policy on lesson_tag_assignments with an org-scoped one.
-- A user can read an assignment only if they have access to the organization that owns
-- either the joined lesson_tag or the joined lesson.

DROP POLICY IF EXISTS "Org view lesson assignments" ON public.lesson_tag_assignments;

CREATE POLICY "Org view lesson assignments"
ON public.lesson_tag_assignments
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.lesson_tags lt
    WHERE lt.id = lesson_tag_assignments.tag_id
      AND public.has_org_access(auth.uid(), lt.organization_id, 'viewer')
  )
  OR EXISTS (
    SELECT 1
    FROM public.lessons_learned ll
    WHERE ll.id = lesson_tag_assignments.lesson_id
      AND ll.organization_id IS NOT NULL
      AND public.has_org_access(auth.uid(), ll.organization_id, 'viewer')
  )
  OR public.is_admin(auth.uid())
);