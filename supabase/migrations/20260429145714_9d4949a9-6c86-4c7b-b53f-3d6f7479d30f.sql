
-- Categories
CREATE TABLE public.service_catalog_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT NOT NULL DEFAULT 'Package',
  color TEXT NOT NULL DEFAULT '#64748b',
  sort_order INTEGER NOT NULL DEFAULT 100,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_svc_cat_org ON public.service_catalog_categories(organization_id);

-- Items
CREATE TABLE public.service_catalog_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  category_id UUID REFERENCES public.service_catalog_categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  short_description TEXT,
  description TEXT,
  icon TEXT NOT NULL DEFAULT 'Package',
  is_active BOOLEAN NOT NULL DEFAULT true,
  -- Fulfillment defaults applied to created ticket
  default_priority helpdesk_ticket_priority NOT NULL DEFAULT 'medium',
  default_assignee_id UUID,
  default_assignee_team TEXT,
  estimated_fulfillment_hours INTEGER,
  -- Approval policy: 'none' | 'manager' | 'specific_users' | 'role'
  approval_policy TEXT NOT NULL DEFAULT 'none' CHECK (approval_policy IN ('none','manager','specific_users','role')),
  approver_user_ids UUID[] NOT NULL DEFAULT '{}',
  approver_role TEXT,
  -- Display
  cost_estimate NUMERIC(12,2),
  cost_currency TEXT NOT NULL DEFAULT 'USD',
  tags TEXT[] NOT NULL DEFAULT '{}',
  sort_order INTEGER NOT NULL DEFAULT 100,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_svc_item_org ON public.service_catalog_items(organization_id);
CREATE INDEX idx_svc_item_cat ON public.service_catalog_items(category_id);

-- Form fields
CREATE TABLE public.service_catalog_item_fields (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id UUID NOT NULL REFERENCES public.service_catalog_items(id) ON DELETE CASCADE,
  field_key TEXT NOT NULL,
  label TEXT NOT NULL,
  help_text TEXT,
  field_type TEXT NOT NULL CHECK (field_type IN ('text','textarea','select','multiselect','number','checkbox','date','user')),
  options JSONB NOT NULL DEFAULT '[]', -- array of {value,label} for select/multiselect
  is_required BOOLEAN NOT NULL DEFAULT false,
  placeholder TEXT,
  sort_order INTEGER NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (item_id, field_key)
);
CREATE INDEX idx_svc_field_item ON public.service_catalog_item_fields(item_id);

-- Per-ticket request answers
CREATE TABLE public.service_catalog_request_data (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  ticket_id UUID NOT NULL UNIQUE REFERENCES public.helpdesk_tickets(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.service_catalog_items(id) ON DELETE RESTRICT,
  answers JSONB NOT NULL DEFAULT '{}',
  cost_estimate NUMERIC(12,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_svc_req_ticket ON public.service_catalog_request_data(ticket_id);
CREATE INDEX idx_svc_req_org ON public.service_catalog_request_data(organization_id);

-- Approval steps
CREATE TABLE public.service_catalog_request_approvals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  ticket_id UUID NOT NULL REFERENCES public.helpdesk_tickets(id) ON DELETE CASCADE,
  step_order INTEGER NOT NULL DEFAULT 1,
  approver_user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','skipped')),
  decided_at TIMESTAMPTZ,
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_svc_appr_ticket ON public.service_catalog_request_approvals(ticket_id);
CREATE INDEX idx_svc_appr_user ON public.service_catalog_request_approvals(approver_user_id);
CREATE INDEX idx_svc_appr_org ON public.service_catalog_request_approvals(organization_id);

-- Triggers for updated_at
CREATE TRIGGER svc_cat_updated_at BEFORE UPDATE ON public.service_catalog_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER svc_item_updated_at BEFORE UPDATE ON public.service_catalog_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER svc_appr_updated_at BEFORE UPDATE ON public.service_catalog_request_approvals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.service_catalog_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_catalog_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_catalog_item_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_catalog_request_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_catalog_request_approvals ENABLE ROW LEVEL SECURITY;

-- Policies: Categories
CREATE POLICY "Org members read categories" ON public.service_catalog_categories
  FOR SELECT TO authenticated
  USING (public.has_org_access(auth.uid(), organization_id, 'viewer'));
CREATE POLICY "Managers manage categories" ON public.service_catalog_categories
  FOR ALL TO authenticated
  USING (public.has_org_access(auth.uid(), organization_id, 'manager'))
  WITH CHECK (public.has_org_access(auth.uid(), organization_id, 'manager'));

-- Policies: Items
CREATE POLICY "Org members read items" ON public.service_catalog_items
  FOR SELECT TO authenticated
  USING (public.has_org_access(auth.uid(), organization_id, 'viewer'));
CREATE POLICY "Managers manage items" ON public.service_catalog_items
  FOR ALL TO authenticated
  USING (public.has_org_access(auth.uid(), organization_id, 'manager'))
  WITH CHECK (public.has_org_access(auth.uid(), organization_id, 'manager'));

-- Policies: Fields (inherit org via item)
CREATE POLICY "Org members read fields" ON public.service_catalog_item_fields
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.service_catalog_items i
    WHERE i.id = service_catalog_item_fields.item_id
      AND public.has_org_access(auth.uid(), i.organization_id, 'viewer')
  ));
CREATE POLICY "Managers manage fields" ON public.service_catalog_item_fields
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.service_catalog_items i
    WHERE i.id = service_catalog_item_fields.item_id
      AND public.has_org_access(auth.uid(), i.organization_id, 'manager')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.service_catalog_items i
    WHERE i.id = service_catalog_item_fields.item_id
      AND public.has_org_access(auth.uid(), i.organization_id, 'manager')
  ));

-- Policies: Request data
CREATE POLICY "Requester/assignee/manager read request data" ON public.service_catalog_request_data
  FOR SELECT TO authenticated
  USING (
    public.has_org_access(auth.uid(), organization_id, 'manager')
    OR EXISTS (
      SELECT 1 FROM public.helpdesk_tickets t
      WHERE t.id = service_catalog_request_data.ticket_id
        AND (t.reporter_user_id = auth.uid() OR t.assignee_id = auth.uid() OR t.created_by = auth.uid())
    )
  );
CREATE POLICY "Authenticated org members create request data" ON public.service_catalog_request_data
  FOR INSERT TO authenticated
  WITH CHECK (public.has_org_access(auth.uid(), organization_id, 'viewer'));
CREATE POLICY "Managers update request data" ON public.service_catalog_request_data
  FOR UPDATE TO authenticated
  USING (public.has_org_access(auth.uid(), organization_id, 'manager'))
  WITH CHECK (public.has_org_access(auth.uid(), organization_id, 'manager'));

-- Policies: Approvals
CREATE POLICY "Approvers and managers read approvals" ON public.service_catalog_request_approvals
  FOR SELECT TO authenticated
  USING (
    approver_user_id = auth.uid()
    OR public.has_org_access(auth.uid(), organization_id, 'manager')
    OR EXISTS (
      SELECT 1 FROM public.helpdesk_tickets t
      WHERE t.id = service_catalog_request_approvals.ticket_id
        AND (t.reporter_user_id = auth.uid() OR t.assignee_id = auth.uid())
    )
  );
CREATE POLICY "Org members create approvals" ON public.service_catalog_request_approvals
  FOR INSERT TO authenticated
  WITH CHECK (public.has_org_access(auth.uid(), organization_id, 'viewer'));
CREATE POLICY "Approver decides own step" ON public.service_catalog_request_approvals
  FOR UPDATE TO authenticated
  USING (approver_user_id = auth.uid() OR public.has_org_access(auth.uid(), organization_id, 'manager'))
  WITH CHECK (approver_user_id = auth.uid() OR public.has_org_access(auth.uid(), organization_id, 'manager'));
CREATE POLICY "Managers delete approvals" ON public.service_catalog_request_approvals
  FOR DELETE TO authenticated
  USING (public.has_org_access(auth.uid(), organization_id, 'manager'));

-- Helper: aggregate approval state for a ticket
CREATE OR REPLACE FUNCTION public.get_request_approval_state(_ticket_id uuid)
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT CASE
    WHEN COUNT(*) = 0 THEN 'not_required'
    WHEN COUNT(*) FILTER (WHERE status = 'rejected') > 0 THEN 'rejected'
    WHEN COUNT(*) FILTER (WHERE status = 'pending') = 0 THEN 'approved'
    ELSE 'pending'
  END
  FROM public.service_catalog_request_approvals
  WHERE ticket_id = _ticket_id;
$$;
