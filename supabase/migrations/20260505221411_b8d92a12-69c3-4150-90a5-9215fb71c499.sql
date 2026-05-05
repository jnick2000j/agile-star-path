-- Enums
DO $$ BEGIN
  CREATE TYPE public.release_status AS ENUM ('planning','in_development','code_freeze','in_testing','ready_for_release','released','rolled_back','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.release_promotion_status AS ENUM ('pending','in_progress','succeeded','failed','rolled_back','skipped');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.release_gate_status AS ENUM ('pending','in_review','approved','rejected','waived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.release_scope_item_type AS ENUM ('feature','work_package','task');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- releases
CREATE TABLE IF NOT EXISTS public.releases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  reference_number TEXT,
  name TEXT NOT NULL,
  version TEXT NOT NULL,
  description TEXT,
  release_type TEXT NOT NULL DEFAULT 'minor',
  status public.release_status NOT NULL DEFAULT 'planning',
  target_date DATE,
  released_at TIMESTAMPTZ,
  code_freeze_at TIMESTAMPTZ,
  release_manager_id UUID,
  release_notes TEXT,
  rollback_plan TEXT,
  is_hotfix BOOLEAN NOT NULL DEFAULT false,
  parent_release_id UUID REFERENCES public.releases(id) ON DELETE SET NULL,
  approval_chain_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_releases_org ON public.releases(organization_id);
CREATE INDEX IF NOT EXISTS idx_releases_product ON public.releases(product_id);
CREATE INDEX IF NOT EXISTS idx_releases_status ON public.releases(status);
CREATE INDEX IF NOT EXISTS idx_releases_target_date ON public.releases(target_date);
CREATE UNIQUE INDEX IF NOT EXISTS uq_releases_product_version ON public.releases(product_id, version);

CREATE SEQUENCE IF NOT EXISTS public.releases_ref_seq START 1000;

CREATE OR REPLACE FUNCTION public.set_release_reference_number()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.reference_number IS NULL OR NEW.reference_number = '' THEN
    NEW.reference_number := 'REL-' || lpad(nextval('public.releases_ref_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_releases_ref ON public.releases;
CREATE TRIGGER trg_releases_ref BEFORE INSERT ON public.releases FOR EACH ROW EXECUTE FUNCTION public.set_release_reference_number();
DROP TRIGGER IF EXISTS trg_releases_updated_at ON public.releases;
CREATE TRIGGER trg_releases_updated_at BEFORE UPDATE ON public.releases FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- release_environments
CREATE TABLE IF NOT EXISTS public.release_environments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  display_order INT NOT NULL DEFAULT 0,
  is_production BOOLEAN NOT NULL DEFAULT false,
  requires_approval BOOLEAN NOT NULL DEFAULT false,
  auto_create_change_request BOOLEAN NOT NULL DEFAULT false,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_release_env_slug ON public.release_environments(product_id, slug);
CREATE INDEX IF NOT EXISTS idx_release_env_org ON public.release_environments(organization_id);
DROP TRIGGER IF EXISTS trg_release_env_updated_at ON public.release_environments;
CREATE TRIGGER trg_release_env_updated_at BEFORE UPDATE ON public.release_environments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- release_promotions
CREATE TABLE IF NOT EXISTS public.release_promotions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  release_id UUID NOT NULL REFERENCES public.releases(id) ON DELETE CASCADE,
  environment_id UUID NOT NULL REFERENCES public.release_environments(id) ON DELETE CASCADE,
  status public.release_promotion_status NOT NULL DEFAULT 'pending',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  promoted_by UUID,
  notes TEXT,
  change_request_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_release_promotions_release ON public.release_promotions(release_id);
CREATE INDEX IF NOT EXISTS idx_release_promotions_env ON public.release_promotions(environment_id);
CREATE INDEX IF NOT EXISTS idx_release_promotions_org ON public.release_promotions(organization_id);
DROP TRIGGER IF EXISTS trg_release_promotions_updated_at ON public.release_promotions;
CREATE TRIGGER trg_release_promotions_updated_at BEFORE UPDATE ON public.release_promotions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- release_scope_items
CREATE TABLE IF NOT EXISTS public.release_scope_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  release_id UUID NOT NULL REFERENCES public.releases(id) ON DELETE CASCADE,
  item_type public.release_scope_item_type NOT NULL,
  feature_id UUID REFERENCES public.product_features(id) ON DELETE CASCADE,
  work_package_id UUID REFERENCES public.work_packages(id) ON DELETE CASCADE,
  task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
  added_by UUID,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT release_scope_item_target_chk CHECK (
    (item_type = 'feature' AND feature_id IS NOT NULL AND work_package_id IS NULL AND task_id IS NULL) OR
    (item_type = 'work_package' AND work_package_id IS NOT NULL AND feature_id IS NULL AND task_id IS NULL) OR
    (item_type = 'task' AND task_id IS NOT NULL AND feature_id IS NULL AND work_package_id IS NULL)
  )
);
CREATE INDEX IF NOT EXISTS idx_release_scope_release ON public.release_scope_items(release_id);
CREATE INDEX IF NOT EXISTS idx_release_scope_org ON public.release_scope_items(organization_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_release_scope_feature ON public.release_scope_items(release_id, feature_id) WHERE feature_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_release_scope_wp ON public.release_scope_items(release_id, work_package_id) WHERE work_package_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_release_scope_task ON public.release_scope_items(release_id, task_id) WHERE task_id IS NOT NULL;

-- release_gates
CREATE TABLE IF NOT EXISTS public.release_gates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  release_id UUID NOT NULL REFERENCES public.releases(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  display_order INT NOT NULL DEFAULT 0,
  status public.release_gate_status NOT NULL DEFAULT 'pending',
  required BOOLEAN NOT NULL DEFAULT true,
  approval_chain_id UUID,
  decided_by UUID,
  decided_at TIMESTAMPTZ,
  decision_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_release_gates_release ON public.release_gates(release_id);
CREATE INDEX IF NOT EXISTS idx_release_gates_org ON public.release_gates(organization_id);
DROP TRIGGER IF EXISTS trg_release_gates_updated_at ON public.release_gates;
CREATE TRIGGER trg_release_gates_updated_at BEFORE UPDATE ON public.release_gates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- release_notes_items
CREATE TABLE IF NOT EXISTS public.release_notes_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  release_id UUID NOT NULL REFERENCES public.releases(id) ON DELETE CASCADE,
  category TEXT NOT NULL DEFAULT 'feature',
  title TEXT NOT NULL,
  body TEXT,
  display_order INT NOT NULL DEFAULT 0,
  source_scope_item_id UUID REFERENCES public.release_scope_items(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_release_notes_release ON public.release_notes_items(release_id);
DROP TRIGGER IF EXISTS trg_release_notes_updated_at ON public.release_notes_items;
CREATE TRIGGER trg_release_notes_updated_at BEFORE UPDATE ON public.release_notes_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Link CR back to release
ALTER TABLE public.change_management_requests
  ADD COLUMN IF NOT EXISTS release_id UUID REFERENCES public.releases(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_cmr_release ON public.change_management_requests(release_id);

-- ENABLE RLS
ALTER TABLE public.releases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.release_environments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.release_promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.release_scope_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.release_gates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.release_notes_items ENABLE ROW LEVEL SECURITY;

-- POLICIES
DROP POLICY IF EXISTS "releases_select" ON public.releases;
CREATE POLICY "releases_select" ON public.releases FOR SELECT
  USING (public.is_org_member(auth.uid(), organization_id));
DROP POLICY IF EXISTS "releases_insert" ON public.releases;
CREATE POLICY "releases_insert" ON public.releases FOR INSERT
  WITH CHECK (public.is_org_admin_of(organization_id) OR public.has_product_access(auth.uid(), product_id));
DROP POLICY IF EXISTS "releases_update" ON public.releases;
CREATE POLICY "releases_update" ON public.releases FOR UPDATE
  USING (public.is_org_admin_of(organization_id) OR public.has_product_access(auth.uid(), product_id));
DROP POLICY IF EXISTS "releases_delete" ON public.releases;
CREATE POLICY "releases_delete" ON public.releases FOR DELETE
  USING (public.is_org_admin_of(organization_id));

DROP POLICY IF EXISTS "release_env_select" ON public.release_environments;
CREATE POLICY "release_env_select" ON public.release_environments FOR SELECT
  USING (public.is_org_member(auth.uid(), organization_id));
DROP POLICY IF EXISTS "release_env_write" ON public.release_environments;
CREATE POLICY "release_env_write" ON public.release_environments FOR ALL
  USING (public.is_org_admin_of(organization_id) OR public.has_product_access(auth.uid(), product_id))
  WITH CHECK (public.is_org_admin_of(organization_id) OR public.has_product_access(auth.uid(), product_id));

DROP POLICY IF EXISTS "release_promo_select" ON public.release_promotions;
CREATE POLICY "release_promo_select" ON public.release_promotions FOR SELECT
  USING (public.is_org_member(auth.uid(), organization_id));
DROP POLICY IF EXISTS "release_promo_write" ON public.release_promotions;
CREATE POLICY "release_promo_write" ON public.release_promotions FOR ALL
  USING (public.is_org_admin_of(organization_id) OR EXISTS (SELECT 1 FROM public.releases r WHERE r.id=release_id AND public.has_product_access(auth.uid(), r.product_id)))
  WITH CHECK (public.is_org_admin_of(organization_id) OR EXISTS (SELECT 1 FROM public.releases r WHERE r.id=release_id AND public.has_product_access(auth.uid(), r.product_id)));

DROP POLICY IF EXISTS "release_scope_select" ON public.release_scope_items;
CREATE POLICY "release_scope_select" ON public.release_scope_items FOR SELECT
  USING (public.is_org_member(auth.uid(), organization_id));
DROP POLICY IF EXISTS "release_scope_write" ON public.release_scope_items;
CREATE POLICY "release_scope_write" ON public.release_scope_items FOR ALL
  USING (public.is_org_admin_of(organization_id) OR EXISTS (SELECT 1 FROM public.releases r WHERE r.id=release_id AND public.has_product_access(auth.uid(), r.product_id)))
  WITH CHECK (public.is_org_admin_of(organization_id) OR EXISTS (SELECT 1 FROM public.releases r WHERE r.id=release_id AND public.has_product_access(auth.uid(), r.product_id)));

DROP POLICY IF EXISTS "release_gates_select" ON public.release_gates;
CREATE POLICY "release_gates_select" ON public.release_gates FOR SELECT
  USING (public.is_org_member(auth.uid(), organization_id));
DROP POLICY IF EXISTS "release_gates_write" ON public.release_gates;
CREATE POLICY "release_gates_write" ON public.release_gates FOR ALL
  USING (public.is_org_admin_of(organization_id) OR EXISTS (SELECT 1 FROM public.releases r WHERE r.id=release_id AND public.has_product_access(auth.uid(), r.product_id)))
  WITH CHECK (public.is_org_admin_of(organization_id) OR EXISTS (SELECT 1 FROM public.releases r WHERE r.id=release_id AND public.has_product_access(auth.uid(), r.product_id)));

DROP POLICY IF EXISTS "release_notes_select" ON public.release_notes_items;
CREATE POLICY "release_notes_select" ON public.release_notes_items FOR SELECT
  USING (public.is_org_member(auth.uid(), organization_id));
DROP POLICY IF EXISTS "release_notes_write" ON public.release_notes_items;
CREATE POLICY "release_notes_write" ON public.release_notes_items FOR ALL
  USING (public.is_org_admin_of(organization_id) OR EXISTS (SELECT 1 FROM public.releases r WHERE r.id=release_id AND public.has_product_access(auth.uid(), r.product_id)))
  WITH CHECK (public.is_org_admin_of(organization_id) OR EXISTS (SELECT 1 FROM public.releases r WHERE r.id=release_id AND public.has_product_access(auth.uid(), r.product_id)));

-- Seed default environments helper
CREATE OR REPLACE FUNCTION public.seed_default_release_environments(p_product_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_org UUID;
BEGIN
  SELECT organization_id INTO v_org FROM public.products WHERE id = p_product_id;
  IF v_org IS NULL THEN RETURN; END IF;
  INSERT INTO public.release_environments (organization_id, product_id, name, slug, display_order, is_production, requires_approval, auto_create_change_request)
  VALUES
    (v_org, p_product_id, 'Development', 'dev', 1, false, false, false),
    (v_org, p_product_id, 'QA',          'qa',  2, false, false, false),
    (v_org, p_product_id, 'Staging',     'staging', 3, false, true,  false),
    (v_org, p_product_id, 'Production',  'production', 4, true, true, true)
  ON CONFLICT (product_id, slug) DO NOTHING;
END $$;