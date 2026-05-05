-- 1. profiles.user_type
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_type') THEN
    CREATE TYPE public.user_type AS ENUM ('staff', 'portal', 'system');
  END IF;
END$$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS user_type public.user_type NOT NULL DEFAULT 'staff';

CREATE INDEX IF NOT EXISTS idx_profiles_user_type ON public.profiles(user_type);

COMMENT ON COLUMN public.profiles.user_type IS
  'staff = internal team (counts toward seat licenses); portal = external customer-portal user (free); system = automation/service account.';

-- 2. user_organization_custom_roles
CREATE TABLE IF NOT EXISTS public.user_organization_custom_roles (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  custom_role_id  uuid NOT NULL REFERENCES public.custom_roles(id) ON DELETE CASCADE,
  granted_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  granted_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, organization_id, custom_role_id)
);

CREATE INDEX IF NOT EXISTS idx_uocr_user_org ON public.user_organization_custom_roles(user_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_uocr_role     ON public.user_organization_custom_roles(custom_role_id);

ALTER TABLE public.user_organization_custom_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own custom role assignments"
  ON public.user_organization_custom_roles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid())
         OR public.has_org_access(auth.uid(), organization_id, 'admin'));

CREATE POLICY "Org admins manage custom role assignments"
  ON public.user_organization_custom_roles FOR ALL
  TO authenticated
  USING (public.has_org_access(auth.uid(), organization_id, 'admin')
         OR public.is_admin(auth.uid()))
  WITH CHECK (public.has_org_access(auth.uid(), organization_id, 'admin')
              OR public.is_admin(auth.uid()));

-- 3. Permission modules
INSERT INTO public.permission_modules (module_key, label, category, description, sort_order) VALUES
  ('portal_tickets',          'Portal — My Tickets',        'Customer Portal',     'Submit and view tickets via the customer portal',                  500),
  ('portal_kb',               'Portal — Knowledge Base',    'Customer Portal',     'Browse public knowledge base articles',                            501),
  ('portal_catalog',          'Portal — Service Catalog',   'Customer Portal',     'Browse and request items from the service catalog',                502),
  ('portal_training',         'Portal — Training',          'Customer Portal',     'Access assigned training courses',                                 503),
  ('helpdesk_tickets',        'Helpdesk — Tickets',         'Helpdesk',            'Work helpdesk tickets in assigned queues',                         600),
  ('helpdesk_queues',         'Helpdesk — Queues',          'Helpdesk',            'Configure helpdesk queues, members and routing',                   601),
  ('helpdesk_macros',         'Helpdesk — Macros',          'Helpdesk',            'Create and manage reply macros',                                   602),
  ('helpdesk_workflows',      'Helpdesk — Workflows',       'Helpdesk',            'Configure automation, workflows and approval chains',              603),
  ('helpdesk_sla',            'Helpdesk — SLA Policies',    'Helpdesk',            'Manage SLA policies and escalation rules',                         604),
  ('helpdesk_intake',         'Helpdesk — Intake Channels', 'Helpdesk',            'Configure email, web and AI intake channels',                      605),
  ('helpdesk_reports',        'Helpdesk — Reports',         'Helpdesk',            'Run and schedule helpdesk reports',                                606),
  ('helpdesk_approvals',      'Helpdesk — Approvals',       'Helpdesk',            'Act as approver in helpdesk approval chains',                      607),
  ('major_incidents',         'Major Incidents',            'Helpdesk',            'Declare, command and communicate major incidents',                 608),
  ('change_requests',         'Change Requests',            'Change Management',   'Create and manage change requests (RFCs)',                         700),
  ('change_cab',              'Change Advisory Board',      'Change Management',   'Vote in CAB approval workflows',                                   701),
  ('change_workflows',        'Change Workflows',           'Change Management',   'Configure change workflows and approval chains',                   702),
  ('change_implementation',   'Change Implementation',      'Change Management',   'Execute approved changes and update implementation status',       703),
  ('cmdb_config',             'CMDB Configuration',         'Service Operations',  'Manage CI types, relationships and health rules',                  800),
  ('cmdb_browse',             'CMDB Browse',                'Service Operations',  'Browse CIs and dependency maps',                                   801),
  ('asset_register',          'Asset Register',             'Service Operations',  'Manage hardware/software assets and lifecycle',                    802),
  ('service_catalog',         'Service Catalog',            'Service Operations',  'Manage service catalog items and request flows',                   803),
  ('kb_authoring',            'Knowledge Base — Authoring', 'Knowledge & Learning','Draft and edit knowledge base articles',                           900),
  ('kb_publishing',           'Knowledge Base — Publish',   'Knowledge & Learning','Publish, retire and curate knowledge base articles',               901),
  ('lms_admin',               'LMS Administration',         'Knowledge & Learning','Manage catalog, curricula, certificates and compliance reports',  902),
  ('lms_authoring',           'LMS Course Authoring',       'Knowledge & Learning','Author and edit courses and quizzes',                              903),
  ('lms_learner',             'LMS Learner',                'Knowledge & Learning','Take assigned training courses',                                   904),
  ('audit_log',               'Audit Log',                  'Governance',          'View the audit log and status-history records',                    1000),
  ('security_center',         'Security Center',            'Governance',          'Manage MFA settings, sessions, SIEM exports',                      1001),
  ('sso_management',          'SSO & SCIM',                 'Governance',          'Configure SSO connections and SCIM provisioning',                  1002),
  ('billing_view',            'Billing — View',             'Governance',          'View subscription, plan utilization and AI-credit usage',          1003),
  ('integrations',            'Integrations',               'Governance',          'Manage API keys, webhooks, automations and external sync',         1004)
ON CONFLICT (module_key) DO NOTHING;

-- 4. System roles
INSERT INTO public.custom_roles (name, description, is_system, color, icon, can_view_reports) VALUES
  ('Customer Portal User',     'External end-customer. Submits tickets, browses public KB, takes assigned training. Cannot see internal data.', true, '#0ea5e9', 'UserRound',     false),
  ('Customer Portal Manager',  'Customer-side admin. Sees all tickets for their company, can approve their own company''s change requests.',     true, '#0284c7', 'UserRoundCog',  false),
  ('Helpdesk Admin',           'Configures queues, SLAs, macros, intake channels, workflows and reports for the helpdesk.',                    true, '#dc2626', 'Headphones',     true),
  ('Helpdesk Supervisor',      'Works tickets and oversees agents. Can reassign across queues, monitor workload and run reports.',             true, '#ea580c', 'Headset',        true),
  ('Helpdesk Agent',           'Works tickets in assigned queues — replies, transitions status, applies macros.',                              true, '#f97316', 'MessageSquare',  false),
  ('Helpdesk Approver',        'Appears in approval chains only — e.g. finance/legal sign-off on tickets or catalog items.',                   true, '#fb923c', 'CircleCheck',    false),
  ('Change Manager',           'Owns the CAB, schedules changes, has final approve/reject authority.',                                          true, '#7c3aed', 'Workflow',       true),
  ('CAB Member',               'Votes in Change Advisory Board approvals.',                                                                    true, '#8b5cf6', 'UsersRound',     false),
  ('Change Implementer',       'Assigned to execute approved changes; updates implementation status.',                                         true, '#a78bfa', 'Hammer',         false),
  ('Change Requester',         'Can raise change requests (RFCs); read-only on others''.',                                                     true, '#c4b5fd', 'PenLine',        false),
  ('CMDB Admin',               'Manages CI types, relationships and health rules in the CMDB.',                                                true, '#0d9488', 'Database',       true),
  ('Asset Manager',            'Manages the asset register — hardware/software lifecycle, retirement.',                                         true, '#14b8a6', 'Package',        true),
  ('Service Owner',            'Owns one or more services in the catalog; approves changes against their CIs.',                                 true, '#2dd4bf', 'ServerCog',      true),
  ('KB Author',                'Drafts and edits knowledge base articles.',                                                                     true, '#ca8a04', 'BookOpen',       false),
  ('KB Publisher',             'Publishes, retires and curates knowledge base articles.',                                                       true, '#eab308', 'BookCheck',      true),
  ('LMS Admin',                'Manages the learning catalog, curricula, certificates and compliance reports.',                                 true, '#65a30d', 'GraduationCap',  true),
  ('LMS Instructor',           'Authors and edits courses; grades quizzes.',                                                                    true, '#84cc16', 'BookMarked',     false),
  ('Auditor',                  'Read-only across the organization, including audit log and compliance reports. Never writes.',                  true, '#475569', 'Eye',            true),
  ('Security Officer',         'Manages MFA settings, SSO, SCIM and SIEM exports. Operates the Security Center.',                               true, '#ef4444', 'ShieldCheck',    true),
  ('Finance Viewer',           'Sees billing, AI-credit usage and plan utilization; no admin scope.',                                            true, '#10b981', 'Wallet',         true),
  ('Integration Developer',    'Manages API keys, webhooks, automations and external sync (Jira/Confluence/MCP).',                              true, '#6366f1', 'Plug',            true)
ON CONFLICT (name) DO NOTHING;

-- 5. Default module-permission grants
DO $$
DECLARE
  rid uuid;
  g record;
BEGIN
  FOR g IN
    SELECT * FROM (VALUES
      ('Customer Portal User',     'portal_tickets',        true,  true,  true,  false, false, false),
      ('Customer Portal User',     'portal_kb',             true,  false, false, false, false, false),
      ('Customer Portal User',     'portal_catalog',        true,  true,  false, false, false, false),
      ('Customer Portal User',     'portal_training',       true,  false, false, false, false, false),
      ('Customer Portal Manager',  'portal_tickets',        true,  true,  true,  false, true,  true),
      ('Customer Portal Manager',  'portal_kb',             true,  false, false, false, false, false),
      ('Customer Portal Manager',  'portal_catalog',        true,  true,  true,  false, true,  false),
      ('Customer Portal Manager',  'portal_training',       true,  false, false, false, false, false),
      ('Customer Portal Manager',  'change_requests',       true,  true,  false, false, true,  false),
      ('Helpdesk Admin',           'helpdesk_tickets',      true,  true,  true,  true,  true,  true),
      ('Helpdesk Admin',           'helpdesk_queues',       true,  true,  true,  true,  false, true),
      ('Helpdesk Admin',           'helpdesk_macros',       true,  true,  true,  true,  false, true),
      ('Helpdesk Admin',           'helpdesk_workflows',    true,  true,  true,  true,  true,  true),
      ('Helpdesk Admin',           'helpdesk_sla',          true,  true,  true,  true,  false, true),
      ('Helpdesk Admin',           'helpdesk_intake',       true,  true,  true,  true,  false, true),
      ('Helpdesk Admin',           'helpdesk_reports',      true,  true,  true,  true,  false, true),
      ('Helpdesk Admin',           'helpdesk_approvals',    true,  true,  true,  true,  true,  false),
      ('Helpdesk Admin',           'major_incidents',       true,  true,  true,  true,  true,  true),
      ('Helpdesk Admin',           'service_catalog',       true,  true,  true,  true,  false, true),
      ('Helpdesk Supervisor',      'helpdesk_tickets',      true,  true,  true,  false, true,  true),
      ('Helpdesk Supervisor',      'helpdesk_queues',       true,  false, true,  false, false, true),
      ('Helpdesk Supervisor',      'helpdesk_macros',       true,  true,  true,  false, false, false),
      ('Helpdesk Supervisor',      'helpdesk_reports',      true,  true,  true,  false, false, true),
      ('Helpdesk Supervisor',      'helpdesk_approvals',    true,  false, false, false, true,  false),
      ('Helpdesk Supervisor',      'major_incidents',       true,  true,  true,  false, true,  true),
      ('Helpdesk Agent',           'helpdesk_tickets',      true,  true,  true,  false, false, false),
      ('Helpdesk Agent',           'helpdesk_macros',       true,  false, false, false, false, false),
      ('Helpdesk Agent',           'kb_authoring',          true,  true,  true,  false, false, false),
      ('Helpdesk Approver',        'helpdesk_approvals',    true,  false, false, false, true,  false),
      ('Helpdesk Approver',        'helpdesk_tickets',      true,  false, false, false, false, false),
      ('Change Manager',           'change_requests',       true,  true,  true,  true,  true,  true),
      ('Change Manager',           'change_cab',            true,  false, false, false, true,  false),
      ('Change Manager',           'change_workflows',      true,  true,  true,  true,  true,  true),
      ('Change Manager',           'change_implementation', true,  true,  true,  false, true,  true),
      ('CAB Member',               'change_cab',            true,  false, false, false, true,  false),
      ('CAB Member',               'change_requests',       true,  false, false, false, false, false),
      ('Change Implementer',       'change_requests',       true,  false, true,  false, false, false),
      ('Change Implementer',       'change_implementation', true,  true,  true,  false, false, false),
      ('Change Requester',         'change_requests',       true,  true,  true,  false, false, false),
      ('CMDB Admin',               'cmdb_config',           true,  true,  true,  true,  false, true),
      ('CMDB Admin',               'cmdb_browse',           true,  true,  true,  true,  false, true),
      ('Asset Manager',            'asset_register',        true,  true,  true,  true,  false, true),
      ('Asset Manager',            'cmdb_browse',           true,  false, false, false, false, true),
      ('Service Owner',            'service_catalog',       true,  true,  true,  false, true,  true),
      ('Service Owner',            'cmdb_browse',           true,  false, false, false, false, false),
      ('Service Owner',            'change_cab',            true,  false, false, false, true,  false),
      ('KB Author',                'kb_authoring',          true,  true,  true,  false, false, false),
      ('KB Publisher',             'kb_authoring',          true,  true,  true,  true,  false, true),
      ('KB Publisher',             'kb_publishing',         true,  true,  true,  true,  true,  true),
      ('LMS Admin',                'lms_admin',             true,  true,  true,  true,  true,  true),
      ('LMS Admin',                'lms_authoring',         true,  true,  true,  true,  true,  true),
      ('LMS Admin',                'lms_learner',           true,  false, false, false, false, false),
      ('LMS Instructor',           'lms_authoring',         true,  true,  true,  false, false, false),
      ('LMS Instructor',           'lms_learner',           true,  false, false, false, false, false),
      ('Auditor',                  'audit_log',             true,  false, false, false, false, true),
      ('Auditor',                  'helpdesk_tickets',      true,  false, false, false, false, true),
      ('Auditor',                  'change_requests',       true,  false, false, false, false, true),
      ('Auditor',                  'cmdb_browse',           true,  false, false, false, false, true),
      ('Auditor',                  'asset_register',        true,  false, false, false, false, true),
      ('Auditor',                  'kb_publishing',         true,  false, false, false, false, true),
      ('Auditor',                  'lms_admin',             true,  false, false, false, false, true),
      ('Security Officer',         'security_center',       true,  true,  true,  true,  false, true),
      ('Security Officer',         'sso_management',        true,  true,  true,  true,  false, true),
      ('Security Officer',         'audit_log',             true,  false, false, false, false, true),
      ('Finance Viewer',           'billing_view',          true,  false, false, false, false, true),
      ('Integration Developer',    'integrations',          true,  true,  true,  true,  false, true)
    ) AS t(role_name, module_key, can_view, can_create, can_edit, can_delete, can_approve, can_export)
  LOOP
    SELECT id INTO rid FROM public.custom_roles WHERE name = g.role_name;
    IF rid IS NOT NULL THEN
      INSERT INTO public.role_module_permissions
        (role_id, module_key, can_view, can_create, can_edit, can_delete, can_approve, can_export)
      VALUES
        (rid, g.module_key, g.can_view, g.can_create, g.can_edit, g.can_delete, g.can_approve, g.can_export)
      ON CONFLICT (role_id, module_key) DO NOTHING;
    END IF;
  END LOOP;
END$$;

-- 6. has_org_module_permission helper (org-scoped)
CREATE OR REPLACE FUNCTION public.has_org_module_permission(
  _user_id     uuid,
  _org_id      uuid,
  _module_key  text,
  _action      text DEFAULT 'view'
)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_admin(_user_id)
      OR EXISTS (
           SELECT 1
             FROM public.user_organization_custom_roles uocr
             JOIN public.role_module_permissions rmp ON rmp.role_id = uocr.custom_role_id
            WHERE uocr.user_id = _user_id
              AND uocr.organization_id = _org_id
              AND rmp.module_key = _module_key
              AND CASE _action
                    WHEN 'view'    THEN rmp.can_view
                    WHEN 'create'  THEN rmp.can_create
                    WHEN 'edit'    THEN rmp.can_edit
                    WHEN 'delete'  THEN rmp.can_delete
                    WHEN 'approve' THEN rmp.can_approve
                    WHEN 'export'  THEN rmp.can_export
                    ELSE false
                  END
         );
$$;

COMMENT ON FUNCTION public.has_org_module_permission IS
  'Org-scoped permission check via assigned custom roles. Platform admins always pass. Use this for new RLS policies and feature gating.';

REVOKE EXECUTE ON FUNCTION public.has_org_module_permission(uuid, uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_org_module_permission(uuid, uuid, text, text) TO authenticated, service_role;