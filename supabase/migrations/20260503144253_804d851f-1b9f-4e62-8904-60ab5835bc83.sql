CREATE OR REPLACE FUNCTION public.increment_directory_ticket_count(_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.migration_contact_directory
  SET ticket_count = ticket_count + 1,
      last_seen_at = now()
  WHERE id = _id;
$$;

REVOKE EXECUTE ON FUNCTION public.increment_directory_ticket_count(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.increment_directory_ticket_count(uuid) TO authenticated, service_role;