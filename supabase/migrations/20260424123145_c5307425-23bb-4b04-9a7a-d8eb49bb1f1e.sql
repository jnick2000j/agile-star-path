-- 1. Add effective_from for scheduled overrides
ALTER TABLE public.organization_plan_overrides
  ADD COLUMN IF NOT EXISTS effective_from timestamptz;

-- 2. Update value resolution to honor effective_from
CREATE OR REPLACE FUNCTION public.get_org_feature_value(_org_id uuid, _feature_key text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _val jsonb;
BEGIN
  -- 1. Per-org override (active window)
  SELECT override_value INTO _val
  FROM organization_plan_overrides
  WHERE organization_id = _org_id
    AND feature_key = _feature_key
    AND (effective_from IS NULL OR effective_from <= now())
    AND (expires_at IS NULL OR expires_at > now())
  LIMIT 1;
  IF _val IS NOT NULL THEN RETURN _val; END IF;

  -- 2. Plan value
  SELECT pfv.value INTO _val
  FROM organization_subscriptions os
  JOIN plan_feature_values pfv ON pfv.plan_id = os.plan_id
  WHERE os.organization_id = _org_id
    AND os.status IN ('active','trialing')
    AND pfv.feature_key = _feature_key
  LIMIT 1;
  IF _val IS NOT NULL THEN RETURN _val; END IF;

  -- 3. Catalog default
  SELECT default_value INTO _val
  FROM plan_features
  WHERE feature_key = _feature_key
  LIMIT 1;
  RETURN COALESCE(_val, 'false'::jsonb);
END;
$function$;

-- 3. Audit log table for plan + feature override changes
CREATE TABLE IF NOT EXISTS public.org_override_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  change_kind text NOT NULL CHECK (change_kind IN ('feature_override', 'plan_assignment')),
  operation text NOT NULL CHECK (operation IN ('insert','update','delete')),
  feature_key text,
  before_value jsonb,
  after_value jsonb,
  actor_user_id uuid,
  actor_email text,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_override_audit_org ON public.org_override_audit_log(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_org_override_audit_kind ON public.org_override_audit_log(change_kind, created_at DESC);

ALTER TABLE public.org_override_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins read override audit"
  ON public.org_override_audit_log
  FOR SELECT
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Org admins read their override audit"
  ON public.org_override_audit_log
  FOR SELECT
  USING (public.has_org_access(auth.uid(), organization_id, 'admin'));

-- Inserts come from triggers (security definer); deny direct writes
CREATE POLICY "No direct writes to override audit"
  ON public.org_override_audit_log
  FOR INSERT
  WITH CHECK (false);

-- 4. Trigger function for feature overrides
CREATE OR REPLACE FUNCTION public.log_org_plan_override_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _actor uuid := auth.uid();
  _email text;
  _before jsonb;
  _after jsonb;
BEGIN
  IF _actor IS NOT NULL THEN
    SELECT email INTO _email FROM public.profiles WHERE user_id = _actor LIMIT 1;
  END IF;

  IF TG_OP = 'INSERT' THEN
    _after := jsonb_build_object(
      'feature_key', NEW.feature_key,
      'override_value', NEW.override_value,
      'reason', NEW.reason,
      'effective_from', NEW.effective_from,
      'expires_at', NEW.expires_at
    );
    INSERT INTO public.org_override_audit_log
      (organization_id, change_kind, operation, feature_key, before_value, after_value, actor_user_id, actor_email, reason)
    VALUES (NEW.organization_id, 'feature_override', 'insert', NEW.feature_key, NULL, _after, _actor, _email, NEW.reason);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    _before := jsonb_build_object(
      'feature_key', OLD.feature_key,
      'override_value', OLD.override_value,
      'reason', OLD.reason,
      'effective_from', OLD.effective_from,
      'expires_at', OLD.expires_at
    );
    _after := jsonb_build_object(
      'feature_key', NEW.feature_key,
      'override_value', NEW.override_value,
      'reason', NEW.reason,
      'effective_from', NEW.effective_from,
      'expires_at', NEW.expires_at
    );
    IF _before IS DISTINCT FROM _after THEN
      INSERT INTO public.org_override_audit_log
        (organization_id, change_kind, operation, feature_key, before_value, after_value, actor_user_id, actor_email, reason)
      VALUES (NEW.organization_id, 'feature_override', 'update', NEW.feature_key, _before, _after, _actor, _email, NEW.reason);
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    _before := jsonb_build_object(
      'feature_key', OLD.feature_key,
      'override_value', OLD.override_value,
      'reason', OLD.reason,
      'effective_from', OLD.effective_from,
      'expires_at', OLD.expires_at
    );
    INSERT INTO public.org_override_audit_log
      (organization_id, change_kind, operation, feature_key, before_value, after_value, actor_user_id, actor_email, reason)
    VALUES (OLD.organization_id, 'feature_override', 'delete', OLD.feature_key, _before, NULL, _actor, _email, OLD.reason);
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$function$;

DROP TRIGGER IF EXISTS trg_audit_org_plan_overrides ON public.organization_plan_overrides;
CREATE TRIGGER trg_audit_org_plan_overrides
AFTER INSERT OR UPDATE OR DELETE ON public.organization_plan_overrides
FOR EACH ROW EXECUTE FUNCTION public.log_org_plan_override_change();

-- 5. Trigger function for plan assignment changes
CREATE OR REPLACE FUNCTION public.log_org_subscription_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _actor uuid := auth.uid();
  _email text;
  _before jsonb;
  _after jsonb;
BEGIN
  IF _actor IS NOT NULL THEN
    SELECT email INTO _email FROM public.profiles WHERE user_id = _actor LIMIT 1;
  END IF;

  IF TG_OP = 'INSERT' THEN
    _after := jsonb_build_object(
      'plan_id', NEW.plan_id,
      'status', NEW.status,
      'trial_ends_at', NEW.trial_ends_at,
      'current_period_start', NEW.current_period_start,
      'current_period_end', NEW.current_period_end
    );
    INSERT INTO public.org_override_audit_log
      (organization_id, change_kind, operation, before_value, after_value, actor_user_id, actor_email)
    VALUES (NEW.organization_id, 'plan_assignment', 'insert', NULL, _after, _actor, _email);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Only log when something a human cares about changed
    IF NEW.plan_id IS DISTINCT FROM OLD.plan_id
       OR NEW.status IS DISTINCT FROM OLD.status
       OR NEW.trial_ends_at IS DISTINCT FROM OLD.trial_ends_at
       OR NEW.current_period_start IS DISTINCT FROM OLD.current_period_start
       OR NEW.current_period_end IS DISTINCT FROM OLD.current_period_end THEN
      _before := jsonb_build_object(
        'plan_id', OLD.plan_id,
        'status', OLD.status,
        'trial_ends_at', OLD.trial_ends_at,
        'current_period_start', OLD.current_period_start,
        'current_period_end', OLD.current_period_end
      );
      _after := jsonb_build_object(
        'plan_id', NEW.plan_id,
        'status', NEW.status,
        'trial_ends_at', NEW.trial_ends_at,
        'current_period_start', NEW.current_period_start,
        'current_period_end', NEW.current_period_end
      );
      INSERT INTO public.org_override_audit_log
        (organization_id, change_kind, operation, before_value, after_value, actor_user_id, actor_email)
      VALUES (NEW.organization_id, 'plan_assignment', 'update', _before, _after, _actor, _email);
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    _before := jsonb_build_object(
      'plan_id', OLD.plan_id,
      'status', OLD.status,
      'trial_ends_at', OLD.trial_ends_at,
      'current_period_start', OLD.current_period_start,
      'current_period_end', OLD.current_period_end
    );
    INSERT INTO public.org_override_audit_log
      (organization_id, change_kind, operation, before_value, after_value, actor_user_id, actor_email)
    VALUES (OLD.organization_id, 'plan_assignment', 'delete', _before, NULL, _actor, _email);
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$function$;

DROP TRIGGER IF EXISTS trg_audit_org_subscriptions ON public.organization_subscriptions;
CREATE TRIGGER trg_audit_org_subscriptions
AFTER INSERT OR UPDATE OR DELETE ON public.organization_subscriptions
FOR EACH ROW EXECUTE FUNCTION public.log_org_subscription_change();