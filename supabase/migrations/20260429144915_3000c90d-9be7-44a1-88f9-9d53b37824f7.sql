-- =========================================================
-- Phase 1: CMDB (Configuration Management Database)
-- =========================================================

CREATE TABLE public.cmdb_ci_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  label text NOT NULL,
  description text,
  icon text NOT NULL DEFAULT 'Box',
  color text NOT NULL DEFAULT '#64748b',
  category text NOT NULL DEFAULT 'infrastructure',
  default_attributes jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_system boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cmdb_ci_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read CI types"
  ON public.cmdb_ci_types FOR SELECT TO authenticated USING (true);

CREATE POLICY "Platform admins manage CI types"
  ON public.cmdb_ci_types FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE TRIGGER cmdb_ci_types_updated_at
  BEFORE UPDATE ON public.cmdb_ci_types
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.cmdb_ci_types (key, label, description, icon, color, category, is_system, sort_order) VALUES
  ('business_service',   'Business Service',   'A customer-facing service (e.g. Online Banking)',     'Briefcase',    '#3b82f6', 'service',        true, 10),
  ('application',        'Application',        'A deployed software application',                     'AppWindow',    '#8b5cf6', 'software',       true, 20),
  ('database',           'Database',           'Database instance or cluster',                        'Database',     '#06b6d4', 'software',       true, 30),
  ('server',             'Server',             'Physical or virtual server',                          'Server',       '#10b981', 'infrastructure', true, 40),
  ('cloud_resource',     'Cloud Resource',     'IaaS/PaaS resource (VM, bucket, function)',           'Cloud',        '#0ea5e9', 'infrastructure', true, 50),
  ('saas',               'SaaS Subscription',  'Third-party SaaS service the org depends on',         'Globe',        '#f59e0b', 'software',       true, 60),
  ('network_device',     'Network Device',     'Router, switch, firewall, load balancer',             'Network',      '#ef4444', 'infrastructure', true, 70),
  ('endpoint',           'Endpoint',           'Laptop, desktop, mobile device',                      'Laptop',       '#84cc16', 'endpoint',       true, 80),
  ('storage',            'Storage',            'Storage system or volume',                            'HardDrive',    '#a855f7', 'infrastructure', true, 90),
  ('integration',        'Integration',        'API integration or middleware connection',           'Plug',         '#f97316', 'software',       true, 100),
  ('license',            'License',            'Software license entitlement',                        'KeyRound',     '#eab308', 'license',        true, 110),
  ('document',           'Documentation',      'Runbook, diagram, configuration document',           'FileText',     '#6b7280', 'documentation',  true, 120);

CREATE TABLE public.configuration_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  reference_number text,
  name text NOT NULL,
  description text,
  ci_type_id uuid NOT NULL REFERENCES public.cmdb_ci_types(id),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('planned','active','in_maintenance','degraded','retired','disposed')),
  lifecycle_state text NOT NULL DEFAULT 'operational' CHECK (lifecycle_state IN ('design','build','test','operational','decommissioning','decommissioned')),
  environment text CHECK (environment IN ('production','staging','dev','test','dr','sandbox')),
  criticality text NOT NULL DEFAULT 'medium' CHECK (criticality IN ('low','medium','high','critical')),
  owner_user_id uuid,
  owner_team text,
  vendor text,
  location text,
  cost_center text,
  business_service text,
  is_public_facing boolean NOT NULL DEFAULT false,
  attributes jsonb NOT NULL DEFAULT '{}'::jsonb,
  tags text[] NOT NULL DEFAULT '{}',
  external_id text,
  external_source text,
  programme_id uuid,
  project_id uuid,
  product_id uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  retired_at timestamptz
);

CREATE INDEX idx_ci_org ON public.configuration_items(organization_id);
CREATE INDEX idx_ci_type ON public.configuration_items(ci_type_id);
CREATE INDEX idx_ci_status ON public.configuration_items(status);
CREATE INDEX idx_ci_environment ON public.configuration_items(environment);
CREATE INDEX idx_ci_criticality ON public.configuration_items(criticality);
CREATE INDEX idx_ci_owner ON public.configuration_items(owner_user_id);
CREATE INDEX idx_ci_tags ON public.configuration_items USING GIN(tags);
CREATE INDEX idx_ci_attributes ON public.configuration_items USING GIN(attributes);

ALTER TABLE public.configuration_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members view CIs"
  ON public.configuration_items FOR SELECT TO authenticated
  USING (public.has_org_access(auth.uid(), organization_id, 'viewer'));

CREATE POLICY "Org editors create CIs"
  ON public.configuration_items FOR INSERT TO authenticated
  WITH CHECK (public.has_org_access(auth.uid(), organization_id, 'editor'));

CREATE POLICY "Org editors update CIs"
  ON public.configuration_items FOR UPDATE TO authenticated
  USING (public.has_org_access(auth.uid(), organization_id, 'editor'))
  WITH CHECK (public.has_org_access(auth.uid(), organization_id, 'editor'));

CREATE POLICY "Org admins delete CIs"
  ON public.configuration_items FOR DELETE TO authenticated
  USING (public.has_org_access(auth.uid(), organization_id, 'admin'));

CREATE TRIGGER configuration_items_updated_at
  BEFORE UPDATE ON public.configuration_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER configuration_items_set_ref
  BEFORE INSERT ON public.configuration_items
  FOR EACH ROW EXECUTE FUNCTION public.set_reference_number('configuration_item');

CREATE OR REPLACE FUNCTION public.generate_reference_number(_organization_id uuid, _entity_type text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _prefix TEXT;
  _year INT := EXTRACT(YEAR FROM now())::INT;
  _seq INT;
BEGIN
  IF _organization_id IS NULL THEN
    RETURN NULL;
  END IF;

  _prefix := CASE _entity_type
    WHEN 'project'      THEN 'PRJ'
    WHEN 'product'      THEN 'PRD'
    WHEN 'task'         THEN 'TSK'
    WHEN 'programme'    THEN 'PGM'
    WHEN 'stage_gate'   THEN 'SG'
    WHEN 'milestone'    THEN 'MIL'
    WHEN 'risk'         THEN 'RSK'
    WHEN 'issue'        THEN 'ISS'
    WHEN 'benefit'      THEN 'BEN'
    WHEN 'lesson'       THEN 'LSN'
    WHEN 'feature'      THEN 'FEA'
    WHEN 'business_requirement'  THEN 'BR'
    WHEN 'technical_requirement' THEN 'TR'
    WHEN 'change_request'        THEN 'CR'
    WHEN 'exception'             THEN 'EXC'
    WHEN 'timesheet'             THEN 'TS'
    WHEN 'helpdesk_ticket'       THEN 'HD'
    WHEN 'cm_request'            THEN 'CM'
    WHEN 'configuration_item'    THEN 'CI'
    WHEN 'service_catalog_item'  THEN 'SVC'
    WHEN 'problem'               THEN 'PRB'
    WHEN 'major_incident'        THEN 'MI'
    ELSE upper(substring(_entity_type, 1, 3))
  END;

  INSERT INTO reference_sequences (organization_id, entity_type, year, next_value)
  VALUES (_organization_id, _entity_type, _year, 2)
  ON CONFLICT (organization_id, entity_type, year)
  DO UPDATE SET next_value = reference_sequences.next_value + 1,
                updated_at = now()
  RETURNING next_value - 1 INTO _seq;

  RETURN _prefix || '-' || _year::TEXT || '-' || lpad(_seq::TEXT, 4, '0');
END;
$function$;

CREATE TABLE public.ci_relationships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  source_ci_id uuid NOT NULL REFERENCES public.configuration_items(id) ON DELETE CASCADE,
  target_ci_id uuid NOT NULL REFERENCES public.configuration_items(id) ON DELETE CASCADE,
  relationship_type text NOT NULL CHECK (relationship_type IN (
    'depends_on','runs_on','hosts','owned_by','member_of',
    'communicates_with','replaces','backs_up','connects_to','uses'
  )),
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ci_relationships_no_self CHECK (source_ci_id <> target_ci_id),
  CONSTRAINT ci_relationships_unique UNIQUE (source_ci_id, target_ci_id, relationship_type)
);

CREATE INDEX idx_ci_rel_source ON public.ci_relationships(source_ci_id);
CREATE INDEX idx_ci_rel_target ON public.ci_relationships(target_ci_id);
CREATE INDEX idx_ci_rel_org ON public.ci_relationships(organization_id);

ALTER TABLE public.ci_relationships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members view CI relationships"
  ON public.ci_relationships FOR SELECT TO authenticated
  USING (public.has_org_access(auth.uid(), organization_id, 'viewer'));

CREATE POLICY "Org editors insert CI relationships"
  ON public.ci_relationships FOR INSERT TO authenticated
  WITH CHECK (public.has_org_access(auth.uid(), organization_id, 'editor'));

CREATE POLICY "Org editors update CI relationships"
  ON public.ci_relationships FOR UPDATE TO authenticated
  USING (public.has_org_access(auth.uid(), organization_id, 'editor'))
  WITH CHECK (public.has_org_access(auth.uid(), organization_id, 'editor'));

CREATE POLICY "Org editors delete CI relationships"
  ON public.ci_relationships FOR DELETE TO authenticated
  USING (public.has_org_access(auth.uid(), organization_id, 'editor'));

CREATE TRIGGER ci_relationships_updated_at
  BEFORE UPDATE ON public.ci_relationships
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.ci_ticket_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  ci_id uuid NOT NULL REFERENCES public.configuration_items(id) ON DELETE CASCADE,
  ticket_id uuid NOT NULL REFERENCES public.helpdesk_tickets(id) ON DELETE CASCADE,
  link_type text NOT NULL DEFAULT 'affected' CHECK (link_type IN ('affected','related','root_cause','impacted_downstream')),
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ci_ticket_links_unique UNIQUE (ci_id, ticket_id, link_type)
);

CREATE INDEX idx_ci_ticket_links_ci ON public.ci_ticket_links(ci_id);
CREATE INDEX idx_ci_ticket_links_ticket ON public.ci_ticket_links(ticket_id);
CREATE INDEX idx_ci_ticket_links_org ON public.ci_ticket_links(organization_id);

ALTER TABLE public.ci_ticket_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members view CI-ticket links"
  ON public.ci_ticket_links FOR SELECT TO authenticated
  USING (public.has_org_access(auth.uid(), organization_id, 'viewer'));

CREATE POLICY "Org editors create CI-ticket links"
  ON public.ci_ticket_links FOR INSERT TO authenticated
  WITH CHECK (public.has_org_access(auth.uid(), organization_id, 'editor'));

CREATE POLICY "Org editors delete CI-ticket links"
  ON public.ci_ticket_links FOR DELETE TO authenticated
  USING (public.has_org_access(auth.uid(), organization_id, 'editor'));

CREATE OR REPLACE FUNCTION public.ci_blast_radius(_ci_id uuid, _max_depth integer DEFAULT 5)
RETURNS TABLE(
  ci_id uuid,
  name text,
  reference_number text,
  ci_type_id uuid,
  ci_type_label text,
  status text,
  criticality text,
  environment text,
  depth integer,
  shortest_path uuid[],
  open_incident_count integer
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH RECURSIVE downstream AS (
    SELECT
      r.source_ci_id AS ci_id,
      1 AS depth,
      ARRAY[_ci_id, r.source_ci_id] AS path
    FROM public.ci_relationships r
    WHERE r.target_ci_id = _ci_id
      AND r.relationship_type IN ('depends_on','runs_on','uses','connects_to')
      AND public.has_org_access(auth.uid(), r.organization_id, 'viewer')

    UNION

    SELECT
      r.source_ci_id,
      d.depth + 1,
      d.path || r.source_ci_id
    FROM public.ci_relationships r
    JOIN downstream d ON r.target_ci_id = d.ci_id
    WHERE d.depth < _max_depth
      AND NOT (r.source_ci_id = ANY(d.path))
      AND r.relationship_type IN ('depends_on','runs_on','uses','connects_to')
      AND public.has_org_access(auth.uid(), r.organization_id, 'viewer')
  ),
  ranked AS (
    SELECT DISTINCT ON (d.ci_id) d.ci_id, d.depth, d.path
    FROM downstream d
    ORDER BY d.ci_id, d.depth ASC
  )
  SELECT
    ci.id AS ci_id,
    ci.name,
    ci.reference_number,
    ci.ci_type_id,
    t.label AS ci_type_label,
    ci.status,
    ci.criticality,
    ci.environment,
    rk.depth::integer,
    rk.path AS shortest_path,
    COALESCE((
      SELECT COUNT(*)::integer
      FROM public.ci_ticket_links ctl
      JOIN public.helpdesk_tickets ht ON ht.id = ctl.ticket_id
      WHERE ctl.ci_id = ci.id
        AND ht.status NOT IN ('resolved','closed','cancelled')
    ), 0) AS open_incident_count
  FROM ranked rk
  JOIN public.configuration_items ci ON ci.id = rk.ci_id
  JOIN public.cmdb_ci_types t ON t.id = ci.ci_type_id
  ORDER BY rk.depth, ci.name;
$$;

CREATE OR REPLACE VIEW public.cmdb_ci_health AS
SELECT
  ci.id,
  ci.organization_id,
  ci.name,
  ci.reference_number,
  ci.status,
  ci.criticality,
  ci.environment,
  ci.is_public_facing,
  COALESCE(open.cnt, 0) AS open_ticket_count,
  COALESCE(critical.cnt, 0) AS critical_ticket_count,
  CASE
    WHEN ci.status IN ('retired','disposed') THEN 'retired'
    WHEN ci.status = 'in_maintenance' THEN 'maintenance'
    WHEN COALESCE(critical.cnt, 0) > 0 THEN 'major_outage'
    WHEN COALESCE(open.cnt, 0) >= 3 THEN 'degraded'
    WHEN COALESCE(open.cnt, 0) > 0 THEN 'partial_outage'
    ELSE 'operational'
  END AS health_state
FROM public.configuration_items ci
LEFT JOIN LATERAL (
  SELECT COUNT(*)::int AS cnt
  FROM public.ci_ticket_links ctl
  JOIN public.helpdesk_tickets ht ON ht.id = ctl.ticket_id
  WHERE ctl.ci_id = ci.id
    AND ht.status NOT IN ('resolved','closed','cancelled')
) open ON true
LEFT JOIN LATERAL (
  SELECT COUNT(*)::int AS cnt
  FROM public.ci_ticket_links ctl
  JOIN public.helpdesk_tickets ht ON ht.id = ctl.ticket_id
  WHERE ctl.ci_id = ci.id
    AND ht.status NOT IN ('resolved','closed','cancelled')
    AND ht.priority::text IN ('urgent','high')
) critical ON true;

GRANT SELECT ON public.cmdb_ci_health TO authenticated;