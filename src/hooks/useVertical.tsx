import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "./useOrganization";

export type VerticalId = "technology" | "construction" | "professional_services" | string;

export interface VerticalConfig {
  id: VerticalId;
  name: string;
  description: string | null;
  icon: string | null;
  enabled_modules: string[];
  terminology_overrides: Record<string, string>;
  default_dashboards: string[];
  ai_context_prompt: string | null;
}

const FALLBACK: VerticalConfig = {
  id: "technology",
  name: "Technology",
  description: null,
  icon: "Cpu",
  enabled_modules: [],
  terminology_overrides: {},
  default_dashboards: [],
  ai_context_prompt: null,
};

/**
 * Returns the active industry vertical config for the current organization.
 * Falls back to the technology vertical for platform admins viewing "Global".
 */
export function useVertical() {
  const { currentOrganization } = useOrganization();
  const [vertical, setVertical] = useState<VerticalConfig>(FALLBACK);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        if (!currentOrganization?.id) {
          if (!cancelled) setVertical(FALLBACK);
          return;
        }
        const { data: org } = await supabase
          .from("organizations")
          .select("industry_vertical")
          .eq("id", currentOrganization.id)
          .maybeSingle();

        const vid = (org?.industry_vertical as VerticalId) || "technology";

        const { data: vConfig } = await supabase
          .from("industry_verticals")
          .select("*")
          .eq("id", vid)
          .maybeSingle();

        if (!cancelled && vConfig) {
          setVertical({
            id: vConfig.id as VerticalId,
            name: vConfig.name,
            description: vConfig.description,
            icon: vConfig.icon,
            enabled_modules: vConfig.enabled_modules || [],
            terminology_overrides: (vConfig.terminology_overrides as Record<string, string>) || {},
            default_dashboards: vConfig.default_dashboards || [],
            ai_context_prompt: vConfig.ai_context_prompt,
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [currentOrganization?.id]);

  /** True if the module is part of this vertical's pack. Modules not in any vertical are allowed (e.g. settings). */
  const hasModule = (moduleKey: string) => {
    if (!vertical.enabled_modules.length) return true;
    return vertical.enabled_modules.includes(moduleKey);
  };

  /** Translate a base term using the vertical's terminology overrides. */
  const term = (key: string, fallback: string) =>
    vertical.terminology_overrides[key] ?? fallback;

  return { vertical, loading, hasModule, term };
}
