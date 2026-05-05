REVOKE ALL ON FUNCTION public.ensure_org_admin_role_for_user(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_org_admin_role_from_access() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_access_tier_from_role() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_org_for_new_user(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_org_for_new_user(text) TO authenticated;