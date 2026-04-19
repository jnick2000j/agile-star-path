
-- 1. Compliance rule config table
CREATE TABLE IF NOT EXISTS public.compliance_rule_configs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
  weight_controls INTEGER NOT NULL DEFAULT 40,
  weight_cadence INTEGER NOT NULL DEFAULT 30,
  weight_hygiene INTEGER NOT NULL DEFAULT 30,
  threshold_pass INTEGER NOT NULL DEFAULT 80,
  threshold_warn INTEGER NOT NULL DEFAULT 60,
  -- per-check toggles
  check_has_risks BOOLEAN NOT NULL DEFAULT true,
  check_has_issues BOOLEAN NOT NULL DEFAULT true,
  check_has_milestones BOOLEAN NOT NULL DEFAULT true,
  check_has_benefits BOOLEAN NOT NULL DEFAULT true,
  check_has_stakeholders BOOLEAN NOT NULL DEFAULT true,
  check_recent_updates BOOLEAN NOT NULL DEFAULT true,
  check_orphan_risks BOOLEAN NOT NULL DEFAULT true,
  check_stale_risks BOOLEAN NOT NULL DEFAULT true,
  check_orphan_issues BOOLEAN NOT NULL DEFAULT true,
  check_stale_issues BOOLEAN NOT NULL DEFAULT true,
  cadence_window_days INTEGER NOT NULL DEFAULT 14,
  stale_window_days INTEGER NOT NULL DEFAULT 30,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.compliance_rule_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members view rule config"
ON public.compliance_rule_configs FOR SELECT
USING (has_org_access(auth.uid(), organization_id, 'viewer') OR is_admin(auth.uid()));

CREATE POLICY "Org admins manage rule config"
ON public.compliance_rule_configs FOR ALL
USING (has_org_access(auth.uid(), organization_id, 'admin') OR is_admin(auth.uid()))
WITH CHECK (has_org_access(auth.uid(), organization_id, 'admin') OR is_admin(auth.uid()));

CREATE TRIGGER trg_compliance_rule_configs_updated_at
BEFORE UPDATE ON public.compliance_rule_configs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Validation trigger: weights must sum to 100
CREATE OR REPLACE FUNCTION public.validate_compliance_weights()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF (NEW.weight_controls + NEW.weight_cadence + NEW.weight_hygiene) <> 100 THEN
    RAISE EXCEPTION 'Pillar weights must sum to 100 (got %)', (NEW.weight_controls + NEW.weight_cadence + NEW.weight_hygiene);
  END IF;
  IF NEW.threshold_pass <= NEW.threshold_warn THEN
    RAISE EXCEPTION 'Pass threshold must be greater than warn threshold';
  END IF;
  RETURN NEW;
END;
$$ SET search_path = public;

CREATE TRIGGER trg_validate_compliance_weights
BEFORE INSERT OR UPDATE ON public.compliance_rule_configs
FOR EACH ROW EXECUTE FUNCTION public.validate_compliance_weights();

-- 2. Updated compute function honoring config
CREATE OR REPLACE FUNCTION public.compute_compliance_score(_scope_type text, _scope_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _controls_score INTEGER := 0;
  _cadence_score INTEGER := 0;
  _hygiene_score INTEGER := 0;
  _composite INTEGER := 0;
  _checks JSONB := '[]'::jsonb;
  _has_risks BOOLEAN; _has_issues BOOLEAN; _has_milestones BOOLEAN;
  _has_benefits BOOLEAN; _has_stakeholders BOOLEAN;
  _recent_updates INTEGER;
  _stale_risks INTEGER; _orphan_risks INTEGER;
  _stale_issues INTEGER; _orphan_issues INTEGER;
  _filter_col TEXT;
  _org_id UUID;
  _cfg public.compliance_rule_configs;
  _controls_total INTEGER := 0; _controls_max INTEGER := 0;
  _hygiene_total INTEGER := 0; _hygiene_max INTEGER := 0;
BEGIN
  IF _scope_type = 'programme' THEN
    _filter_col := 'programme_id';
    SELECT organization_id INTO _org_id FROM programmes WHERE id = _scope_id;
  ELSIF _scope_type = 'project' THEN
    _filter_col := 'project_id';
    SELECT organization_id INTO _org_id FROM projects WHERE id = _scope_id;
  ELSIF _scope_type = 'product' THEN
    _filter_col := 'product_id';
    SELECT organization_id INTO _org_id FROM products WHERE id = _scope_id;
  ELSE
    RETURN jsonb_build_object('error', 'unsupported scope');
  END IF;

  -- Load org config or build defaults
  SELECT * INTO _cfg FROM compliance_rule_configs WHERE organization_id = _org_id;
  IF NOT FOUND THEN
    _cfg.weight_controls := 40; _cfg.weight_cadence := 30; _cfg.weight_hygiene := 30;
    _cfg.threshold_pass := 80; _cfg.threshold_warn := 60;
    _cfg.check_has_risks := true; _cfg.check_has_issues := true;
    _cfg.check_has_milestones := true; _cfg.check_has_benefits := true;
    _cfg.check_has_stakeholders := true; _cfg.check_recent_updates := true;
    _cfg.check_orphan_risks := true; _cfg.check_stale_risks := true;
    _cfg.check_orphan_issues := true; _cfg.check_stale_issues := true;
    _cfg.cadence_window_days := 14; _cfg.stale_window_days := 30;
  END IF;

  -- CONTROLS pillar
  IF _cfg.check_has_risks THEN
    EXECUTE format('SELECT EXISTS(SELECT 1 FROM risks WHERE %I = $1)', _filter_col) USING _scope_id INTO _has_risks;
    _controls_max := _controls_max + 20;
    IF _has_risks THEN _controls_total := _controls_total + 20; END IF;
    _checks := _checks || jsonb_build_object('key','has_risks','pillar','controls','label','Risk register populated','passed',_has_risks,'weight',20,'recommendation',CASE WHEN _has_risks THEN NULL ELSE 'Add at least one risk to the register.' END);
  END IF;
  IF _cfg.check_has_issues THEN
    EXECUTE format('SELECT EXISTS(SELECT 1 FROM issues WHERE %I = $1)', _filter_col) USING _scope_id INTO _has_issues;
    _controls_max := _controls_max + 20;
    IF _has_issues THEN _controls_total := _controls_total + 20; END IF;
    _checks := _checks || jsonb_build_object('key','has_issues','pillar','controls','label','Issue register populated','passed',_has_issues,'weight',20,'recommendation',CASE WHEN _has_issues THEN NULL ELSE 'Log any open issues.' END);
  END IF;
  IF _cfg.check_has_milestones THEN
    EXECUTE format('SELECT EXISTS(SELECT 1 FROM milestones WHERE %I = $1)', _filter_col) USING _scope_id INTO _has_milestones;
    _controls_max := _controls_max + 20;
    IF _has_milestones THEN _controls_total := _controls_total + 20; END IF;
    _checks := _checks || jsonb_build_object('key','has_milestones','pillar','controls','label','Milestones defined','passed',_has_milestones,'weight',20,'recommendation',CASE WHEN _has_milestones THEN NULL ELSE 'Define key milestones with target dates.' END);
  END IF;
  IF _cfg.check_has_benefits THEN
    EXECUTE format('SELECT EXISTS(SELECT 1 FROM benefits WHERE %I = $1)', _filter_col) USING _scope_id INTO _has_benefits;
    _controls_max := _controls_max + 20;
    IF _has_benefits THEN _controls_total := _controls_total + 20; END IF;
    _checks := _checks || jsonb_build_object('key','has_benefits','pillar','controls','label','Benefits identified','passed',_has_benefits,'weight',20,'recommendation',CASE WHEN _has_benefits THEN NULL ELSE 'Capture target benefits with owners.' END);
  END IF;
  IF _cfg.check_has_stakeholders THEN
    BEGIN
      EXECUTE format('SELECT EXISTS(SELECT 1 FROM stakeholders WHERE %I = $1)', _filter_col) USING _scope_id INTO _has_stakeholders;
    EXCEPTION WHEN undefined_column THEN _has_stakeholders := FALSE;
    END;
    _controls_max := _controls_max + 20;
    IF _has_stakeholders THEN _controls_total := _controls_total + 20; END IF;
    _checks := _checks || jsonb_build_object('key','has_stakeholders','pillar','controls','label','Stakeholders mapped','passed',_has_stakeholders,'weight',20,'recommendation',CASE WHEN _has_stakeholders THEN NULL ELSE 'Map key stakeholders.' END);
  END IF;

  IF _controls_max > 0 THEN
    _controls_score := ROUND(_controls_total::NUMERIC / _controls_max * 100);
  ELSE
    _controls_score := 100;
  END IF;

  -- CADENCE pillar
  IF _cfg.check_recent_updates THEN
    SELECT COUNT(*) INTO _recent_updates
    FROM entity_updates
    WHERE entity_type = _scope_type AND entity_id = _scope_id
      AND created_at > now() - (_cfg.cadence_window_days || ' days')::INTERVAL;
    _cadence_score := LEAST(100, _recent_updates * 50);
    _checks := _checks || jsonb_build_object(
      'key','recent_updates','pillar','cadence',
      'label', format('At least 2 updates in last %s days', _cfg.cadence_window_days),
      'passed', _recent_updates >= 2,
      'value', _recent_updates,
      'recommendation', CASE WHEN _recent_updates >= 2 THEN NULL ELSE 'Post a status update — cadence affects stakeholder confidence.' END
    );
  ELSE
    _cadence_score := 100;
  END IF;

  -- HYGIENE pillar
  IF _cfg.check_orphan_risks THEN
    EXECUTE format('SELECT COUNT(*) FROM risks WHERE %I = $1 AND owner_id IS NULL AND status NOT IN (''closed'')', _filter_col)
      USING _scope_id INTO _orphan_risks;
    _hygiene_max := _hygiene_max + 25;
    IF _orphan_risks = 0 THEN _hygiene_total := _hygiene_total + 25; END IF;
    _checks := _checks || jsonb_build_object('key','orphan_risks','pillar','hygiene','label','All open risks have an owner','passed',_orphan_risks=0,'value',_orphan_risks,'recommendation',CASE WHEN _orphan_risks=0 THEN NULL ELSE format('%s open risk(s) have no owner — assign accountability.', _orphan_risks) END);
  END IF;
  IF _cfg.check_stale_risks THEN
    EXECUTE format('SELECT COUNT(*) FROM risks WHERE %I = $1 AND status NOT IN (''closed'') AND updated_at < now() - ($2 || '' days'')::INTERVAL', _filter_col)
      USING _scope_id, _cfg.stale_window_days INTO _stale_risks;
    _hygiene_max := _hygiene_max + 25;
    IF _stale_risks = 0 THEN _hygiene_total := _hygiene_total + 25; END IF;
    _checks := _checks || jsonb_build_object('key','stale_risks','pillar','hygiene','label',format('No risks stale > %s days', _cfg.stale_window_days),'passed',_stale_risks=0,'value',_stale_risks,'recommendation',CASE WHEN _stale_risks=0 THEN NULL ELSE format('%s risk(s) not reviewed recently.', _stale_risks) END);
  END IF;
  IF _cfg.check_orphan_issues THEN
    EXECUTE format('SELECT COUNT(*) FROM issues WHERE %I = $1 AND owner_id IS NULL AND status NOT IN (''resolved'',''closed'')', _filter_col)
      USING _scope_id INTO _orphan_issues;
    _hygiene_max := _hygiene_max + 25;
    IF _orphan_issues = 0 THEN _hygiene_total := _hygiene_total + 25; END IF;
    _checks := _checks || jsonb_build_object('key','orphan_issues','pillar','hygiene','label','All open issues have an owner','passed',_orphan_issues=0,'value',_orphan_issues,'recommendation',CASE WHEN _orphan_issues=0 THEN NULL ELSE format('%s open issue(s) lack an owner.', _orphan_issues) END);
  END IF;
  IF _cfg.check_stale_issues THEN
    EXECUTE format('SELECT COUNT(*) FROM issues WHERE %I = $1 AND status NOT IN (''resolved'',''closed'') AND updated_at < now() - ($2 || '' days'')::INTERVAL', _filter_col)
      USING _scope_id, _cfg.stale_window_days INTO _stale_issues;
    _hygiene_max := _hygiene_max + 25;
    IF _stale_issues = 0 THEN _hygiene_total := _hygiene_total + 25; END IF;
    _checks := _checks || jsonb_build_object('key','stale_issues','pillar','hygiene','label',format('No issues stale > %s days', _cfg.stale_window_days),'passed',_stale_issues=0,'value',_stale_issues,'recommendation',CASE WHEN _stale_issues=0 THEN NULL ELSE format('%s issue(s) not updated recently.', _stale_issues) END);
  END IF;

  IF _hygiene_max > 0 THEN
    _hygiene_score := ROUND(_hygiene_total::NUMERIC / _hygiene_max * 100);
  ELSE
    _hygiene_score := 100;
  END IF;

  _composite := ROUND(
    (_controls_score * _cfg.weight_controls + _cadence_score * _cfg.weight_cadence + _hygiene_score * _cfg.weight_hygiene)::NUMERIC / 100
  );

  RETURN jsonb_build_object(
    'score', _composite,
    'controls_score', _controls_score,
    'cadence_score', _cadence_score,
    'hygiene_score', _hygiene_score,
    'details', jsonb_build_object(
      'checks', _checks,
      'weights', jsonb_build_object('controls', _cfg.weight_controls, 'cadence', _cfg.weight_cadence, 'hygiene', _cfg.weight_hygiene),
      'thresholds', jsonb_build_object('pass', _cfg.threshold_pass, 'warn', _cfg.threshold_warn),
      'cadence_window_days', _cfg.cadence_window_days,
      'stale_window_days', _cfg.stale_window_days
    )
  );
END;
$function$;
