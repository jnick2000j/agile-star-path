-- Helper: count only billable (staff) members with active org access
CREATE OR REPLACE FUNCTION public.count_billable_users(_org_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::int
  FROM public.user_organization_access uoa
  JOIN public.profiles p ON p.user_id = uoa.user_id
  WHERE uoa.organization_id = _org_id
    AND COALESCE(uoa.is_disabled, false) = false
    AND COALESCE(p.user_type, 'staff') = 'staff';
$$;

-- Replace the resource-limit function so 'users' uses billable count
CREATE OR REPLACE FUNCTION public.check_org_resource_limit(
  _org_id uuid,
  _resource_type text
) RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  _plan record;
  _max_allowed int;
  _current_count int;
  _license record;
BEGIN
  -- 1. License path (on-prem / PO-billed customers)
  SELECT ol.* INTO _license
    FROM public.organization_licenses ol
   WHERE ol.organization_id = _org_id
     AND ol.status = 'active'
     AND (ol.valid_until IS NULL OR ol.valid_until >= CURRENT_DATE)
   ORDER BY ol.valid_from DESC
   LIMIT 1;

  IF _license.id IS NOT NULL THEN
    CASE _resource_type
      WHEN 'users' THEN _max_allowed := COALESCE(_license.seats, -1);
      ELSE _max_allowed := NULL;
    END CASE;

    IF _max_allowed IS NULL AND _license.plan_id IS NOT NULL THEN
      SELECT sp.* INTO _plan FROM public.subscription_plans sp WHERE sp.id = _license.plan_id;
    END IF;
  END IF;

  -- 2. Subscription path (Stripe customers)
  IF _max_allowed IS NULL THEN
    IF _plan.id IS NULL THEN
      SELECT sp.* INTO _plan
        FROM public.organization_subscriptions os
        JOIN public.subscription_plans sp ON sp.id = os.plan_id
       WHERE os.organization_id = _org_id
         AND os.status IN ('active', 'trialing');
    END IF;

    IF _plan IS NULL THEN
      RETURN FALSE;
    END IF;

    CASE _resource_type
      WHEN 'users'      THEN _max_allowed := _plan.max_users;
      WHEN 'programmes' THEN _max_allowed := _plan.max_programmes;
      WHEN 'projects'   THEN _max_allowed := _plan.max_projects;
      WHEN 'products'   THEN _max_allowed := _plan.max_products;
      ELSE RETURN TRUE;
    END CASE;
  END IF;

  IF _max_allowed = -1 THEN RETURN TRUE; END IF;

  CASE _resource_type
    WHEN 'users' THEN
      _current_count := public.count_billable_users(_org_id);
    WHEN 'programmes' THEN
      SELECT COUNT(*) INTO _current_count FROM public.programmes WHERE organization_id = _org_id;
    WHEN 'projects' THEN
      SELECT COUNT(*) INTO _current_count FROM public.projects WHERE organization_id = _org_id;
    WHEN 'products' THEN
      SELECT COUNT(*) INTO _current_count FROM public.products WHERE organization_id = _org_id;
    ELSE RETURN TRUE;
  END CASE;

  RETURN _current_count < _max_allowed;
END;
$function$;