
-- ============ OKR CYCLES ============
CREATE TABLE public.okr_cycles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  period_type TEXT NOT NULL DEFAULT 'quarterly' CHECK (period_type IN ('quarterly','annual','custom')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','active','closed')),
  grading_scale_min NUMERIC NOT NULL DEFAULT 0.0,
  grading_scale_max NUMERIC NOT NULL DEFAULT 1.0,
  description TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_okr_cycles_org ON public.okr_cycles(organization_id);
CREATE INDEX idx_okr_cycles_status ON public.okr_cycles(organization_id, status);

ALTER TABLE public.okr_cycles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "okr_cycles_select" ON public.okr_cycles FOR SELECT
  USING (has_org_access(auth.uid(), organization_id) OR is_admin(auth.uid()));
CREATE POLICY "okr_cycles_insert" ON public.okr_cycles FOR INSERT
  WITH CHECK (has_org_access(auth.uid(), organization_id));
CREATE POLICY "okr_cycles_update" ON public.okr_cycles FOR UPDATE
  USING (has_org_access(auth.uid(), organization_id) OR is_admin(auth.uid()));
CREATE POLICY "okr_cycles_delete" ON public.okr_cycles FOR DELETE
  USING (has_org_access(auth.uid(), organization_id) OR is_admin(auth.uid()));

-- ============ OKR OBJECTIVES ============
CREATE TABLE public.okr_objectives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  cycle_id UUID NOT NULL REFERENCES public.okr_cycles(id) ON DELETE CASCADE,
  parent_objective_id UUID REFERENCES public.okr_objectives(id) ON DELETE SET NULL,
  scope TEXT NOT NULL DEFAULT 'org' CHECK (scope IN ('org','programme','project','team','individual')),
  programme_id UUID,
  project_id UUID,
  product_id UUID,
  owner_user_id UUID,
  team_name TEXT,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  status TEXT NOT NULL DEFAULT 'on_track' CHECK (status IN ('not_started','on_track','at_risk','off_track','achieved','missed','cancelled')),
  progress_pct NUMERIC NOT NULL DEFAULT 0,
  confidence NUMERIC NOT NULL DEFAULT 0.7,
  final_grade NUMERIC,
  final_commentary TEXT,
  graded_by UUID,
  graded_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_okr_objectives_org ON public.okr_objectives(organization_id);
CREATE INDEX idx_okr_objectives_cycle ON public.okr_objectives(cycle_id);
CREATE INDEX idx_okr_objectives_parent ON public.okr_objectives(parent_objective_id);
CREATE INDEX idx_okr_objectives_owner ON public.okr_objectives(owner_user_id);

ALTER TABLE public.okr_objectives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "okr_obj_select" ON public.okr_objectives FOR SELECT
  USING (has_org_access(auth.uid(), organization_id) OR auth.uid() = owner_user_id OR is_admin(auth.uid()));
CREATE POLICY "okr_obj_insert" ON public.okr_objectives FOR INSERT
  WITH CHECK (has_org_access(auth.uid(), organization_id));
CREATE POLICY "okr_obj_update" ON public.okr_objectives FOR UPDATE
  USING (has_org_access(auth.uid(), organization_id) OR auth.uid() = owner_user_id OR is_admin(auth.uid()));
CREATE POLICY "okr_obj_delete" ON public.okr_objectives FOR DELETE
  USING (has_org_access(auth.uid(), organization_id) OR is_admin(auth.uid()));

-- ============ OKR KEY RESULTS ============
CREATE TABLE public.okr_key_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  objective_id UUID NOT NULL REFERENCES public.okr_objectives(id) ON DELETE CASCADE,
  owner_user_id UUID,
  title TEXT NOT NULL,
  description TEXT,
  metric_type TEXT NOT NULL DEFAULT 'number' CHECK (metric_type IN ('number','percent','currency','boolean','milestone')),
  start_value NUMERIC NOT NULL DEFAULT 0,
  target_value NUMERIC NOT NULL DEFAULT 100,
  current_value NUMERIC NOT NULL DEFAULT 0,
  unit TEXT,
  progress_pct NUMERIC NOT NULL DEFAULT 0,
  confidence NUMERIC NOT NULL DEFAULT 0.7,
  weight NUMERIC NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'on_track' CHECK (status IN ('not_started','on_track','at_risk','off_track','achieved','missed','cancelled')),
  due_date DATE,
  last_checkin_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_okr_kr_org ON public.okr_key_results(organization_id);
CREATE INDEX idx_okr_kr_obj ON public.okr_key_results(objective_id);
CREATE INDEX idx_okr_kr_owner ON public.okr_key_results(owner_user_id);

ALTER TABLE public.okr_key_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "okr_kr_select" ON public.okr_key_results FOR SELECT
  USING (has_org_access(auth.uid(), organization_id) OR auth.uid() = owner_user_id OR is_admin(auth.uid()));
CREATE POLICY "okr_kr_insert" ON public.okr_key_results FOR INSERT
  WITH CHECK (has_org_access(auth.uid(), organization_id));
CREATE POLICY "okr_kr_update" ON public.okr_key_results FOR UPDATE
  USING (has_org_access(auth.uid(), organization_id) OR auth.uid() = owner_user_id OR is_admin(auth.uid()));
CREATE POLICY "okr_kr_delete" ON public.okr_key_results FOR DELETE
  USING (has_org_access(auth.uid(), organization_id) OR is_admin(auth.uid()));

-- ============ OKR CHECK-INS ============
CREATE TABLE public.okr_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  key_result_id UUID NOT NULL REFERENCES public.okr_key_results(id) ON DELETE CASCADE,
  user_id UUID,
  checkin_date DATE NOT NULL DEFAULT CURRENT_DATE,
  previous_value NUMERIC,
  new_value NUMERIC NOT NULL,
  progress_pct NUMERIC,
  confidence NUMERIC NOT NULL DEFAULT 0.7,
  status TEXT,
  commentary TEXT,
  blockers TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_okr_checkin_org ON public.okr_checkins(organization_id);
CREATE INDEX idx_okr_checkin_kr ON public.okr_checkins(key_result_id, checkin_date DESC);

ALTER TABLE public.okr_checkins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "okr_chk_select" ON public.okr_checkins FOR SELECT
  USING (has_org_access(auth.uid(), organization_id) OR is_admin(auth.uid()));
CREATE POLICY "okr_chk_insert" ON public.okr_checkins FOR INSERT
  WITH CHECK (has_org_access(auth.uid(), organization_id));
CREATE POLICY "okr_chk_update" ON public.okr_checkins FOR UPDATE
  USING (auth.uid() = user_id OR is_admin(auth.uid()));
CREATE POLICY "okr_chk_delete" ON public.okr_checkins FOR DELETE
  USING (auth.uid() = user_id OR is_admin(auth.uid()));

-- ============ OKR SETTINGS (per org) ============
CREATE TABLE public.okr_settings (
  organization_id UUID PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  checkin_cadence TEXT NOT NULL DEFAULT 'weekly' CHECK (checkin_cadence IN ('weekly','biweekly','monthly')),
  checkin_day_of_week SMALLINT NOT NULL DEFAULT 1 CHECK (checkin_day_of_week BETWEEN 0 AND 6),
  reminder_enabled BOOLEAN NOT NULL DEFAULT true,
  cycle_reminder_days_before_end INT NOT NULL DEFAULT 7,
  low_confidence_threshold NUMERIC NOT NULL DEFAULT 0.4,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.okr_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "okr_settings_select" ON public.okr_settings FOR SELECT
  USING (has_org_access(auth.uid(), organization_id) OR is_admin(auth.uid()));
CREATE POLICY "okr_settings_upsert" ON public.okr_settings FOR INSERT
  WITH CHECK (has_org_access(auth.uid(), organization_id));
CREATE POLICY "okr_settings_update" ON public.okr_settings FOR UPDATE
  USING (has_org_access(auth.uid(), organization_id) OR is_admin(auth.uid()));

-- ============ TRIGGERS ============
-- updated_at
CREATE TRIGGER trg_okr_cycles_updated BEFORE UPDATE ON public.okr_cycles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_okr_obj_updated BEFORE UPDATE ON public.okr_objectives
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_okr_kr_updated BEFORE UPDATE ON public.okr_key_results
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_okr_settings_updated BEFORE UPDATE ON public.okr_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Recompute KR progress from latest check-in
CREATE OR REPLACE FUNCTION public.okr_apply_checkin()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _kr public.okr_key_results%ROWTYPE;
  _denom NUMERIC;
  _pct NUMERIC;
BEGIN
  SELECT * INTO _kr FROM public.okr_key_results WHERE id = NEW.key_result_id;
  IF NOT FOUND THEN RETURN NEW; END IF;

  _denom := NULLIF(_kr.target_value - _kr.start_value, 0);
  IF _denom IS NULL THEN
    _pct := CASE WHEN NEW.new_value >= _kr.target_value THEN 100 ELSE 0 END;
  ELSE
    _pct := GREATEST(0, LEAST(100, ((NEW.new_value - _kr.start_value) / _denom) * 100));
  END IF;

  NEW.previous_value := COALESCE(NEW.previous_value, _kr.current_value);
  NEW.progress_pct := _pct;

  UPDATE public.okr_key_results
  SET current_value = NEW.new_value,
      progress_pct = _pct,
      confidence = NEW.confidence,
      last_checkin_at = now()
  WHERE id = NEW.key_result_id;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_okr_apply_checkin
  BEFORE INSERT ON public.okr_checkins
  FOR EACH ROW EXECUTE FUNCTION public.okr_apply_checkin();

-- Roll up objective progress when a KR changes
CREATE OR REPLACE FUNCTION public.okr_recompute_objective()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _avg NUMERIC;
  _conf NUMERIC;
  _obj_id UUID := COALESCE(NEW.objective_id, OLD.objective_id);
BEGIN
  SELECT
    COALESCE(SUM(progress_pct * weight) / NULLIF(SUM(weight), 0), 0),
    COALESCE(SUM(confidence * weight) / NULLIF(SUM(weight), 0), 0.7)
  INTO _avg, _conf
  FROM public.okr_key_results
  WHERE objective_id = _obj_id;

  UPDATE public.okr_objectives
  SET progress_pct = _avg,
      confidence = _conf
  WHERE id = _obj_id;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_okr_kr_rollup
  AFTER INSERT OR UPDATE OR DELETE ON public.okr_key_results
  FOR EACH ROW EXECUTE FUNCTION public.okr_recompute_objective();

-- ============ MODULE TOGGLE ============
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'organization_module_toggles' AND column_name = 'okrs'
  ) THEN
    -- column exists, skip
    NULL;
  ELSE
    ALTER TABLE public.organization_module_toggles ADD COLUMN okrs BOOLEAN NOT NULL DEFAULT true;
  END IF;
END $$;
