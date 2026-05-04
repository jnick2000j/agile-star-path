CREATE TABLE public.helpdesk_queues (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#3b82f6',
  default_priority helpdesk_ticket_priority NOT NULL DEFAULT 'medium',
  default_assignee_id UUID,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, name)
);
CREATE INDEX idx_helpdesk_queues_org ON public.helpdesk_queues(organization_id);
ALTER TABLE public.helpdesk_queues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members view queues" ON public.helpdesk_queues FOR SELECT
  USING (has_org_access(auth.uid(), organization_id));
CREATE POLICY "Org admins manage queues" ON public.helpdesk_queues FOR ALL
  USING (has_org_access(auth.uid(), organization_id) AND (is_admin(auth.uid()) OR is_org_admin(auth.uid(), organization_id)))
  WITH CHECK (has_org_access(auth.uid(), organization_id) AND (is_admin(auth.uid()) OR is_org_admin(auth.uid(), organization_id)));

CREATE TRIGGER trg_helpdesk_queues_updated BEFORE UPDATE ON public.helpdesk_queues
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE public.helpdesk_queue_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  queue_id UUID NOT NULL REFERENCES public.helpdesk_queues(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (queue_id, user_id)
);
CREATE INDEX idx_queue_members_queue ON public.helpdesk_queue_members(queue_id);
CREATE INDEX idx_queue_members_user ON public.helpdesk_queue_members(user_id);
ALTER TABLE public.helpdesk_queue_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members view queue members" ON public.helpdesk_queue_members FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.helpdesk_queues q WHERE q.id = queue_id AND has_org_access(auth.uid(), q.organization_id)));
CREATE POLICY "Org admins manage queue members" ON public.helpdesk_queue_members FOR ALL
  USING (EXISTS (SELECT 1 FROM public.helpdesk_queues q WHERE q.id = queue_id AND has_org_access(auth.uid(), q.organization_id) AND (is_admin(auth.uid()) OR is_org_admin(auth.uid(), q.organization_id))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.helpdesk_queues q WHERE q.id = queue_id AND has_org_access(auth.uid(), q.organization_id) AND (is_admin(auth.uid()) OR is_org_admin(auth.uid(), q.organization_id))));

ALTER TABLE public.helpdesk_email_inboxes ADD COLUMN queue_id UUID REFERENCES public.helpdesk_queues(id) ON DELETE SET NULL;
ALTER TABLE public.helpdesk_tickets ADD COLUMN queue_id UUID REFERENCES public.helpdesk_queues(id) ON DELETE SET NULL;
CREATE INDEX idx_helpdesk_tickets_queue ON public.helpdesk_tickets(queue_id);

CREATE OR REPLACE FUNCTION public.notify_queue_on_ticket_assignment()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_queue_name TEXT; v_member RECORD;
BEGIN
  IF NEW.queue_id IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.queue_id IS NOT DISTINCT FROM NEW.queue_id THEN RETURN NEW; END IF;
  SELECT name INTO v_queue_name FROM public.helpdesk_queues WHERE id = NEW.queue_id;
  FOR v_member IN SELECT user_id FROM public.helpdesk_queue_members WHERE queue_id = NEW.queue_id LOOP
    BEGIN
      INSERT INTO public.notifications (user_id, organization_id, type, title, message, link, metadata)
      VALUES (v_member.user_id, NEW.organization_id, 'helpdesk_queue_assignment',
        'Ticket assigned to queue: ' || COALESCE(v_queue_name, 'Queue'),
        COALESCE(NEW.reference_number, 'Ticket') || ' — ' || COALESCE(NEW.subject, ''),
        '/helpdesk/tickets/' || NEW.id::text,
        jsonb_build_object('ticket_id', NEW.id, 'queue_id', NEW.queue_id));
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END LOOP;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_notify_queue_on_ticket_assignment
  AFTER INSERT OR UPDATE OF queue_id ON public.helpdesk_tickets
  FOR EACH ROW EXECUTE FUNCTION public.notify_queue_on_ticket_assignment();