
-- Revoke default PUBLIC + anon execute on all new LMS functions.
REVOKE EXECUTE ON FUNCTION public.lms_user_can(uuid, uuid, text, text)        FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.lms_course_org(uuid)                         FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.lms_lesson_org(uuid)                         FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.lms_question_org(uuid)                       FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.lms_get_quiz_for_attempt(uuid)               FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.lms_submit_quiz(uuid, jsonb)                 FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.lms_recompute_enrollment(uuid)               FROM PUBLIC, anon;
-- lms_touch_updated_at is a trigger fn; revoke too for consistency
REVOKE EXECUTE ON FUNCTION public.lms_touch_updated_at()                       FROM PUBLIC, anon;

-- Re-grant to authenticated for the ones learners/authors call directly
GRANT  EXECUTE ON FUNCTION public.lms_get_quiz_for_attempt(uuid)               TO authenticated;
GRANT  EXECUTE ON FUNCTION public.lms_submit_quiz(uuid, jsonb)                 TO authenticated;
GRANT  EXECUTE ON FUNCTION public.lms_recompute_enrollment(uuid)               TO authenticated;
