import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { ShieldAlert } from "lucide-react";

interface Policy {
  enforcement_mode: "optional" | "required_admins" | "required_all";
  grace_period_days: number;
  allow_recovery_codes: boolean;
}

export function OrgMFAPolicyCard() {
  const { currentOrganization: selectedOrg } = useOrganization();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [policy, setPolicy] = useState<Policy>({
    enforcement_mode: "optional",
    grace_period_days: 7,
    allow_recovery_codes: true,
  });

  useEffect(() => {
    if (!selectedOrg) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("org_mfa_policies")
        .select("*")
        .eq("organization_id", selectedOrg.id)
        .maybeSingle();
      if (data) {
        setPolicy({
          enforcement_mode: data.enforcement_mode as Policy["enforcement_mode"],
          grace_period_days: data.grace_period_days,
          allow_recovery_codes: data.allow_recovery_codes,
        });
      }
      setLoading(false);
    })();
  }, [selectedOrg]);

  const save = async () => {
    if (!selectedOrg) return;
    setSaving(true);
    const { error } = await supabase
      .from("org_mfa_policies")
      .upsert({ organization_id: selectedOrg.id, ...policy });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("MFA policy saved");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldAlert className="h-5 w-5" />
          Organization MFA policy
        </CardTitle>
        <CardDescription>
          Control whether members of this organization must use two-factor authentication.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <Skeleton className="h-32 w-full" />
        ) : (
          <>
            <div className="space-y-2">
              <Label>Enforcement</Label>
              <Select
                value={policy.enforcement_mode}
                onValueChange={(v) =>
                  setPolicy({ ...policy, enforcement_mode: v as Policy["enforcement_mode"] })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="optional">Optional — members may opt in</SelectItem>
                  <SelectItem value="required_admins">Required for admins only</SelectItem>
                  <SelectItem value="required_all">Required for all members</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="grace">Grace period (days)</Label>
              <Input
                id="grace"
                type="number"
                min={0}
                max={90}
                value={policy.grace_period_days}
                onChange={(e) =>
                  setPolicy({ ...policy, grace_period_days: parseInt(e.target.value) || 0 })
                }
              />
              <p className="text-xs text-muted-foreground">
                Days new members have to enroll before being blocked from sign-in.
              </p>
            </div>

            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <Label className="text-sm">Allow recovery codes</Label>
                <p className="text-xs text-muted-foreground">
                  Users can sign in with a one-time recovery code if they lose their device.
                </p>
              </div>
              <Switch
                checked={policy.allow_recovery_codes}
                onCheckedChange={(c) => setPolicy({ ...policy, allow_recovery_codes: c })}
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
