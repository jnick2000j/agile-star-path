-- Per-org Change Management notification & comment-requirement settings
CREATE TABLE IF NOT EXISTS public.change_notification_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,

  -- Email-on-event toggles
  notify_on_status_change boolean NOT NULL DEFAULT true,
  notify_on_type_change boolean NOT NULL DEFAULT false,
  notify_on_urgency_change boolean NOT NULL DEFAULT true,
  notify_on_impact_change boolean NOT NULL DEFAULT true,
  notify_on_owner_change boolean NOT NULL DEFAULT true,
  notify_on_progress_note boolean NOT NULL DEFAULT true,
  notify_on_test_result boolean NOT NULL DEFAULT true,
  notify_on_implementation_note boolean NOT NULL DEFAULT true,
  notify_on_comment boolean NOT NULL DEFAULT false,
  notify_on_approval_decision boolean NOT NULL DEFAULT true,

  -- Required-comment toggles (when changing these fields, user must enter a note)
  require_comment_on_status boolean NOT NULL DEFAULT false,
  require_comment_on_type boolean NOT NULL DEFAULT false,
  require_comment_on_urgency boolean NOT NULL DEFAULT false,
  require_comment_on_impact boolean NOT NULL DEFAULT false,
  require_comment_on_owner boolean NOT NULL DEFAULT false,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE public.change_notification_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view CM notification settings"
  ON public.change_notification_settings FOR SELECT
  TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR public.has_org_access(auth.uid(), organization_id, 'viewer')
  );

CREATE POLICY "Org managers can insert CM notification settings"
  ON public.change_notification_settings FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin(auth.uid())
    OR public.has_org_access(auth.uid(), organization_id, 'editor')
  );

CREATE POLICY "Org managers can update CM notification settings"
  ON public.change_notification_settings FOR UPDATE
  TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR public.has_org_access(auth.uid(), organization_id, 'editor')
  )
  WITH CHECK (
    public.is_admin(auth.uid())
    OR public.has_org_access(auth.uid(), organization_id, 'editor')
  );

CREATE TRIGGER update_change_notification_settings_updated_at
  BEFORE UPDATE ON public.change_notification_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();