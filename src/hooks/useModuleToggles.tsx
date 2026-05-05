import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "./useOrganization";
import { usePlanFeatures } from "./usePlanFeatures";
import { toast } from "sonner";

export interface HelpdeskModuleDef {
  key: string;
  label: string;
  description: string;
  href?: string;
  defaultEnabled?: boolean;
}

/**
 * Catalog of toggleable helpdesk sub-modules.
 * Add to this list to expose a new module toggle.
 */
export const HELPDESK_MODULE_CATALOG: HelpdeskModuleDef[] = [
  { key: "major_incidents", label: "Major Incidents", description: "Coordinate critical, high-impact incidents.", href: "/major-incidents" },
  { key: "problems", label: "Problem Management", description: "Track root causes behind recurring incidents.", href: "/problems" },
  { key: "service_catalog", label: "Service Catalog", description: "Publish requestable services for end-users.", href: "/catalog" },
  { key: "cmdb", label: "CMDB", description: "Configuration Management Database for assets and services.", href: "/cmdb" },
  { key: "assets", label: "Assets & Licenses", description: "Track hardware, software and license inventory.", href: "/assets" },
  { key: "status_page", label: "Status Page", description: "Public service health and incident timeline.", href: "/status/admin" },
  { key: "csat", label: "CSAT Surveys", description: "Customer satisfaction surveys after ticket resolution.", href: "/support/csat" },
  { key: "analytics", label: "Analytics", description: "Helpdesk performance dashboards.", href: "/support/analytics" },
  { key: "reports", label: "Reports & Exports", description: "Scheduled reports and data exports.", href: "/support/reports" },
  { key: "workflows", label: "Workflows", description: "Automation rules and ticket workflows.", href: "/support/workflows" },
  { key: "lms", label: "Learning (LMS)", description: "Courses, learning paths, quizzes, certificates and training compliance. Bundled with Helpdesk + Learning add-ons.", href: "/learning", defaultEnabled: true },
];

/** Module keys that are opt-in add-ons (default OFF unless explicitly enabled). */
export const ADDON_MODULE_KEYS = new Set<string>([]);

export function useModuleToggles(orgId?: string | null) {
  const { currentOrganization } = useOrganization();
  const { hasFeature } = usePlanFeatures();
  const effectiveOrgId = orgId ?? currentOrganization?.id ?? null;
  const [toggles, setToggles] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!effectiveOrgId) {
      setToggles({});
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("organization_module_toggles")
      .select("module_key, enabled")
      .eq("organization_id", effectiveOrgId);
    if (error) {
      console.error("Failed to load module toggles", error);
    }
    const map: Record<string, boolean> = {};
    (data ?? []).forEach((row: any) => {
      map[row.module_key] = row.enabled;
    });
    setToggles(map);
    setLoading(false);
  }, [effectiveOrgId]);

  useEffect(() => { load(); }, [load]);

  const isEnabled = useCallback(
    (key: string) => {
      // Explicit toggle wins.
      if (toggles[key] !== undefined) return toggles[key];
      // LMS auto-enables when the org's plan grants feature_lms (Helpdesk + Learning / ITSM + Learning).
      if (key === "lms" && hasFeature("feature_lms")) return true;
      // Add-on modules default OFF; everything else defaults ON when no row exists.
      return !ADDON_MODULE_KEYS.has(key);
    },
    [toggles, hasFeature],
  );

  const setEnabled = useCallback(
    async (key: string, enabled: boolean) => {
      if (!effectiveOrgId) return;
      const { data: userResp } = await supabase.auth.getUser();
      const userId = userResp?.user?.id ?? null;
      const { error } = await supabase
        .from("organization_module_toggles")
        .upsert(
          {
            organization_id: effectiveOrgId,
            module_key: key,
            enabled,
            updated_by: userId,
          },
          { onConflict: "organization_id,module_key" },
        );
      if (error) {
        toast.error(`Failed to update: ${error.message}`);
        return;
      }
      setToggles((prev) => ({ ...prev, [key]: enabled }));
      toast.success(`${key} ${enabled ? "enabled" : "disabled"}`);
    },
    [effectiveOrgId],
  );

  return { toggles, isEnabled, setEnabled, loading, refresh: load };
}
