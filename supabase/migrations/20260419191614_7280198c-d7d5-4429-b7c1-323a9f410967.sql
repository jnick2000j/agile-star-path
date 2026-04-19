-- Status enum
CREATE TYPE public.timesheet_status AS ENUM ('draft', 'submitted', 'approved', 'rejected');

-- Timesheets table (one per user per week)
CREATE TABLE public.timesheets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  reference_number TEXT,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  status public.timesheet_status NOT NULL DEFAULT 'draft',
  notes TEXT,

  -- Approver
  approver_id UUID,

  -- Submitter signature
  submitted_at TIMESTAMPTZ,
  submitter_signature_name TEXT,
  submitter_signature_image TEXT,
  submitter_signature_ip TEXT,

  -- Approver signature
  decided_at TIMESTAMPTZ,
  approver_signature_name TEXT,
  approver_signature_image TEXT,
  approver_signature_ip TEXT,
  decision_notes TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT timesheets_period_valid CHECK (period_end >= period_start),
  CONSTRAINT timesheets_unique_user_week UNIQUE (user_id, period_start)
);

CREATE INDEX idx_timesheets_org ON public.timesheets(organization_id);
CREATE INDEX idx_timesheets_user ON public.timesheets(user_id);
CREATE INDEX idx_timesheets_approver ON public.timesheets(approver_id);
CREATE INDEX idx_timesheets_status ON public.timesheets(status);

-- Timesheet line entries (hours per day Mon-Sun)
CREATE TABLE public.timesheet_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timesheet_id UUID NOT NULL REFERENCES public.timesheets(id) ON DELETE CASCADE,
  programme_id UUID REFERENCES public.programmes(id) ON DELETE SET NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  description TEXT,
  hours_mon NUMERIC(5,2) NOT NULL DEFAULT 0,
  hours_tue NUMERIC(5,2) NOT NULL DEFAULT 0,
  hours_wed NUMERIC(5,2) NOT NULL DEFAULT 0,
  hours_thu NUMERIC(5,2) NOT NULL DEFAULT 0,
  hours_fri NUMERIC(5,2) NOT NULL DEFAULT 0,
  hours_sat NUMERIC(5,2) NOT NULL DEFAULT 0,
  hours_sun NUMERIC(5,2) NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT timesheet_entries_hours_nonneg CHECK (
    hours_mon >= 0 AND hours_tue >= 0 AND hours_wed >= 0 AND hours_thu >= 0
    AND hours_fri >= 0 AND hours_sat >= 0 AND hours_sun >= 0
  ),
  CONSTRAINT timesheet_entries_has_link CHECK (
    programme_id IS NOT NULL OR project_id IS NOT NULL
    OR product_id IS NOT NULL OR task_id IS NOT NULL
  )
);

CREATE INDEX idx_timesheet_entries_ts ON public.timesheet_entries(timesheet_id);

-- Timestamps trigger
CREATE TRIGGER trg_timesheets_updated_at
BEFORE UPDATE ON public.timesheets
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_timesheet_entries_updated_at
BEFORE UPDATE ON public.timesheet_entries
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Reference number trigger (uses existing generate_reference_number with 'timesheet')
CREATE TRIGGER trg_timesheets_ref
BEFORE INSERT ON public.timesheets
FOR EACH ROW EXECUTE FUNCTION public.set_reference_number('timesheet');

-- Enable RLS
ALTER TABLE public.timesheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timesheet_entries ENABLE ROW LEVEL SECURITY;

-- ===== Timesheet policies =====

-- Owner can view their own
CREATE POLICY "Owners view their timesheets"
ON public.timesheets FOR SELECT
USING (auth.uid() = user_id);

-- Approver can view timesheets assigned to them (when submitted/approved/rejected)
CREATE POLICY "Approvers view assigned timesheets"
ON public.timesheets FOR SELECT
USING (auth.uid() = approver_id AND status <> 'draft');

-- Org admins / users with org access view all in org
CREATE POLICY "Org members view org timesheets"
ON public.timesheets FOR SELECT
USING (public.has_org_access(auth.uid(), organization_id, 'manager'));

-- Owner can insert (only for self, only as draft)
CREATE POLICY "Owners create their timesheets"
ON public.timesheets FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND status = 'draft'
  AND public.has_org_access(auth.uid(), organization_id, 'viewer')
);

-- Owner can update only when draft or rejected (for resubmission)
CREATE POLICY "Owners update draft timesheets"
ON public.timesheets FOR UPDATE
USING (auth.uid() = user_id AND status IN ('draft', 'rejected'));

-- Approver can update (to approve/reject) their assigned timesheets
CREATE POLICY "Approvers decide timesheets"
ON public.timesheets FOR UPDATE
USING (auth.uid() = approver_id AND status = 'submitted');

-- Org admins can update any timesheet in org
CREATE POLICY "Org admins manage timesheets"
ON public.timesheets FOR UPDATE
USING (public.has_org_access(auth.uid(), organization_id, 'admin'));

-- Owner can delete their own drafts
CREATE POLICY "Owners delete draft timesheets"
ON public.timesheets FOR DELETE
USING (auth.uid() = user_id AND status = 'draft');

-- Org admins can delete any
CREATE POLICY "Org admins delete timesheets"
ON public.timesheets FOR DELETE
USING (public.has_org_access(auth.uid(), organization_id, 'admin'));

-- ===== Timesheet entry policies (delegate to parent) =====

CREATE POLICY "View entries when can view timesheet"
ON public.timesheet_entries FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.timesheets t
  WHERE t.id = timesheet_id
    AND (
      t.user_id = auth.uid()
      OR (t.approver_id = auth.uid() AND t.status <> 'draft')
      OR public.has_org_access(auth.uid(), t.organization_id, 'manager')
    )
));

CREATE POLICY "Insert entries on own draft timesheet"
ON public.timesheet_entries FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.timesheets t
  WHERE t.id = timesheet_id
    AND t.user_id = auth.uid()
    AND t.status IN ('draft', 'rejected')
));

CREATE POLICY "Update entries on own draft timesheet"
ON public.timesheet_entries FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.timesheets t
  WHERE t.id = timesheet_id
    AND t.user_id = auth.uid()
    AND t.status IN ('draft', 'rejected')
));

CREATE POLICY "Delete entries on own draft timesheet"
ON public.timesheet_entries FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.timesheets t
  WHERE t.id = timesheet_id
    AND t.user_id = auth.uid()
    AND t.status IN ('draft', 'rejected')
));

-- Helper: extend reference prefix mapping for timesheet
CREATE OR REPLACE FUNCTION public.generate_reference_number(_organization_id uuid, _entity_type text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    WHEN 'timesheet'             THEN 'TS'
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
$function$;