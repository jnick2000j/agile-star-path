CREATE TABLE public.platform_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value TEXT,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read platform settings"
ON public.platform_settings
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Platform admins can insert platform settings"
ON public.platform_settings
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Platform admins can update platform settings"
ON public.platform_settings
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Platform admins can delete platform settings"
ON public.platform_settings
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_platform_settings_updated_at
BEFORE UPDATE ON public.platform_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.platform_settings (key, value, description)
VALUES (
  'site_url',
  'https://thetaskmaster.lovable.app',
  'Public production URL used for authentication emails (sign up, login, password reset). Override this for on-premises deployments.'
);

-- Public RPC so unauthenticated auth flows (sign-in/sign-up screen) can resolve the configured site URL.
CREATE OR REPLACE FUNCTION public.get_site_url()
RETURNS TEXT
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT value FROM public.platform_settings WHERE key = 'site_url' LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_site_url() TO anon, authenticated;