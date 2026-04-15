
-- Add new role enum values
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'product_manager';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'product_team_member';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'project_team_member';
