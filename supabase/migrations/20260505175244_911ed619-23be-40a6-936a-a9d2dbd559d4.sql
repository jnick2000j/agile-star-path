-- 1. Rename addon plans
UPDATE public.subscription_plans
SET name = 'Helpdesk + Learning Add-on',
    description = 'Helpdesk + Learning Management. Tickets, SLAs, customer portal AND built-in courses, quizzes and certifications. Includes 5 GB of LMS video storage; extra at $0.25/GB/month.',
    updated_at = now()
WHERE id = 'aaaaaaaa-1003-4000-8000-000000000001';

UPDATE public.subscription_plans
SET name = 'ITSM + Learning Suite Add-on',
    description = 'Helpdesk + Change Management + Learning. Save ~20% vs buying separately. Includes 5 GB of LMS video storage; extra at $0.25/GB/month.',
    updated_at = now()
WHERE id = 'aaaaaaaa-1003-4000-8000-000000000003';

UPDATE public.subscription_plans
SET is_active = false, is_archived = true, is_public = false, updated_at = now()
WHERE id = 'aaaaaaaa-1003-4000-8000-000000000004';

-- 2. lms_storage_usage
CREATE TABLE IF NOT EXISTS public.lms_storage_usage (
  organization_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  bytes_used bigint NOT NULL DEFAULT 0,
  files_count integer NOT NULL DEFAULT 0,
  included_gb integer NOT NULL DEFAULT 5,
  last_recomputed_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.lms_storage_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view their LMS storage usage"
ON public.lms_storage_usage FOR SELECT
USING (public.has_org_access(auth.uid(), organization_id));

CREATE POLICY "Service role manages LMS storage usage"
ON public.lms_storage_usage FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- 3. lms_storage_overage
CREATE TABLE IF NOT EXISTS public.lms_storage_overage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  period_end date NOT NULL,
  bytes_used bigint NOT NULL DEFAULT 0,
  overage_gb numeric(12,4) NOT NULL DEFAULT 0,
  unit_price_cents integer NOT NULL DEFAULT 25,
  amount_cents integer NOT NULL DEFAULT 0,
  stripe_invoice_item_id text,
  reported_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, period_start)
);

CREATE INDEX IF NOT EXISTS idx_lms_storage_overage_org ON public.lms_storage_overage(organization_id, period_start DESC);

ALTER TABLE public.lms_storage_overage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view LMS overage"
ON public.lms_storage_overage FOR SELECT
USING (public.has_org_access(auth.uid(), organization_id));

CREATE POLICY "Service role manages LMS overage"
ON public.lms_storage_overage FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- 4. Recompute function
CREATE OR REPLACE FUNCTION public.recompute_lms_storage(_org_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bytes bigint := 0;
  v_files integer := 0;
BEGIN
  SELECT COALESCE(SUM((metadata->>'size')::bigint), 0), COUNT(*)
    INTO v_bytes, v_files
  FROM storage.objects
  WHERE bucket_id IN ('lms-content', 'lms-external-training')
    AND (storage.foldername(name))[1] = _org_id::text;

  INSERT INTO public.lms_storage_usage (organization_id, bytes_used, files_count, last_recomputed_at, updated_at)
  VALUES (_org_id, v_bytes, v_files, now(), now())
  ON CONFLICT (organization_id) DO UPDATE
    SET bytes_used = EXCLUDED.bytes_used,
        files_count = EXCLUDED.files_count,
        last_recomputed_at = now(),
        updated_at = now();
END;
$$;

-- 5. Trigger function (gate inside the function instead of WHEN clause)
CREATE OR REPLACE FUNCTION public.lms_storage_objects_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row record;
  v_org_text text;
  v_org uuid;
BEGIN
  IF (TG_OP = 'DELETE') THEN
    v_row := OLD;
  ELSE
    v_row := NEW;
  END IF;

  IF v_row.bucket_id NOT IN ('lms-content', 'lms-external-training') THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  v_org_text := (storage.foldername(v_row.name))[1];
  IF v_org_text IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  BEGIN
    v_org := v_org_text::uuid;
  EXCEPTION WHEN OTHERS THEN
    RETURN COALESCE(NEW, OLD);
  END;

  PERFORM public.recompute_lms_storage(v_org);
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS lms_storage_objects_change ON storage.objects;
CREATE TRIGGER lms_storage_objects_change
AFTER INSERT OR UPDATE OR DELETE ON storage.objects
FOR EACH ROW
EXECUTE FUNCTION public.lms_storage_objects_trigger();

-- 6. Helper for current overage in GB
CREATE OR REPLACE FUNCTION public.lms_storage_overage_gb(_org_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT GREATEST(
    0,
    ROUND( (COALESCE(u.bytes_used, 0)::numeric / (1024.0 * 1024.0 * 1024.0)) - COALESCE(u.included_gb, 5), 4)
  )
  FROM public.lms_storage_usage u
  WHERE u.organization_id = _org_id;
$$;

REVOKE ALL ON FUNCTION public.recompute_lms_storage(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.lms_storage_objects_trigger() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lms_storage_overage_gb(uuid) TO authenticated;