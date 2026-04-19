-- Add reference_number to product_features and link to org for prefix generation
ALTER TABLE public.product_features
  ADD COLUMN IF NOT EXISTS reference_number TEXT,
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL;

-- Update generate_reference_number to include explicit 'feature' prefix 'FEA'
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

-- Trigger to set reference number on insert for product_features
DROP TRIGGER IF EXISTS trg_product_features_set_ref ON public.product_features;
CREATE TRIGGER trg_product_features_set_ref
  BEFORE INSERT ON public.product_features
  FOR EACH ROW
  EXECUTE FUNCTION public.set_reference_number('feature');

-- Backfill organization_id for existing features from their parent product
UPDATE public.product_features pf
   SET organization_id = p.organization_id
  FROM public.products p
 WHERE pf.product_id = p.id
   AND pf.organization_id IS NULL;

-- Backfill reference_number for existing features (one at a time so sequence increments)
DO $$
DECLARE
  _f RECORD;
  _ref TEXT;
BEGIN
  FOR _f IN SELECT id, organization_id FROM public.product_features WHERE reference_number IS NULL AND organization_id IS NOT NULL LOOP
    _ref := public.generate_reference_number(_f.organization_id, 'feature');
    UPDATE public.product_features SET reference_number = _ref WHERE id = _f.id;
  END LOOP;
END $$;