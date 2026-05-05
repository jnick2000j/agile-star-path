-- =========================================================
-- 1) New per-entity role assignment tables
-- =========================================================
CREATE TABLE IF NOT EXISTS public.user_programme_custom_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  programme_id uuid NOT NULL REFERENCES public.programmes(id) ON DELETE CASCADE,
  custom_role_id uuid NOT NULL REFERENCES public.custom_roles(id) ON DELETE CASCADE,
  granted_by uuid,
  granted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, programme_id, custom_role_id)
);

CREATE TABLE IF NOT EXISTS public.user_project_custom_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  custom_role_id uuid NOT NULL REFERENCES public.custom_roles(id) ON DELETE CASCADE,
  granted_by uuid,
  granted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, project_id, custom_role_id)
);

CREATE TABLE IF NOT EXISTS public.user_product_custom_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  custom_role_id uuid NOT NULL REFERENCES public.custom_roles(id) ON DELETE CASCADE,
  granted_by uuid,
  granted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, product_id, custom_role_id)
);

CREATE INDEX IF NOT EXISTS idx_uprcr_user        ON public.user_programme_custom_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_uprcr_programme   ON public.user_programme_custom_roles(programme_id);
CREATE INDEX IF NOT EXISTS idx_uprjcr_user       ON public.user_project_custom_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_uprjcr_project    ON public.user_project_custom_roles(project_id);
CREATE INDEX IF NOT EXISTS idx_updcr_user        ON public.user_product_custom_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_updcr_product     ON public.user_product_custom_roles(product_id);

ALTER TABLE public.user_programme_custom_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_project_custom_roles   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_product_custom_roles   ENABLE ROW LEVEL SECURITY;

-- Self-read + admin-manage policies
CREATE POLICY "Users see own programme role assignments"
  ON public.user_programme_custom_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "Admins manage programme role assignments"
  ON public.user_programme_custom_roles FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Users see own project role assignments"
  ON public.user_project_custom_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "Admins manage project role assignments"
  ON public.user_project_custom_roles FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Users see own product role assignments"
  ON public.user_product_custom_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "Admins manage product role assignments"
  ON public.user_product_custom_roles FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- =========================================================
-- 2) Backfill from existing access tier rows
-- =========================================================
-- Organization access -> user_organization_custom_roles (already has Org Admin trigger; fill viewer/editor too)
WITH role_for(level, role_name) AS (
  VALUES ('admin','Org Admin'), ('manager','Org Editor'), ('editor','Org Editor'),
         ('viewer','Org Viewer'), ('owner','Org Admin')
)
INSERT INTO public.user_organization_custom_roles (user_id, organization_id, custom_role_id)
SELECT DISTINCT uoa.user_id, uoa.organization_id, cr.id
FROM public.user_organization_access uoa
JOIN role_for rf ON rf.level = uoa.access_level
JOIN public.custom_roles cr ON cr.name = rf.role_name AND cr.is_system = true
ON CONFLICT DO NOTHING;

-- Programme access
WITH role_for(level, role_name) AS (
  VALUES ('admin','Org Admin'), ('manager','Org Editor'), ('editor','Org Editor'),
         ('viewer','Org Viewer'), ('owner','Org Admin')
)
INSERT INTO public.user_programme_custom_roles (user_id, programme_id, custom_role_id)
SELECT DISTINCT upa.user_id, upa.programme_id, cr.id
FROM public.user_programme_access upa
JOIN role_for rf ON rf.level = upa.access_level
JOIN public.custom_roles cr ON cr.name = rf.role_name AND cr.is_system = true
ON CONFLICT DO NOTHING;

-- Project access
WITH role_for(level, role_name) AS (
  VALUES ('admin','Org Admin'), ('manager','Org Editor'), ('editor','Org Editor'),
         ('viewer','Org Viewer'), ('owner','Org Admin')
)
INSERT INTO public.user_project_custom_roles (user_id, project_id, custom_role_id)
SELECT DISTINCT upa.user_id, upa.project_id, cr.id
FROM public.user_project_access upa
JOIN role_for rf ON rf.level = upa.access_level
JOIN public.custom_roles cr ON cr.name = rf.role_name AND cr.is_system = true
ON CONFLICT DO NOTHING;

-- Product access
WITH role_for(level, role_name) AS (
  VALUES ('admin','Org Admin'), ('manager','Org Editor'), ('editor','Org Editor'),
         ('viewer','Org Viewer'), ('owner','Org Admin')
)
INSERT INTO public.user_product_custom_roles (user_id, product_id, custom_role_id)
SELECT DISTINCT upa.user_id, upa.product_id, cr.id
FROM public.user_product_access upa
JOIN role_for rf ON rf.level = upa.access_level
JOIN public.custom_roles cr ON cr.name = rf.role_name AND cr.is_system = true
ON CONFLICT DO NOTHING;

-- =========================================================
-- 3) Rewrite the 4 access helpers to read from role assignments
--    Returning the same boolean signature means all 408 dependent RLS
--    policies inherit the new behavior with no edits.
-- =========================================================
CREATE OR REPLACE FUNCTION public.has_org_access(_user_id uuid, _org_id uuid, _min_level text DEFAULT 'viewer'::text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.is_admin(_user_id) OR EXISTS (
    SELECT 1
    FROM public.user_organization_custom_roles uocr
    JOIN public.custom_roles cr ON cr.id = uocr.custom_role_id
    WHERE uocr.user_id = _user_id
      AND uocr.organization_id = _org_id
      AND CASE _min_level
        WHEN 'admin'  THEN cr.name = 'Org Admin'
        WHEN 'editor' THEN cr.name IN ('Org Admin','Org Editor')
                            OR cr.can_manage_programmes OR cr.can_manage_projects
                            OR cr.can_manage_products  OR cr.can_manage_users
        ELSE TRUE
      END
  );
$$;

CREATE OR REPLACE FUNCTION public.has_programme_access(_user_id uuid, _programme_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.is_admin(_user_id)
  -- Direct programme-scope role assignment
  OR EXISTS (
    SELECT 1 FROM public.user_programme_custom_roles
    WHERE user_id = _user_id AND programme_id = _programme_id
  )
  -- Inherited via org-scope role assignment
  OR EXISTS (
    SELECT 1
    FROM public.programmes p
    JOIN public.user_organization_custom_roles uocr ON uocr.organization_id = p.organization_id
    WHERE p.id = _programme_id AND uocr.user_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.has_project_access(_user_id uuid, _project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.is_admin(_user_id)
  -- Direct project-scope role assignment
  OR EXISTS (
    SELECT 1 FROM public.user_project_custom_roles
    WHERE user_id = _user_id AND project_id = _project_id
  )
  -- Inherited via parent programme role assignment
  OR EXISTS (
    SELECT 1
    FROM public.projects p
    JOIN public.user_programme_custom_roles uprcr ON uprcr.programme_id = p.programme_id
    WHERE p.id = _project_id AND uprcr.user_id = _user_id
  )
  -- Inherited via org role assignment
  OR EXISTS (
    SELECT 1
    FROM public.projects p
    JOIN public.user_organization_custom_roles uocr ON uocr.organization_id = p.organization_id
    WHERE p.id = _project_id AND uocr.user_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.has_product_access(_user_id uuid, _product_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.is_admin(_user_id)
  -- Direct product-scope role
  OR EXISTS (
    SELECT 1 FROM public.user_product_custom_roles
    WHERE user_id = _user_id AND product_id = _product_id
  )
  -- Inherited via org role
  OR EXISTS (
    SELECT 1
    FROM public.products pr
    JOIN public.user_organization_custom_roles uocr ON uocr.organization_id = pr.organization_id
    WHERE pr.id = _product_id AND uocr.user_id = _user_id
  );
$$;

-- =========================================================
-- 4) Replace the legacy "Org Admin" sync trigger with one that fires on role grants.
--    Whenever a user is given the Org Admin role, also keep user_organization_access
--    in sync (some legacy code still inserts into it for membership checks).
-- =========================================================
DROP TRIGGER IF EXISTS trg_sync_org_admin_custom_role ON public.user_organization_access;

CREATE OR REPLACE FUNCTION public.sync_access_tier_from_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role_name text;
  v_tier text := 'viewer';
BEGIN
  SELECT name INTO v_role_name FROM public.custom_roles WHERE id = NEW.custom_role_id;
  IF v_role_name = 'Org Admin' THEN
    v_tier := 'admin';
  ELSIF v_role_name = 'Org Editor' THEN
    v_tier := 'editor';
  END IF;

  INSERT INTO public.user_organization_access (user_id, organization_id, access_level)
  VALUES (NEW.user_id, NEW.organization_id, v_tier)
  ON CONFLICT (user_id, organization_id)
  DO UPDATE SET access_level =
    CASE
      WHEN public.user_organization_access.access_level = 'admin' THEN 'admin'
      WHEN v_tier = 'admin' THEN 'admin'
      WHEN public.user_organization_access.access_level = 'editor' OR v_tier = 'editor' THEN 'editor'
      ELSE 'viewer'
    END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_access_tier_from_role ON public.user_organization_custom_roles;
CREATE TRIGGER trg_sync_access_tier_from_role
AFTER INSERT ON public.user_organization_custom_roles
FOR EACH ROW EXECUTE FUNCTION public.sync_access_tier_from_role();