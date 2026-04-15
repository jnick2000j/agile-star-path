
-- Add new columns
ALTER TABLE public.weekly_reports
ADD COLUMN report_type text NOT NULL DEFAULT 'programme',
ADD COLUMN project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
ADD COLUMN product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
ADD COLUMN organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL;

-- Make programme_id nullable
ALTER TABLE public.weekly_reports ALTER COLUMN programme_id DROP NOT NULL;
