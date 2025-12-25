-- Add new fields to profiles table for extended user info
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS phone_number text,
ADD COLUMN IF NOT EXISTS address text,
ADD COLUMN IF NOT EXISTS mailing_address text,
ADD COLUMN IF NOT EXISTS location text,
ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS archived_at timestamp with time zone;

-- Create index for archived filter
CREATE INDEX IF NOT EXISTS idx_profiles_archived ON public.profiles(archived);

-- Create a table to track multiple roles per user per organization
CREATE TABLE IF NOT EXISTS public.user_organization_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, organization_id, role)
);

-- Enable RLS on user_organization_roles
ALTER TABLE public.user_organization_roles ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_organization_roles
CREATE POLICY "Users can view their own org roles"
ON public.user_organization_roles
FOR SELECT
USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "Org admins can manage org roles"
ON public.user_organization_roles
FOR ALL
USING (public.has_org_access(auth.uid(), organization_id, 'admin') OR public.is_admin(auth.uid()));