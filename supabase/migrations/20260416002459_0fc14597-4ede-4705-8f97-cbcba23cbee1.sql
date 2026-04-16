
-- Update all existing data
UPDATE public.profiles SET role = 'org_stakeholder' WHERE role = 'stakeholder';
UPDATE public.user_roles SET role = 'org_stakeholder' WHERE role = 'stakeholder';
UPDATE public.user_organization_roles SET role = 'org_stakeholder' WHERE role = 'stakeholder';

-- Create new enum without 'stakeholder'
CREATE TYPE public.app_role_new AS ENUM (
  'admin',
  'programme_owner',
  'project_manager',
  'product_manager',
  'product_team_member',
  'project_team_member',
  'org_stakeholder',
  'programme_stakeholder',
  'project_stakeholder',
  'product_stakeholder'
);

-- Update profiles
ALTER TABLE public.profiles ALTER COLUMN role DROP DEFAULT;
ALTER TABLE public.profiles ALTER COLUMN role TYPE public.app_role_new USING role::text::public.app_role_new;
ALTER TABLE public.profiles ALTER COLUMN role SET DEFAULT 'org_stakeholder'::public.app_role_new;

-- Update user_roles
ALTER TABLE public.user_roles ALTER COLUMN role TYPE public.app_role_new USING role::text::public.app_role_new;

-- Update user_organization_roles
ALTER TABLE public.user_organization_roles ALTER COLUMN role TYPE public.app_role_new USING role::text::public.app_role_new;

-- Drop has_role function that depends on old enum
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);

-- Drop old enum and rename
DROP TYPE public.app_role;
ALTER TYPE public.app_role_new RENAME TO app_role;

-- Recreate has_role
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;
