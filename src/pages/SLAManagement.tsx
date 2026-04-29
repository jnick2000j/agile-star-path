import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, Clock, AlertTriangle, Zap } from "lucide-react";
import { toast } from "sonner";

const PRIORITIES = ["low", "medium", "high", "critical"];
const TICKET_TYPES = ["incident", "service_request", "problem", "change"];
const TRIGGER_TYPES = [
  { value: "approaching_response", label: "Approaching response SLA" },
  { value: "approaching_resolution", label: "Approaching resolution SLA" },
  { value: "response_breach", label: "Response SLA breached" },
  { value: "resolution_breach", label: "Resolution SLA breached" },
  { value: "time_open", label: "Time open exceeds threshold" },
  { value: "time_unassigned", label: "Unassigned for threshold" },
];
const ACTIONS = [
  { value: "notify", label: "Send notification" },
  { value: "reassign", label: "Reassign ticket" },
  { value: "raise_priority", label: "Raise priority" },
  { value: "add_watcher", label: "Add watcher" },
];

export default function SLAManagement() {
  const { currentOrganization } = useOrganization();
  const qc = useQueryClient();
  const [policyOpen, setPolicyOpen] = useState(false);
  const [ruleOpen, setRuleOpen] = useState(false);

  // ===== Policies =====
  const { data: policies = [] } = useQuery({
    queryKey: ["sla-policies", currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization?.id) return [];
      const { data } = await supabase
        .from("helpdesk_sla_policies")
        .select("*")
        .eq("organization_id", currentOrganization.id)
        .order("priority");
      return data ?? [];
    },
    enabled: !!currentOrganization?.id,
  });

  const [newPolicy, setNewPolicy] = useState<any>({
    priority: "medium",
    ticket_type: "",
    response_minutes: 240,
    resolution_minutes: 2880,
    business_hours_only: false,
  });

  const createPolicy = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("helpdesk_sla_policies").insert({
        organization_id: currentOrganization!.id,
        priority: newPolicy.priority,
        ticket_type: newPolicy.ticket_type || null,
        response_minutes: Number(newPolicy.response_minutes),
        resolution_minutes: Number(newPolicy.resolution_minutes),
        business_hours_only: newPolicy.business_hours_only,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sla-policies"] });
      setPolicyOpen(false);
      toast.success("SLA policy created");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deletePolicy = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("helpdesk_sla_policies").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sla-policies"] }),
  });

  // ===== Rules =====
  const { data: rules = [] } = useQuery({
    queryKey: ["esc-rules", currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization?.id) return [];
      const { data } = await supabase
        .from("helpdesk_escalation_rules")
        .select("*")
        .eq("organization_id", currentOrganization.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!currentOrganization?.id,
  });

  const { data: recentEvents = [] } = useQuery({
    queryKey: ["esc-events", currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization?.id) return [];
      const { data } = await supabase
        .from("helpdesk_escalation_events")
        .select("*, helpdesk_tickets(reference_number, subject), helpdesk_escalation_rules(name)")
        .eq("organization_id", currentOrganization.id)
        .order("created_at", { ascending: false })
        .limit(30);
      return data ?? [];
    },
    enabled: !!currentOrganization?.id,
  });

  const [newRule, setNewRule] = useState<any>({
    name: "",
    priority: "high",
    ticket_type: "",
    trigger_type: "approaching_response",
    threshold_minutes: 30,
    action: "notify",
    raise_to_priority: "high",
    notify_emails: "",
    cooldown_minutes: 60,
  });

  const createRule = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("helpdesk_escalation_rules").insert({
        organization_id: currentOrganization!.id,
        name: newRule.name,
        priority: newRule.priority || null,
        ticket_type: newRule.ticket_type || null,
        trigger_type: newRule.trigger_type,
        threshold_minutes: Number(newRule.threshold_minutes),
        action: newRule.action,
        raise_to_priority: newRule.action === "raise_priority" ? newRule.raise_to_priority : null,
        notify_emails: newRule.notify_emails ? newRule.notify_emails.split(",").map((e: string) => e.trim()).filter(Boolean) : [],
        cooldown_minutes: Number(newRule.cooldown_minutes),
        is_enabled: true,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["esc-rules"] });
      setRuleOpen(false);
      toast.success("Escalation rule created");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleRule = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const { error } = await supabase.from("helpdesk_escalation_rules").update({ is_enabled: enabled } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["esc-rules"] }),
  });

  const deleteRule = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("helpdesk_escalation_rules").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["esc-rules"] }),
  });

  const runScanner = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("sla-escalation-scanner");
      if (error) throw error;
      return data;
    },
    onSuccess: (d: any) => {
      qc.invalidateQueries({ queryKey: ["esc-events"] });
      toast.success(`Scan complete: ${d.escalations_fired ?? 0} escalations fired`);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const fmt = (mins: number) => {
    if (mins < 60) return `${mins}m`;
    if (mins < 1440) return `${Math.round(mins / 60)}h`;
    return `${Math.round(mins / 1440)}d`;
  };

  return (
    <AppLayout title="SLA & Escalation" subtitle="Service level policies and automated escalations">
      <div className="p-6 space-y-6 max-w-6xl mx-auto">
        <Tabs defaultValue="policies">
          <TabsList>
            <TabsTrigger value="policies"><Clock className="h-4 w-4 mr-1" /> SLA Policies ({policies.length})</TabsTrigger>
            <TabsTrigger value="rules"><Zap className="h-4 w-4 mr-1" /> Escalation Rules ({rules.length})</TabsTrigger>
            <TabsTrigger value="events"><AlertTriangle className="h-4 w-4 mr-1" /> Recent Events</TabsTrigger>
          </TabsList>

          <TabsContent value="policies" className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={() => setPolicyOpen(true)}><Plus className="h-4 w-4 mr-2" /> New Policy</Button>
            </div>
            <Card className="p-4 space-y-2">
              {policies.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No SLA policies. Create policies per priority/type to set response and resolution targets.</p>
              ) : policies.map((p: any) => (
                <div key={p.id} className="flex items-center justify-between p-3 border rounded">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="capitalize">{p.priority}</Badge>
                    {p.ticket_type && <Badge variant="secondary">{p.ticket_type}</Badge>}
                    <div className="text-sm">
                      <span className="text-muted-foreground">Response:</span> <strong>{fmt(p.response_minutes)}</strong>
                      <span className="text-muted-foreground ml-3">Resolution:</span> <strong>{fmt(p.resolution_minutes)}</strong>
                    </div>
                    {p.business_hours_only && <Badge variant="outline" className="text-xs">Biz hours only</Badge>}
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => deletePolicy.mutate(p.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
            </Card>
          </TabsContent>

          <TabsContent value="rules" className="space-y-4">
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => runScanner.mutate()} disabled={runScanner.isPending}>
                {runScanner.isPending ? "Scanning..." : "Run Scanner Now"}
              </Button>
              <Button onClick={() => setRuleOpen(true)}><Plus className="h-4 w-4 mr-2" /> New Rule</Button>
            </div>
            <Card className="p-4 space-y-2">
              {rules.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No escalation rules. Create rules to automatically notify, reassign, or raise priority on tickets.</p>
              ) : rules.map((r: any) => (
                <div key={r.id} className="flex items-center justify-between p-3 border rounded">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Switch checked={r.is_enabled} onCheckedChange={(v) => toggleRule.mutate({ id: r.id, enabled: v })} />
                      <span className="font-medium">{r.name}</span>
                      {r.priority && <Badge variant="outline" className="text-xs capitalize">{r.priority}</Badge>}
                      {r.ticket_type && <Badge variant="secondary" className="text-xs">{r.ticket_type}</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      When <strong>{TRIGGER_TYPES.find((t) => t.value === r.trigger_type)?.label}</strong>
                      {r.threshold_minutes > 0 && ` (${fmt(r.threshold_minutes)})`}
                      {" → "}
                      <strong>{ACTIONS.find((a) => a.value === r.action)?.label}</strong>
                      {r.action === "raise_priority" && r.raise_to_priority && ` to ${r.raise_to_priority}`}
                      {r.notify_emails?.length > 0 && ` (${r.notify_emails.join(", ")})`}
                    </div>
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => deleteRule.mutate(r.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
            </Card>
          </TabsContent>

          <TabsContent value="events">
            <Card className="p-4 space-y-2">
              {recentEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No escalation events yet</p>
              ) : recentEvents.map((e: any) => (
                <div key={e.id} className="flex items-center justify-between p-3 border rounded text-sm">
                  <div>
                    <div className="font-medium">
                      {e.helpdesk_escalation_rules?.name ?? "Rule"} → {e.action}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {e.helpdesk_tickets?.reference_number} · {e.helpdesk_tickets?.subject} · {e.trigger_type}
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">{new Date(e.created_at).toLocaleString()}</span>
                </div>
              ))}
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Policy Dialog */}
      <Dialog open={policyOpen} onOpenChange={setPolicyOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New SLA Policy</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Priority</Label>
                <Select value={newPolicy.priority} onValueChange={(v) => setNewPolicy({ ...newPolicy, priority: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PRIORITIES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Ticket type (optional)</Label>
                <Select value={newPolicy.ticket_type || "_any"} onValueChange={(v) => setNewPolicy({ ...newPolicy, ticket_type: v === "_any" ? "" : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_any">Any</SelectItem>
                    {TICKET_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Response minutes</Label>
                <Input type="number" value={newPolicy.response_minutes} onChange={(e) => setNewPolicy({ ...newPolicy, response_minutes: e.target.value })} />
              </div>
              <div>
                <Label>Resolution minutes</Label>
                <Input type="number" value={newPolicy.resolution_minutes} onChange={(e) => setNewPolicy({ ...newPolicy, resolution_minutes: e.target.value })} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={newPolicy.business_hours_only} onCheckedChange={(v) => setNewPolicy({ ...newPolicy, business_hours_only: v })} />
              <Label>Business hours only</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPolicyOpen(false)}>Cancel</Button>
            <Button onClick={() => createPolicy.mutate()} disabled={createPolicy.isPending}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rule Dialog */}
      <Dialog open={ruleOpen} onOpenChange={setRuleOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>New Escalation Rule</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Name</Label>
              <Input value={newRule.name} onChange={(e) => setNewRule({ ...newRule, name: e.target.value })} placeholder="e.g. Notify manager on critical breach" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Priority filter</Label>
                <Select value={newRule.priority || "_any"} onValueChange={(v) => setNewRule({ ...newRule, priority: v === "_any" ? "" : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_any">Any</SelectItem>
                    {PRIORITIES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Type filter</Label>
                <Select value={newRule.ticket_type || "_any"} onValueChange={(v) => setNewRule({ ...newRule, ticket_type: v === "_any" ? "" : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_any">Any</SelectItem>
                    {TICKET_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Trigger</Label>
              <Select value={newRule.trigger_type} onValueChange={(v) => setNewRule({ ...newRule, trigger_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TRIGGER_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Threshold (minutes)</Label>
                <Input type="number" value={newRule.threshold_minutes} onChange={(e) => setNewRule({ ...newRule, threshold_minutes: e.target.value })} />
              </div>
              <div>
                <Label>Cooldown (minutes)</Label>
                <Input type="number" value={newRule.cooldown_minutes} onChange={(e) => setNewRule({ ...newRule, cooldown_minutes: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Action</Label>
              <Select value={newRule.action} onValueChange={(v) => setNewRule({ ...newRule, action: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ACTIONS.map((a) => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {newRule.action === "raise_priority" && (
              <div>
                <Label>Raise to priority</Label>
                <Select value={newRule.raise_to_priority} onValueChange={(v) => setNewRule({ ...newRule, raise_to_priority: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PRIORITIES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            {newRule.action === "notify" && (
              <div>
                <Label>Notify emails (comma-separated)</Label>
                <Input value={newRule.notify_emails} onChange={(e) => setNewRule({ ...newRule, notify_emails: e.target.value })} placeholder="manager@co.com, oncall@co.com" />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRuleOpen(false)}>Cancel</Button>
            <Button onClick={() => createRule.mutate()} disabled={!newRule.name || createRule.isPending}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
