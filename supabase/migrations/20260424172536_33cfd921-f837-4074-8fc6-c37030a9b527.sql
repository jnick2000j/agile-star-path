
-- Archive support
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_organizations_archived
  ON public.organizations(is_archived) WHERE is_archived = true;

-- Helper: is the caller an admin of the given org?
CREATE OR REPLACE FUNCTION public.is_org_admin(_user_id uuid, _org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_organization_access
    WHERE user_id = _user_id
      AND organization_id = _org_id
      AND access_level = 'admin'
  );
$$;

-- Archive RPC (org admin OR platform admin)
CREATE OR REPLACE FUNCTION public.archive_organization(_org_id uuid, _archive boolean DEFAULT true)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.is_admin(auth.uid()) OR public.is_org_admin(auth.uid(), _org_id)) THEN
    RAISE EXCEPTION 'not authorized to archive this organization';
  END IF;

  IF _archive THEN
    UPDATE public.organizations
       SET is_archived = true,
           archived_at = now(),
           archived_by = auth.uid()
     WHERE id = _org_id;
  ELSE
    UPDATE public.organizations
       SET is_archived = false,
           archived_at = NULL,
           archived_by = NULL
     WHERE id = _org_id;
  END IF;
END;
$$;

-- Delete RPC (platform admin only) — cascades via existing FKs
CREATE OR REPLACE FUNCTION public.delete_organization_cascade(_org_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'only platform admins can delete an organization';
  END IF;

  DELETE FROM public.organizations WHERE id = _org_id;
END;
$$;

REVOKE ALL ON FUNCTION public.archive_organization(uuid, boolean) FROM public;
GRANT EXECUTE ON FUNCTION public.archive_organization(uuid, boolean) TO authenticated;

REVOKE ALL ON FUNCTION public.delete_organization_cascade(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.delete_organization_cascade(uuid) TO authenticated;
