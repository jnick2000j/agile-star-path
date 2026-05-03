-- External training settings (per-org approval toggle) + records table + storage bucket

-- 1) Add toggle to certificate settings table (already per-org) OR create lightweight settings.
-- Reuse a small dedicated settings table to avoid coupling with certificate settings.
CREATE TABLE IF NOT EXISTS public.lms_external_training_settings (
  organization_id uuid PRIMARY KEY,
  require_approval boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.lms_external_training_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view external training settings"
  ON public.lms_external_training_settings FOR SELECT TO authenticated
  USING (public.has_org_access(auth.uid(), organization_id, 'viewer'));
CREATE POLICY "Org managers can upsert external training settings"
  ON public.lms_external_training_settings FOR INSERT TO authenticated
  WITH CHECK (public.has_org_access(auth.uid(), organization_id, 'manager'));
CREATE POLICY "Org managers can update external training settings"
  ON public.lms_external_training_settings FOR UPDATE TO authenticated
  USING (public.has_org_access(auth.uid(), organization_id, 'manager'))
  WITH CHECK (public.has_org_access(auth.uid(), organization_id, 'manager'));

CREATE TRIGGER trg_lms_ext_settings_updated_at
  BEFORE UPDATE ON public.lms_external_training_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) External training records
CREATE TABLE IF NOT EXISTS public.lms_external_training (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  user_id uuid NOT NULL,
  title text NOT NULL,
  provider text,
  event_type text NOT NULL DEFAULT 'course',
  -- e.g. course, conference, workshop, webinar, certification, seminar, self_study, other
  purpose text,
  description text,
  hours numeric(6,2) NOT NULL DEFAULT 0,
  cpd_credits numeric(6,2),
  category text,
  skills text[] DEFAULT '{}'::text[],
  location text,
  delivery_mode text DEFAULT 'in_person', -- in_person, online, hybrid
  start_date date,
  end_date date,
  cost_amount numeric(12,2),
  status text NOT NULL DEFAULT 'submitted', -- submitted, approved, rejected
  approval_required boolean NOT NULL DEFAULT false,
  reviewed_by uuid,
  reviewed_at timestamptz,
  review_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lms_external_training_org ON public.lms_external_training(organization_id);
CREATE INDEX IF NOT EXISTS idx_lms_external_training_user ON public.lms_external_training(user_id);
CREATE INDEX IF NOT EXISTS idx_lms_external_training_status ON public.lms_external_training(status);

ALTER TABLE public.lms_external_training ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own external training in org"
  ON public.lms_external_training FOR SELECT TO authenticated
  USING (
    public.has_org_access(auth.uid(), organization_id, 'viewer')
    AND (user_id = auth.uid() OR public.has_org_access(auth.uid(), organization_id, 'manager'))
  );

CREATE POLICY "Users insert own external training"
  ON public.lms_external_training FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.has_org_access(auth.uid(), organization_id, 'viewer')
  );

CREATE POLICY "Users update own pending records or managers any"
  ON public.lms_external_training FOR UPDATE TO authenticated
  USING (
    (user_id = auth.uid() AND status = 'submitted')
    OR public.has_org_access(auth.uid(), organization_id, 'manager')
  )
  WITH CHECK (
    (user_id = auth.uid() AND public.has_org_access(auth.uid(), organization_id, 'viewer'))
    OR public.has_org_access(auth.uid(), organization_id, 'manager')
  );

CREATE POLICY "Users delete own pending or managers any"
  ON public.lms_external_training FOR DELETE TO authenticated
  USING (
    (user_id = auth.uid() AND status = 'submitted')
    OR public.has_org_access(auth.uid(), organization_id, 'manager')
  );

CREATE TRIGGER trg_lms_external_training_updated_at
  BEFORE UPDATE ON public.lms_external_training
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) Attachments (proof documents)
CREATE TABLE IF NOT EXISTS public.lms_external_training_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_training_id uuid NOT NULL REFERENCES public.lms_external_training(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL,
  user_id uuid NOT NULL,
  file_name text NOT NULL,
  storage_path text NOT NULL,
  mime_type text,
  size_bytes bigint,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lms_ext_train_attach_parent ON public.lms_external_training_attachments(external_training_id);

ALTER TABLE public.lms_external_training_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View attachments if can view parent record"
  ON public.lms_external_training_attachments FOR SELECT TO authenticated
  USING (
    public.has_org_access(auth.uid(), organization_id, 'viewer')
    AND (user_id = auth.uid() OR public.has_org_access(auth.uid(), organization_id, 'manager'))
  );
CREATE POLICY "Insert own attachments"
  ON public.lms_external_training_attachments FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.has_org_access(auth.uid(), organization_id, 'viewer'));
CREATE POLICY "Delete own or manager attachments"
  ON public.lms_external_training_attachments FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.has_org_access(auth.uid(), organization_id, 'manager'));

-- 4) Private storage bucket for proof documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('lms-external-training', 'lms-external-training', false)
ON CONFLICT (id) DO NOTHING;

-- Path convention: {organization_id}/{user_id}/{record_id}/{file}
CREATE POLICY "Users read own external training files"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'lms-external-training'
    AND (
      auth.uid()::text = (storage.foldername(name))[2]
      OR public.has_org_access(auth.uid(), ((storage.foldername(name))[1])::uuid, 'manager')
    )
  );
CREATE POLICY "Users upload own external training files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'lms-external-training'
    AND auth.uid()::text = (storage.foldername(name))[2]
    AND public.has_org_access(auth.uid(), ((storage.foldername(name))[1])::uuid, 'viewer')
  );
CREATE POLICY "Users delete own external training files or managers"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'lms-external-training'
    AND (
      auth.uid()::text = (storage.foldername(name))[2]
      OR public.has_org_access(auth.uid(), ((storage.foldername(name))[1])::uuid, 'manager')
    )
  );