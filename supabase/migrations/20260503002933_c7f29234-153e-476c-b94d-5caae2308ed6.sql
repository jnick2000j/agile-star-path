ALTER TABLE public.lms_lessons ADD COLUMN min_required_seconds integer;
ALTER TABLE public.lms_lessons ADD CONSTRAINT lms_lessons_min_required_seconds_check CHECK (min_required_seconds IS NULL OR min_required_seconds >= 0);

ALTER TABLE public.lms_modules ADD COLUMN min_required_seconds integer;
ALTER TABLE public.lms_modules ADD CONSTRAINT lms_modules_min_required_seconds_check CHECK (min_required_seconds IS NULL OR min_required_seconds >= 0);

ALTER TABLE public.lms_courses ADD COLUMN min_required_seconds integer;
ALTER TABLE public.lms_courses ADD CONSTRAINT lms_courses_min_required_seconds_check CHECK (min_required_seconds IS NULL OR min_required_seconds >= 0);