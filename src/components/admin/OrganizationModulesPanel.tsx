import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Layers, FolderKanban, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { useOrgAccessLevel } from "@/hooks/useOrgAccessLevel";
import { usePlanFeatures } from "@/hooks/usePlanFeatures";
import { toast } from "sonner";

const MODULES = [
  {
    key: "feature_module_programmes",
    label: "Programmes",
    description: "MSP programme lifecycle, blueprints, tranches, success plans.",
    icon: Layers,
  },
  {
    key: "feature_module_projects",
    label: "Projects",
    description: "PRINCE2/Agile projects, stages, work packages, briefs.",
    icon: FolderKanban,
  },
  {
    key: "feature_module_products",
    label: "Products",
    description: "Product roadmap, backlog, sprints, dependencies.",
    icon: Package,
  },
] as const;

export function OrganizationModulesPanel() {
  const { currentOrganization } = useOrganization();
  const { accessLevel } = useOrgAccessLevel();
  const { features, refresh, loading } = usePlanFeatures();
  const [saving, setSaving] = useState<string | null>(null);

  const isAdmin = accessLevel === "admin";

  const states = useMemo(() => {
    const out: Record<string, boolean> = {};
    for (const m of MODULES) {
      const v = features[m.key];
      out[m.key] = v === true || v === "true" || v === undefined; // default on
    }
    return out;
  }, [features]);

  const toggle = async (key: string, enabled: boolean) => {
    if (!currentOrganization?.id) return;
    setSaving(key);
    try {
      // Upsert an override row for this org+feature
      const { error } = await supabase
        .from("organization_plan_overrides")
        .upsert(
          {
            organization_id: currentOrganization.id,
            feature_key: key,
            override_value: enabled,
          },
          { onConflict: "organization_id,feature_key" },
        );
      if (error) throw error;
      toast.success(`${MODULES.find((m) => m.key === key)?.label} ${enabled ? "enabled" : "disabled"}`);
      await refresh();
    } catch (e: any) {
      toast.error(e.message || "Failed to update module");
    } finally {
      setSaving(null);
    }
  };

  if (!isAdmin) return null;

  return (
    <Card className="p-6 max-w-2xl">
      <div className="mb-4">
        <h3 className="text-lg font-semibold">Modules</h3>
        <p className="text-sm text-muted-foreground">
          Enable or disable core modules for this organization. Disabling a module hides it from
          the navigation and gates the related pages — existing data is preserved and reappears
          if you re-enable the module.
        </p>
      </div>

      <div className="space-y-4">
        {MODULES.map((m) => {
          const Icon = m.icon;
          return (
            <div key={m.key} className="flex items-start justify-between gap-4 py-3 border-b last:border-0">
              <div className="flex items-start gap-3">
                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <Label className="text-base">{m.label}</Label>
                  <p className="text-sm text-muted-foreground mt-0.5">{m.description}</p>
                </div>
              </div>
              <Switch
                checked={states[m.key]}
                disabled={loading || saving === m.key}
                onCheckedChange={(v) => toggle(m.key, v)}
              />
            </div>
          );
        })}
      </div>
    </Card>
  );
}
