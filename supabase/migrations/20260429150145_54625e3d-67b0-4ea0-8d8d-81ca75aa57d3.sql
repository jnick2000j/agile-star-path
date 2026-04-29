
-- Problems
CREATE TABLE public.problems (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  reference_number TEXT,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new','investigating','known_error','resolved','closed')),
  priority TEXT NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('low','medium','high','critical')),
  category TEXT,
  root_cause TEXT,
  workaround TEXT,
  resolution TEXT,
  is_known_error BOOLEAN NOT NULL DEFAULT false,
  identified_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  assignee_id UUID,
  reporter_user_id UUID,
  programme_id UUID,
  project_id UUID,
  product_id UUID,
  tags TEXT[] NOT NULL DEFAULT '{}',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_problems_org ON public.problems(organization_id);
CREATE INDEX idx_problems_status ON public.problems(status);
CREATE INDEX idx_problems_assignee ON public.problems(assignee_id);
CREATE INDEX idx_problems_known_error ON public.problems(is_known_error) WHERE is_known_error = true;

-- Problem ↔ CI links
CREATE TABLE public.problem_ci_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  problem_id UUID NOT NULL REFERENCES public.problems(id) ON DELETE CASCADE,
  ci_id UUID NOT NULL REFERENCES public.configuration_items(id) ON DELETE CASCADE,
  link_type TEXT NOT NULL DEFAULT 'affected'
    CHECK (link_type IN ('affected','root_cause','related')),
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (problem_id, ci_id, link_type)
);
CREATE INDEX idx_problem_ci_problem ON public.problem_ci_links(problem_id);
CREATE INDEX idx_problem_ci_ci ON public.problem_ci_links(ci_id);

-- Status history
CREATE TABLE public.problem_status_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  problem_id UUID NOT NULL REFERENCES public.problems(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT NOT NULL,
  changed_by UUID,
  comment TEXT,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_problem_history_problem ON public.problem_status_history(problem_id);

-- updated_at trigger
CREATE TRIGGER problems_updated_at BEFORE UPDATE ON public.problems
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Reference number trigger
CREATE OR REPLACE FUNCTION public.set_problem_reference_number()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.reference_number IS NULL THEN
    NEW.reference_number := public.generate_reference_number(NEW.organization_id, 'PRB');
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER problems_set_ref BEFORE INSERT ON public.problems
  FOR EACH ROW EXECUTE FUNCTION public.set_problem_reference_number();

-- Status history trigger
CREATE OR REPLACE FUNCTION public.log_problem_status_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.problem_status_history(problem_id, from_status, to_status, changed_by)
    VALUES (NEW.id, NULL, NEW.status, NEW.created_by);
    RETURN NEW;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.problem_status_history(problem_id, from_status, to_status, changed_by)
    VALUES (NEW.id, OLD.status, NEW.status, auth.uid());
    -- auto stamp resolved/closed timestamps
    IF NEW.status = 'resolved' AND NEW.resolved_at IS NULL THEN
      NEW.resolved_at := now();
    END IF;
    IF NEW.status = 'closed' AND NEW.closed_at IS NULL THEN
      NEW.closed_at := now();
    END IF;
    IF NEW.status = 'known_error' THEN
      NEW.is_known_error := true;
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER problems_status_history
  BEFORE INSERT OR UPDATE OF status ON public.problems
  FOR EACH ROW EXECUTE FUNCTION public.log_problem_status_change();

-- Enable RLS
ALTER TABLE public.problems ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.problem_ci_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.problem_status_history ENABLE ROW LEVEL SECURITY;

-- Problems policies
CREATE POLICY "Org members read problems" ON public.problems
  FOR SELECT TO authenticated
  USING (public.has_org_access(auth.uid(), organization_id, 'viewer'));
CREATE POLICY "Editors create problems" ON public.problems
  FOR INSERT TO authenticated
  WITH CHECK (public.has_org_access(auth.uid(), organization_id, 'editor'));
CREATE POLICY "Editors update problems" ON public.problems
  FOR UPDATE TO authenticated
  USING (public.has_org_access(auth.uid(), organization_id, 'editor'))
  WITH CHECK (public.has_org_access(auth.uid(), organization_id, 'editor'));
CREATE POLICY "Managers delete problems" ON public.problems
  FOR DELETE TO authenticated
  USING (public.has_org_access(auth.uid(), organization_id, 'manager'));

-- Problem CI links policies
CREATE POLICY "Org members read problem_ci_links" ON public.problem_ci_links
  FOR SELECT TO authenticated
  USING (public.has_org_access(auth.uid(), organization_id, 'viewer'));
CREATE POLICY "Editors manage problem_ci_links" ON public.problem_ci_links
  FOR ALL TO authenticated
  USING (public.has_org_access(auth.uid(), organization_id, 'editor'))
  WITH CHECK (public.has_org_access(auth.uid(), organization_id, 'editor'));

-- Status history policies (read-only for users; trigger writes)
CREATE POLICY "Org members read problem history" ON public.problem_status_history
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.problems p
    WHERE p.id = problem_status_history.problem_id
      AND public.has_org_access(auth.uid(), p.organization_id, 'viewer')
  ));

-- Helper view: problem with linked-incident summary
CREATE OR REPLACE VIEW public.problem_summary
WITH (security_invoker = true)
AS
SELECT
  p.*,
  (SELECT COUNT(*) FROM public.helpdesk_tickets t WHERE t.parent_problem_id = p.id) AS linked_incident_count,
  (SELECT COUNT(*) FROM public.helpdesk_tickets t
     WHERE t.parent_problem_id = p.id AND t.status NOT IN ('resolved','closed','cancelled')) AS open_incident_count
FROM public.problems p;
