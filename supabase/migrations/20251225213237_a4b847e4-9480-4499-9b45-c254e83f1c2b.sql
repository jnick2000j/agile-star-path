-- Create sprints table for sprint planning
CREATE TABLE public.sprints (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations(id),
  start_date DATE,
  end_date DATE,
  capacity_points INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'planning',
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add sprint_id to product_features
ALTER TABLE public.product_features ADD COLUMN sprint_id UUID REFERENCES public.sprints(id) ON DELETE SET NULL;
ALTER TABLE public.product_features ADD COLUMN story_points INTEGER;

-- Enable RLS
ALTER TABLE public.sprints ENABLE ROW LEVEL SECURITY;

-- RLS policies for sprints
CREATE POLICY "Authenticated users can view sprints"
  ON public.sprints FOR SELECT
  USING (true);

CREATE POLICY "Users can create sprints"
  ON public.sprints FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Creators can update sprints"
  ON public.sprints FOR UPDATE
  USING (auth.uid() = created_by OR is_admin(auth.uid()));

CREATE POLICY "Admins can delete sprints"
  ON public.sprints FOR DELETE
  USING (is_admin(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_sprints_updated_at
  BEFORE UPDATE ON public.sprints
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();