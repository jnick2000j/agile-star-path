DO $$ BEGIN
  CREATE TYPE public.email_transport AS ENUM ('lovable', 'smtp', 'resend');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.email_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL UNIQUE,
  active_transport public.email_transport NOT NULL DEFAULT 'lovable',
  from_address TEXT,
  from_name TEXT,
  last_test_status TEXT,
  last_test_at TIMESTAMPTZ,
  last_test_error TEXT,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.email_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view their org email settings"
ON public.email_settings FOR SELECT TO authenticated
USING (public.is_org_admin(auth.uid(), organization_id));

CREATE POLICY "Admins can insert their org email settings"
ON public.email_settings FOR INSERT TO authenticated
WITH CHECK (public.is_org_admin(auth.uid(), organization_id));

CREATE POLICY "Admins can update their org email settings"
ON public.email_settings FOR UPDATE TO authenticated
USING (public.is_org_admin(auth.uid(), organization_id))
WITH CHECK (public.is_org_admin(auth.uid(), organization_id));

CREATE TRIGGER email_settings_set_updated_at
BEFORE UPDATE ON public.email_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();