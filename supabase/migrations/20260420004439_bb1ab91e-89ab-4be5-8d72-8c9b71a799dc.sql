ALTER TABLE public.ai_audit_log
  ADD COLUMN IF NOT EXISTS draft_payload jsonb,
  ADD COLUMN IF NOT EXISTS target_field text,
  ADD COLUMN IF NOT EXISTS parent_audit_id uuid REFERENCES public.ai_audit_log(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_ai_audit_log_parent ON public.ai_audit_log(parent_audit_id);
CREATE INDEX IF NOT EXISTS idx_ai_audit_log_org_status ON public.ai_audit_log(organization_id, status);