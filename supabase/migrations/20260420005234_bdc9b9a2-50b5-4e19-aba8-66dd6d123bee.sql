-- AI Summaries table
CREATE TABLE IF NOT EXISTS public.ai_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  scope_type TEXT NOT NULL,
  scope_id UUID NOT NULL,
  summary_kind TEXT NOT NULL,
  draft_content JSONB,
  published_content JSONB,
  status TEXT NOT NULL DEFAULT 'draft',
  is_stale BOOLEAN NOT NULL DEFAULT false,
  change_count_at_generation INTEGER NOT NULL DEFAULT 0,
  last_audit_id UUID REFERENCES public.ai_audit_log(id) ON DELETE SET NULL,
  generated_by UUID,
  generated_at TIMESTAMPTZ DEFAULT now(),
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  model TEXT,
  prompt_version TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (scope_type, scope_id, summary_kind)
);

CREATE INDEX IF NOT EXISTS idx_ai_summaries_scope ON public.ai_summaries(scope_type, scope_id);
CREATE INDEX IF NOT EXISTS idx_ai_summaries_org ON public.ai_summaries(organization_id);
CREATE INDEX IF NOT EXISTS idx_ai_summaries_status ON public.ai_summaries(status);

ALTER TABLE public.ai_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view summaries"
  ON public.ai_summaries FOR SELECT
  USING (
    public.is_admin(auth.uid())
    OR (organization_id IS NOT NULL AND public.has_org_access(auth.uid(), organization_id, 'viewer'))
  );

CREATE POLICY "Org editors can insert summaries"
  ON public.ai_summaries FOR INSERT
  WITH CHECK (
    public.is_admin(auth.uid())
    OR (organization_id IS NOT NULL AND public.has_org_access(auth.uid(), organization_id, 'editor'))
  );

CREATE POLICY "Org editors can update summaries"
  ON public.ai_summaries FOR UPDATE
  USING (
    public.is_admin(auth.uid())
    OR (organization_id IS NOT NULL AND public.has_org_access(auth.uid(), organization_id, 'editor'))
  );

CREATE POLICY "Admins can delete summaries"
  ON public.ai_summaries FOR DELETE
  USING (public.is_admin(auth.uid()));

CREATE TRIGGER ai_summaries_updated_at
  BEFORE UPDATE ON public.ai_summaries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Change watermark: bump is_stale when entity_updates / risks / issues land for tracked scope
CREATE OR REPLACE FUNCTION public.mark_summaries_stale_for_scope(_scope_type TEXT, _scope_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.ai_summaries
     SET is_stale = true,
         change_count_at_generation = change_count_at_generation + 1
   WHERE scope_type = _scope_type
     AND scope_id = _scope_id
     AND is_stale = false;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_entity_updates_stale_summary()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.mark_summaries_stale_for_scope(NEW.entity_type, NEW.entity_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS entity_updates_stale_summary ON public.entity_updates;
CREATE TRIGGER entity_updates_stale_summary
  AFTER INSERT ON public.entity_updates
  FOR EACH ROW EXECUTE FUNCTION public.trg_entity_updates_stale_summary();

CREATE OR REPLACE FUNCTION public.trg_risk_issue_stale_summary()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.programme_id IS NOT NULL THEN
    PERFORM public.mark_summaries_stale_for_scope('programme', NEW.programme_id);
  END IF;
  IF NEW.project_id IS NOT NULL THEN
    PERFORM public.mark_summaries_stale_for_scope('project', NEW.project_id);
  END IF;
  IF NEW.product_id IS NOT NULL THEN
    PERFORM public.mark_summaries_stale_for_scope('product', NEW.product_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS risks_stale_summary ON public.risks;
CREATE TRIGGER risks_stale_summary
  AFTER INSERT OR UPDATE ON public.risks
  FOR EACH ROW EXECUTE FUNCTION public.trg_risk_issue_stale_summary();

DROP TRIGGER IF EXISTS issues_stale_summary ON public.issues;
CREATE TRIGGER issues_stale_summary
  AFTER INSERT OR UPDATE ON public.issues
  FOR EACH ROW EXECUTE FUNCTION public.trg_risk_issue_stale_summary();