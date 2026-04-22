-- Preserve the original target date and allow a revised target date
ALTER TABLE public.milestones
  ADD COLUMN IF NOT EXISTS original_target_date DATE,
  ADD COLUMN IF NOT EXISTS revised_target_date DATE,
  ADD COLUMN IF NOT EXISTS revision_reason TEXT;

-- Backfill original_target_date for existing rows
UPDATE public.milestones
   SET original_target_date = target_date
 WHERE original_target_date IS NULL;

-- Audit / timeline table for milestones
CREATE TABLE IF NOT EXISTS public.milestone_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  milestone_id UUID NOT NULL REFERENCES public.milestones(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'status_change', 'owner_change', 'target_date_revised',
    'document_linked', 'document_unlinked', 'created', 'comment'
  )),
  from_value TEXT,
  to_value TEXT,
  comment TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  changed_by UUID,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_milestone_history_milestone ON public.milestone_history(milestone_id, changed_at DESC);

ALTER TABLE public.milestone_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "View milestone history" ON public.milestone_history;
CREATE POLICY "View milestone history" ON public.milestone_history
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.milestones m
     WHERE m.id = milestone_history.milestone_id
       AND (
         m.organization_id IS NULL
         OR public.has_org_access(auth.uid(), m.organization_id)
         OR auth.uid() = m.owner_id
         OR auth.uid() = m.created_by
         OR public.is_admin(auth.uid())
       )
  )
);

DROP POLICY IF EXISTS "Insert milestone history" ON public.milestone_history;
CREATE POLICY "Insert milestone history" ON public.milestone_history
FOR INSERT TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

-- Trigger function: log status, owner, target_date changes
CREATE OR REPLACE FUNCTION public.log_milestone_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _actor UUID := auth.uid();
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.milestone_history (milestone_id, organization_id, event_type, to_value, changed_by)
    VALUES (NEW.id, NEW.organization_id, 'created', NEW.status::text, COALESCE(_actor, NEW.created_by));
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      INSERT INTO public.milestone_history (milestone_id, organization_id, event_type, from_value, to_value, changed_by)
      VALUES (NEW.id, NEW.organization_id, 'status_change', OLD.status::text, NEW.status::text, _actor);
    END IF;

    IF NEW.owner_id IS DISTINCT FROM OLD.owner_id THEN
      INSERT INTO public.milestone_history (milestone_id, organization_id, event_type, from_value, to_value, changed_by)
      VALUES (NEW.id, NEW.organization_id, 'owner_change',
              OLD.owner_id::text, NEW.owner_id::text, _actor);
    END IF;

    IF NEW.revised_target_date IS DISTINCT FROM OLD.revised_target_date THEN
      INSERT INTO public.milestone_history (
        milestone_id, organization_id, event_type, from_value, to_value, comment, changed_by
      )
      VALUES (
        NEW.id, NEW.organization_id, 'target_date_revised',
        COALESCE(OLD.revised_target_date::text, OLD.target_date::text),
        NEW.revised_target_date::text,
        NEW.revision_reason,
        _actor
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS milestones_log_changes ON public.milestones;
CREATE TRIGGER milestones_log_changes
AFTER INSERT OR UPDATE ON public.milestones
FOR EACH ROW EXECUTE FUNCTION public.log_milestone_changes();

-- Trigger to log when documents are attached to milestones
CREATE OR REPLACE FUNCTION public.log_milestone_document_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _milestone public.milestones;
BEGIN
  IF (TG_OP = 'INSERT' AND NEW.entity_type = 'milestone') THEN
    SELECT * INTO _milestone FROM public.milestones WHERE id = NEW.entity_id;
    IF FOUND THEN
      INSERT INTO public.milestone_history (
        milestone_id, organization_id, event_type, to_value, comment, metadata, changed_by
      )
      VALUES (
        _milestone.id, _milestone.organization_id, 'document_linked',
        NEW.name, NEW.name,
        jsonb_build_object('document_id', NEW.id, 'file_path', NEW.file_path),
        COALESCE(auth.uid(), NEW.uploaded_by)
      );
    END IF;
  ELSIF (TG_OP = 'DELETE' AND OLD.entity_type = 'milestone') THEN
    SELECT * INTO _milestone FROM public.milestones WHERE id = OLD.entity_id;
    IF FOUND THEN
      INSERT INTO public.milestone_history (
        milestone_id, organization_id, event_type, from_value, comment, metadata, changed_by
      )
      VALUES (
        _milestone.id, _milestone.organization_id, 'document_unlinked',
        OLD.name, OLD.name,
        jsonb_build_object('document_id', OLD.id),
        auth.uid()
      );
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS documents_log_milestone_changes ON public.documents;
CREATE TRIGGER documents_log_milestone_changes
AFTER INSERT OR DELETE ON public.documents
FOR EACH ROW EXECUTE FUNCTION public.log_milestone_document_changes();