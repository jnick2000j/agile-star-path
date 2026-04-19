import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "./useOrganization";

export type FeatureValue = boolean | number | string | null;

export interface PlanFeature {
  feature_key: string;
  name: string;
  description: string | null;
  category: string;
  feature_type: "boolean" | "numeric" | "text";
  default_value: any;
  display_order: number;
  is_active: boolean;
}

export interface ResolvedFeatures {
  loading: boolean;
  features: Record<string, FeatureValue>;
  catalog: PlanFeature[];
  hasFeature: (key: string) => boolean;
  getLimit: (key: string) => number;
  refresh: () => Promise<void>;
}

const parseJsonb = (raw: any): FeatureValue => {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "boolean" || typeof raw === "number" || typeof raw === "string") return raw;
  return raw;
};

export function usePlanFeatures(): ResolvedFeatures {
  const { currentOrganization } = useOrganization();
  const [loading, setLoading] = useState(true);
  const [features, setFeatures] = useState<Record<string, FeatureValue>>({});
  const [catalog, setCatalog] = useState<PlanFeature[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: cat } = await supabase
        .from("plan_features")
        .select("*")
        .eq("is_active", true)
        .order("display_order");

      const catalogList = (cat || []) as PlanFeature[];
      setCatalog(catalogList);

      if (!currentOrganization?.id) {
        const defaults: Record<string, FeatureValue> = {};
        catalogList.forEach((f) => {
          defaults[f.feature_key] = parseJsonb(f.default_value);
        });
        setFeatures(defaults);
        return;
      }

      // Get current subscription -> plan -> feature values
      const { data: sub } = await supabase
        .from("organization_subscriptions")
        .select("plan_id, status")
        .eq("organization_id", currentOrganization.id)
        .maybeSingle();

      const { data: planValues } = sub?.plan_id
        ? await supabase
            .from("plan_feature_values")
            .select("feature_key, value")
            .eq("plan_id", sub.plan_id)
        : { data: [] as any[] };

      const { data: overrides } = await supabase
        .from("organization_plan_overrides")
        .select("feature_key, override_value, expires_at")
        .eq("organization_id", currentOrganization.id);

      const resolved: Record<string, FeatureValue> = {};
      catalogList.forEach((f) => {
        resolved[f.feature_key] = parseJsonb(f.default_value);
      });
      (planValues || []).forEach((pv: any) => {
        resolved[pv.feature_key] = parseJsonb(pv.value);
      });
      (overrides || []).forEach((ov: any) => {
        if (!ov.expires_at || new Date(ov.expires_at) > new Date()) {
          resolved[ov.feature_key] = parseJsonb(ov.override_value);
        }
      });

      setFeatures(resolved);
    } catch (err) {
      console.error("Error loading plan features:", err);
    } finally {
      setLoading(false);
    }
  }, [currentOrganization?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const hasFeature = useCallback(
    (key: string) => {
      const v = features[key];
      return v === true || v === "true";
    },
    [features],
  );

  const getLimit = useCallback(
    (key: string) => {
      const v = features[key];
      if (v === null || v === undefined) return 0;
      if (typeof v === "number") return v;
      const n = Number(v);
      return isNaN(n) ? 0 : n;
    },
    [features],
  );

  return { loading, features, catalog, hasFeature, getLimit, refresh: load };
}
