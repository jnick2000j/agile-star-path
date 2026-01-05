-- Add product_id to registers that don't have it
ALTER TABLE public.risks ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES public.products(id);
ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES public.products(id);
ALTER TABLE public.benefits ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id);
ALTER TABLE public.benefits ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES public.products(id);
ALTER TABLE public.exceptions ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES public.products(id);
ALTER TABLE public.lessons_learned ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES public.products(id);

-- Add programme_id and project_id to sprints for separate sprints per entity
ALTER TABLE public.sprints ADD COLUMN IF NOT EXISTS programme_id UUID REFERENCES public.programmes(id);
ALTER TABLE public.sprints ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id);

-- Add programme_id and project_id to stakeholders for direct linking
ALTER TABLE public.stakeholders ADD COLUMN IF NOT EXISTS programme_id UUID REFERENCES public.programmes(id);
ALTER TABLE public.stakeholders ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id);
ALTER TABLE public.stakeholders ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES public.products(id);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_risks_product_id ON public.risks(product_id);
CREATE INDEX IF NOT EXISTS idx_issues_product_id ON public.issues(product_id);
CREATE INDEX IF NOT EXISTS idx_benefits_project_id ON public.benefits(project_id);
CREATE INDEX IF NOT EXISTS idx_benefits_product_id ON public.benefits(product_id);
CREATE INDEX IF NOT EXISTS idx_exceptions_product_id ON public.exceptions(product_id);
CREATE INDEX IF NOT EXISTS idx_lessons_learned_product_id ON public.lessons_learned(product_id);
CREATE INDEX IF NOT EXISTS idx_sprints_programme_id ON public.sprints(programme_id);
CREATE INDEX IF NOT EXISTS idx_sprints_project_id ON public.sprints(project_id);
CREATE INDEX IF NOT EXISTS idx_stakeholders_programme_id ON public.stakeholders(programme_id);
CREATE INDEX IF NOT EXISTS idx_stakeholders_project_id ON public.stakeholders(project_id);
CREATE INDEX IF NOT EXISTS idx_stakeholders_product_id ON public.stakeholders(product_id);