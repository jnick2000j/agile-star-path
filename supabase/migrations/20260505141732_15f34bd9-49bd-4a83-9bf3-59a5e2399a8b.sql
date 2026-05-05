CREATE OR REPLACE FUNCTION public.delete_organization_cascade(_org_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  r record;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'only platform admins can delete an organization';
  END IF;

  -- Clear default org reference on profiles (FK is NO ACTION)
  UPDATE public.profiles
    SET default_organization_id = NULL
    WHERE default_organization_id = _org_id;

  -- Remove billing accounts (RESTRICT FK)
  DELETE FROM public.billing_accounts WHERE owner_organization_id = _org_id;

  -- Dynamically delete from every public table that has an organization_id column
  FOR r IN
    SELECT c.table_name
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_schema = c.table_schema AND t.table_name = c.table_name
    WHERE c.table_schema = 'public'
      AND c.column_name = 'organization_id'
      AND t.table_type = 'BASE TABLE'
      AND c.table_name <> 'organizations'
  LOOP
    EXECUTE format('DELETE FROM public.%I WHERE organization_id = $1', r.table_name)
      USING _org_id;
  END LOOP;

  -- Finally remove the organization
  DELETE FROM public.organizations WHERE id = _org_id;
END;
$function$;