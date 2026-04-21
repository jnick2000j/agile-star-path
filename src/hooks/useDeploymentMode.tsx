import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";

export type DeploymentMode = "cloud" | "on_prem" | "hybrid";

export interface LicenseEntitlements {
  has_license: boolean;
  license_id?: string;
  deployment_mode?: DeploymentMode;
  plan_id?: string | null;
  plan_tier?: string | null;
  seats?: number;
  ai_credits_monthly?: number;
  features_override?: Record<string, unknown>;
  valid_from?: string;
  valid_until?: string | null;
  customer_reference?: string | null;
}

interface UseDeploymentModeResult {
  loading: boolean;
  hasLicense: boolean;
  /** True when billing-related UI (Stripe checkout, plan switching) should be hidden. */
  isLicenseMode: boolean;
  deploymentMode: DeploymentMode;
  entitlements: LicenseEntitlements | null;
  refresh: () => Promise<void>;
}

/**
 * Resolves whether the active organization is running on a license (on-prem /
 * PO-billed) and exposes the deployment mode to the UI. Use this to hide
 * Stripe-only features and surface a "managed via license" message instead.
 */
export function useDeploymentMode(): UseDeploymentModeResult {
  const { currentOrganization } = useOrganization();
  const [loading, setLoading] = useState(true);
  const [entitlements, setEntitlements] = useState<LicenseEntitlements | null>(null);

  const fetchEntitlements = async () => {
    if (!currentOrganization?.id) {
      setEntitlements({ has_license: false, deployment_mode: "cloud" });
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.rpc("get_license_entitlements", {
      _org_id: currentOrganization.id,
    });
    if (error) {
      console.warn("get_license_entitlements failed:", error.message);
      setEntitlements({ has_license: false, deployment_mode: "cloud" });
    } else {
      setEntitlements((data as unknown as LicenseEntitlements) ?? { has_license: false });
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchEntitlements();
  }, [currentOrganization?.id]);

  const hasLicense = !!entitlements?.has_license;
  const deploymentMode: DeploymentMode = entitlements?.deployment_mode ?? "cloud";
  // License mode = either explicit on_prem deployment OR a hybrid/cloud license that
  // overrides Stripe billing. Any active license disables the Stripe path.
  const isLicenseMode = hasLicense;

  return {
    loading,
    hasLicense,
    isLicenseMode,
    deploymentMode,
    entitlements,
    refresh: fetchEntitlements,
  };
}
