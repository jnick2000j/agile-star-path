ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS feature_id UUID NULL
    REFERENCES public.product_features(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_feature ON public.tasks(feature_id);