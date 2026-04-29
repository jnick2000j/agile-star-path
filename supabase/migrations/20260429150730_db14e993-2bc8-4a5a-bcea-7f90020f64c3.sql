
-- ===== MAJOR INCIDENTS =====
CREATE TABLE public.major_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  reference_number TEXT UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  severity TEXT NOT NULL DEFAULT 'sev2' CHECK (severity IN ('sev1','sev2','sev3','sev4')),
  status TEXT NOT NULL DEFAULT 'investigating' CHECK (status IN ('investigating','identified','monitoring','resolved','closed')),
  impact TEXT,
  incident_commander_id UUID REFERENCES public.profiles(id),
  comms_lead_id UUID REFERENCES public.profiles(id),
  declared_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  post_mortem TEXT,
  post_mortem_published_at TIMESTAMPTZ,
  parent_problem_id UUID REFERENCES public.problems(id),
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.major_incidents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "MI read" ON public.major_incidents FOR SELECT TO authenticated
  USING (public.has_org_access(auth.uid(), organization_id, 'viewer'));
CREATE POLICY "MI insert" ON public.major_incidents FOR INSERT TO authenticated
  WITH CHECK (public.has_org_access(auth.uid(), organization_id, 'editor'));
CREATE POLICY "MI update" ON public.major_incidents FOR UPDATE TO authenticated
  USING (public.has_org_access(auth.uid(), organization_id, 'editor'));
CREATE POLICY "MI delete" ON public.major_incidents FOR DELETE TO authenticated
  USING (public.has_org_access(auth.uid(), organization_id, 'admin'));

CREATE TRIGGER trg_major_incidents_updated_at BEFORE UPDATE ON public.major_incidents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.generate_major_incident_ref()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  yr TEXT := to_char(now(), 'YYYY');
  next_num INT;
BEGIN
  IF NEW.reference_number IS NOT NULL THEN RETURN NEW; END IF;
  SELECT COALESCE(MAX(SUBSTRING(reference_number FROM 'MI-' || yr || '-(\d+)')::INT), 0) + 1
    INTO next_num FROM public.major_incidents
    WHERE organization_id = NEW.organization_id AND reference_number LIKE 'MI-' || yr || '-%';
  NEW.reference_number := 'MI-' || yr || '-' || LPAD(next_num::TEXT, 4, '0');
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_major_incidents_ref BEFORE INSERT ON public.major_incidents
  FOR EACH ROW EXECUTE FUNCTION public.generate_major_incident_ref();

CREATE OR REPLACE FUNCTION public.major_incident_status_stamps()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status = 'resolved' AND OLD.status <> 'resolved' AND NEW.resolved_at IS NULL THEN
    NEW.resolved_at := now();
  END IF;
  IF NEW.status = 'closed' AND OLD.status <> 'closed' AND NEW.closed_at IS NULL THEN
    NEW.closed_at := now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_major_incident_status_stamps BEFORE UPDATE ON public.major_incidents
  FOR EACH ROW EXECUTE FUNCTION public.major_incident_status_stamps();

-- ===== MAJOR INCIDENT UPDATES =====
CREATE TABLE public.major_incident_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  major_incident_id UUID NOT NULL REFERENCES public.major_incidents(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  update_type TEXT NOT NULL DEFAULT 'note' CHECK (update_type IN ('note','status_change','comms','action','decision')),
  message TEXT NOT NULL,
  is_public BOOLEAN NOT NULL DEFAULT false,
  posted_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.major_incident_updates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "MIU read" ON public.major_incident_updates FOR SELECT TO authenticated
  USING (public.has_org_access(auth.uid(), organization_id, 'viewer'));
CREATE POLICY "MIU write" ON public.major_incident_updates FOR INSERT TO authenticated
  WITH CHECK (public.has_org_access(auth.uid(), organization_id, 'editor'));
CREATE POLICY "MIU delete" ON public.major_incident_updates FOR DELETE TO authenticated
  USING (public.has_org_access(auth.uid(), organization_id, 'editor'));

-- ===== MAJOR INCIDENT TICKETS =====
CREATE TABLE public.major_incident_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  major_incident_id UUID NOT NULL REFERENCES public.major_incidents(id) ON DELETE CASCADE,
  ticket_id UUID NOT NULL REFERENCES public.helpdesk_tickets(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  linked_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (major_incident_id, ticket_id)
);
ALTER TABLE public.major_incident_tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "MIT read" ON public.major_incident_tickets FOR SELECT TO authenticated
  USING (public.has_org_access(auth.uid(), organization_id, 'viewer'));
CREATE POLICY "MIT write" ON public.major_incident_tickets FOR INSERT TO authenticated
  WITH CHECK (public.has_org_access(auth.uid(), organization_id, 'editor'));
CREATE POLICY "MIT delete" ON public.major_incident_tickets FOR DELETE TO authenticated
  USING (public.has_org_access(auth.uid(), organization_id, 'editor'));

-- ===== STATUS PAGE COMPONENTS =====
CREATE TABLE public.status_page_components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  group_name TEXT,
  display_order INT NOT NULL DEFAULT 0,
  current_status TEXT NOT NULL DEFAULT 'operational' CHECK (current_status IN ('operational','degraded','partial_outage','major_outage','maintenance')),
  ci_id UUID REFERENCES public.configuration_items(id),
  is_public BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.status_page_components ENABLE ROW LEVEL SECURITY;
CREATE POLICY "SPC public read" ON public.status_page_components FOR SELECT TO anon, authenticated
  USING (is_public = true);
CREATE POLICY "SPC org read" ON public.status_page_components FOR SELECT TO authenticated
  USING (public.has_org_access(auth.uid(), organization_id, 'viewer'));
CREATE POLICY "SPC insert" ON public.status_page_components FOR INSERT TO authenticated
  WITH CHECK (public.has_org_access(auth.uid(), organization_id, 'editor'));
CREATE POLICY "SPC update" ON public.status_page_components FOR UPDATE TO authenticated
  USING (public.has_org_access(auth.uid(), organization_id, 'editor'));
CREATE POLICY "SPC delete" ON public.status_page_components FOR DELETE TO authenticated
  USING (public.has_org_access(auth.uid(), organization_id, 'admin'));
CREATE TRIGGER trg_status_components_updated_at BEFORE UPDATE ON public.status_page_components
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===== STATUS PAGE INCIDENTS =====
CREATE TABLE public.status_page_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  major_incident_id UUID REFERENCES public.major_incidents(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'investigating' CHECK (status IN ('investigating','identified','monitoring','resolved')),
  impact TEXT NOT NULL DEFAULT 'minor' CHECK (impact IN ('none','minor','major','critical')),
  affected_component_ids UUID[] DEFAULT '{}',
  is_published BOOLEAN NOT NULL DEFAULT true,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.status_page_incidents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "SPI public read" ON public.status_page_incidents FOR SELECT TO anon, authenticated
  USING (is_published = true);
CREATE POLICY "SPI org read" ON public.status_page_incidents FOR SELECT TO authenticated
  USING (public.has_org_access(auth.uid(), organization_id, 'viewer'));
CREATE POLICY "SPI insert" ON public.status_page_incidents FOR INSERT TO authenticated
  WITH CHECK (public.has_org_access(auth.uid(), organization_id, 'editor'));
CREATE POLICY "SPI update" ON public.status_page_incidents FOR UPDATE TO authenticated
  USING (public.has_org_access(auth.uid(), organization_id, 'editor'));
CREATE POLICY "SPI delete" ON public.status_page_incidents FOR DELETE TO authenticated
  USING (public.has_org_access(auth.uid(), organization_id, 'admin'));
CREATE TRIGGER trg_status_incidents_updated_at BEFORE UPDATE ON public.status_page_incidents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===== STATUS PAGE INCIDENT UPDATES =====
CREATE TABLE public.status_page_incident_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status_incident_id UUID NOT NULL REFERENCES public.status_page_incidents(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('investigating','identified','monitoring','resolved')),
  message TEXT NOT NULL,
  posted_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.status_page_incident_updates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "SPIU public read" ON public.status_page_incident_updates FOR SELECT TO anon, authenticated
  USING (status_incident_id IN (SELECT id FROM public.status_page_incidents WHERE is_published = true));
CREATE POLICY "SPIU org read" ON public.status_page_incident_updates FOR SELECT TO authenticated
  USING (public.has_org_access(auth.uid(), organization_id, 'viewer'));
CREATE POLICY "SPIU insert" ON public.status_page_incident_updates FOR INSERT TO authenticated
  WITH CHECK (public.has_org_access(auth.uid(), organization_id, 'editor'));
CREATE POLICY "SPIU delete" ON public.status_page_incident_updates FOR DELETE TO authenticated
  USING (public.has_org_access(auth.uid(), organization_id, 'editor'));

-- ===== STATUS PAGE SUBSCRIBERS =====
CREATE TABLE public.status_page_subscribers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  confirmed_at TIMESTAMPTZ,
  unsubscribe_token UUID NOT NULL DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, email)
);
ALTER TABLE public.status_page_subscribers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "SPS public subscribe" ON public.status_page_subscribers FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "SPS org read" ON public.status_page_subscribers FOR SELECT TO authenticated
  USING (public.has_org_access(auth.uid(), organization_id, 'viewer'));
CREATE POLICY "SPS org delete" ON public.status_page_subscribers FOR DELETE TO authenticated
  USING (public.has_org_access(auth.uid(), organization_id, 'editor'));

CREATE INDEX idx_major_incidents_org_status ON public.major_incidents(organization_id, status);
CREATE INDEX idx_mi_updates_incident ON public.major_incident_updates(major_incident_id, created_at DESC);
CREATE INDEX idx_mi_tickets_incident ON public.major_incident_tickets(major_incident_id);
CREATE INDEX idx_status_components_org ON public.status_page_components(organization_id, display_order);
CREATE INDEX idx_status_incidents_org ON public.status_page_incidents(organization_id, started_at DESC);
CREATE INDEX idx_status_incident_updates ON public.status_page_incident_updates(status_incident_id, created_at DESC);
