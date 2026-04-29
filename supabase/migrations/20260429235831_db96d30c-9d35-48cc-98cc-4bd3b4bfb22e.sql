-- =========================================================
-- 1) Revoke EXECUTE from anon on internal SECURITY DEFINER functions.
--    Keep anon access ONLY on functions that legitimately serve public/token flows.
-- =========================================================

-- Public-flow functions that MUST remain callable by anon:
--   accept_invitation, get_invitation_by_token,
--   get_csat_by_token, submit_csat_response_by_token,
--   get_org_sso_config_by_domain, get_deployment_mode,
--   kb_increment_view
-- Everything else below is internal and should not be anon-executable.

REVOKE EXECUTE ON FUNCTION public.apply_addon_feature_overrides(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.apply_helpdesk_sla() FROM anon;
REVOKE EXECUTE ON FUNCTION public.archive_organization(uuid, boolean) FROM anon;
REVOKE EXECUTE ON FUNCTION public.can_user_log_time_on_task(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.check_plan_limit(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.check_residency_policy(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.ci_blast_radius(uuid, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.compute_compliance_score(text, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.consume_ai_credits(uuid, integer, text, text, uuid, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_org_for_new_user(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.cron_flush_siem_exporters() FROM anon;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM anon;
REVOKE EXECUTE ON FUNCTION public.delete_organization_cascade(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.generate_reference_number(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_ai_credit_status(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_effective_ai_provider(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_effective_retention_days(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_license_entitlements(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_org_admin_emails(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_org_credit_purchase_history(uuid, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_org_feature_value(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_org_limit(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_request_approval_state(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_user_role(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.grant_ai_credits(uuid, integer, text, integer, text, text, text, text, uuid, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_active_license(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_feature(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_module_permission(uuid, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_org_access(uuid, uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_paid_plan(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_product_access(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_programme_access(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_project_access(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_stakeholder_access(uuid, text, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.helpdesk_evaluate_approvals(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.helpdesk_instantiate_approval_chain(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.helpdesk_sla_sweep_breaches() FROM anon;
REVOKE EXECUTE ON FUNCTION public.helpdesk_spawn_next_catalog_task(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_helpdesk_admin(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_org_admin(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_org_admin_of(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_org_manager_of(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_org_member(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_org_suspended(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.log_audit_event(text, text, uuid, uuid, text, uuid, text, jsonb, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.mark_helpdesk_sla_breaches() FROM anon;
REVOKE EXECUTE ON FUNCTION public.mark_summaries_stale_for_scope(text, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.match_kb_chunks(uuid, extensions.vector, double precision, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.purge_expired_audit_logs() FROM anon;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.resolve_scim_groups_to_access_level(uuid, text[]) FROM anon;
REVOKE EXECUTE ON FUNCTION public.set_license_status(uuid, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.set_org_member_disabled(uuid, uuid, boolean, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.set_organization_suspension(uuid, boolean, text, text) FROM anon;

-- =========================================================
-- 2) Lock down the public 'logos' bucket: disable listing/enumeration
--    while preserving authenticated read. Anonymous fetches now require signed URLs.
-- =========================================================

UPDATE storage.buckets SET public = false WHERE id = 'logos';

DROP POLICY IF EXISTS "Anyone can view logos" ON storage.objects;

CREATE POLICY "Authenticated users can read logos"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'logos');
