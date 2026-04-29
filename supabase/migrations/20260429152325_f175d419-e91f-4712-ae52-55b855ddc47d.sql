-- ============ ASSETS ============
CREATE TABLE public.assets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  ci_id UUID REFERENCES public.configuration_items(id) ON DELETE SET NULL,
  asset_tag TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'hardware',
  status TEXT NOT NULL DEFAULT 'in_stock',
  serial_number TEXT,
  model TEXT,
  manufacturer TEXT,
  vendor TEXT,
  location TEXT,
  assigned_to_user_id UUID,
  department TEXT,
  purchase_date DATE,
  purchase_cost NUMERIC(12,2),
  warranty_expires_at DATE,
  end_of_life_at DATE,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, asset_tag)
);
CREATE INDEX idx_assets_org ON public.assets(organization_id);
CREATE INDEX idx_assets_status ON public.assets(organization_id, status);
CREATE INDEX idx_assets_assigned ON public.assets(assigned_to_user_id);
CREATE INDEX idx_assets_warranty ON public.assets(warranty_expires_at) WHERE warranty_expires_at IS NOT NULL;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members view assets" ON public.assets FOR SELECT
USING (public.has_org_access(auth.uid(), organization_id));
CREATE POLICY "Org members manage assets" ON public.assets FOR ALL
USING (public.has_org_access(auth.uid(), organization_id))
WITH CHECK (public.has_org_access(auth.uid(), organization_id));

CREATE TRIGGER update_assets_updated_at BEFORE UPDATE ON public.assets
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ SOFTWARE LICENSES ============
CREATE TABLE public.software_licenses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  name TEXT NOT NULL,
  software_name TEXT NOT NULL,
  vendor TEXT,
  license_type TEXT NOT NULL DEFAULT 'subscription',
  license_key TEXT,
  total_seats INTEGER NOT NULL DEFAULT 1,
  purchase_date DATE,
  expires_at DATE,
  cost NUMERIC(12,2),
  cost_currency TEXT DEFAULT 'USD',
  auto_renew BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'active',
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_licenses_org ON public.software_licenses(organization_id);
CREATE INDEX idx_licenses_expiry ON public.software_licenses(expires_at) WHERE expires_at IS NOT NULL;
ALTER TABLE public.software_licenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members view licenses" ON public.software_licenses FOR SELECT
USING (public.has_org_access(auth.uid(), organization_id));
CREATE POLICY "Org members manage licenses" ON public.software_licenses FOR ALL
USING (public.has_org_access(auth.uid(), organization_id))
WITH CHECK (public.has_org_access(auth.uid(), organization_id));

CREATE TRIGGER update_licenses_updated_at BEFORE UPDATE ON public.software_licenses
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ LICENSE ASSIGNMENTS ============
CREATE TABLE public.license_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  license_id UUID NOT NULL REFERENCES public.software_licenses(id) ON DELETE CASCADE,
  user_id UUID,
  asset_id UUID REFERENCES public.assets(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  assigned_by UUID,
  notes TEXT,
  CHECK (user_id IS NOT NULL OR asset_id IS NOT NULL)
);
CREATE INDEX idx_lic_assign_license ON public.license_assignments(license_id);
CREATE INDEX idx_lic_assign_user ON public.license_assignments(user_id);
ALTER TABLE public.license_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members view license assignments" ON public.license_assignments FOR SELECT
USING (public.has_org_access(auth.uid(), organization_id));
CREATE POLICY "Org members manage license assignments" ON public.license_assignments FOR ALL
USING (public.has_org_access(auth.uid(), organization_id))
WITH CHECK (public.has_org_access(auth.uid(), organization_id));

-- ============ ASSET CONTRACTS ============
CREATE TABLE public.asset_contracts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  name TEXT NOT NULL,
  contract_type TEXT NOT NULL DEFAULT 'support',
  vendor TEXT,
  contract_number TEXT,
  start_date DATE,
  end_date DATE,
  renewal_date DATE,
  cost NUMERIC(12,2),
  cost_currency TEXT DEFAULT 'USD',
  auto_renew BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'active',
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_contracts_org ON public.asset_contracts(organization_id);
CREATE INDEX idx_contracts_renewal ON public.asset_contracts(renewal_date) WHERE renewal_date IS NOT NULL;
ALTER TABLE public.asset_contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members view contracts" ON public.asset_contracts FOR SELECT
USING (public.has_org_access(auth.uid(), organization_id));
CREATE POLICY "Org members manage contracts" ON public.asset_contracts FOR ALL
USING (public.has_org_access(auth.uid(), organization_id))
WITH CHECK (public.has_org_access(auth.uid(), organization_id));

CREATE TRIGGER update_contracts_updated_at BEFORE UPDATE ON public.asset_contracts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
