import { useMemo, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2, Plus, Workflow, ListChecks, Inbox, ArrowUp, ArrowDown, History, CheckCircle2, XCircle, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format } from "date-fns";

// CM-specific trigger events
const TRIGGER_EVENTS = [
  { value: "change_created", label: "Change created" },
  { value: "status_changed", label: "Status changed" },
  { value: "urgency_changed", label: "Urgency changed" },
  { value: "impact_changed", label: "Impact changed" },
  { value: "assigned", label: "Owner/implementer assigned" },
  { value: "approval_requested", label: "Approval requested" },
  { value: "approval_decided", label: "Approval decided" },
  { value: "scheduled", label: "Change scheduled" },
  { value: "implementation_started", label: "Implementation started" },
  { value: "implemented", label: "Change implemented" },
  { value: "failed", label: "Implementation failed" },
  { value: "cancelled", label: "Change cancelled" },
  { value: "idle_timeout", label: "Change idle (time-based)" },
  { value: "manual", label: "Manual / on-demand" },
];

// CM-specific step library
const STEP_TYPES = [
  { group: "Logic", value: "condition", label: "Condition", icon: "⚙️" },
  { group: "AI", value: "ai_risk_assessment", label: "AI: Risk assessment", icon: "🤖" },
  { group: "AI", value: "ai_summarize", label: "AI: Summarize change", icon: "🤖" },
  { group: "AI", value: "ai_generate_rollback", label: "AI: Generate rollback plan", icon: "🤖" },
  { group: "AI", value: "ai_communication_plan", label: "AI: Draft communication plan", icon: "🤖" },
  { group: "Change", value: "set_field", label: "Set change field", icon: "✏️" },
  { group: "Change", value: "assign", label: "Assign owner / implementer", icon: "👤" },
  { group: "Change", value: "schedule", label: "Schedule change window", icon: "📅" },
  { group: "Approval", value: "request_cab_approval", label: "Request CAB approval (pause)", icon: "✅" },
  { group: "Approval", value: "escalate", label: "Escalate (bump urgency)", icon: "🚨" },
  { group: "Notify", value: "notify", label: "Notify user", icon: "🔔" },
  { group: "Notify", value: "send_email", label: "Send email", icon: "✉️" },
  { group: "Cross-module", value: "create_helpdesk_ticket", label: "Create help-desk ticket", icon: "🎫" },
  { group: "Audit", value: "link_evidence", label: "Add evidence note", icon: "📎" },
];

const CONDITION_OPS = [
  { value: "eq", label: "equals" }, { value: "neq", label: "not equals" },
  { value: "in", label: "is one of" }, { value: "contains", label: "contains" },
  { value: "gt", label: ">" }, { value: "gte", label: "≥" },
  { value: "lt", label: "<" }, { value: "lte", label: "≤" },
  { value: "is_set", label: "is set" }, { value: "is_empty", label: "is empty" },
];

const CHANGE_FIELDS = ["status", "urgency", "impact", "change_type", "category", "risk_score"];

interface Step { type: string; label?: string; config: Record<string, any>; }

interface CMWorkflow {
  id?: string;
  organization_id?: string;
  name: string;
  description?: string;
  trigger_event: string;
  trigger_config: Record<string, any>;
  category_id?: string | null;
  match_conditions: any[];
  steps: Step[];
  is_enabled: boolean;
}

const EMPTY_WF: CMWorkflow = {
  name: "", description: "", trigger_event: "change_created",
  trigger_config: {}, category_id: null, match_conditions: [], steps: [], is_enabled: true,
};

const STATUS_BADGE: Record<string, string> = {
  running: "bg-info/10 text-info",
  awaiting_approval: "bg-warning/10 text-warning",
  completed: "bg-success/10 text-success",
  failed: "bg-destructive/10 text-destructive",
};

export default function CMWorkflows() {
  const { currentOrganization } = useOrganization();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState("workflows");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<CMWorkflow>(EMPTY_WF);

  const orgId = currentOrganization?.id;

  const { data: workflows = [] } = useQuery({
    queryKey: ["cm-workflows", orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data } = await supabase.from("cm_workflows" as any)
        .select("*").eq("organization_id", orgId).order("created_at", { ascending: false });
      return (data ?? []) as any[];
    },
    enabled: !!orgId,
  });

  const { data: runs = [] } = useQuery({
    queryKey: ["cm-wf-runs", orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data } = await supabase.from("cm_workflow_runs" as any)
        .select("*, cm_workflows(name), change_management_requests(reference_number, title)")
        .eq("organization_id", orgId).order("started_at", { ascending: false }).limit(100);
      return (data ?? []) as any[];
    },
    enabled: !!orgId,
    refetchInterval: 8000,
  });

  const { data: approvals = [] } = useQuery({
    queryKey: ["cm-wf-approvals", orgId, user?.id],
    queryFn: async () => {
      if (!orgId) return [];
      const { data } = await supabase.from("cm_workflow_approvals" as any)
        .select("*, change_management_requests(reference_number, title)")
        .eq("organization_id", orgId).eq("decision", "pending").order("created_at", { ascending: false });
      return (data ?? []) as any[];
    },
    enabled: !!orgId,
    refetchInterval: 8000,
  });

  const myApprovals = useMemo(
    () => approvals.filter((a) => !a.assigned_to_user_id || a.assigned_to_user_id === user?.id),
    [approvals, user?.id],
  );

  const openNew = () => { setEditing({ ...EMPTY_WF }); setEditorOpen(true); };
  const openEdit = (wf: any) => {
    setEditing({
      ...wf,
      match_conditions: wf.match_conditions ?? [],
      steps: wf.steps ?? [],
      trigger_config: wf.trigger_config ?? {},
    });
    setEditorOpen(true);
  };

  const saveWorkflow = async () => {
    if (!orgId || !editing.name.trim()) { toast.error("Name is required"); return; }
    const payload: any = {
      organization_id: orgId,
      name: editing.name.trim(),
      description: editing.description ?? null,
      trigger_event: editing.trigger_event,
      trigger_config: editing.trigger_config ?? {},
      category_id: editing.category_id || null,
      match_conditions: editing.match_conditions ?? [],
      steps: editing.steps ?? [],
      is_enabled: editing.is_enabled,
      updated_by: user?.id,
    };
    if (editing.id) {
      const { error } = await supabase.from("cm_workflows" as any).update(payload).eq("id", editing.id);
      if (error) return toast.error(error.message);
    } else {
      payload.created_by = user?.id;
      const { error } = await supabase.from("cm_workflows" as any).insert(payload);
      if (error) return toast.error(error.message);
    }
    toast.success("Workflow saved");
    setEditorOpen(false);
    qc.invalidateQueries({ queryKey: ["cm-workflows", orgId] });
  };

  const deleteWorkflow = async (id: string) => {
    if (!confirm("Delete this workflow?")) return;
    await supabase.from("cm_workflows" as any).delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["cm-workflows", orgId] });
  };

  const toggleEnabled = async (wf: any) => {
    await supabase.from("cm_workflows" as any).update({ is_enabled: !wf.is_enabled }).eq("id", wf.id);
    qc.invalidateQueries({ queryKey: ["cm-workflows", orgId] });
  };

  const decideApproval = async (a: any, decision: "approved" | "rejected") => {
    const comment = prompt(`Optional comment for ${decision}:`) ?? "";
    const { error } = await supabase.from("cm_workflow_approvals" as any).update({
      decision, decided_by: user?.id, decided_at: new Date().toISOString(), decision_comment: comment,
    }).eq("id", a.id);
    if (error) return toast.error(error.message);
    // resume the run
    await supabase.functions.invoke(`cm-workflow-runner/run/${a.run_id}/resume`, { body: {} }).catch(() => {});
    toast.success(`Approval ${decision}`);
    qc.invalidateQueries({ queryKey: ["cm-wf-approvals", orgId] });
    qc.invalidateQueries({ queryKey: ["cm-wf-runs", orgId] });
  };

  // Step editor helpers
  const addStep = (type: string) => setEditing({ ...editing, steps: [...editing.steps, { type, label: "", config: {} }] });
  const removeStep = (i: number) => setEditing({ ...editing, steps: editing.steps.filter((_, idx) => idx !== i) });
  const moveStep = (i: number, dir: -1 | 1) => {
    const next = [...editing.steps]; const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    setEditing({ ...editing, steps: next });
  };
  const updateStepConfig = (i: number, patch: Record<string, any>) => {
    const next = [...editing.steps];
    next[i] = { ...next[i], config: { ...next[i].config, ...patch } };
    setEditing({ ...editing, steps: next });
  };

  // Match condition helpers
  const addCondition = () => setEditing({ ...editing, match_conditions: [...editing.match_conditions, { field: "status", op: "eq", value: "" }] });
  const removeCondition = (i: number) => setEditing({ ...editing, match_conditions: editing.match_conditions.filter((_, idx) => idx !== i) });
  const updateCondition = (i: number, patch: Record<string, any>) => {
    const next = [...editing.match_conditions];
    next[i] = { ...next[i], ...patch };
    setEditing({ ...editing, match_conditions: next });
  };

  return (
    <AppLayout title="Change Management Workflows" subtitle="Automate ITIL change processes — risk assessments, CAB approvals, scheduling, and more">
      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="workflows"><Workflow className="h-4 w-4 mr-2" />Workflows ({workflows.length})</TabsTrigger>
          <TabsTrigger value="approvals"><ListChecks className="h-4 w-4 mr-2" />Pending Approvals ({myApprovals.length})</TabsTrigger>
          <TabsTrigger value="runs"><History className="h-4 w-4 mr-2" />Run History ({runs.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="workflows" className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">Define automations that fire on change events.</p>
            <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />New Workflow</Button>
          </div>
          {workflows.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">
              <Inbox className="h-10 w-10 mx-auto mb-3 opacity-40" />
              No workflows yet. Create one to start automating CM processes.
            </CardContent></Card>
          ) : (
            <div className="grid gap-3">
              {workflows.map((wf: any) => (
                <Card key={wf.id} className="hover:shadow-sm">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <CardTitle className="text-base flex items-center gap-2">
                          {wf.name}
                          {!wf.is_enabled && <Badge variant="outline">Disabled</Badge>}
                        </CardTitle>
                        <CardDescription className="mt-1">
                          Trigger: <code className="text-xs">{wf.trigger_event}</code> · {(wf.steps ?? []).length} steps
                        </CardDescription>
                        {wf.description && <p className="text-sm text-muted-foreground mt-2">{wf.description}</p>}
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch checked={wf.is_enabled} onCheckedChange={() => toggleEnabled(wf)} />
                        <Button size="sm" variant="outline" onClick={() => openEdit(wf)}>Edit</Button>
                        <Button size="sm" variant="ghost" onClick={() => deleteWorkflow(wf.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="text-xs text-muted-foreground flex gap-4 pt-0">
                    <span>Runs: {wf.run_count ?? 0}</span>
                    <span>Success: {wf.success_count ?? 0}</span>
                    <span>Failed: {wf.failure_count ?? 0}</span>
                    {wf.last_run_at && <span>Last: {format(new Date(wf.last_run_at), "PP p")}</span>}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="approvals" className="space-y-3">
          {myApprovals.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">
              <CheckCircle2 className="h-10 w-10 mx-auto mb-3 opacity-40" />
              No pending CAB approvals.
            </CardContent></Card>
          ) : myApprovals.map((a: any) => (
            <Card key={a.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-base">{a.title}</CardTitle>
                    {a.change_management_requests && (
                      <CardDescription>
                        {a.change_management_requests.reference_number} — {a.change_management_requests.title}
                      </CardDescription>
                    )}
                  </div>
                  <Badge variant="outline">{a.assigned_to_role ?? "any"}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                {a.description && <p className="text-sm mb-3">{a.description}</p>}
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => decideApproval(a, "approved")}>
                    <CheckCircle2 className="h-4 w-4 mr-1" /> Approve
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => decideApproval(a, "rejected")}>
                    <XCircle className="h-4 w-4 mr-1" /> Reject
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="runs">
          <Card>
            <CardHeader><CardTitle>Recent runs</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Workflow</TableHead><TableHead>Change</TableHead>
                  <TableHead>Trigger</TableHead><TableHead>Status</TableHead>
                  <TableHead>Started</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {runs.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No runs yet</TableCell></TableRow>
                  ) : runs.map((r: any) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.cm_workflows?.name ?? "—"}</TableCell>
                      <TableCell className="text-xs">
                        {r.change_management_requests
                          ? `${r.change_management_requests.reference_number} ${r.change_management_requests.title}`
                          : "—"}
                      </TableCell>
                      <TableCell><code className="text-xs">{r.trigger_event}</code></TableCell>
                      <TableCell>
                        <Badge className={STATUS_BADGE[r.status] ?? ""}>
                          {r.status === "running" && <Clock className="h-3 w-3 mr-1" />}
                          {r.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">{format(new Date(r.started_at), "PP p")}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Editor */}
      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing.id ? "Edit Workflow" : "New Workflow"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Name *</Label>
                <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Trigger event</Label>
                <Select value={editing.trigger_event} onValueChange={(v) => setEditing({ ...editing, trigger_event: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TRIGGER_EVENTS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea rows={2} value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={editing.is_enabled} onCheckedChange={(v) => setEditing({ ...editing, is_enabled: v })} />
              <Label>Enabled</Label>
            </div>

            {/* Match conditions */}
            <div className="space-y-2 border-t pt-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Match conditions (optional)</Label>
                <Button size="sm" variant="outline" onClick={addCondition}><Plus className="h-3 w-3 mr-1" />Add</Button>
              </div>
              {editing.match_conditions.length === 0 && (
                <p className="text-xs text-muted-foreground">No conditions — workflow runs on every event.</p>
              )}
              {editing.match_conditions.map((c, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <Select value={c.field} onValueChange={(v) => updateCondition(i, { field: v })}>
                    <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CHANGE_FIELDS.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={c.op} onValueChange={(v) => updateCondition(i, { op: v })}>
                    <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CONDITION_OPS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Input value={c.value ?? ""} onChange={(e) => updateCondition(i, { value: e.target.value })} placeholder="value" />
                  <Button size="icon" variant="ghost" onClick={() => removeCondition(i)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
            </div>

            {/* Steps */}
            <div className="space-y-2 border-t pt-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Steps</Label>
                <Select onValueChange={(v) => addStep(v)}>
                  <SelectTrigger className="w-56"><SelectValue placeholder="+ Add step" /></SelectTrigger>
                  <SelectContent>
                    {STEP_TYPES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.icon} {s.group} — {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {editing.steps.length === 0 && (
                <p className="text-xs text-muted-foreground">No steps yet. Add at least one step from the dropdown.</p>
              )}
              {editing.steps.map((s, i) => {
                const meta = STEP_TYPES.find((t) => t.value === s.type);
                return (
                  <Card key={i} className="p-3 space-y-2 bg-muted/30">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-muted-foreground">{i + 1}.</span>
                        <span>{meta?.icon}</span>
                        <span className="font-medium text-sm">{meta?.label ?? s.type}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button size="icon" variant="ghost" onClick={() => moveStep(i, -1)}><ArrowUp className="h-3 w-3" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => moveStep(i, 1)}><ArrowDown className="h-3 w-3" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => removeStep(i)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </div>
                    </div>
                    <StepConfigEditor step={s} onChange={(p) => updateStepConfig(i, p)} />
                  </Card>
                );
              })}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditorOpen(false)}>Cancel</Button>
            <Button onClick={saveWorkflow}>Save Workflow</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

// Per-step config editor
function StepConfigEditor({ step, onChange }: { step: Step; onChange: (patch: Record<string, any>) => void }) {
  const c = step.config ?? {};
  switch (step.type) {
    case "set_field":
      return (
        <div className="grid grid-cols-2 gap-2">
          <div><Label className="text-xs">Status</Label><Input value={c.status ?? ""} onChange={(e) => onChange({ status: e.target.value })} placeholder="e.g. scheduled" /></div>
          <div><Label className="text-xs">Urgency</Label><Input value={c.urgency ?? ""} onChange={(e) => onChange({ urgency: e.target.value })} placeholder="low/medium/high/critical" /></div>
          <div><Label className="text-xs">Impact</Label><Input value={c.impact ?? ""} onChange={(e) => onChange({ impact: e.target.value })} placeholder="low/medium/high/critical" /></div>
          <div><Label className="text-xs">Change type</Label><Input value={c.change_type ?? ""} onChange={(e) => onChange({ change_type: e.target.value })} placeholder="standard/normal/emergency" /></div>
        </div>
      );
    case "assign":
      return (
        <div className="grid grid-cols-2 gap-2">
          <div><Label className="text-xs">Owner user ID</Label><Input value={c.owner_id ?? ""} onChange={(e) => onChange({ owner_id: e.target.value })} placeholder="UUID" /></div>
          <div><Label className="text-xs">Implementer user ID</Label><Input value={c.implementer_id ?? ""} onChange={(e) => onChange({ implementer_id: e.target.value })} placeholder="UUID" /></div>
        </div>
      );
    case "schedule":
      return (
        <div className="grid grid-cols-2 gap-2">
          <div><Label className="text-xs">Planned start</Label><Input type="datetime-local" value={c.planned_start_at ?? ""} onChange={(e) => onChange({ planned_start_at: e.target.value })} /></div>
          <div><Label className="text-xs">Planned end</Label><Input type="datetime-local" value={c.planned_end_at ?? ""} onChange={(e) => onChange({ planned_end_at: e.target.value })} /></div>
        </div>
      );
    case "request_cab_approval":
      return (
        <div className="space-y-2">
          <div><Label className="text-xs">Title</Label><Input value={c.title ?? ""} onChange={(e) => onChange({ title: e.target.value })} placeholder="CAB approval needed" /></div>
          <div><Label className="text-xs">Description</Label><Textarea rows={2} value={c.description ?? ""} onChange={(e) => onChange({ description: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-xs">Approver user ID (optional)</Label><Input value={c.approver_user_id ?? ""} onChange={(e) => onChange({ approver_user_id: e.target.value })} /></div>
            <div><Label className="text-xs">Approver role</Label><Input value={c.approver_role ?? "cab"} onChange={(e) => onChange({ approver_role: e.target.value })} /></div>
          </div>
        </div>
      );
    case "escalate":
      return (
        <div className="grid grid-cols-2 gap-2">
          <div><Label className="text-xs">Bump urgency to</Label><Input value={c.bump_urgency ?? ""} onChange={(e) => onChange({ bump_urgency: e.target.value })} placeholder="high/critical" /></div>
          <div><Label className="text-xs">Bump impact to</Label><Input value={c.bump_impact ?? ""} onChange={(e) => onChange({ bump_impact: e.target.value })} placeholder="high/critical" /></div>
          <div className="col-span-2"><Label className="text-xs">Recipient user ID</Label><Input value={c.recipient_user_id ?? ""} onChange={(e) => onChange({ recipient_user_id: e.target.value })} placeholder="UUID" /></div>
        </div>
      );
    case "notify":
    case "send_email":
      return (
        <div className="space-y-2">
          <div><Label className="text-xs">Recipient user ID</Label><Input value={c.recipient_user_id ?? ""} onChange={(e) => onChange({ recipient_user_id: e.target.value })} placeholder="UUID" /></div>
          <div><Label className="text-xs">Subject</Label><Input value={c.subject ?? ""} onChange={(e) => onChange({ subject: e.target.value })} placeholder="Subject (supports {{change.title}})" /></div>
          <div><Label className="text-xs">Body</Label><Textarea rows={3} value={c.body ?? ""} onChange={(e) => onChange({ body: e.target.value })} placeholder="Body (supports {{change.title}}, {{context.ai_summary}})" /></div>
        </div>
      );
    case "create_helpdesk_ticket":
      return (
        <div className="space-y-2">
          <div><Label className="text-xs">Subject</Label><Input value={c.subject ?? ""} onChange={(e) => onChange({ subject: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-xs">Type</Label><Input value={c.ticket_type ?? "service_request"} onChange={(e) => onChange({ ticket_type: e.target.value })} /></div>
            <div><Label className="text-xs">Priority</Label><Input value={c.priority ?? "medium"} onChange={(e) => onChange({ priority: e.target.value })} /></div>
          </div>
        </div>
      );
    case "ai_risk_assessment":
    case "ai_generate_rollback":
    case "ai_communication_plan":
      return (
        <div className="flex items-center gap-2">
          <Switch checked={!!c.apply_to_change} onCheckedChange={(v) => onChange({ apply_to_change: v })} />
          <Label className="text-xs">Apply AI output to the change record</Label>
        </div>
      );
    case "link_evidence":
      return (
        <div><Label className="text-xs">Note</Label><Input value={c.note ?? ""} onChange={(e) => onChange({ note: e.target.value })} placeholder="Evidence note" /></div>
      );
    case "condition":
      return <p className="text-xs text-muted-foreground">Condition step uses match-conditions structure (advanced).</p>;
    default:
      return <p className="text-xs text-muted-foreground">No additional config.</p>;
  }
}
