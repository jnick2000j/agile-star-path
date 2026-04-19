-- ============================================================
-- 1) Per-organization reference number sequences
-- ============================================================
CREATE TABLE IF NOT EXISTS public.reference_sequences (
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  year INT NOT NULL,
  next_value INT NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, entity_type, year)
);

ALTER TABLE public.reference_sequences ENABLE ROW LEVEL SECURITY;

-- No user-facing access; SECURITY DEFINER function manages it.

-- ============================================================
-- 2) Generator function
-- ============================================================
CREATE OR REPLACE FUNCTION public.generate_reference_number(
  _organization_id UUID,
  _entity_type TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _prefix TEXT;
  _year INT := EXTRACT(YEAR FROM now())::INT;
  _seq INT;
BEGIN
  IF _organization_id IS NULL THEN
    RETURN NULL;
  END IF;

  _prefix := CASE _entity_type
    WHEN 'project'      THEN 'PRJ'
    WHEN 'product'      THEN 'PRD'
    WHEN 'task'         THEN 'TSK'
    WHEN 'programme'    THEN 'PGM'
    WHEN 'stage_gate'   THEN 'SG'
    WHEN 'milestone'    THEN 'MIL'
    WHEN 'risk'         THEN 'RSK'
    WHEN 'issue'        THEN 'ISS'
    WHEN 'benefit'      THEN 'BEN'
    WHEN 'lesson'       THEN 'LSN'
    WHEN 'business_requirement'  THEN 'BR'
    WHEN 'technical_requirement' THEN 'TR'
    WHEN 'change_request'        THEN 'CR'
    WHEN 'exception'             THEN 'EXC'
    ELSE upper(substring(_entity_type, 1, 3))
  END;

  INSERT INTO reference_sequences (organization_id, entity_type, year, next_value)
  VALUES (_organization_id, _entity_type, _year, 2)
  ON CONFLICT (organization_id, entity_type, year)
  DO UPDATE SET next_value = reference_sequences.next_value + 1,
                updated_at = now()
  RETURNING next_value - 1 INTO _seq;

  RETURN _prefix || '-' || _year::TEXT || '-' || lpad(_seq::TEXT, 4, '0');
END;
$$;

-- ============================================================
-- 3) Generic trigger to auto-fill reference_number on insert
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_reference_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _entity_type TEXT := TG_ARGV[0];
BEGIN
  IF NEW.reference_number IS NULL OR NEW.reference_number = '' THEN
    NEW.reference_number := public.generate_reference_number(NEW.organization_id, _entity_type);
  END IF;
  RETURN NEW;
END;
$$;

-- ============================================================
-- 4) Add reference_number columns
-- ============================================================
ALTER TABLE public.projects        ADD COLUMN IF NOT EXISTS reference_number TEXT;
ALTER TABLE public.products        ADD COLUMN IF NOT EXISTS reference_number TEXT;
ALTER TABLE public.tasks           ADD COLUMN IF NOT EXISTS reference_number TEXT;
ALTER TABLE public.programmes      ADD COLUMN IF NOT EXISTS reference_number TEXT;
ALTER TABLE public.stage_gates     ADD COLUMN IF NOT EXISTS reference_number TEXT;
ALTER TABLE public.milestones      ADD COLUMN IF NOT EXISTS reference_number TEXT;
ALTER TABLE public.risks           ADD COLUMN IF NOT EXISTS reference_number TEXT;
ALTER TABLE public.issues          ADD COLUMN IF NOT EXISTS reference_number TEXT;
ALTER TABLE public.benefits        ADD COLUMN IF NOT EXISTS reference_number TEXT;
ALTER TABLE public.lessons_learned ADD COLUMN IF NOT EXISTS reference_number TEXT;

-- Unique per organization (NULLs allowed for legacy / org-less rows)
CREATE UNIQUE INDEX IF NOT EXISTS uq_projects_ref        ON public.projects        (organization_id, reference_number) WHERE reference_number IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_products_ref        ON public.products        (organization_id, reference_number) WHERE reference_number IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_tasks_ref           ON public.tasks           (organization_id, reference_number) WHERE reference_number IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_programmes_ref      ON public.programmes      (organization_id, reference_number) WHERE reference_number IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_stage_gates_ref     ON public.stage_gates     (organization_id, reference_number) WHERE reference_number IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_milestones_ref      ON public.milestones      (organization_id, reference_number) WHERE reference_number IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_risks_ref           ON public.risks           (organization_id, reference_number) WHERE reference_number IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_issues_ref          ON public.issues          (organization_id, reference_number) WHERE reference_number IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_benefits_ref        ON public.benefits        (organization_id, reference_number) WHERE reference_number IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_lessons_learned_ref ON public.lessons_learned (organization_id, reference_number) WHERE reference_number IS NOT NULL;

-- ============================================================
-- 5) Triggers (BEFORE INSERT)
-- ============================================================
DROP TRIGGER IF EXISTS trg_projects_set_ref         ON public.projects;
DROP TRIGGER IF EXISTS trg_products_set_ref         ON public.products;
DROP TRIGGER IF EXISTS trg_tasks_set_ref            ON public.tasks;
DROP TRIGGER IF EXISTS trg_programmes_set_ref       ON public.programmes;
DROP TRIGGER IF EXISTS trg_stage_gates_set_ref      ON public.stage_gates;
DROP TRIGGER IF EXISTS trg_milestones_set_ref       ON public.milestones;
DROP TRIGGER IF EXISTS trg_risks_set_ref            ON public.risks;
DROP TRIGGER IF EXISTS trg_issues_set_ref           ON public.issues;
DROP TRIGGER IF EXISTS trg_benefits_set_ref         ON public.benefits;
DROP TRIGGER IF EXISTS trg_lessons_learned_set_ref  ON public.lessons_learned;

CREATE TRIGGER trg_projects_set_ref         BEFORE INSERT ON public.projects        FOR EACH ROW EXECUTE FUNCTION public.set_reference_number('project');
CREATE TRIGGER trg_products_set_ref         BEFORE INSERT ON public.products        FOR EACH ROW EXECUTE FUNCTION public.set_reference_number('product');
CREATE TRIGGER trg_tasks_set_ref            BEFORE INSERT ON public.tasks           FOR EACH ROW EXECUTE FUNCTION public.set_reference_number('task');
CREATE TRIGGER trg_programmes_set_ref       BEFORE INSERT ON public.programmes      FOR EACH ROW EXECUTE FUNCTION public.set_reference_number('programme');
CREATE TRIGGER trg_stage_gates_set_ref      BEFORE INSERT ON public.stage_gates     FOR EACH ROW EXECUTE FUNCTION public.set_reference_number('stage_gate');
CREATE TRIGGER trg_milestones_set_ref       BEFORE INSERT ON public.milestones      FOR EACH ROW EXECUTE FUNCTION public.set_reference_number('milestone');
CREATE TRIGGER trg_risks_set_ref            BEFORE INSERT ON public.risks           FOR EACH ROW EXECUTE FUNCTION public.set_reference_number('risk');
CREATE TRIGGER trg_issues_set_ref           BEFORE INSERT ON public.issues          FOR EACH ROW EXECUTE FUNCTION public.set_reference_number('issue');
CREATE TRIGGER trg_benefits_set_ref         BEFORE INSERT ON public.benefits        FOR EACH ROW EXECUTE FUNCTION public.set_reference_number('benefit');
CREATE TRIGGER trg_lessons_learned_set_ref  BEFORE INSERT ON public.lessons_learned FOR EACH ROW EXECUTE FUNCTION public.set_reference_number('lesson');

-- ============================================================
-- 6) Backfill existing rows (org-scoped, in creation order)
-- ============================================================
DO $$
DECLARE
  _r RECORD;
  _spec RECORD;
  _seq INT;
  _yr INT;
  _prefix TEXT;
BEGIN
  FOR _spec IN SELECT * FROM (VALUES
    ('projects',        'project',     'PRJ'),
    ('products',        'product',     'PRD'),
    ('tasks',           'task',        'TSK'),
    ('programmes',      'programme',   'PGM'),
    ('stage_gates',     'stage_gate',  'SG'),
    ('milestones',      'milestone',   'MIL'),
    ('risks',           'risk',        'RSK'),
    ('issues',          'issue',       'ISS'),
    ('benefits',        'benefit',     'BEN'),
    ('lessons_learned', 'lesson',      'LSN')
  ) AS t(tbl, etype, prefix)
  LOOP
    FOR _r IN EXECUTE format(
      'SELECT id, organization_id, EXTRACT(YEAR FROM created_at)::INT AS yr
         FROM public.%I
        WHERE reference_number IS NULL AND organization_id IS NOT NULL
        ORDER BY created_at', _spec.tbl)
    LOOP
      _yr := _r.yr;
      INSERT INTO reference_sequences (organization_id, entity_type, year, next_value)
      VALUES (_r.organization_id, _spec.etype, _yr, 2)
      ON CONFLICT (organization_id, entity_type, year)
      DO UPDATE SET next_value = reference_sequences.next_value + 1,
                    updated_at = now()
      RETURNING next_value - 1 INTO _seq;

      EXECUTE format('UPDATE public.%I SET reference_number = $1 WHERE id = $2', _spec.tbl)
        USING (_spec.prefix || '-' || _yr::TEXT || '-' || lpad(_seq::TEXT, 4, '0')), _r.id;
    END LOOP;
  END LOOP;
END $$;