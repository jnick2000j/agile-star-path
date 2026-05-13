CREATE OR REPLACE FUNCTION public.apply_sso_default_roles_on_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _email text;
  _domain text;
  _role_ids uuid[];
  _role_id uuid;
BEGIN
  SELECT email INTO _email FROM auth.users WHERE id = NEW.user_id;
  IF _email IS NULL THEN RETURN NEW; END IF;
  _domain := lower(split_part(_email, '@', 2));

  SELECT default_custom_role_ids INTO _role_ids
    FROM public.sso_configurations
   WHERE organization_id = NEW.organization_id
     AND status = 'active'
     AND _domain = ANY(SELECT lower(unnest(allowed_domains)))
   LIMIT 1;

  IF _role_ids IS NULL OR array_length(_role_ids, 1) IS NULL THEN
    RETURN NEW;
  END IF;

  FOREACH _role_id IN ARRAY _role_ids LOOP
    INSERT INTO public.user_organization_custom_roles (user_id, organization_id, custom_role_id)
    VALUES (NEW.user_id, NEW.organization_id, _role_id)
    ON CONFLICT DO NOTHING;
  END LOOP;

  RETURN NEW;
EXCEPTION WHEN others THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_apply_sso_default_roles ON public.user_organization_access;
CREATE TRIGGER trg_apply_sso_default_roles
AFTER INSERT ON public.user_organization_access
FOR EACH ROW
EXECUTE FUNCTION public.apply_sso_default_roles_on_access();