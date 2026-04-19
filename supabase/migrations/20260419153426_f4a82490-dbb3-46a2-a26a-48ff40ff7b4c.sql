CREATE TABLE IF NOT EXISTS public.organization_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email text NOT NULL,
  access_level text NOT NULL DEFAULT 'editor',
  invited_by uuid,
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  status text NOT NULL DEFAULT 'pending',
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_pending_invite_per_org
  ON public.organization_invitations(organization_id, lower(email))
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_invitations_token ON public.organization_invitations(token);
CREATE INDEX IF NOT EXISTS idx_invitations_email ON public.organization_invitations(lower(email));

ALTER TABLE public.organization_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org admins can view invitations"
  ON public.organization_invitations FOR SELECT
  TO authenticated
  USING (has_org_access(auth.uid(), organization_id, 'admin') OR is_admin(auth.uid()) OR auth.uid() = invited_by);

CREATE POLICY "Org admins can create invitations"
  ON public.organization_invitations FOR INSERT
  TO authenticated
  WITH CHECK (has_org_access(auth.uid(), organization_id, 'admin') OR is_admin(auth.uid()));

CREATE POLICY "Org admins can update invitations"
  ON public.organization_invitations FOR UPDATE
  TO authenticated
  USING (has_org_access(auth.uid(), organization_id, 'admin') OR is_admin(auth.uid()));

CREATE POLICY "Org admins can delete invitations"
  ON public.organization_invitations FOR DELETE
  TO authenticated
  USING (has_org_access(auth.uid(), organization_id, 'admin') OR is_admin(auth.uid()));

CREATE TRIGGER trg_invitations_updated_at
  BEFORE UPDATE ON public.organization_invitations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RPC for invitee to accept their invite (works without admin org access)
CREATE OR REPLACE FUNCTION public.accept_invitation(_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _invite organization_invitations;
  _user_id uuid;
  _email text;
BEGIN
  _user_id := auth.uid();
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT email INTO _email FROM auth.users WHERE id = _user_id;

  SELECT * INTO _invite FROM organization_invitations
   WHERE token = _token AND status = 'pending' AND expires_at > now()
   LIMIT 1;

  IF _invite IS NULL THEN
    RAISE EXCEPTION 'Invitation not found, expired, or already used';
  END IF;

  IF lower(_invite.email) <> lower(_email) THEN
    RAISE EXCEPTION 'This invitation was sent to %, but you are signed in as %', _invite.email, _email;
  END IF;

  INSERT INTO user_organization_access (user_id, organization_id, access_level)
  VALUES (_user_id, _invite.organization_id, _invite.access_level)
  ON CONFLICT (user_id, organization_id) DO UPDATE SET access_level = EXCLUDED.access_level;

  UPDATE organization_invitations
     SET status = 'accepted', accepted_at = now()
   WHERE id = _invite.id;

  -- Set as default org if user has none
  UPDATE profiles SET default_organization_id = _invite.organization_id
   WHERE user_id = _user_id AND default_organization_id IS NULL;

  RETURN jsonb_build_object('organization_id', _invite.organization_id);
END;
$$;

-- RPC to look up an invite by token (anonymous-friendly via security definer)
CREATE OR REPLACE FUNCTION public.get_invitation_by_token(_token text)
RETURNS TABLE(email text, organization_id uuid, organization_name text, access_level text, expires_at timestamptz, status text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT i.email, i.organization_id, o.name AS organization_name, i.access_level, i.expires_at, i.status
    FROM organization_invitations i
    JOIN organizations o ON o.id = i.organization_id
   WHERE i.token = _token
   LIMIT 1;
$$;