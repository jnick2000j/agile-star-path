
-- ============================================================================
-- LMS: Learning Management System
-- ============================================================================

-- Permission modules ---------------------------------------------------------
INSERT INTO public.permission_modules (module_key, label, category, description, sort_order) VALUES
  ('lms', 'Learning (LMS)', 'Productivity', 'Browse and take training courses', 320),
  ('lms_authoring', 'LMS Authoring', 'Productivity', 'Create and edit courses, lessons, quizzes, learning paths', 321),
  ('lms_admin', 'LMS Administration', 'Productivity', 'Assign mandatory training and view team training reports', 322)
ON CONFLICT (module_key) DO NOTHING;

-- Helper: does the current user have a given permission action on a module
-- Resolution: app_role (from user_organization_roles for this org) → custom_roles.name → role_module_permissions
CREATE OR REPLACE FUNCTION public.lms_user_can(_user_id uuid, _org_id uuid, _module_key text, _action text DEFAULT 'view')
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.has_org_access(_user_id, _org_id, 'admin')
    OR EXISTS (
      SELECT 1
      FROM public.user_organization_roles uor
      JOIN public.custom_roles            cr  ON cr.name = uor.role::text
      JOIN public.role_module_permissions rmp ON rmp.role_id = cr.id
      WHERE uor.user_id = _user_id
        AND uor.organization_id = _org_id
        AND rmp.module_key = _module_key
        AND CASE _action
              WHEN 'view'    THEN rmp.can_view
              WHEN 'create'  THEN rmp.can_create
              WHEN 'edit'    THEN rmp.can_edit
              WHEN 'delete'  THEN rmp.can_delete
              WHEN 'approve' THEN rmp.can_approve
              WHEN 'export'  THEN rmp.can_export
              ELSE false
            END
    );
$$;
REVOKE EXECUTE ON FUNCTION public.lms_user_can(uuid, uuid, text, text) FROM anon;

-- Learning paths -------------------------------------------------------------
CREATE TABLE public.lms_learning_paths (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  title           text NOT NULL,
  description     text,
  cover_image_url text,
  status          text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  created_by      uuid,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_lms_paths_org ON public.lms_learning_paths(organization_id);

-- Courses --------------------------------------------------------------------
CREATE TABLE public.lms_courses (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       uuid NOT NULL,
  title                 text NOT NULL,
  description           text,
  category              text,
  cover_image_url       text,
  est_duration_minutes  integer,
  passing_score_percent integer NOT NULL DEFAULT 80 CHECK (passing_score_percent BETWEEN 0 AND 100),
  issues_certificate    boolean NOT NULL DEFAULT true,
  status                text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  created_by            uuid,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_lms_courses_org ON public.lms_courses(organization_id);
CREATE INDEX idx_lms_courses_status ON public.lms_courses(organization_id, status);

CREATE TABLE public.lms_learning_path_courses (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  path_id     uuid NOT NULL REFERENCES public.lms_learning_paths(id) ON DELETE CASCADE,
  course_id   uuid NOT NULL REFERENCES public.lms_courses(id) ON DELETE CASCADE,
  position    integer NOT NULL DEFAULT 0,
  required    boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (path_id, course_id)
);
CREATE INDEX idx_lms_path_courses_path ON public.lms_learning_path_courses(path_id, position);

CREATE TABLE public.lms_modules (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id   uuid NOT NULL REFERENCES public.lms_courses(id) ON DELETE CASCADE,
  title       text NOT NULL,
  description text,
  position    integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_lms_modules_course ON public.lms_modules(course_id, position);

CREATE TABLE public.lms_lessons (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id       uuid NOT NULL REFERENCES public.lms_modules(id) ON DELETE CASCADE,
  course_id       uuid NOT NULL REFERENCES public.lms_courses(id) ON DELETE CASCADE,
  title           text NOT NULL,
  lesson_type     text NOT NULL CHECK (lesson_type IN ('video_upload','video_embed','document','quiz')),
  position        integer NOT NULL DEFAULT 0,
  storage_path    text,
  embed_url       text,
  content_md      text,
  duration_seconds integer,
  passing_score_percent integer CHECK (passing_score_percent IS NULL OR passing_score_percent BETWEEN 0 AND 100),
  max_attempts    integer,
  required        boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_lms_lessons_module ON public.lms_lessons(module_id, position);
CREATE INDEX idx_lms_lessons_course ON public.lms_lessons(course_id);

CREATE TABLE public.lms_quiz_questions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id    uuid NOT NULL REFERENCES public.lms_lessons(id) ON DELETE CASCADE,
  question     text NOT NULL,
  explanation  text,
  position     integer NOT NULL DEFAULT 0,
  multi_select boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_lms_questions_lesson ON public.lms_quiz_questions(lesson_id, position);

CREATE TABLE public.lms_quiz_options (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES public.lms_quiz_questions(id) ON DELETE CASCADE,
  option_text text NOT NULL,
  is_correct  boolean NOT NULL DEFAULT false,
  position    integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_lms_options_question ON public.lms_quiz_options(question_id, position);

CREATE TABLE public.lms_enrollments (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid NOT NULL,
  user_id          uuid NOT NULL,
  course_id        uuid NOT NULL REFERENCES public.lms_courses(id) ON DELETE CASCADE,
  path_id          uuid REFERENCES public.lms_learning_paths(id) ON DELETE SET NULL,
  status           text NOT NULL DEFAULT 'in_progress' CHECK (status IN ('not_started','in_progress','completed','failed','expired')),
  source           text NOT NULL DEFAULT 'self' CHECK (source IN ('self','assigned')),
  mandatory        boolean NOT NULL DEFAULT false,
  due_at           timestamptz,
  enrolled_at      timestamptz NOT NULL DEFAULT now(),
  started_at       timestamptz,
  completed_at     timestamptz,
  progress_percent integer NOT NULL DEFAULT 0 CHECK (progress_percent BETWEEN 0 AND 100),
  final_score      integer,
  assigned_by      uuid,
  UNIQUE (user_id, course_id)
);
CREATE INDEX idx_lms_enrollments_user ON public.lms_enrollments(user_id, status);
CREATE INDEX idx_lms_enrollments_org ON public.lms_enrollments(organization_id, status);
CREATE INDEX idx_lms_enrollments_course ON public.lms_enrollments(course_id);

CREATE TABLE public.lms_lesson_progress (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid NOT NULL,
  user_id          uuid NOT NULL,
  lesson_id        uuid NOT NULL REFERENCES public.lms_lessons(id) ON DELETE CASCADE,
  course_id        uuid NOT NULL REFERENCES public.lms_courses(id) ON DELETE CASCADE,
  position_seconds integer NOT NULL DEFAULT 0,
  completed        boolean NOT NULL DEFAULT false,
  completed_at     timestamptz,
  last_accessed_at timestamptz NOT NULL DEFAULT now(),
  watch_seconds    integer NOT NULL DEFAULT 0,
  UNIQUE (user_id, lesson_id)
);
CREATE INDEX idx_lms_progress_user_course ON public.lms_lesson_progress(user_id, course_id);

CREATE TABLE public.lms_quiz_attempts (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid NOT NULL,
  user_id          uuid NOT NULL,
  lesson_id        uuid NOT NULL REFERENCES public.lms_lessons(id) ON DELETE CASCADE,
  course_id        uuid NOT NULL REFERENCES public.lms_courses(id) ON DELETE CASCADE,
  attempt_number   integer NOT NULL DEFAULT 1,
  score_percent    integer NOT NULL DEFAULT 0 CHECK (score_percent BETWEEN 0 AND 100),
  passed           boolean NOT NULL DEFAULT false,
  answers          jsonb NOT NULL DEFAULT '{}'::jsonb,
  submitted_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_lms_attempts_user_lesson ON public.lms_quiz_attempts(user_id, lesson_id);

CREATE TABLE public.lms_assignments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  course_id       uuid REFERENCES public.lms_courses(id) ON DELETE CASCADE,
  path_id         uuid REFERENCES public.lms_learning_paths(id) ON DELETE CASCADE,
  user_id         uuid,
  role_id         uuid,
  mandatory       boolean NOT NULL DEFAULT true,
  due_at          timestamptz,
  notes           text,
  assigned_by     uuid NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CHECK ((course_id IS NOT NULL) OR (path_id IS NOT NULL)),
  CHECK ((user_id IS NOT NULL) OR (role_id IS NOT NULL))
);
CREATE INDEX idx_lms_assignments_org ON public.lms_assignments(organization_id);
CREATE INDEX idx_lms_assignments_user ON public.lms_assignments(user_id);

CREATE TABLE public.lms_certificates (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  user_id         uuid NOT NULL,
  course_id       uuid NOT NULL REFERENCES public.lms_courses(id) ON DELETE CASCADE,
  enrollment_id   uuid REFERENCES public.lms_enrollments(id) ON DELETE SET NULL,
  serial          text NOT NULL UNIQUE,
  storage_path    text,
  issued_at       timestamptz NOT NULL DEFAULT now(),
  final_score     integer
);
CREATE INDEX idx_lms_certificates_user ON public.lms_certificates(user_id);
CREATE INDEX idx_lms_certificates_org ON public.lms_certificates(organization_id);

-- updated_at triggers
CREATE OR REPLACE FUNCTION public.lms_touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER trg_lms_paths_updated   BEFORE UPDATE ON public.lms_learning_paths FOR EACH ROW EXECUTE FUNCTION public.lms_touch_updated_at();
CREATE TRIGGER trg_lms_courses_updated BEFORE UPDATE ON public.lms_courses        FOR EACH ROW EXECUTE FUNCTION public.lms_touch_updated_at();
CREATE TRIGGER trg_lms_lessons_updated BEFORE UPDATE ON public.lms_lessons        FOR EACH ROW EXECUTE FUNCTION public.lms_touch_updated_at();

-- Enable RLS
ALTER TABLE public.lms_learning_paths        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lms_courses               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lms_learning_path_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lms_modules               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lms_lessons               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lms_quiz_questions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lms_quiz_options          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lms_enrollments           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lms_lesson_progress       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lms_quiz_attempts         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lms_assignments           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lms_certificates          ENABLE ROW LEVEL SECURITY;

-- Helpers for inherited org context
CREATE OR REPLACE FUNCTION public.lms_course_org(_course_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT organization_id FROM public.lms_courses WHERE id = _course_id
$$;
REVOKE EXECUTE ON FUNCTION public.lms_course_org(uuid) FROM anon;

CREATE OR REPLACE FUNCTION public.lms_lesson_org(_lesson_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.organization_id FROM public.lms_lessons l JOIN public.lms_courses c ON c.id = l.course_id WHERE l.id = _lesson_id
$$;
REVOKE EXECUTE ON FUNCTION public.lms_lesson_org(uuid) FROM anon;

CREATE OR REPLACE FUNCTION public.lms_question_org(_question_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.organization_id
  FROM public.lms_quiz_questions q
  JOIN public.lms_lessons l ON l.id = q.lesson_id
  JOIN public.lms_courses c ON c.id = l.course_id
  WHERE q.id = _question_id
$$;
REVOKE EXECUTE ON FUNCTION public.lms_question_org(uuid) FROM anon;

-- Policies
CREATE POLICY "lms_paths_select" ON public.lms_learning_paths FOR SELECT
  USING (public.has_org_access(auth.uid(), organization_id, 'viewer'));
CREATE POLICY "lms_paths_insert" ON public.lms_learning_paths FOR INSERT
  WITH CHECK (public.lms_user_can(auth.uid(), organization_id, 'lms_authoring', 'create'));
CREATE POLICY "lms_paths_update" ON public.lms_learning_paths FOR UPDATE
  USING (public.lms_user_can(auth.uid(), organization_id, 'lms_authoring', 'edit'));
CREATE POLICY "lms_paths_delete" ON public.lms_learning_paths FOR DELETE
  USING (public.lms_user_can(auth.uid(), organization_id, 'lms_authoring', 'delete'));

CREATE POLICY "lms_path_courses_select" ON public.lms_learning_path_courses FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.lms_learning_paths p WHERE p.id = path_id AND public.has_org_access(auth.uid(), p.organization_id, 'viewer')));
CREATE POLICY "lms_path_courses_modify" ON public.lms_learning_path_courses FOR ALL
  USING (EXISTS (SELECT 1 FROM public.lms_learning_paths p WHERE p.id = path_id AND public.lms_user_can(auth.uid(), p.organization_id, 'lms_authoring', 'edit')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.lms_learning_paths p WHERE p.id = path_id AND public.lms_user_can(auth.uid(), p.organization_id, 'lms_authoring', 'edit')));

CREATE POLICY "lms_courses_select" ON public.lms_courses FOR SELECT
  USING (public.has_org_access(auth.uid(), organization_id, 'viewer'));
CREATE POLICY "lms_courses_insert" ON public.lms_courses FOR INSERT
  WITH CHECK (public.lms_user_can(auth.uid(), organization_id, 'lms_authoring', 'create'));
CREATE POLICY "lms_courses_update" ON public.lms_courses FOR UPDATE
  USING (public.lms_user_can(auth.uid(), organization_id, 'lms_authoring', 'edit'));
CREATE POLICY "lms_courses_delete" ON public.lms_courses FOR DELETE
  USING (public.lms_user_can(auth.uid(), organization_id, 'lms_authoring', 'delete'));

CREATE POLICY "lms_modules_select" ON public.lms_modules FOR SELECT
  USING (public.has_org_access(auth.uid(), public.lms_course_org(course_id), 'viewer'));
CREATE POLICY "lms_modules_modify" ON public.lms_modules FOR ALL
  USING (public.lms_user_can(auth.uid(), public.lms_course_org(course_id), 'lms_authoring', 'edit'))
  WITH CHECK (public.lms_user_can(auth.uid(), public.lms_course_org(course_id), 'lms_authoring', 'edit'));

CREATE POLICY "lms_lessons_select" ON public.lms_lessons FOR SELECT
  USING (public.has_org_access(auth.uid(), public.lms_course_org(course_id), 'viewer'));
CREATE POLICY "lms_lessons_modify" ON public.lms_lessons FOR ALL
  USING (public.lms_user_can(auth.uid(), public.lms_course_org(course_id), 'lms_authoring', 'edit'))
  WITH CHECK (public.lms_user_can(auth.uid(), public.lms_course_org(course_id), 'lms_authoring', 'edit'));

CREATE POLICY "lms_questions_select" ON public.lms_quiz_questions FOR SELECT
  USING (public.has_org_access(auth.uid(), public.lms_lesson_org(lesson_id), 'viewer'));
CREATE POLICY "lms_questions_modify" ON public.lms_quiz_questions FOR ALL
  USING (public.lms_user_can(auth.uid(), public.lms_lesson_org(lesson_id), 'lms_authoring', 'edit'))
  WITH CHECK (public.lms_user_can(auth.uid(), public.lms_lesson_org(lesson_id), 'lms_authoring', 'edit'));

-- Quiz options: only authors can read raw rows; learners use lms_get_quiz_for_attempt()
CREATE POLICY "lms_options_select_authors" ON public.lms_quiz_options FOR SELECT
  USING (public.lms_user_can(auth.uid(), public.lms_question_org(question_id), 'lms_authoring', 'view'));
CREATE POLICY "lms_options_modify" ON public.lms_quiz_options FOR ALL
  USING (public.lms_user_can(auth.uid(), public.lms_question_org(question_id), 'lms_authoring', 'edit'))
  WITH CHECK (public.lms_user_can(auth.uid(), public.lms_question_org(question_id), 'lms_authoring', 'edit'));

-- Enrollments
CREATE POLICY "lms_enrollments_select_self" ON public.lms_enrollments FOR SELECT
  USING (user_id = auth.uid());
CREATE POLICY "lms_enrollments_select_admin" ON public.lms_enrollments FOR SELECT
  USING (public.lms_user_can(auth.uid(), organization_id, 'lms_admin', 'view'));
CREATE POLICY "lms_enrollments_insert_self" ON public.lms_enrollments FOR INSERT
  WITH CHECK (user_id = auth.uid() AND public.has_org_access(auth.uid(), organization_id, 'viewer'));
CREATE POLICY "lms_enrollments_insert_admin" ON public.lms_enrollments FOR INSERT
  WITH CHECK (public.lms_user_can(auth.uid(), organization_id, 'lms_admin', 'create'));
CREATE POLICY "lms_enrollments_update_self" ON public.lms_enrollments FOR UPDATE
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "lms_enrollments_update_admin" ON public.lms_enrollments FOR UPDATE
  USING (public.lms_user_can(auth.uid(), organization_id, 'lms_admin', 'edit'))
  WITH CHECK (public.lms_user_can(auth.uid(), organization_id, 'lms_admin', 'edit'));
CREATE POLICY "lms_enrollments_delete_admin" ON public.lms_enrollments FOR DELETE
  USING (public.lms_user_can(auth.uid(), organization_id, 'lms_admin', 'delete'));

-- Lesson progress
CREATE POLICY "lms_progress_select_self"  ON public.lms_lesson_progress FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "lms_progress_select_admin" ON public.lms_lesson_progress FOR SELECT
  USING (public.lms_user_can(auth.uid(), organization_id, 'lms_admin', 'view'));
CREATE POLICY "lms_progress_upsert_self"  ON public.lms_lesson_progress FOR INSERT
  WITH CHECK (user_id = auth.uid() AND public.has_org_access(auth.uid(), organization_id, 'viewer'));
CREATE POLICY "lms_progress_update_self"  ON public.lms_lesson_progress FOR UPDATE
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Quiz attempts
CREATE POLICY "lms_attempts_select_self"  ON public.lms_quiz_attempts FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "lms_attempts_select_admin" ON public.lms_quiz_attempts FOR SELECT
  USING (public.lms_user_can(auth.uid(), organization_id, 'lms_admin', 'view'));
CREATE POLICY "lms_attempts_insert_self"  ON public.lms_quiz_attempts FOR INSERT
  WITH CHECK (user_id = auth.uid() AND public.has_org_access(auth.uid(), organization_id, 'viewer'));

-- Assignments
CREATE POLICY "lms_assignments_select_self"  ON public.lms_assignments FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "lms_assignments_select_admin" ON public.lms_assignments FOR SELECT
  USING (public.lms_user_can(auth.uid(), organization_id, 'lms_admin', 'view'));
CREATE POLICY "lms_assignments_modify"       ON public.lms_assignments FOR ALL
  USING (public.lms_user_can(auth.uid(), organization_id, 'lms_admin', 'edit'))
  WITH CHECK (public.lms_user_can(auth.uid(), organization_id, 'lms_admin', 'create'));

-- Certificates (insert handled by SECURITY DEFINER function lms_recompute_enrollment)
CREATE POLICY "lms_certificates_select_self"  ON public.lms_certificates FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "lms_certificates_select_admin" ON public.lms_certificates FOR SELECT
  USING (public.lms_user_can(auth.uid(), organization_id, 'lms_admin', 'view'));

-- Learner-safe quiz fetcher (no answer key)
CREATE OR REPLACE FUNCTION public.lms_get_quiz_for_attempt(_lesson_id uuid)
RETURNS TABLE (
  question_id uuid, question text, multi_select boolean, q_position integer,
  option_id uuid, option_text text, o_position integer
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT q.id, q.question, q.multi_select, q.position,
         o.id, o.option_text, o.position
  FROM public.lms_quiz_questions q
  JOIN public.lms_quiz_options   o ON o.question_id = q.id
  JOIN public.lms_lessons        l ON l.id = q.lesson_id
  JOIN public.lms_courses        c ON c.id = l.course_id
  WHERE l.id = _lesson_id
    AND public.has_org_access(auth.uid(), c.organization_id, 'viewer')
  ORDER BY q.position, o.position
$$;
REVOKE EXECUTE ON FUNCTION public.lms_get_quiz_for_attempt(uuid) FROM anon;

-- Server-side quiz grading
CREATE OR REPLACE FUNCTION public.lms_submit_quiz(_lesson_id uuid, _answers jsonb)
RETURNS TABLE (attempt_id uuid, score_percent integer, passed boolean, attempt_number integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_org uuid; v_course_id uuid; v_pass_threshold integer;
  v_total integer := 0; v_correct integer := 0; v_score integer := 0;
  v_passed boolean := false; v_attempt_no integer; v_attempt_id uuid;
  q_rec record; selected_opts uuid[]; correct_opts uuid[];
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;

  SELECT c.organization_id, c.id, COALESCE(l.passing_score_percent, c.passing_score_percent)
    INTO v_org, v_course_id, v_pass_threshold
  FROM public.lms_lessons l JOIN public.lms_courses c ON c.id = l.course_id
  WHERE l.id = _lesson_id AND l.lesson_type = 'quiz';

  IF v_org IS NULL THEN RAISE EXCEPTION 'Quiz lesson not found'; END IF;
  IF NOT public.has_org_access(auth.uid(), v_org, 'viewer') THEN RAISE EXCEPTION 'Access denied'; END IF;

  FOR q_rec IN SELECT id, multi_select FROM public.lms_quiz_questions WHERE lesson_id = _lesson_id LOOP
    v_total := v_total + 1;
    selected_opts := COALESCE(
      (SELECT array_agg((value)::uuid) FROM jsonb_array_elements_text(_answers -> q_rec.id::text)),
      ARRAY[]::uuid[]);
    SELECT COALESCE(array_agg(id ORDER BY id), ARRAY[]::uuid[]) INTO correct_opts
      FROM public.lms_quiz_options WHERE question_id = q_rec.id AND is_correct = true;
    IF (SELECT COALESCE(array_agg(x ORDER BY x), ARRAY[]::uuid[]) FROM unnest(selected_opts) AS x) = correct_opts THEN
      v_correct := v_correct + 1;
    END IF;
  END LOOP;

  IF v_total = 0 THEN v_score := 0;
  ELSE v_score := ROUND((v_correct::numeric / v_total::numeric) * 100); END IF;
  v_passed := v_score >= COALESCE(v_pass_threshold, 80);

  SELECT COALESCE(MAX(attempt_number), 0) + 1 INTO v_attempt_no
    FROM public.lms_quiz_attempts WHERE user_id = auth.uid() AND lesson_id = _lesson_id;

  INSERT INTO public.lms_quiz_attempts (organization_id, user_id, lesson_id, course_id, attempt_number, score_percent, passed, answers)
    VALUES (v_org, auth.uid(), _lesson_id, v_course_id, v_attempt_no, v_score, v_passed, _answers)
    RETURNING id INTO v_attempt_id;

  IF v_passed THEN
    INSERT INTO public.lms_lesson_progress (organization_id, user_id, lesson_id, course_id, completed, completed_at)
      VALUES (v_org, auth.uid(), _lesson_id, v_course_id, true, now())
      ON CONFLICT (user_id, lesson_id) DO UPDATE
        SET completed = true,
            completed_at = COALESCE(public.lms_lesson_progress.completed_at, now()),
            last_accessed_at = now();
  END IF;

  RETURN QUERY SELECT v_attempt_id, v_score, v_passed, v_attempt_no;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.lms_submit_quiz(uuid, jsonb) FROM anon;

-- Recompute enrollment progress + auto-issue cert
CREATE OR REPLACE FUNCTION public.lms_recompute_enrollment(_course_id uuid)
RETURNS TABLE (progress_percent integer, status text, completed boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_org uuid; v_total integer; v_done integer;
  v_pct integer := 0; v_status text; v_completed boolean := false;
  v_enrollment_id uuid; v_serial text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT organization_id INTO v_org FROM public.lms_courses WHERE id = _course_id;
  IF v_org IS NULL THEN RAISE EXCEPTION 'Course not found'; END IF;
  IF NOT public.has_org_access(auth.uid(), v_org, 'viewer') THEN RAISE EXCEPTION 'Access denied'; END IF;

  SELECT COUNT(*) INTO v_total FROM public.lms_lessons WHERE course_id = _course_id AND required = true;
  SELECT COUNT(*) INTO v_done
    FROM public.lms_lesson_progress lp
    JOIN public.lms_lessons l ON l.id = lp.lesson_id
   WHERE lp.user_id = auth.uid() AND lp.course_id = _course_id AND lp.completed = true AND l.required = true;

  IF v_total = 0 THEN v_pct := 0; ELSE v_pct := LEAST(100, ROUND((v_done::numeric / v_total::numeric) * 100)); END IF;
  v_completed := (v_total > 0 AND v_done >= v_total);
  v_status := CASE WHEN v_completed THEN 'completed' WHEN v_pct > 0 THEN 'in_progress' ELSE 'not_started' END;

  UPDATE public.lms_enrollments
     SET progress_percent = v_pct, status = v_status,
         started_at = COALESCE(started_at, CASE WHEN v_pct > 0 THEN now() ELSE NULL END),
         completed_at = CASE WHEN v_completed THEN COALESCE(completed_at, now()) ELSE completed_at END
   WHERE user_id = auth.uid() AND course_id = _course_id
   RETURNING id INTO v_enrollment_id;

  IF v_completed THEN
    IF EXISTS (SELECT 1 FROM public.lms_courses WHERE id = _course_id AND issues_certificate = true)
       AND NOT EXISTS (SELECT 1 FROM public.lms_certificates WHERE user_id = auth.uid() AND course_id = _course_id) THEN
      v_serial := 'CERT-' || to_char(now(), 'YYYYMMDD') || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);
      INSERT INTO public.lms_certificates (organization_id, user_id, course_id, enrollment_id, serial, final_score)
        VALUES (v_org, auth.uid(), _course_id, v_enrollment_id, v_serial, v_pct);
    END IF;
    INSERT INTO public.entity_audit_log (organization_id, entity_type, entity_id, action, actor_user_id, after_data)
      VALUES (v_org, 'lms_enrollment', v_enrollment_id, 'completed', auth.uid(),
              jsonb_build_object('course_id', _course_id, 'progress', v_pct));
  END IF;

  RETURN QUERY SELECT v_pct, v_status, v_completed;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.lms_recompute_enrollment(uuid) FROM anon;

-- Storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES
  ('lms-content', 'lms-content', false),
  ('lms-certificates', 'lms-certificates', false)
ON CONFLICT (id) DO NOTHING;

-- lms-content: org-scoped read; authors write. Path convention: {org_id}/...
CREATE POLICY "lms_content_read" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'lms-content'
    AND EXISTS (
      SELECT 1 FROM public.user_organization_access uoa
      WHERE uoa.user_id = auth.uid()
        AND uoa.organization_id::text = (storage.foldername(name))[1]
        AND uoa.is_disabled = false
    )
  );
CREATE POLICY "lms_content_write" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'lms-content'
    AND public.lms_user_can(auth.uid(), ((storage.foldername(name))[1])::uuid, 'lms_authoring', 'create')
  );
CREATE POLICY "lms_content_update" ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'lms-content'
    AND public.lms_user_can(auth.uid(), ((storage.foldername(name))[1])::uuid, 'lms_authoring', 'edit')
  );
CREATE POLICY "lms_content_delete" ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'lms-content'
    AND public.lms_user_can(auth.uid(), ((storage.foldername(name))[1])::uuid, 'lms_authoring', 'delete')
  );

-- lms-certificates: only owner & admin read. Path: {org_id}/{user_id}/...
CREATE POLICY "lms_certificates_read_self" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'lms-certificates'
    AND (
      (storage.foldername(name))[2] = auth.uid()::text
      OR public.lms_user_can(auth.uid(), ((storage.foldername(name))[1])::uuid, 'lms_admin', 'view')
    )
  );
