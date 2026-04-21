import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { Network } from "lucide-react";

export function OrgSessionPolicyCard() {
  const { currentOrganization: selectedOrg } = useOrganization();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [idle, setIdle] = useState(480);
  const [absolute, setAbsolute] = useState(10080);
  const [enforce, setEnforce] = useState(false);
  const [allowlist, setAllowlist] = useState("");

  useEffect(() => {
    if (!selectedOrg) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("org_session_policies")
        .select("*")
        .eq("organization_id", selectedOrg.id)
        .maybeSingle();
      if (data) {
        setIdle(data.idle_timeout_minutes);
        setAbsolute(data.absolute_timeout_minutes);
        setEnforce(data.enforce_ip_allowlist);
        setAllowlist((data.ip_allowlist ?? []).join("\n"));
      }
      setLoading(false);
    })();
  }, [selectedOrg]);

  const save = async () => {
    if (!selectedOrg) return;
    const cidrs = allowlist.split("\n").map((s) => s.trim()).filter(Boolean);
    setSaving(true);
    const { error } = await supabase.from("org_session_policies").upsert({
      organization_id: selectedOrg.id,
      idle_timeout_minutes: idle,
      absolute_timeout_minutes: absolute,
      enforce_ip_allowlist: enforce,
      ip_allowlist: cidrs,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Session policy saved");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Network className="h-5 w-5" />
          Session & network policy
        </CardTitle>
        <CardDescription>
          Control how long sessions stay valid and which IP ranges may sign in.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="idle">Idle timeout (minutes)</Label>
                <Input
                  id="idle"
                  type="number"
                  min={5}
                  value={idle}
                  onChange={(e) => setIdle(parseInt(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="abs">Absolute timeout (minutes)</Label>
                <Input
                  id="abs"
                  type="number"
                  min={60}
                  value={absolute}
                  onChange={(e) => setAbsolute(parseInt(e.target.value) || 0)}
                />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <Label className="text-sm">Enforce IP allowlist</Label>
                <p className="text-xs text-muted-foreground">
                  Block sign-ins from IP addresses outside the listed CIDR ranges.
                </p>
              </div>
              <Switch checked={enforce} onCheckedChange={setEnforce} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cidrs">Allowed IP ranges (one per line, CIDR notation)</Label>
              <Textarea
                id="cidrs"
                rows={5}
                value={allowlist}
                onChange={(e) => setAllowlist(e.target.value)}
                placeholder={"203.0.113.0/24\n198.51.100.42/32"}
                className="font-mono text-xs"
              />
            </div>

            <Button onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save policy"}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
