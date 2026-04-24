import { useEffect, useMemo, useState } from "react";
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
import { Trash2, Plus, Play, Sparkles, Workflow, ListChecks, Inbox, ArrowUp, ArrowDown, History, CheckCircle2, XCircle, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format } from "date-fns";

const TRIGGER_EVENTS = [
  { value: "ticket_created", label: "Ticket created" },
  { value: "status_changed", label: "Status changed" },
  { value: "priority_changed", label: "Priority changed" },
  { value: "assigned", label: "Ticket assigned" },
  { value: "replied", label: "Reply added" },
  { value: "internal_note_added", label: "Internal note added" },
  { value: "sla_warning", label: "SLA approaching" },
  { value: "sla_breached", label: "SLA breached" },
  { value: "idle_timeout", label: "Ticket idle (time-based)" },
  { value: "manual", label: "Manual / on-demand" },
];

const STEP_TYPES = [
  { group: "Logic", value: "condition", label: "Condition", icon: "⚙️" },
  { group: "AI", value: "ai_triage", label: "AI: Triage (category + priority)", icon: "🤖" },
  { group: "AI", value: "ai_summarize", label: "AI: Summarize ticket", icon: "🤖" },
  { group: "AI", value: "ai_suggest_reply", label: "AI: Suggest reply", icon: "🤖" },
  { group: "AI", value: "ai_draft_reply", label: "AI: Draft reply", icon: "🤖" },
  { group: "AI", value: "ai_sentiment", label: "AI: Sentiment analysis", icon: "🤖" },
  { group: "Helpdesk", value: "assign", label: "Assign to user", icon: "👤" },
  { group: "Helpdesk", value: "set_field", label: "Set ticket field", icon: "✏️" },
  { group: "Helpdesk", value: "add_tag", label: "Add tag(s)", icon: "🏷️" },
  { group: "Helpdesk", value: "internal_note", label: "Add internal note", icon: "📝" },
  { group: "Notify", value: "send_email", label: "Send email", icon: "✉️" },
  { group: "Notify", value: "notify", label: "Notify user", icon: "🔔" },
  { group: "Approval", value: "request_approval", label: "Request approval (pause)", icon: "✅" },
  { group: "Approval", value: "escalate", label: "Escalate", icon: "🚨" },
  { group: "Approval", value: "create_cab", label: "Create CAB change request", icon: "📋" },
];

const CONDITION_OPS = [
  { value: "eq", label: "equals" },
  { value: "neq", label: "not equals" },
  { value: "in", label: "is one of" },
  { value: "contains", label: "contains" },
  { value: "starts_with", label: "starts with" },
  { value: "gt", label: ">" },
  { value: "gte", label: "≥" },
  { value: "lt", label: "<" },
  { value: "lte", label: "≤" },
  { value: "is_set", label: "is set" },
  { value: "is_empty", label: "is empty" },
];

const TICKET_FIELDS = ["status", "priority", "ticket_type", "category", "subject", "tags"];

interface Step {
  type: string;
  label?: string;
  config: Record<string, any>;
}

interface Workflow {
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

const EMPTY_WF: Workflow = {
  name: "",
  description: "",
  trigger_event: "ticket_created",
  trigger_config: {},
  category_id: null,
  match_conditions: [],
  steps: [],
  is_enabled: true,
};

export default function HelpdeskWorkflows() {
  const { currentOrganization } = useOrganization();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState("workflows");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Workflow>(EMPTY_WF);
  const [catDialogOpen, setCatDialogOpen] = useState(false);
  const [newCat, setNewCat] = useState({ name: "", description: "" });

  const orgId = currentOrganization?.id;

  const { data: workflows = [] } = useQuery({
    queryKey: ["hd-workflows", orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data } = await supabase.from("helpdesk_workflows" as any)
        .select("*").eq("organization_id", orgId).order("created_at", { ascending: false });
      return (data ?? []) as any[];
    },
    enabled: !!orgId,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["hd-wf-categories", orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data } = await supabase.from("helpdesk_workflow_categories" as any)
        .select("*").eq("organization_id", orgId).order("sort_order");
      return (data ?? []) as any[];
    },
    enabled: !!orgId,
  });

  const { data: runs = [] } = useQuery({
    queryKey: ["hd-wf-runs", orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data } = await supabase.from("helpdesk_workflow_runs" as any)
        .select("*, helpdesk_workflows(name), helpdesk_tickets(reference_number, subject)")
        .eq("organization_id", orgId).order("started_at", { ascending: false }).limit(100);
      return (data ?? []) as any[];
    },
    enabled: !!orgId,
    refetchInterval: 8000,
  });

  const { data: approvals = [] } = useQuery({
    queryKey: ["hd-wf-approvals", orgId, user?.id],
    queryFn: async () => {
      if (!orgId) return [];
      const { data } = await supabase.from("helpdesk_workflow_approvals" as any)
        .select("*, helpdesk_tickets(reference_number, subject)")
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
    if (!orgId || !editing.name.trim()) {
      toast.error("Name is required");
      return;
    }
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
      const { error } = await supabase.from("helpdesk_workflows" as any).update(payload).eq("id", editing.id);
      if (error) return toast.error(error.message);
    } else {
      payload.created_by = user?.id;
      const { error } = await supabase.from("helpdesk_workflows" as any).insert(payload);
      if (error) return toast.error(error.message);
    }
    toast.success("Workflow saved");
    setEditorOpen(false);
    qc.invalidateQueries({ queryKey: ["hd-workflows", orgId] });
  };

  const deleteWorkflow = async (id: string) => {
    if (!confirm("Delete this workflow?")) return;
    await supabase.from("helpdesk_workflows" as any).delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["hd-workflows", orgId] });
  };

  const toggleEnabled = async (wf: any) => {
    await supabase.from("helpdesk_workflows" as any).update({ is_enabled: !wf.is_enabled }).eq("id", wf.id);
    qc.invalidateQueries({ queryKey: ["hd-workflows", orgId] });
  };

  const addCategory = async () => {
    if (!orgId || !newCat.name.trim()) return;
    await supabase.from("helpdesk_workflow_categories" as any).insert({
      organization_id: orgId,
      name: newCat.name.trim(),
      description: newCat.description.trim() || null,
      created_by: user?.id,
    });
    setNewCat({ name: "", description: "" });
    setCatDialogOpen(false);
    qc.invalidateQueries({ queryKey: ["hd-wf-categories", orgId] });
  };

  const decideApproval = async (id: string, decision: "approved" | "rejected") => {
    const comment = prompt(`Optional comment for ${decision}:`) ?? "";
    const { error } = await supabase.functions.invoke("helpdesk-workflow-approve", {
      body: { approval_id: id, decision, comment },
    });
    if (error) return toast.error(error.message);
    toast.success(`Approval ${decision}`);
    qc.invalidateQueries({ queryKey: ["hd-wf-approvals", orgId] });
    qc.invalidateQueries({ queryKey: ["hd-wf-runs", orgId] });
  };

  // ----- Step editor helpers -----
  const addStep = (type: string) => {
    setEditing({ ...editing, steps: [...editing.steps, { type, label: "", config: {} }] });
  };
  const removeStep = (i: number) => {
    setEditing({ ...editing, steps: editing.steps.filter((_, idx) => idx !== i) });
  };
  const moveStep = (i: number, dir: -1 | 1) => {
    const next = [...editing.steps];
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    setEditing({ ...editing, steps: next });
  };
  const updateStepConfig = (i: number, patch: Record<string, any>) => {
    const next = [...editing.steps];
    next[i] = { ...next[i], config: { ...next[i].config, ...patch } };
    setEditing({ ...editing, steps: next });
  };

  return (
    <AppLayout title="Helpdesk Workflows">
      <div className="container mx-auto py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Workflow className="h-6 w-6" /> Helpdesk Workflows
            </h1>
            <p className="text-muted-foreground text-sm">Build AI-powered automations with approvals, notifications and actions.</p>
          </div>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="workflows"><Workflow className="h-4 w-4 mr-1" />Workflows</TabsTrigger>
            <TabsTrigger value="runs"><History className="h-4 w-4 mr-1" />Runs</TabsTrigger>
            <TabsTrigger value="approvals">
              <Inbox className="h-4 w-4 mr-1" />Approvals
              {myApprovals.length > 0 && <Badge className="ml-2">{myApprovals.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="categories"><ListChecks className="h-4 w-4 mr-1" />Categories</TabsTrigger>
          </TabsList>

          {/* WORKFLOWS */}
          <TabsContent value="workflows" className="space-y-4 mt-4">
            <div className="flex justify-end">
              <Button onClick={openNew}><Plus className="h-4 w-4 mr-1" />New workflow</Button>
            </div>
            <div className="grid gap-3">
              {workflows.length === 0 && (
                <Card><CardContent className="py-8 text-center text-muted-foreground">
                  No workflows yet. Click "New workflow" to create one.
                </CardContent></Card>
              )}
              {workflows.map((wf: any) => (
                <Card key={wf.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <CardTitle className="text-base flex items-center gap-2">
                          {wf.name}
                          <Badge variant={wf.is_enabled ? "default" : "secondary"}>
                            {wf.is_enabled ? "Enabled" : "Disabled"}
                          </Badge>
                        </CardTitle>
                        <CardDescription className="mt-1">
                          {TRIGGER_EVENTS.find((t) => t.value === wf.trigger_event)?.label ?? wf.trigger_event}
                          {" · "}{(wf.steps ?? []).length} step(s)
                          {" · "}{wf.run_count ?? 0} runs · {wf.success_count ?? 0} ok / {wf.failure_count ?? 0} failed
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch checked={wf.is_enabled} onCheckedChange={() => toggleEnabled(wf)} />
                        <Button variant="outline" size="sm" onClick={() => openEdit(wf)}>Edit</Button>
                        <Button variant="ghost" size="icon" onClick={() => deleteWorkflow(wf.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  {wf.description && <CardContent className="text-sm text-muted-foreground pt-0">{wf.description}</CardContent>}
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* RUNS */}
          <TabsContent value="runs" className="mt-4">
            <Card><CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Workflow</TableHead>
                    <TableHead>Ticket</TableHead>
                    <TableHead>Trigger</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Started</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {runs.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No runs yet</TableCell></TableRow>}
                  {runs.map((r: any) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.helpdesk_workflows?.name ?? "—"}</TableCell>
                      <TableCell>{r.helpdesk_tickets?.reference_number ?? "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{r.trigger_event}</TableCell>
                      <TableCell>
                        <Badge variant={
                          r.status === "completed" ? "default" :
                          r.status === "failed" ? "destructive" :
                          r.status === "awaiting_approval" ? "secondary" : "outline"
                        }>{r.status}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {format(new Date(r.started_at), "MMM d, HH:mm")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent></Card>
          </TabsContent>

          {/* APPROVALS */}
          <TabsContent value="approvals" className="space-y-3 mt-4">
            {myApprovals.length === 0 && (
              <Card><CardContent className="py-8 text-center text-muted-foreground">No pending approvals.</CardContent></Card>
            )}
            {myApprovals.map((a: any) => (
              <Card key={a.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Clock className="h-4 w-4" />{a.title}
                  </CardTitle>
                  <CardDescription>
                    {a.helpdesk_tickets?.reference_number ? `Ticket ${a.helpdesk_tickets.reference_number} · ` : ""}
                    Requested {format(new Date(a.created_at), "MMM d, HH:mm")}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {a.description && <p className="text-sm">{a.description}</p>}
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => decideApproval(a.id, "approved")}>
                      <CheckCircle2 className="h-4 w-4 mr-1" />Approve
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => decideApproval(a.id, "rejected")}>
                      <XCircle className="h-4 w-4 mr-1" />Reject
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          {/* CATEGORIES */}
          <TabsContent value="categories" className="space-y-3 mt-4">
            <div className="flex justify-end">
              <Button onClick={() => setCatDialogOpen(true)}><Plus className="h-4 w-4 mr-1" />New category</Button>
            </div>
            <Card><CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Description</TableHead></TableRow></TableHeader>
                <TableBody>
                  {categories.length === 0 && <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground py-8">No categories yet (e.g. Hardware Purchasing, Security Requests, Report Generation)</TableCell></TableRow>}
                  {categories.map((c: any) => (
                    <TableRow key={c.id}><TableCell className="font-medium">{c.name}</TableCell><TableCell className="text-sm text-muted-foreground">{c.description}</TableCell></TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent></Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Category dialog */}
      <Dialog open={catDialogOpen} onOpenChange={setCatDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New category</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Name *</Label><Input value={newCat.name} onChange={(e) => setNewCat({ ...newCat, name: e.target.value })} placeholder="e.g. Hardware Purchasing" /></div>
            <div><Label>Description</Label><Textarea value={newCat.description} onChange={(e) => setNewCat({ ...newCat, description: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCatDialogOpen(false)}>Cancel</Button>
            <Button onClick={addCategory}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Workflow editor */}
      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing.id ? "Edit workflow" : "New workflow"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Name *</Label><Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
              <div className="space-y-2"><Label>Trigger</Label>
                <Select value={editing.trigger_event} onValueChange={(v) => setEditing({ ...editing, trigger_event: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TRIGGER_EVENTS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2"><Label>Description</Label><Textarea value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Category</Label>
                <Select value={editing.category_id ?? "none"} onValueChange={(v) => setEditing({ ...editing, category_id: v === "none" ? null : v })}>
                  <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {categories.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end gap-2"><Switch checked={editing.is_enabled} onCheckedChange={(v) => setEditing({ ...editing, is_enabled: v })} /><Label>Enabled</Label></div>
            </div>

            {/* Match conditions */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label>Match conditions (all must match)</Label>
                <Button size="sm" variant="outline" onClick={() => setEditing({ ...editing, match_conditions: [...editing.match_conditions, { field: "priority", op: "eq", value: "high" }] })}>
                  <Plus className="h-3 w-3 mr-1" />Add
                </Button>
              </div>
              {editing.match_conditions.map((c: any, i: number) => (
                <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2">
                  <Select value={c.field} onValueChange={(v) => {
                    const next = [...editing.match_conditions]; next[i] = { ...c, field: v };
                    setEditing({ ...editing, match_conditions: next });
                  }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{TICKET_FIELDS.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
                  </Select>
                  <Select value={c.op} onValueChange={(v) => {
                    const next = [...editing.match_conditions]; next[i] = { ...c, op: v };
                    setEditing({ ...editing, match_conditions: next });
                  }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{CONDITION_OPS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                  </Select>
                  <Input value={c.value ?? ""} onChange={(e) => {
                    const next = [...editing.match_conditions]; next[i] = { ...c, value: e.target.value };
                    setEditing({ ...editing, match_conditions: next });
                  }} placeholder="value" />
                  <Button variant="ghost" size="icon" onClick={() => setEditing({ ...editing, match_conditions: editing.match_conditions.filter((_, idx) => idx !== i) })}><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
            </div>

            {/* Steps */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label>Steps (run in order)</Label>
                <Select onValueChange={addStep}>
                  <SelectTrigger className="w-56"><SelectValue placeholder="+ Add step…" /></SelectTrigger>
                  <SelectContent>
                    {STEP_TYPES.map((s) => <SelectItem key={s.value} value={s.value}>{s.icon} {s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {editing.steps.length === 0 && <p className="text-sm text-muted-foreground">No steps yet — add one above.</p>}
              {editing.steps.map((s, i) => {
                const meta = STEP_TYPES.find((t) => t.value === s.type);
                return (
                  <Card key={i}>
                    <CardHeader className="py-2 px-3 flex flex-row items-center justify-between">
                      <CardTitle className="text-sm">{i + 1}. {meta?.icon} {meta?.label ?? s.type}</CardTitle>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => moveStep(i, -1)}><ArrowUp className="h-3 w-3" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => moveStep(i, 1)}><ArrowDown className="h-3 w-3" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => removeStep(i)}><Trash2 className="h-3 w-3" /></Button>
                      </div>
                    </CardHeader>
                    <CardContent className="px-3 pb-3 space-y-2">
                      <StepConfig step={s} onChange={(patch) => updateStepConfig(i, patch)} />
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditorOpen(false)}>Cancel</Button>
            <Button onClick={saveWorkflow}>Save workflow</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

function StepConfig({ step, onChange }: { step: Step; onChange: (patch: Record<string, any>) => void }) {
  const c = step.config ?? {};
  switch (step.type) {
    case "set_field":
      return (
        <div className="grid grid-cols-2 gap-2">
          <Input placeholder="status (e.g. open)" value={c.status ?? ""} onChange={(e) => onChange({ status: e.target.value })} />
          <Input placeholder="priority (low/medium/high/urgent)" value={c.priority ?? ""} onChange={(e) => onChange({ priority: e.target.value })} />
          <Input placeholder="category" value={c.category ?? ""} onChange={(e) => onChange({ category: e.target.value })} />
          <Input placeholder="ticket_type" value={c.ticket_type ?? ""} onChange={(e) => onChange({ ticket_type: e.target.value })} />
        </div>
      );
    case "assign":
      return <Input placeholder="User ID to assign" value={c.user_id ?? ""} onChange={(e) => onChange({ user_id: e.target.value })} />;
    case "add_tag":
      return <Input placeholder="comma-separated tags" value={(c.tags ?? []).join(",")} onChange={(e) => onChange({ tags: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} />;
    case "internal_note":
      return <Textarea placeholder="Note body. Supports {{ticket.subject}}, {{context.ai_summary}}, etc." value={c.body ?? ""} onChange={(e) => onChange({ body: e.target.value })} />;
    case "send_email":
    case "notify":
      return (
        <div className="space-y-2">
          <Select value={c.recipient ?? "reporter"} onValueChange={(v) => onChange({ recipient: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="reporter">Ticket reporter</SelectItem>
              <SelectItem value="custom">Custom email</SelectItem>
            </SelectContent>
          </Select>
          {c.recipient === "custom" && <Input placeholder="email@example.com" value={c.recipient_email ?? ""} onChange={(e) => onChange({ recipient_email: e.target.value })} />}
          <Input placeholder="Subject" value={c.subject ?? ""} onChange={(e) => onChange({ subject: e.target.value })} />
          <Textarea placeholder="Body" value={c.body ?? ""} onChange={(e) => onChange({ body: e.target.value })} />
        </div>
      );
    case "request_approval":
      return (
        <div className="space-y-2">
          <Input placeholder="Approval title" value={c.title ?? ""} onChange={(e) => onChange({ title: e.target.value })} />
          <Textarea placeholder="What is the approver deciding on?" value={c.description ?? ""} onChange={(e) => onChange({ description: e.target.value })} />
          <Input placeholder="Approver user ID (optional — empty = any admin)" value={c.approver_user_id ?? ""} onChange={(e) => onChange({ approver_user_id: e.target.value })} />
        </div>
      );
    case "escalate":
      return (
        <div className="space-y-2">
          <Input placeholder="Recipient email" value={c.recipient_email ?? ""} onChange={(e) => onChange({ recipient_email: e.target.value })} />
          <Input placeholder="Bump priority to (optional)" value={c.bump_priority ?? ""} onChange={(e) => onChange({ bump_priority: e.target.value })} />
          <Textarea placeholder="Message" value={c.body ?? ""} onChange={(e) => onChange({ body: e.target.value })} />
        </div>
      );
    case "create_cab":
      return (
        <div className="space-y-2">
          <Input placeholder="Title" value={c.title ?? ""} onChange={(e) => onChange({ title: e.target.value })} />
          <Textarea placeholder="Description" value={c.description ?? ""} onChange={(e) => onChange({ description: e.target.value })} />
          <div className="grid grid-cols-3 gap-2">
            <Input placeholder="impact" value={c.impact ?? ""} onChange={(e) => onChange({ impact: e.target.value })} />
            <Input placeholder="urgency" value={c.urgency ?? ""} onChange={(e) => onChange({ urgency: e.target.value })} />
            <Input placeholder="change_type" value={c.change_type ?? ""} onChange={(e) => onChange({ change_type: e.target.value })} />
          </div>
        </div>
      );
    case "ai_triage":
      return (
        <div className="space-y-2">
          <div className="flex items-center gap-2"><Switch checked={!!c.apply_to_ticket} onCheckedChange={(v) => onChange({ apply_to_ticket: v })} /><Label className="text-xs">Apply triage results to the ticket</Label></div>
          <p className="text-xs text-muted-foreground">AI fills <code>context.ai_category</code>, <code>ai_priority</code>, <code>ai_ticket_type</code>.</p>
        </div>
      );
    case "ai_summarize":
    case "ai_sentiment":
      return <p className="text-xs text-muted-foreground">No config required. Result available as <code>context.ai_summary</code> / <code>context.ai_sentiment</code> in later steps.</p>;
    case "ai_suggest_reply":
    case "ai_draft_reply":
      return (
        <div className="space-y-2">
          <Input placeholder="Tone (professional, empathetic, concise)" value={c.tone ?? ""} onChange={(e) => onChange({ tone: e.target.value })} />
          <Textarea placeholder="Extra instructions" value={c.instructions ?? ""} onChange={(e) => onChange({ instructions: e.target.value })} />
        </div>
      );
    case "condition":
      return <p className="text-xs text-muted-foreground">Use the workflow's match conditions or add a halt-on-false flag here. (Inline editing coming soon — for now use top-level match conditions.)</p>;
    default:
      return null;
  }
}
