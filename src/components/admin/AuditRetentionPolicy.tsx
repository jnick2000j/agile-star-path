import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { useToast } from "@/hooks/use-toast";
import { Calendar, Trash2, Save, Loader2, Database } from "lucide-react";
import { format } from "date-fns";

interface RetentionPolicy {
  id?: string;
  retention_days: number;
  auto_purge_enabled: boolean;
  last_purged_at?: string | null;
  last_purged_count?: number | null;
}

export function AuditRetentionPolicy({ scope = "org" }: { scope?: "org" | "platform" }) {
  const { currentOrganization } = useOrganization();
  const { toast } = useToast();
  const [policy, setPolicy] = useState<RetentionPolicy>({ retention_days: 365, auto_purge_enabled: false });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [purging, setPurging] = useState(false);

  const orgId = scope === "platform" ? null : currentOrganization?.id;

  useEffect(() => {
    fetchPolicy();
  }, [orgId, scope]);

  const fetchPolicy = async () => {
    setLoading(true);
    try {
      const q = supabase.from("audit_log_retention_policies").select("*");
      const { data } = orgId
        ? await q.eq("organization_id", orgId).maybeSingle()
        : await q.is("organization_id", null).maybeSingle();
      if (data) setPolicy(data as any);
    } finally {
      setLoading(false);
    }
  };

  const save = async () => {
    if (scope === "org" && !orgId) return;
    setSaving(true);
    try {
      const payload = {
        organization_id: orgId,
        retention_days: policy.retention_days,
        auto_purge_enabled: policy.auto_purge_enabled,
      };
      const { error } = await supabase
        .from("audit_log_retention_policies")
        .upsert(payload, { onConflict: orgId ? "organization_id" : "id" });
      if (error) throw error;
      toast({ title: "Retention policy saved" });
      fetchPolicy();
    } catch (e: any) {
      toast({ title: "Failed to save", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const runPurge = async () => {
    if (!confirm("This will permanently delete audit logs older than the retention period. Continue?")) return;
    setPurging(true);
    try {
      const { data, error } = await supabase.rpc("purge_expired_audit_logs");
      if (error) throw error;
      const result = data as any;
      toast({
        title: "Purge complete",
        description: `${result?.rows_deleted ?? 0} log(s) deleted across ${result?.orgs_purged ?? 0} org(s).`,
      });
      fetchPolicy();
    } catch (e: any) {
      toast({ title: "Purge failed", description: e.message, variant: "destructive" });
    } finally {
      setPurging(false);
    }
  };

  if (loading) {
    return (
      <Card className="p-6 flex justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </Card>
    );
  }

  return (
    <Card className="p-6 space-y-5">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Database className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1">
          <h3 className="text-base font-semibold">Audit Log Retention</h3>
          <p className="text-sm text-muted-foreground">
            {scope === "platform"
              ? "Platform-wide default retention. Organizations may override this."
              : "How long audit events are kept before being eligible for deletion."}
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="retention-days">Retention (days)</Label>
          <Input
            id="retention-days"
            type="number"
            min={30}
            max={2555}
            value={policy.retention_days}
            onChange={(e) => setPolicy({ ...policy, retention_days: parseInt(e.target.value) || 365 })}
          />
          <p className="text-xs text-muted-foreground">
            Min 30 days, max 7 years. Common: 365 (SOC 2), 2190 (HIPAA 6yr).
          </p>
        </div>

        <div className="space-y-2">
          <Label>Automatic purge</Label>
          <div className="flex items-center gap-3 h-10">
            <Switch
              checked={policy.auto_purge_enabled}
              onCheckedChange={(v) => setPolicy({ ...policy, auto_purge_enabled: v })}
            />
            <span className="text-sm">{policy.auto_purge_enabled ? "Enabled" : "Disabled"}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            When on, expired logs are removed when the purge job runs.
          </p>
        </div>
      </div>

      {policy.last_purged_at && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Calendar className="h-3 w-3" />
          Last purged {format(new Date(policy.last_purged_at), "MMM d, yyyy HH:mm")} —{" "}
          <Badge variant="outline" className="text-xs">{policy.last_purged_count ?? 0} rows</Badge>
        </div>
      )}

      <div className="flex flex-wrap gap-2 pt-2 border-t">
        <Button onClick={save} disabled={saving} size="sm">
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Save Policy
        </Button>
        {scope === "platform" && (
          <Button onClick={runPurge} disabled={purging} variant="outline" size="sm">
            {purging ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
            Run Purge Now
          </Button>
        )}
      </div>
    </Card>
  );
}
