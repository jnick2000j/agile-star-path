
ALTER FUNCTION public._audit_redact(jsonb) SET search_path = public;
ALTER FUNCTION public._audit_diff(jsonb, jsonb) SET search_path = public;
ALTER FUNCTION public._attach_platform_audit(text, text) SET search_path = public;

REVOKE EXECUTE ON FUNCTION public._audit_redact(jsonb) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._audit_diff(jsonb, jsonb) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._attach_platform_audit(text, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.audit_platform_change() FROM anon, authenticated;
