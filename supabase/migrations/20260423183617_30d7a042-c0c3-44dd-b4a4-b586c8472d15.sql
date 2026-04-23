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
    WHEN 'feature'      THEN 'FEA'
    WHEN 'business_requirement'  THEN 'BR'
    WHEN 'technical_requirement' THEN 'TR'
    WHEN 'change_request'        THEN 'CR'
    WHEN 'exception'             THEN 'EXC'
    WHEN 'timesheet'             THEN 'TS'
    WHEN 'helpdesk_ticket'       THEN 'HD'
    WHEN 'cm_request'            THEN 'CM'
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