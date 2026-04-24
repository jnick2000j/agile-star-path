
-- =====================================================================
-- 1. SLA PAUSE / RESUME ON STATUS TRANSITIONS
-- =====================================================================

CREATE OR REPLACE FUNCTION public.helpdesk_sla_pause_resume()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _was_paused boolean;
  _now timestamptz := now();
  _delta_seconds integer;
BEGIN
  IF TG_OP = 'INSERT' THEN
    RETURN NEW;
  END IF;

  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  _was_paused := OLD.sla_paused_at IS NOT NULL;

  IF NEW.status IN ('pending','on_hold') AND NOT _was_paused THEN
    NEW.sla_paused_at := _now;
    INSERT INTO public.helpdesk_ticket_activity (ticket_id, organization_id, actor_user_id, event_type, from_value, to_value)
    VALUES (NEW.id, NEW.organization_id, auth.uid(), 'sla_paused',
            jsonb_build_object('status', OLD.status),
            jsonb_build_object('status', NEW.status, 'paused_at', _now));
  END IF;

  IF NEW.status NOT IN ('pending','on_hold') AND _was_paused THEN
    _delta_seconds := GREATEST(0, EXTRACT(EPOCH FROM (_now - OLD.sla_paused_at))::integer);
    NEW.sla_paused_seconds := COALESCE(OLD.sla_paused_seconds, 0) + _delta_seconds;
    NEW.sla_paused_at := NULL;

    IF NEW.sla_response_due_at IS NOT NULL AND NEW.first_response_at IS NULL THEN
      NEW.sla_response_due_at := NEW.sla_response_due_at + (_delta_seconds || ' seconds')::interval;
    END IF;
    IF NEW.sla_resolution_due_at IS NOT NULL AND NEW.resolved_at IS NULL THEN
      NEW.sla_resolution_due_at := NEW.sla_resolution_due_at + (_delta_seconds || ' seconds')::interval;
    END IF;

    INSERT INTO public.helpdesk_ticket_activity (ticket_id, organization_id, actor_user_id, event_type, from_value, to_value)
    VALUES (NEW.id, NEW.organization_id, auth.uid(), 'sla_resumed',
            jsonb_build_object('status', OLD.status, 'paused_seconds', _delta_seconds),
            jsonb_build_object('status', NEW.status,
                               'response_due_at', NEW.sla_response_due_at,
                               'resolution_due_at', NEW.sla_resolution_due_at));
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_helpdesk_sla_pause_resume ON public.helpdesk_tickets;
CREATE TRIGGER trg_helpdesk_sla_pause_resume
BEFORE UPDATE OF status ON public.helpdesk_tickets
FOR EACH ROW
EXECUTE FUNCTION public.helpdesk_sla_pause_resume();

DROP TRIGGER IF EXISTS trg_helpdesk_mark_breaches ON public.helpdesk_tickets;
CREATE TRIGGER trg_helpdesk_mark_breaches
BEFORE UPDATE ON public.helpdesk_tickets
FOR EACH ROW
EXECUTE FUNCTION public.mark_helpdesk_sla_breaches();

CREATE OR REPLACE FUNCTION public.helpdesk_sla_sweep_breaches()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _resp_count integer := 0;
  _resol_count integer := 0;
BEGIN
  WITH r AS (
    UPDATE public.helpdesk_tickets
       SET sla_response_breached = true
     WHERE sla_response_due_at IS NOT NULL
       AND first_response_at IS NULL
       AND sla_paused_at IS NULL
       AND sla_response_breached = false
       AND status NOT IN ('resolved','closed','cancelled')
       AND now() > sla_response_due_at
     RETURNING 1
  )
  SELECT count(*) INTO _resp_count FROM r;

  WITH r AS (
    UPDATE public.helpdesk_tickets
       SET sla_resolution_breached = true
     WHERE sla_resolution_due_at IS NOT NULL
       AND resolved_at IS NULL
       AND sla_paused_at IS NULL
       AND sla_resolution_breached = false
       AND status NOT IN ('resolved','closed','cancelled')
       AND now() > sla_resolution_due_at
     RETURNING 1
  )
  SELECT count(*) INTO _resol_count FROM r;

  RETURN _resp_count + _resol_count;
END;
$$;

-- =====================================================================
-- 2. HELPDESK CATALOG TABLES
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.helpdesk_catalog_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  key text NOT NULL,
  name text NOT NULL,
  description text,
  icon text,
  is_active boolean NOT NULL DEFAULT true,
  allow_multiple boolean NOT NULL DEFAULT true,
  required_for_types text[] NOT NULL DEFAULT '{}'::text[],
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  UNIQUE (organization_id, key)
);

CREATE TABLE IF NOT EXISTS public.helpdesk_catalog_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id uuid NOT NULL REFERENCES public.helpdesk_catalog_lists(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

CREATE INDEX IF NOT EXISTS idx_helpdesk_catalog_items_list ON public.helpdesk_catalog_items(list_id);
CREATE INDEX IF NOT EXISTS idx_helpdesk_catalog_items_org ON public.helpdesk_catalog_items(organization_id);

CREATE TABLE IF NOT EXISTS public.helpdesk_ticket_catalog_items (
  ticket_id uuid NOT NULL REFERENCES public.helpdesk_tickets(id) ON DELETE CASCADE,
  catalog_item_id uuid NOT NULL REFERENCES public.helpdesk_catalog_items(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  list_id uuid NOT NULL REFERENCES public.helpdesk_catalog_lists(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  PRIMARY KEY (ticket_id, catalog_item_id)
);

CREATE INDEX IF NOT EXISTS idx_hd_ticket_cat_items_ticket ON public.helpdesk_ticket_catalog_items(ticket_id);
CREATE INDEX IF NOT EXISTS idx_hd_ticket_cat_items_list ON public.helpdesk_ticket_catalog_items(list_id);

CREATE OR REPLACE FUNCTION public.helpdesk_catalog_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_helpdesk_catalog_lists_updated ON public.helpdesk_catalog_lists;
CREATE TRIGGER trg_helpdesk_catalog_lists_updated
BEFORE UPDATE ON public.helpdesk_catalog_lists
FOR EACH ROW EXECUTE FUNCTION public.helpdesk_catalog_touch_updated_at();

DROP TRIGGER IF EXISTS trg_helpdesk_catalog_items_updated ON public.helpdesk_catalog_items;
CREATE TRIGGER trg_helpdesk_catalog_items_updated
BEFORE UPDATE ON public.helpdesk_catalog_items
FOR EACH ROW EXECUTE FUNCTION public.helpdesk_catalog_touch_updated_at();

-- =====================================================================
-- 3. RLS
-- =====================================================================

ALTER TABLE public.helpdesk_catalog_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.helpdesk_catalog_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.helpdesk_ticket_catalog_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read catalog lists"
  ON public.helpdesk_catalog_lists FOR SELECT
  USING (public.has_org_access(auth.uid(), organization_id, 'viewer') OR public.is_admin(auth.uid()));

CREATE POLICY "admins manage catalog lists"
  ON public.helpdesk_catalog_lists FOR ALL
  USING (public.has_org_access(auth.uid(), organization_id, 'admin') OR public.is_admin(auth.uid()))
  WITH CHECK (public.has_org_access(auth.uid(), organization_id, 'admin') OR public.is_admin(auth.uid()));

CREATE POLICY "members read catalog items"
  ON public.helpdesk_catalog_items FOR SELECT
  USING (public.has_org_access(auth.uid(), organization_id, 'viewer') OR public.is_admin(auth.uid()));

CREATE POLICY "admins manage catalog items"
  ON public.helpdesk_catalog_items FOR ALL
  USING (public.has_org_access(auth.uid(), organization_id, 'admin') OR public.is_admin(auth.uid()))
  WITH CHECK (public.has_org_access(auth.uid(), organization_id, 'admin') OR public.is_admin(auth.uid()));

CREATE POLICY "members read ticket catalog links"
  ON public.helpdesk_ticket_catalog_items FOR SELECT
  USING (public.has_org_access(auth.uid(), organization_id, 'viewer') OR public.is_admin(auth.uid()));

CREATE POLICY "members manage ticket catalog links"
  ON public.helpdesk_ticket_catalog_items FOR ALL
  USING (public.has_org_access(auth.uid(), organization_id, 'editor') OR public.is_admin(auth.uid()))
  WITH CHECK (public.has_org_access(auth.uid(), organization_id, 'editor') OR public.is_admin(auth.uid()));

-- =====================================================================
-- 4. SEED STARTER LISTS FOR EXISTING ORGS
-- =====================================================================

INSERT INTO public.helpdesk_catalog_lists (organization_id, key, name, description, icon, sort_order)
SELECT o.id, v.key, v.name, v.description, v.icon, v.sort_order
FROM public.organizations o
CROSS JOIN (VALUES
  ('applications',   'Applications & Software', 'Business apps, SaaS tools and internal systems', 'AppWindow', 10),
  ('it_services',    'IT Services',             'Standardised services such as Email, VPN, Storage', 'Server', 20),
  ('it_teams',       'IT Service Teams',        'Internal teams that handle support — Network, Security, Desktop', 'Users', 30),
  ('hardware',       'Hardware & Devices',      'Laptops, peripherals, mobile devices and other physical assets', 'Laptop', 40)
) AS v(key, name, description, icon, sort_order)
ON CONFLICT (organization_id, key) DO NOTHING;
