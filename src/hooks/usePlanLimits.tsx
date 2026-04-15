import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "./useOrganization";

interface PlanLimits {
  planName: string;
  maxUsers: number;
  maxProgrammes: number;
  maxProjects: number;
  maxProducts: number;
  maxStorageMb: number;
  features: string[];
  status: string;
  trialEndsAt: string | null;
  priceMonthly: number;
  priceYearly: number;
}

interface PlanUsage {
  users: number;
  programmes: number;
  projects: number;
  products: number;
}

export function usePlanLimits() {
  const { currentOrganization } = useOrganization();
  const [limits, setLimits] = useState<PlanLimits | null>(null);
  const [usage, setUsage] = useState<PlanUsage>({ users: 0, programmes: 0, projects: 0, products: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentOrganization?.id) {
      setLimits(null);
      setLoading(false);
      return;
    }

    const fetchPlanAndUsage = async () => {
      setLoading(true);
      try {
        // Get subscription + plan
        const { data: sub } = await supabase
          .from("organization_subscriptions")
          .select("*, subscription_plans(*)")
          .eq("organization_id", currentOrganization.id)
          .maybeSingle();

        if (sub && sub.subscription_plans) {
          const plan = sub.subscription_plans as any;
          setLimits({
            planName: plan.name,
            maxUsers: plan.max_users,
            maxProgrammes: plan.max_programmes,
            maxProjects: plan.max_projects,
            maxProducts: plan.max_products,
            maxStorageMb: plan.max_storage_mb,
            features: Array.isArray(plan.features) ? plan.features : [],
            status: sub.status,
            trialEndsAt: sub.trial_ends_at,
            priceMonthly: plan.price_monthly,
            priceYearly: plan.price_yearly,
          });
        }

        // Get usage counts
        const [usersRes, progsRes, projsRes, prodsRes] = await Promise.all([
          supabase.from("user_organization_access").select("id", { count: "exact", head: true }).eq("organization_id", currentOrganization.id),
          supabase.from("programmes").select("id", { count: "exact", head: true }).eq("organization_id", currentOrganization.id),
          supabase.from("projects").select("id", { count: "exact", head: true }).eq("organization_id", currentOrganization.id),
          supabase.from("products").select("id", { count: "exact", head: true }).eq("organization_id", currentOrganization.id),
        ]);

        setUsage({
          users: usersRes.count || 0,
          programmes: progsRes.count || 0,
          projects: projsRes.count || 0,
          products: prodsRes.count || 0,
        });
      } catch (err) {
        console.error("Error fetching plan limits:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchPlanAndUsage();
  }, [currentOrganization?.id]);

  const canCreate = (resource: "users" | "programmes" | "projects" | "products") => {
    if (!limits) return true; // No plan = no limits enforced
    const max = limits[`max${resource.charAt(0).toUpperCase() + resource.slice(1)}` as keyof PlanLimits] as number;
    if (max === -1) return true; // Unlimited
    return usage[resource] < max;
  };

  const getUsagePercent = (resource: "users" | "programmes" | "projects" | "products") => {
    if (!limits) return 0;
    const key = `max${resource.charAt(0).toUpperCase() + resource.slice(1)}` as keyof PlanLimits;
    const max = limits[key] as number;
    if (max === -1) return 0;
    return Math.round((usage[resource] / max) * 100);
  };

  return { limits, usage, loading, canCreate, getUsagePercent };
}
