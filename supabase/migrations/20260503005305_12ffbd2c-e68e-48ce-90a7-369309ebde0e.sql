CREATE TABLE IF NOT EXISTS public.lms_certificate_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
  template text NOT NULL DEFAULT 'classic',
  accent_color text NOT NULL DEFAULT '#1E40AF',
  background_color text NOT NULL DEFAULT '#FFFFFF',
  logo_url text,
  signature_image_url text,
  signatory_name text,
  signatory_title text,
  footer_text text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lms_cert_template_check CHECK (template IN ('classic','modern','minimal'))
);

ALTER TABLE public.lms_certificate_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view org certificate settings"
ON public.lms_certificate_settings FOR SELECT TO authenticated
USING (has_org_access(auth.uid(), organization_id, 'viewer'::text));

CREATE POLICY "Authors insert org certificate settings"
ON public.lms_certificate_settings FOR INSERT TO authenticated
WITH CHECK (lms_user_can(auth.uid(), organization_id, 'lms_authoring'::text, 'edit'::text));

CREATE POLICY "Authors update org certificate settings"
ON public.lms_certificate_settings FOR UPDATE TO authenticated
USING (lms_user_can(auth.uid(), organization_id, 'lms_authoring'::text, 'edit'::text))
WITH CHECK (lms_user_can(auth.uid(), organization_id, 'lms_authoring'::text, 'edit'::text));

CREATE TRIGGER update_lms_certificate_settings_updated_at
  BEFORE UPDATE ON public.lms_certificate_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();