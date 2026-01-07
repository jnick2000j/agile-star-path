-- Add work_package_id to milestones table for PRINCE2 work package tracking
ALTER TABLE public.milestones 
ADD COLUMN work_package_id UUID REFERENCES public.work_packages(id) ON DELETE SET NULL;

-- Create index for better query performance
CREATE INDEX idx_milestones_work_package_id ON public.milestones(work_package_id);