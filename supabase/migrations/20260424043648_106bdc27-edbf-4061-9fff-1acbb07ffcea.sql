ALTER TABLE public.change_notification_settings
  ADD COLUMN IF NOT EXISTS require_comment_on_status_draft boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS require_comment_on_status_submitted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS require_comment_on_status_in_review boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS require_comment_on_status_cab_review boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS require_comment_on_status_needs_information boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS require_comment_on_status_approved boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS require_comment_on_status_rejected boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS require_comment_on_status_cancelled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS require_comment_on_status_failed boolean NOT NULL DEFAULT true;