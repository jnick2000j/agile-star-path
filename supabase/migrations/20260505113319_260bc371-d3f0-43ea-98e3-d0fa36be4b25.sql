-- Email trigger toggles per organization
CREATE TABLE IF NOT EXISTS public.email_trigger_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  trigger_key text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, trigger_key)
);

ALTER TABLE public.email_trigger_settings ENABLE ROW LEVEL SECURITY;

-- Admins of the org can view/manage; service role bypasses RLS.
CREATE POLICY "Org admins can view email trigger settings"
ON public.email_trigger_settings FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Org admins can insert email trigger settings"
ON public.email_trigger_settings FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Org admins can update email trigger settings"
ON public.email_trigger_settings FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Org admins can delete email trigger settings"
ON public.email_trigger_settings FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_email_trigger_settings_updated_at
BEFORE UPDATE ON public.email_trigger_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Server-side gate. Returns true (default-on) when no row exists.
CREATE OR REPLACE FUNCTION public.is_email_trigger_enabled(
  _organization_id uuid,
  _trigger_key text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT enabled FROM public.email_trigger_settings
      WHERE organization_id = _organization_id
        AND trigger_key = _trigger_key
      LIMIT 1),
    true
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_email_trigger_enabled(uuid, text) TO authenticated, service_role;