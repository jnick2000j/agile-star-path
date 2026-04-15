
-- Create user_product_access table
CREATE TABLE public.user_product_access (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  access_level text NOT NULL DEFAULT 'viewer',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, product_id)
);

ALTER TABLE public.user_product_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all product access"
  ON public.user_product_access FOR ALL
  USING (is_admin(auth.uid()));

CREATE POLICY "Users can view their own product access"
  ON public.user_product_access FOR SELECT
  USING (auth.uid() = user_id);

-- Create a helper function for product access checks
CREATE OR REPLACE FUNCTION public.has_product_access(_user_id uuid, _product_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_product_access
    WHERE user_id = _user_id AND product_id = _product_id
  );
$$;
