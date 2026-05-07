
CREATE OR REPLACE FUNCTION public._audit_redact(_data jsonb)
RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
  SELECT COALESCE(_data, '{}'::jsonb)
    - 'password' - 'password_hash' - 'token' - 'access_token' - 'refresh_token'
    - 'api_key' - 'secret' - 'client_secret' - 'private_key' - 'encryption_key'
    - 'scim_token' - 'webhook_secret' - 'value';
$$;

CREATE OR REPLACE FUNCTION public._audit_diff(_old jsonb, _new jsonb)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE _key text; _changes jsonb := '{}'::jsonb;
BEGIN
  IF _old IS NULL OR _new IS NULL THEN RETURN '{}'::jsonb; END IF;
  FOR _key IN SELECT jsonb_object_keys(_new) LOOP
    IF _key = 'updated_at' THEN CONTINUE; END IF;
    IF (_old->_key) IS DISTINCT FROM (_new->_key) THEN
      _changes := _changes || jsonb_build_object(_key, jsonb_build_object('from', _old->_key, 'to', _new->_key));
    END IF;
  END LOOP;
  RETURN _changes;
END; $$;

CREATE OR REPLACE FUNCTION public.audit_platform_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _category text := COALESCE(TG_ARGV[0], 'platform');
  _entity   text := TG_TABLE_NAME;
  _action   text := lower(TG_OP);
  _row_id   uuid;
  _org_id   uuid;
  _old_j    jsonb;
  _new_j    jsonb;
  _meta     jsonb;
  _changes  jsonb;
BEGIN
  IF TG_OP = 'DELETE' THEN
    _old_j := public._audit_redact(to_jsonb(OLD));
  ELSIF TG_OP = 'INSERT' THEN
    _new_j := public._audit_redact(to_jsonb(NEW));
  ELSE
    _old_j := public._audit_redact(to_jsonb(OLD));
    _new_j := public._audit_redact(to_jsonb(NEW));
    _changes := public._audit_diff(_old_j, _new_j);
    IF _changes = '{}'::jsonb THEN RETURN NEW; END IF;
  END IF;

  BEGIN
    _row_id := ((CASE WHEN TG_OP='DELETE' THEN _old_j ELSE _new_j END)->>'id')::uuid;
  EXCEPTION WHEN others THEN _row_id := NULL; END;

  BEGIN
    _org_id := ((CASE WHEN TG_OP='DELETE' THEN _old_j ELSE _new_j END)->>'organization_id')::uuid;
  EXCEPTION WHEN others THEN _org_id := NULL; END;

  IF _entity = 'organizations' AND _org_id IS NULL THEN _org_id := _row_id; END IF;

  _meta := jsonb_build_object('table', _entity, 'op', TG_OP, 'row_id', _row_id);
  IF _changes IS NOT NULL THEN
    _meta := _meta || jsonb_build_object('changes', _changes);
  ELSIF TG_OP = 'INSERT' THEN
    _meta := _meta || jsonb_build_object('new', _new_j);
  ELSIF TG_OP = 'DELETE' THEN
    _meta := _meta || jsonb_build_object('old', _old_j);
  END IF;

  PERFORM public.log_audit_event(
    _entity || '.' || _action, _category, _org_id, NULL, _entity, _row_id, 'success', _meta
  );

  RETURN COALESCE(NEW, OLD);
EXCEPTION WHEN others THEN
  RETURN COALESCE(NEW, OLD);
END; $$;

CREATE OR REPLACE FUNCTION public._attach_platform_audit(_table text, _category text DEFAULT 'platform')
RETURNS void LANGUAGE plpgsql AS $$
DECLARE _trg text := 'trg_audit_platform_' || _table;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=_table) THEN
    RETURN;
  END IF;
  EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', _trg, _table);
  EXECUTE format(
    'CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.audit_platform_change(%L)',
    _trg, _table, _category
  );
END; $$;

DO $$
DECLARE
  _t text;
  _platform text[] := ARRAY[
    'organizations',
    'subscription_plans','plan_features','plan_feature_values','plan_price_sync_history',
    'organization_subscriptions','organization_plan_overrides',
    'organization_licenses','license_assignments','software_licenses',
    'platform_settings','ai_provider_settings','branding_settings',
    'industry_verticals','vertical_entities',
    'organization_module_toggles','permission_modules','role_module_permissions',
    'audit_log_retention_policies'
  ];
  _security text[] := ARRAY[
    'sso_configurations','user_roles','custom_roles','scim_tokens','scim_group_mappings'
  ];
BEGIN
  FOREACH _t IN ARRAY _platform LOOP
    PERFORM public._attach_platform_audit(_t, 'platform');
  END LOOP;
  FOREACH _t IN ARRAY _security LOOP
    PERFORM public._attach_platform_audit(_t, 'security');
  END LOOP;
END$$;
