
-- Entity updates for timestamped progress tracking
CREATE TABLE public.entity_updates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_type TEXT NOT NULL, -- 'task', 'project', 'programme', 'product'
  entity_id UUID NOT NULL,
  update_text TEXT NOT NULL,
  created_by UUID NOT NULL,
  organization_id UUID REFERENCES public.organizations(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.entity_updates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create updates" ON public.entity_updates
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can view org updates" ON public.entity_updates
  FOR SELECT USING (
    (organization_id IS NULL)
    OR has_org_access(auth.uid(), organization_id)
    OR auth.uid() = created_by
    OR is_admin(auth.uid())
  );

CREATE POLICY "Creators can update their updates" ON public.entity_updates
  FOR UPDATE TO authenticated
  USING (auth.uid() = created_by OR is_admin(auth.uid()));

CREATE POLICY "Creators and admins can delete updates" ON public.entity_updates
  FOR DELETE TO authenticated
  USING (auth.uid() = created_by OR is_admin(auth.uid()));

CREATE INDEX idx_entity_updates_entity ON public.entity_updates(entity_type, entity_id);
CREATE INDEX idx_entity_updates_created_at ON public.entity_updates(created_at DESC);

-- Add AI summary columns to weekly_reports
ALTER TABLE public.weekly_reports
  ADD COLUMN ai_summary TEXT,
  ADD COLUMN task_summary TEXT,
  ADD COLUMN project_summary TEXT,
  ADD COLUMN programme_summary TEXT,
  ADD COLUMN product_summary TEXT;
