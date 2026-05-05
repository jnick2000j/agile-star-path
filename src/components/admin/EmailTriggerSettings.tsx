import { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Bell, BellOff, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { toast } from "sonner";
import {
  EMAIL_TRIGGERS,
  EMAIL_TRIGGER_CATEGORIES,
  type EmailTriggerDef,
} from "@/lib/emailTriggers";

interface SettingRow {
  trigger_key: string;
  enabled: boolean;
}

export function EmailTriggerSettings() {
  const { currentOrganization } = useOrganization();
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  // local state: triggerKey -> enabled (defaults to true if no row)
  const [state, setState] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!currentOrganization?.id) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOrganization?.id]);

  async function load() {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("email_trigger_settings")
      .select("trigger_key, enabled")
      .eq("organization_id", currentOrganization!.id);
    if (error) {
      console.error(error);
      toast.error("Failed to load email trigger settings");
    }
    const map: Record<string, boolean> = {};
    for (const t of EMAIL_TRIGGERS) map[t.key] = true; // default on
    for (const row of (data ?? []) as SettingRow[]) {
      map[row.trigger_key] = row.enabled;
    }
    setState(map);
    setLoading(false);
  }

  async function toggle(key: string, enabled: boolean) {
    if (!currentOrganization?.id) return;
    setSavingKey(key);
    setState((prev) => ({ ...prev, [key]: enabled }));
    const { error } = await (supabase as any)
      .from("email_trigger_settings")
      .upsert(
        {
          organization_id: currentOrganization.id,
          trigger_key: key,
          enabled,
          updated_by: (await supabase.auth.getUser()).data.user?.id ?? null,
        },
        { onConflict: "organization_id,trigger_key" },
      );
    setSavingKey(null);
    if (error) {
      console.error(error);
      toast.error("Failed to save setting");
      // revert
      setState((prev) => ({ ...prev, [key]: !enabled }));
      return;
    }
    toast.success(`${enabled ? "Enabled" : "Disabled"} email trigger`);
  }

  async function setAll(enabled: boolean) {
    if (!currentOrganization?.id) return;
    setBulkBusy(true);
    const userId = (await supabase.auth.getUser()).data.user?.id ?? null;
    const rows = EMAIL_TRIGGERS.map((t) => ({
      organization_id: currentOrganization.id,
      trigger_key: t.key,
      enabled,
      updated_by: userId,
    }));
    const { error } = await (supabase as any)
      .from("email_trigger_settings")
      .upsert(rows, { onConflict: "organization_id,trigger_key" });
    setBulkBusy(false);
    if (error) {
      console.error(error);
      toast.error("Failed to update all triggers");
      return;
    }
    toast.success(enabled ? "All email triggers enabled" : "All email triggers disabled");
    void load();
  }

  async function resetToDefaults() {
    if (!currentOrganization?.id) return;
    setBulkBusy(true);
    const { error } = await (supabase as any)
      .from("email_trigger_settings")
      .delete()
      .eq("organization_id", currentOrganization.id);
    setBulkBusy(false);
    if (error) {
      console.error(error);
      toast.error("Failed to reset");
      return;
    }
    toast.success("Email trigger settings reset to defaults");
    void load();
  }

  const grouped = useMemo(() => {
    const out = new Map<string, EmailTriggerDef[]>();
    for (const cat of EMAIL_TRIGGER_CATEGORIES) out.set(cat, []);
    for (const t of EMAIL_TRIGGERS) {
      out.get(t.category)!.push(t);
    }
    return out;
  }, []);

  const enabledCount = useMemo(
    () => EMAIL_TRIGGERS.filter((t) => state[t.key] !== false).length,
    [state],
  );
  const totalCount = EMAIL_TRIGGERS.length;

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-primary" />
              <CardTitle>Email Notification Triggers</CardTitle>
            </div>
            <CardDescription className="mt-1">
              Turn individual platform email notifications on or off. Disabled
              triggers stop sending immediately for this organization.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">
              {enabledCount}/{totalCount} enabled
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAll(true)}
              disabled={bulkBusy}
            >
              <Bell className="h-4 w-4 mr-2" /> Enable all
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAll(false)}
              disabled={bulkBusy}
            >
              <BellOff className="h-4 w-4 mr-2" /> Disable all
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={resetToDefaults}
              disabled={bulkBusy}
            >
              <RotateCcw className="h-4 w-4 mr-2" /> Reset
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {EMAIL_TRIGGER_CATEGORIES.map((cat) => {
          const items = grouped.get(cat) ?? [];
          if (items.length === 0) return null;
          return (
            <div key={cat} className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                {cat}
              </h3>
              <div className="rounded-lg border divide-y">
                {items.map((t) => {
                  const enabled = state[t.key] !== false;
                  return (
                    <div
                      key={t.key}
                      className="flex items-center justify-between gap-4 p-4"
                    >
                      <div className="min-w-0">
                        <div className="font-medium">{t.label}</div>
                        <div className="text-sm text-muted-foreground">
                          {t.description}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {savingKey === t.key && (
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        )}
                        <Switch
                          checked={enabled}
                          onCheckedChange={(v) => toggle(t.key, v)}
                          disabled={savingKey === t.key || bulkBusy}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
