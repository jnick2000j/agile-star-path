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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus, Trash2, Pencil, History } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Org { id: string; name: string }
interface Plan { id: string; name: string; price_monthly: number }
interface Feature { feature_key: string; name: string; feature_type: string }
interface Override {
  id: string;
  organization_id: string;
  feature_key: string;
  override_value: any;
  reason: string | null;
  effective_from: string | null;
  expires_at: string | null;
}
interface OrgSub {
  organization_id: string;
  plan_id: string;
  status: string;
  current_period_end: string | null;
  trial_ends_at: string | null;
}
interface AuditEntry {
  id: string;
  organization_id: string;
  change_kind: string;
  operation: string;
  feature_key: string | null;
  before_value: any;
  after_value: any;
  actor_email: string | null;
  reason: string | null;
  created_at: string;
}

const toLocalInput = (iso: string | null | undefined) =>
  iso ? new Date(new Date(iso).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "";

export function OrgOverridesManager() {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [features, setFeatures] = useState<Feature[]>([]);
  const [overrides, setOverrides] = useState<Override[]>([]);
  const [subs, setSubs] = useState<OrgSub[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Partial<Override>>({});

  const [planOpen, setPlanOpen] = useState(false);
  const [planDraft, setPlanDraft] = useState<{
    organization_id?: string;
    plan_id?: string;
    status?: string;
    current_period_end?: string | null;
  }>({});

  const [auditOpen, setAuditOpen] = useState(false);
  const [auditFilterOrg, setAuditFilterOrg] = useState<string>("all");

  const load = async () => {
    setLoading(true);
    const [{ data: o }, { data: p }, { data: f }, { data: ov }, { data: s }, { data: al }] = await Promise.all([
      supabase.from("organizations").select("id, name").order("name"),
      supabase.from("subscription_plans").select("id, name, price_monthly").order("price_monthly"),
      supabase.from("plan_features").select("feature_key, name, feature_type").eq("is_active", true).order("display_order"),
      supabase.from("organization_plan_overrides").select("*").order("created_at", { ascending: false }),
      supabase.from("organization_subscriptions").select("organization_id, plan_id, status, current_period_end, trial_ends_at"),
      supabase.from("org_override_audit_log").select("*").order("created_at", { ascending: false }).limit(200),
    ]);
    setOrgs((o || []) as Org[]);
    setPlans((p || []) as Plan[]);
    setFeatures((f || []) as Feature[]);
    setOverrides((ov || []) as Override[]);
    setSubs((s || []) as OrgSub[]);
    setAudit((al || []) as AuditEntry[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const orgName = (id: string) => orgs.find((o) => o.id === id)?.name || id;
  const planName = (id: string) => plans.find((p) => p.id === id)?.name || id;
  const featureName = (key: string) => features.find((f) => f.feature_key === key)?.name || key;
  const featureType = (key: string) => features.find((f) => f.feature_key === key)?.feature_type || "boolean";
  const subFor = (orgId: string) => subs.find((s) => s.organization_id === orgId);
  const isScheduled = (o: Override) => o.effective_from && new Date(o.effective_from) > new Date();
  const filteredAudit = auditFilterOrg === "all" ? audit : audit.filter((a) => a.organization_id === auditFilterOrg);

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
        effective_from: draft.effective_from || null,
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

  const openPlanFor = (orgId: string) => {
    const existing = subFor(orgId);
    setPlanDraft({
      organization_id: orgId,
      plan_id: existing?.plan_id,
      status: existing?.status || "active",
      current_period_end: existing?.current_period_end || null,
    });
    setPlanOpen(true);
  };

  const handleSavePlan = async () => {
    if (!planDraft.organization_id || !planDraft.plan_id) {
      toast.error("Select an org and plan");
      return;
    }
    const { error } = await supabase
      .from("organization_subscriptions")
      .upsert(
        {
          organization_id: planDraft.organization_id,
          plan_id: planDraft.plan_id,
          status: planDraft.status || "active",
          current_period_end: planDraft.current_period_end || null,
        },
        { onConflict: "organization_id" },
      );
    if (error) { toast.error(error.message); return; }
    toast.success("Plan assigned");
    setPlanOpen(false);
    setPlanDraft({});
    load();
  };

  return (
    <Card className="p-6">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold">Per-organization overrides</h3>
          <p className="text-sm text-muted-foreground">
            Override a plan or specific features for an organization (enterprise deals, comps, beta access).
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setAuditOpen(true)}>
          <History className="h-4 w-4 mr-2" />Audit history
        </Button>
      </div>

      <Tabs defaultValue="plans" className="w-full">
        <TabsList>
          <TabsTrigger value="plans">Plan assignment</TabsTrigger>
          <TabsTrigger value="features">Feature overrides</TabsTrigger>
        </TabsList>

        <TabsContent value="plans" className="mt-4">
          <div className="flex justify-end mb-3">
            <Dialog open={planOpen} onOpenChange={setPlanOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => setPlanDraft({ status: "active" })}>
                  <Plus className="h-4 w-4 mr-2" />Assign plan
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    {planDraft.organization_id && subFor(planDraft.organization_id) ? "Change plan" : "Assign plan"}
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Organization</Label>
                    <Select
                      value={planDraft.organization_id}
                      onValueChange={(v) => setPlanDraft({ ...planDraft, organization_id: v })}
                    >
                      <SelectTrigger><SelectValue placeholder="Select an org" /></SelectTrigger>
                      <SelectContent>
                        {orgs.map((o) => (<SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Plan</Label>
                    <Select
                      value={planDraft.plan_id}
                      onValueChange={(v) => setPlanDraft({ ...planDraft, plan_id: v })}
                    >
                      <SelectTrigger><SelectValue placeholder="Select a plan" /></SelectTrigger>
                      <SelectContent>
                        {plans.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}{p.price_monthly > 0 ? ` — $${p.price_monthly}/mo` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Status</Label>
                    <Select
                      value={planDraft.status}
                      onValueChange={(v) => setPlanDraft({ ...planDraft, status: v })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="trialing">Trialing</SelectItem>
                        <SelectItem value="past_due">Past due</SelectItem>
                        <SelectItem value="canceled">Canceled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Period end (optional)</Label>
                    <Input
                      type="datetime-local"
                      value={planDraft.current_period_end ? new Date(planDraft.current_period_end).toISOString().slice(0, 16) : ""}
                      onChange={(e) =>
                        setPlanDraft({
                          ...planDraft,
                          current_period_end: e.target.value ? new Date(e.target.value).toISOString() : null,
                        })
                      }
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Leave blank for no expiry. Useful for time-bound enterprise contracts.
                    </p>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setPlanOpen(false)}>Cancel</Button>
                  <Button onClick={handleSavePlan}>Save plan assignment</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Organization</TableHead>
                <TableHead>Current plan</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Period end</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-6">Loading…</TableCell></TableRow>
              ) : orgs.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">No organizations</TableCell></TableRow>
              ) : (
                orgs.map((o) => {
                  const sub = subFor(o.id);
                  return (
                    <TableRow key={o.id}>
                      <TableCell className="font-medium">{o.name}</TableCell>
                      <TableCell>
                        {sub ? planName(sub.plan_id) : <span className="text-muted-foreground">No plan</span>}
                      </TableCell>
                      <TableCell>
                        {sub ? (
                          <Badge variant={sub.status === "active" ? "default" : "outline"}>{sub.status}</Badge>
                        ) : "—"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {sub?.current_period_end ? new Date(sub.current_period_end).toLocaleDateString() : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => openPlanFor(o.id)}>
                          <Pencil className="h-4 w-4 mr-1" />
                          {sub ? "Change" : "Assign"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="features" className="mt-4">
          <div className="flex justify-end mb-3">
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
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Effective from (optional)</Label>
                      <Input
                        type="datetime-local"
                        value={toLocalInput(draft.effective_from)}
                        onChange={(e) => setDraft({ ...draft, effective_from: e.target.value ? new Date(e.target.value).toISOString() : null })}
                      />
                      <p className="text-xs text-muted-foreground mt-1">Leave blank to apply immediately.</p>
                    </div>
                    <div>
                      <Label>Expires at (optional)</Label>
                      <Input
                        type="datetime-local"
                        value={toLocalInput(draft.expires_at)}
                        onChange={(e) => setDraft({ ...draft, expires_at: e.target.value ? new Date(e.target.value).toISOString() : null })}
                      />
                      <p className="text-xs text-muted-foreground mt-1">Leave blank for no expiry.</p>
                    </div>
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
                <TableHead>Effective from</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-6">Loading…</TableCell></TableRow>
              ) : overrides.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-6 text-muted-foreground">No overrides set</TableCell></TableRow>
              ) : (
                overrides.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-medium">{orgName(o.organization_id)}</TableCell>
                    <TableCell>
                      {featureName(o.feature_key)}
                      {isScheduled(o) && <Badge variant="secondary" className="ml-2 text-xs">Scheduled</Badge>}
                    </TableCell>
                    <TableCell><Badge variant="outline" className="font-mono text-xs">{JSON.stringify(o.override_value)}</Badge></TableCell>
                    <TableCell className="text-sm text-muted-foreground">{o.reason || "—"}</TableCell>
                    <TableCell className="text-sm">{o.effective_from ? new Date(o.effective_from).toLocaleString() : "Now"}</TableCell>
                    <TableCell className="text-sm">{o.expires_at ? new Date(o.expires_at).toLocaleString() : "Never"}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => { setDraft(o); setOpen(true); }}
                        title="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(o.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TabsContent>
      </Tabs>

      {/* Audit history dialog */}
      <Dialog open={auditOpen} onOpenChange={setAuditOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Override audit history</DialogTitle>
          </DialogHeader>
          <div className="flex items-center gap-3 mb-3">
            <Label className="text-sm">Filter by org:</Label>
            <Select value={auditFilterOrg} onValueChange={setAuditFilterOrg}>
              <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All organizations</SelectItem>
                {orgs.map((o) => (<SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div className="overflow-auto flex-1">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Org</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Op</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead>Actor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAudit.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">No audit entries</TableCell></TableRow>
                ) : filteredAudit.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="text-xs whitespace-nowrap">{new Date(a.created_at).toLocaleString()}</TableCell>
                    <TableCell className="text-sm">{orgName(a.organization_id)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {a.change_kind === "plan_assignment" ? "Plan" : "Feature"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={a.operation === "delete" ? "destructive" : a.operation === "insert" ? "default" : "secondary"}
                        className="text-xs"
                      >
                        {a.operation}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs font-mono max-w-md">
                      {a.feature_key && <div className="text-muted-foreground mb-1">{featureName(a.feature_key)}</div>}
                      {a.before_value && <div><span className="text-destructive">−</span> {JSON.stringify(a.before_value)}</div>}
                      {a.after_value && <div><span className="text-primary">+</span> {JSON.stringify(a.after_value)}</div>}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{a.actor_email || "system"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
