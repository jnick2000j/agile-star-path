-- ============================================================
-- HELPDESK MODULE
-- ============================================================

CREATE TYPE public.helpdesk_ticket_type AS ENUM (
  'support','incident','service_request','question','problem'
);

CREATE TYPE public.helpdesk_ticket_status AS ENUM (
  'new','open','pending','on_hold','resolved','closed','cancelled'
);

CREATE TYPE public.helpdesk_ticket_priority AS ENUM ('low','medium','high','urgent');

CREATE TYPE public.helpdesk_ticket_source AS ENUM ('portal','email','api','phone','chat','internal');

CREATE TABLE public.helpdesk_tickets (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  reference_number text UNIQUE,
  subject         text NOT NULL,
  description     text,
  ticket_type     public.helpdesk_ticket_type NOT NULL DEFAULT 'support',
  category        text,
  priority        public.helpdesk_ticket_priority NOT NULL DEFAULT 'medium',
  status          public.helpdesk_ticket_status NOT NULL DEFAULT 'new',
  source          public.helpdesk_ticket_source NOT NULL DEFAULT 'portal',
  reporter_user_id uuid,
  reporter_email  text,
  reporter_name   text,
  assignee_id     uuid,
  programme_id    uuid REFERENCES public.programmes(id) ON DELETE SET NULL,
  project_id      uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  product_id      uuid REFERENCES public.products(id) ON DELETE SET NULL,
  parent_problem_id uuid REFERENCES public.helpdesk_tickets(id) ON DELETE SET NULL,
  due_at          timestamptz,
  first_response_at timestamptz,
  resolved_at     timestamptz,
  closed_at       timestamptz,
  resolution      text,
  tags            text[] DEFAULT '{}',
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by      uuid,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_helpdesk_tickets_org      ON public.helpdesk_tickets(organization_id);
CREATE INDEX idx_helpdesk_tickets_status   ON public.helpdesk_tickets(status);
CREATE INDEX idx_helpdesk_tickets_assignee ON public.helpdesk_tickets(assignee_id);
CREATE INDEX idx_helpdesk_tickets_reporter ON public.helpdesk_tickets(reporter_user_id);
CREATE INDEX idx_helpdesk_tickets_project  ON public.helpdesk_tickets(project_id);
CREATE INDEX idx_helpdesk_tickets_programme ON public.helpdesk_tickets(programme_id);
CREATE INDEX idx_helpdesk_tickets_product   ON public.helpdesk_tickets(product_id);

CREATE TRIGGER trg_helpdesk_tickets_updated_at
  BEFORE UPDATE ON public.helpdesk_tickets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_helpdesk_tickets_ref
  BEFORE INSERT ON public.helpdesk_tickets
  FOR EACH ROW EXECUTE FUNCTION public.set_reference_number('helpdesk_ticket');

ALTER TABLE public.helpdesk_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view tickets"
  ON public.helpdesk_tickets FOR SELECT
  USING (
    public.has_org_access(auth.uid(), organization_id, 'viewer')
    OR reporter_user_id = auth.uid()
    OR public.is_admin(auth.uid())
  );

CREATE POLICY "Org members can create tickets"
  ON public.helpdesk_tickets FOR INSERT
  WITH CHECK (
    public.has_org_access(auth.uid(), organization_id, 'viewer')
    OR public.is_admin(auth.uid())
  );

CREATE POLICY "Editors can update tickets"
  ON public.helpdesk_tickets FOR UPDATE
  USING (
    public.has_org_access(auth.uid(), organization_id, 'editor')
    OR public.is_admin(auth.uid())
    OR (reporter_user_id = auth.uid() AND status NOT IN ('closed','cancelled'))
  );

CREATE POLICY "Admins can delete tickets"
  ON public.helpdesk_tickets FOR DELETE
  USING (
    public.has_org_access(auth.uid(), organization_id, 'admin')
    OR public.is_admin(auth.uid())
  );

-- Comments
CREATE TABLE public.helpdesk_ticket_comments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id       uuid NOT NULL REFERENCES public.helpdesk_tickets(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  author_user_id  uuid,
  author_email    text,
  author_name     text,
  body            text NOT NULL,
  is_internal     boolean NOT NULL DEFAULT false,
  is_from_email   boolean NOT NULL DEFAULT false,
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_helpdesk_comments_ticket ON public.helpdesk_ticket_comments(ticket_id);

ALTER TABLE public.helpdesk_ticket_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View comments on accessible tickets"
  ON public.helpdesk_ticket_comments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.helpdesk_tickets t
      WHERE t.id = ticket_id
        AND (
          public.has_org_access(auth.uid(), t.organization_id, 'viewer')
          OR t.reporter_user_id = auth.uid()
          OR public.is_admin(auth.uid())
        )
        AND (
          is_internal = false
          OR public.has_org_access(auth.uid(), t.organization_id, 'editor')
          OR public.is_admin(auth.uid())
        )
    )
  );

CREATE POLICY "Add comments on accessible tickets"
  ON public.helpdesk_ticket_comments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.helpdesk_tickets t
      WHERE t.id = ticket_id
        AND (
          public.has_org_access(auth.uid(), t.organization_id, 'viewer')
          OR t.reporter_user_id = auth.uid()
          OR public.is_admin(auth.uid())
        )
    )
  );

CREATE POLICY "Authors and editors can update comments"
  ON public.helpdesk_ticket_comments FOR UPDATE
  USING (
    author_user_id = auth.uid()
    OR public.has_org_access(auth.uid(), organization_id, 'editor')
    OR public.is_admin(auth.uid())
  );

CREATE POLICY "Editors can delete comments"
  ON public.helpdesk_ticket_comments FOR DELETE
  USING (
    public.has_org_access(auth.uid(), organization_id, 'editor')
    OR public.is_admin(auth.uid())
  );

-- Activity log
CREATE TABLE public.helpdesk_ticket_activity (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id       uuid NOT NULL REFERENCES public.helpdesk_tickets(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  actor_user_id   uuid,
  event_type      text NOT NULL,
  from_value      jsonb,
  to_value        jsonb,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_helpdesk_activity_ticket ON public.helpdesk_ticket_activity(ticket_id);

ALTER TABLE public.helpdesk_ticket_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View activity on accessible tickets"
  ON public.helpdesk_ticket_activity FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.helpdesk_tickets t
      WHERE t.id = ticket_id
        AND (
          public.has_org_access(auth.uid(), t.organization_id, 'viewer')
          OR t.reporter_user_id = auth.uid()
          OR public.is_admin(auth.uid())
        )
    )
  );

CREATE POLICY "System and editors insert activity"
  ON public.helpdesk_ticket_activity FOR INSERT
  WITH CHECK (
    public.has_org_access(auth.uid(), organization_id, 'viewer')
    OR public.is_admin(auth.uid())
  );

-- Email inbound log
CREATE TABLE public.helpdesk_email_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  ticket_id       uuid REFERENCES public.helpdesk_tickets(id) ON DELETE SET NULL,
  direction       text NOT NULL DEFAULT 'inbound',
  message_id      text,
  from_address    text,
  to_address      text,
  subject         text,
  body_text       text,
  body_html       text,
  raw_payload     jsonb,
  processed_at    timestamptz,
  status          text NOT NULL DEFAULT 'received',
  error_message   text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_helpdesk_email_log_ticket ON public.helpdesk_email_log(ticket_id);
CREATE INDEX idx_helpdesk_email_log_msgid  ON public.helpdesk_email_log(message_id);

ALTER TABLE public.helpdesk_email_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read email log"
  ON public.helpdesk_email_log FOR SELECT
  USING (
    organization_id IS NULL
    OR public.has_org_access(auth.uid(), organization_id, 'admin')
    OR public.is_admin(auth.uid())
  );

-- ============================================================
-- CHANGE MANAGEMENT MODULE (independent of governance change_requests)
-- ============================================================

CREATE TYPE public.cm_change_type AS ENUM ('standard','normal','emergency','operational');
CREATE TYPE public.cm_status AS ENUM (
  'draft','submitted','in_review','cab_review','needs_information',
  'approved','rejected','scheduled','in_progress','implemented','closed','cancelled','failed'
);
CREATE TYPE public.cm_urgency AS ENUM ('low','medium','high','critical');
CREATE TYPE public.cm_impact AS ENUM ('low','medium','high','critical');
CREATE TYPE public.cm_approval_kind AS ENUM ('technical','business','cab','security','operational');
CREATE TYPE public.cm_approval_decision AS ENUM ('pending','approved','rejected','abstain');

CREATE TABLE public.change_management_requests (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  reference_number text UNIQUE,
  title           text NOT NULL,
  description     text,
  change_type     public.cm_change_type NOT NULL DEFAULT 'normal',
  category        text,
  status          public.cm_status NOT NULL DEFAULT 'draft',
  urgency         public.cm_urgency NOT NULL DEFAULT 'medium',
  impact          public.cm_impact NOT NULL DEFAULT 'medium',
  risk_score      integer DEFAULT 0,
  reason          text,
  business_justification text,
  implementation_plan text,
  rollback_plan   text,
  test_plan       text,
  communication_plan text,
  affected_services text[],
  planned_start_at timestamptz,
  planned_end_at  timestamptz,
  actual_start_at timestamptz,
  actual_end_at   timestamptz,
  downtime_required boolean NOT NULL DEFAULT false,
  downtime_minutes integer,
  cost_estimate   numeric,
  requested_by    uuid,
  owner_id        uuid,
  implementer_id  uuid,
  programme_id    uuid REFERENCES public.programmes(id) ON DELETE SET NULL,
  project_id      uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  product_id      uuid REFERENCES public.products(id) ON DELETE SET NULL,
  related_ticket_id uuid REFERENCES public.helpdesk_tickets(id) ON DELETE SET NULL,
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by      uuid,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_cm_requests_org ON public.change_management_requests(organization_id);
CREATE INDEX idx_cm_requests_status ON public.change_management_requests(status);
CREATE INDEX idx_cm_requests_owner ON public.change_management_requests(owner_id);

CREATE TRIGGER trg_cm_requests_updated_at
  BEFORE UPDATE ON public.change_management_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_cm_requests_ref
  BEFORE INSERT ON public.change_management_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_reference_number('cm_request');

ALTER TABLE public.change_management_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members view change requests"
  ON public.change_management_requests FOR SELECT
  USING (
    public.has_org_access(auth.uid(), organization_id, 'viewer')
    OR public.is_admin(auth.uid())
  );

CREATE POLICY "Editors create change requests"
  ON public.change_management_requests FOR INSERT
  WITH CHECK (
    public.has_org_access(auth.uid(), organization_id, 'editor')
    OR public.is_admin(auth.uid())
  );

CREATE POLICY "Editors update change requests"
  ON public.change_management_requests FOR UPDATE
  USING (
    public.has_org_access(auth.uid(), organization_id, 'editor')
    OR public.is_admin(auth.uid())
  );

CREATE POLICY "Admins delete change requests"
  ON public.change_management_requests FOR DELETE
  USING (
    public.has_org_access(auth.uid(), organization_id, 'admin')
    OR public.is_admin(auth.uid())
  );

-- Approvals
CREATE TABLE public.change_management_approvals (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  change_id       uuid NOT NULL REFERENCES public.change_management_requests(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  approval_kind   public.cm_approval_kind NOT NULL,
  approver_id     uuid,
  decision        public.cm_approval_decision NOT NULL DEFAULT 'pending',
  decision_notes  text,
  decided_at      timestamptz,
  sequence        integer NOT NULL DEFAULT 1,
  required        boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_cm_approvals_change ON public.change_management_approvals(change_id);
CREATE INDEX idx_cm_approvals_approver ON public.change_management_approvals(approver_id);

CREATE TRIGGER trg_cm_approvals_updated_at
  BEFORE UPDATE ON public.change_management_approvals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.change_management_approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members view approvals"
  ON public.change_management_approvals FOR SELECT
  USING (
    public.has_org_access(auth.uid(), organization_id, 'viewer')
    OR approver_id = auth.uid()
    OR public.is_admin(auth.uid())
  );

CREATE POLICY "Editors create approvals"
  ON public.change_management_approvals FOR INSERT
  WITH CHECK (
    public.has_org_access(auth.uid(), organization_id, 'editor')
    OR public.is_admin(auth.uid())
  );

CREATE POLICY "Approvers and editors update approvals"
  ON public.change_management_approvals FOR UPDATE
  USING (
    approver_id = auth.uid()
    OR public.has_org_access(auth.uid(), organization_id, 'editor')
    OR public.is_admin(auth.uid())
  );

CREATE POLICY "Admins delete approvals"
  ON public.change_management_approvals FOR DELETE
  USING (
    public.has_org_access(auth.uid(), organization_id, 'admin')
    OR public.is_admin(auth.uid())
  );

-- Activity
CREATE TABLE public.change_management_activity (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  change_id       uuid NOT NULL REFERENCES public.change_management_requests(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  actor_user_id   uuid,
  event_type      text NOT NULL,
  from_value      jsonb,
  to_value        jsonb,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_cm_activity_change ON public.change_management_activity(change_id);

ALTER TABLE public.change_management_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View change activity"
  ON public.change_management_activity FOR SELECT
  USING (
    public.has_org_access(auth.uid(), organization_id, 'viewer')
    OR public.is_admin(auth.uid())
  );

CREATE POLICY "Insert change activity"
  ON public.change_management_activity FOR INSERT
  WITH CHECK (
    public.has_org_access(auth.uid(), organization_id, 'viewer')
    OR public.is_admin(auth.uid())
  );

-- ============================================================
-- Premium feature catalog entries
-- ============================================================

INSERT INTO public.plan_features (feature_key, name, description, category, default_value)
VALUES
  ('feature_helpdesk', 'Helpdesk & Support', 'Ticket-based help desk with email intake, customer portal, and links to projects/programmes/products.', 'support', 'false'::jsonb),
  ('feature_change_management', 'Change Management', 'Standalone operational change management with approvals, CAB workflow, and risk scoring.', 'governance', 'false'::jsonb)
ON CONFLICT (feature_key) DO NOTHING;