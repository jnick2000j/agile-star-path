
-- =========================================================================
-- HELPDESK TICKETS — augment existing policies with module-permission checks
-- =========================================================================
DROP POLICY IF EXISTS "Editors and assignees can view tickets" ON public.helpdesk_tickets;
CREATE POLICY "Editors and assignees can view tickets"
ON public.helpdesk_tickets FOR SELECT
USING (
  has_org_access(auth.uid(), organization_id, 'editor')
  OR is_admin(auth.uid())
  OR reporter_user_id = auth.uid()
  OR assignee_id = auth.uid()
  OR has_org_module_permission(auth.uid(), organization_id, 'helpdesk_tickets', 'view')
);

DROP POLICY IF EXISTS "Org members can create tickets" ON public.helpdesk_tickets;
CREATE POLICY "Org members can create tickets"
ON public.helpdesk_tickets FOR INSERT
WITH CHECK (
  has_org_access(auth.uid(), organization_id, 'viewer')
  OR is_admin(auth.uid())
  OR has_org_module_permission(auth.uid(), organization_id, 'helpdesk_tickets', 'create')
);

DROP POLICY IF EXISTS "Editors can update tickets" ON public.helpdesk_tickets;
CREATE POLICY "Editors can update tickets"
ON public.helpdesk_tickets FOR UPDATE
USING (
  has_org_access(auth.uid(), organization_id, 'editor')
  OR is_admin(auth.uid())
  OR (reporter_user_id = auth.uid() AND status <> ALL (ARRAY['closed'::helpdesk_ticket_status, 'cancelled'::helpdesk_ticket_status]))
  OR has_org_module_permission(auth.uid(), organization_id, 'helpdesk_tickets', 'edit')
);

DROP POLICY IF EXISTS "Admins can delete tickets" ON public.helpdesk_tickets;
CREATE POLICY "Admins can delete tickets"
ON public.helpdesk_tickets FOR DELETE
USING (
  has_org_access(auth.uid(), organization_id, 'admin')
  OR is_admin(auth.uid())
  OR has_org_module_permission(auth.uid(), organization_id, 'helpdesk_tickets', 'delete')
);

-- =========================================================================
-- CHANGE REQUESTS — augment with change_workflows + change_cab perms
-- =========================================================================
DROP POLICY IF EXISTS "Users can view org change requests" ON public.change_requests;
CREATE POLICY "Users can view org change requests"
ON public.change_requests FOR SELECT
USING (
  has_org_access(auth.uid(), organization_id)
  OR auth.uid() = raised_by
  OR auth.uid() = owner_id
  OR auth.uid() = created_by
  OR is_admin(auth.uid())
  OR has_org_module_permission(auth.uid(), organization_id, 'change_workflows', 'view')
  OR has_org_module_permission(auth.uid(), organization_id, 'change_cab', 'view')
);

DROP POLICY IF EXISTS "Users can create change requests" ON public.change_requests;
CREATE POLICY "Users can create change requests"
ON public.change_requests FOR INSERT
WITH CHECK (
  auth.uid() = created_by
  AND (
    has_org_access(auth.uid(), organization_id)
    OR is_admin(auth.uid())
    OR has_org_module_permission(auth.uid(), organization_id, 'change_workflows', 'create')
  )
);

DROP POLICY IF EXISTS "Owners can update change requests" ON public.change_requests;
CREATE POLICY "Owners can update change requests"
ON public.change_requests FOR UPDATE
USING (
  auth.uid() = owner_id
  OR auth.uid() = raised_by
  OR auth.uid() = created_by
  OR is_admin(auth.uid())
  OR has_org_module_permission(auth.uid(), organization_id, 'change_workflows', 'edit')
);

DROP POLICY IF EXISTS "Admins can delete change requests" ON public.change_requests;
CREATE POLICY "Admins can delete change requests"
ON public.change_requests FOR DELETE
USING (
  is_admin(auth.uid())
  OR has_org_access(auth.uid(), organization_id, 'admin')
  OR has_org_module_permission(auth.uid(), organization_id, 'change_workflows', 'delete')
);

-- =========================================================================
-- CONFIGURATION ITEMS (CMDB) — augment with cmdb_browse / cmdb_config perms
-- =========================================================================
DROP POLICY IF EXISTS "Org members view CIs" ON public.configuration_items;
CREATE POLICY "Org members view CIs"
ON public.configuration_items FOR SELECT
USING (
  has_org_access(auth.uid(), organization_id, 'viewer')
  OR is_admin(auth.uid())
  OR has_org_module_permission(auth.uid(), organization_id, 'cmdb_browse', 'view')
  OR has_org_module_permission(auth.uid(), organization_id, 'cmdb_config', 'view')
);

DROP POLICY IF EXISTS "Org editors create CIs" ON public.configuration_items;
CREATE POLICY "Org editors create CIs"
ON public.configuration_items FOR INSERT
WITH CHECK (
  has_org_access(auth.uid(), organization_id, 'editor')
  OR is_admin(auth.uid())
  OR has_org_module_permission(auth.uid(), organization_id, 'cmdb_config', 'create')
);

DROP POLICY IF EXISTS "Org editors update CIs" ON public.configuration_items;
CREATE POLICY "Org editors update CIs"
ON public.configuration_items FOR UPDATE
USING (
  has_org_access(auth.uid(), organization_id, 'editor')
  OR is_admin(auth.uid())
  OR has_org_module_permission(auth.uid(), organization_id, 'cmdb_config', 'edit')
);

DROP POLICY IF EXISTS "Org admins delete CIs" ON public.configuration_items;
CREATE POLICY "Org admins delete CIs"
ON public.configuration_items FOR DELETE
USING (
  has_org_access(auth.uid(), organization_id, 'admin')
  OR is_admin(auth.uid())
  OR has_org_module_permission(auth.uid(), organization_id, 'cmdb_config', 'delete')
);
