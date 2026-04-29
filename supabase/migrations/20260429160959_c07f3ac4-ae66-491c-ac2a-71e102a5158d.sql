REVOKE EXECUTE ON FUNCTION public.helpdesk_instantiate_approval_chain(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.helpdesk_evaluate_approvals(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.helpdesk_auto_trigger_approval_chain() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.helpdesk_instantiate_approval_chain(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.helpdesk_evaluate_approvals(uuid) TO authenticated;