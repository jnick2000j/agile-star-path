import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Org { id: string; name: string }
interface Feature { feature_key: string; name: string; feature_type: string }
interface Override {
  id: string;
  organization_id: string;
  feature_key: string;
  override_value: any;
  reason: string | null;
  expires_at: string | null;
}

export function OrgOverridesManager() {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [features, setFeatures] = useState<Feature[]>([]);
  const [overrides, setOverrides] = useState<Override[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Partial<Override>>({});

  const load = async () => {
    setLoading(true);
    const [{ data: o }, { data: f }, { data: ov }] = await Promise.all([
      supabase.from("organizations").select("id, name").order("name"),
      supabase.from("plan_features").select("feature_key, name, feature_type").eq("is_active", true).order("display_order"),
      supabase.from("organization_plan_overrides").select("*").order("created_at", { ascending: false }),
    ]);
    setOrgs((o || []) as Org[]);
    setFeatures((f || []) as Feature[]);
    setOverrides((ov || []) as Override[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const orgName = (id: string) => orgs.find((o) => o.id === id)?.name || id;
  const featureName = (key: string) => features.find((f) => f.feature_key === key)?.name || key;
  const featureType = (key: string) => features.find((f) => f.feature_key === key)?.feature_type || "boolean";

  const handleSave = async () => {
    if (!draft.organization_id || !draft.feature_key) {
      toast.error("Select an org and feature");
      return;
    }
    const t = featureType(draft.feature_key);
    const value =
      t === "boolean"
        ? draft.override_value === true || draft.override_value === "true"
        : t === "numeric"
          ? Number(draft.override_value ?? 0)
          : draft.override_value;

    const { error } = await supabase.from("organization_plan_overrides").upsert(
      {
        organization_id: draft.organization_id,
        feature_key: draft.feature_key,
        override_value: value,
        reason: draft.reason || null,
        expires_at: draft.expires_at || null,
      },
      { onConflict: "organization_id,feature_key" },
    );
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Override saved");
    setOpen(false);
    setDraft({});
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Remove this override?")) return;
    const { error } = await supabase.from("organization_plan_overrides").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Override removed");
    load();
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold">Per-organization overrides</h3>
          <p className="text-sm text-muted-foreground">
            Override any feature or limit for a specific organization (enterprise deals, comps, beta).
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setDraft({})}>
              <Plus className="h-4 w-4 mr-2" />New override
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New override</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Organization</Label>
                <Select
                  value={draft.organization_id}
                  onValueChange={(v) => setDraft({ ...draft, organization_id: v })}
                >
                  <SelectTrigger><SelectValue placeholder="Select an org" /></SelectTrigger>
                  <SelectContent>
                    {orgs.map((o) => (<SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Feature</Label>
                <Select
                  value={draft.feature_key}
                  onValueChange={(v) => setDraft({ ...draft, feature_key: v, override_value: featureType(v) === "boolean" ? true : 0 })}
                >
                  <SelectTrigger><SelectValue placeholder="Select a feature" /></SelectTrigger>
                  <SelectContent>
                    {features.map((f) => (<SelectItem key={f.feature_key} value={f.feature_key}>{f.name}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              {draft.feature_key && (
                <div>
                  <Label>Override value</Label>
                  {featureType(draft.feature_key) === "boolean" ? (
                    <div className="h-10 flex items-center">
                      <Switch
                        checked={draft.override_value === true || draft.override_value === "true"}
                        onCheckedChange={(c) => setDraft({ ...draft, override_value: c })}
                      />
                    </div>
                  ) : (
                    <Input
                      type={featureType(draft.feature_key) === "numeric" ? "number" : "text"}
                      value={draft.override_value ?? ""}
                      onChange={(e) => setDraft({ ...draft, override_value: e.target.value })}
                    />
                  )}
                </div>
              )}
              <div>
                <Label>Reason (optional)</Label>
                <Input
                  placeholder="e.g. Enterprise contract"
                  value={draft.reason || ""}
                  onChange={(e) => setDraft({ ...draft, reason: e.target.value })}
                />
              </div>
              <div>
                <Label>Expires at (optional)</Label>
                <Input
                  type="datetime-local"
                  value={draft.expires_at ? new Date(draft.expires_at).toISOString().slice(0, 16) : ""}
                  onChange={(e) => setDraft({ ...draft, expires_at: e.target.value ? new Date(e.target.value).toISOString() : null })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={handleSave}>Save override</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Organization</TableHead>
            <TableHead>Feature</TableHead>
            <TableHead>Value</TableHead>
            <TableHead>Reason</TableHead>
            <TableHead>Expires</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow><TableCell colSpan={6} className="text-center py-6">Loading…</TableCell></TableRow>
          ) : overrides.length === 0 ? (
            <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">No overrides set</TableCell></TableRow>
          ) : (
            overrides.map((o) => (
              <TableRow key={o.id}>
                <TableCell className="font-medium">{orgName(o.organization_id)}</TableCell>
                <TableCell>{featureName(o.feature_key)}</TableCell>
                <TableCell><Badge variant="outline" className="font-mono text-xs">{JSON.stringify(o.override_value)}</Badge></TableCell>
                <TableCell className="text-sm text-muted-foreground">{o.reason || "—"}</TableCell>
                <TableCell className="text-sm">{o.expires_at ? new Date(o.expires_at).toLocaleDateString() : "Never"}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(o.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </Card>
  );
}
