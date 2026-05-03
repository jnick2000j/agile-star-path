ALTER TABLE public.lms_learning_path_courses
  ADD COLUMN IF NOT EXISTS prerequisite_course_id uuid NULL;

ALTER TABLE public.lms_learning_path_courses
  ADD CONSTRAINT lms_learning_path_courses_prereq_self_check
  CHECK (prerequisite_course_id IS NULL OR prerequisite_course_id <> course_id);

CREATE INDEX IF NOT EXISTS idx_lms_path_courses_prereq
  ON public.lms_learning_path_courses (path_id, prerequisite_course_id);

-- Validate prereq lives in same path and prevent cycles
CREATE OR REPLACE FUNCTION public.lms_validate_path_course_prereq()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  found boolean;
  cursor_course uuid;
  hops int := 0;
BEGIN
  IF NEW.prerequisite_course_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Prereq must be a course in the same path
  SELECT EXISTS (
    SELECT 1 FROM public.lms_learning_path_courses
    WHERE path_id = NEW.path_id AND course_id = NEW.prerequisite_course_id
  ) INTO found;
  IF NOT found THEN
    RAISE EXCEPTION 'Prerequisite course must belong to the same learning path';
  END IF;

  -- Walk the prerequisite chain to detect cycles (cap at 50 hops)
  cursor_course := NEW.prerequisite_course_id;
  WHILE cursor_course IS NOT NULL AND hops < 50 LOOP
    IF cursor_course = NEW.course_id THEN
      RAISE EXCEPTION 'Circular prerequisite detected';
    END IF;
    SELECT prerequisite_course_id INTO cursor_course
      FROM public.lms_learning_path_courses
      WHERE path_id = NEW.path_id AND course_id = cursor_course
      LIMIT 1;
    hops := hops + 1;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS lms_path_course_prereq_validate ON public.lms_learning_path_courses;
CREATE TRIGGER lms_path_course_prereq_validate
  BEFORE INSERT OR UPDATE ON public.lms_learning_path_courses
  FOR EACH ROW EXECUTE FUNCTION public.lms_validate_path_course_prereq();