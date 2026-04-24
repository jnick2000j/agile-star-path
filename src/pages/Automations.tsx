import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, Workflow, Activity, CheckCircle2, XCircle, Clock, Loader2, ChevronUp, ChevronDown, Pencil, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useOrganization } from "@/hooks/useOrganization";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  AUTOMATION_MODULES,
  AUTOMATION_TRIGGERS,
  AUTOMATION_STEP_TYPES,
  decideApproval,
  type AutomationModule,
} from "@/lib/automations";
import { AUTOMATION_TEMPLATES, type AutomationTemplate } from "@/lib/automationTemplates";

const STATUS_ICON: Record<string, JSX.Element> = {
  pending: <Clock className="h-4 w-4 text-muted-foreground" />,
  running: <Loader2 className="h-4 w-4 animate-spin text-info" />,
  awaiting_approval: <Clock className="h-4 w-4 text-warning" />,
  completed: <CheckCircle2 className="h-4 w-4 text-success" />,
  failed: <XCircle className="h-4 w-4 text-destructive" />,
  rejected: <XCircle className="h-4 w-4 text-destructive" />,
};

interface Step {
  type: string;
  label?: string;
  config?: Record<string, any>;
}

export default function Automations() {
  const { currentOrganization } = useOrganization();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [moduleFilter, setModuleFilter] = useState<string>(searchParams.get("module") || "all");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [templatesOpen, setTemplatesOpen] = useState(false);

  // Open builder if ?new=1
  useEffect(() => {
    if (searchParams.get("new") === "1") {
      setEditing({
        module: searchParams.get("module") || "project",
        name: "",
        description: "",
        trigger_event: "created",
        match_conditions: [],
        steps: [],
        is_active: true,
        priority: 100,
      });
      setEditorOpen(true);
      searchParams.delete("new");
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const { data: workflows = [] } = useQuery({
    queryKey: ["automations-workflows", currentOrganization?.id, moduleFilter],
    queryFn: async () => {
      if (!currentOrganization?.id) return [];
      let q = supabase.from("automation_workflows").select("*")
        .eq("organization_id", currentOrganization.id)
        .order("module").order("priority");
      if (moduleFilter !== "all") q = q.eq("module", moduleFilter);
      const { data } = await q;
      return data ?? [];
    },
    enabled: !!currentOrganization?.id,
  });

  const { data: runs = [] } = useQuery({
    queryKey: ["automations-runs", currentOrganization?.id, moduleFilter],
    queryFn: async () => {
      if (!currentOrganization?.id) return [];
      let q = supabase.from("automation_runs")
        .select("*, automation_workflows(name, module)")
        .eq("organization_id", currentOrganization.id)
        .order("created_at", { ascending: false }).limit(100);
      if (moduleFilter !== "all") q = q.eq("module", moduleFilter);
      const { data } = await q;
      return data ?? [];
    },
    enabled: !!currentOrganization?.id,
  });

  const { data: approvals = [] } = useQuery({
    queryKey: ["automations-approvals", currentOrganization?.id, user?.id],
    queryFn: async () => {
      if (!currentOrganization?.id) return [];
      const { data } = await supabase.from("automation_approvals").select("*")
        .eq("organization_id", currentOrganization.id)
        .eq("decision", "pending")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!currentOrganization?.id,
  });

  const myApprovals = useMemo(
    () => (approvals as any[]).filter(a => a.assigned_to_user_id === user?.id),
    [approvals, user]
  );

  const saveWorkflow = async () => {
    if (!editing || !currentOrganization?.id) return;
    if (!editing.name?.trim()) return toast.error("Name is required");
    if (!editing.steps?.length) return toast.error("Add at least one step");

    const payload: any = {
      organization_id: currentOrganization.id,
      module: editing.module,
      name: editing.name,
      description: editing.description,
      trigger_event: editing.trigger_event,
      match_conditions: editing.match_conditions || [],
      steps: editing.steps,
      is_active: editing.is_active,
      priority: editing.priority || 100,
      updated_by: user?.id,
    };
    let error;
    if (editing.id) {
      ({ error } = await supabase.from("automation_workflows").update(payload).eq("id", editing.id));
    } else {
      ({ error } = await supabase.from("automation_workflows").insert({ ...payload, created_by: user?.id }));
    }
    if (error) toast.error(error.message);
    else {
      toast.success("Saved");
      setEditorOpen(false);
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["automations-workflows"] });
    }
  };

  const deleteWorkflow = async (id: string) => {
    if (!confirm("Delete this automation?")) return;
    const { error } = await supabase.from("automation_workflows").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["automations-workflows"] });
    }
  };

  const handleApproval = async (approval_id: string, decision: "approved" | "rejected") => {
    const comment = prompt(decision === "rejected" ? "Reason for rejection?" : "Optional comment:") || undefined;
    try {
      await decideApproval(approval_id, decision, comment);
      toast.success(`${decision === "approved" ? "Approved" : "Rejected"}`);
      qc.invalidateQueries({ queryKey: ["automations-approvals"] });
      qc.invalidateQueries({ queryKey: ["automations-runs"] });
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <AppLayout title="AI Automations" subtitle="Program AI-driven workflows across every module">
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Label className="text-sm">Module</Label>
            <Select value={moduleFilter} onValueChange={setModuleFilter}>
              <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All modules</SelectItem>
                {AUTOMATION_MODULES.map(m => <SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setTemplatesOpen(true)}>
              <Sparkles className="h-4 w-4 mr-2" /> Templates
            </Button>
            <Button onClick={() => {
              setEditing({
                module: moduleFilter !== "all" ? moduleFilter : "project",
                name: "", description: "",
                trigger_event: "created",
                match_conditions: [], steps: [],
                is_active: true, priority: 100,
              });
              setEditorOpen(true);
            }}>
              <Plus className="h-4 w-4 mr-2" /> New Automation
            </Button>
          </div>
        </div>

        <Tabs defaultValue="workflows">
          <TabsList>
            <TabsTrigger value="workflows"><Workflow className="h-4 w-4 mr-2" />Workflows ({workflows.length})</TabsTrigger>
            <TabsTrigger value="runs"><Activity className="h-4 w-4 mr-2" />Runs ({runs.length})</TabsTrigger>
            <TabsTrigger value="approvals">
              <Clock className="h-4 w-4 mr-2" />My Approvals
              {myApprovals.length > 0 && <Badge variant="destructive" className="ml-2 h-5">{myApprovals.length}</Badge>}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="workflows" className="space-y-2">
            {workflows.length === 0 ? (
              <Card className="p-12 text-center text-muted-foreground">
                No automations yet. Click "New Automation" to create one.
              </Card>
            ) : workflows.map((w: any) => (
              <Card key={w.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold">{w.name}</h3>
                      <Badge variant="outline">{AUTOMATION_MODULES.find(m => m.key === w.module)?.label || w.module}</Badge>
                      <Badge variant="secondary">{w.trigger_event.replace(/_/g, " ")}</Badge>
                      <Badge variant="outline" className="text-xs">{(w.steps as any[])?.length || 0} steps</Badge>
                    </div>
                    {w.description && <p className="text-sm text-muted-foreground mt-1">{w.description}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={w.is_active} onCheckedChange={async (v) => {
                      await supabase.from("automation_workflows").update({ is_active: v }).eq("id", w.id);
                      qc.invalidateQueries({ queryKey: ["automations-workflows"] });
                    }} />
                    <Button variant="ghost" size="icon" onClick={() => { setEditing(w); setEditorOpen(true); }}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => deleteWorkflow(w.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="runs" className="space-y-2">
            {runs.length === 0 ? (
              <Card className="p-12 text-center text-muted-foreground">No runs yet.</Card>
            ) : runs.map((r: any) => (
              <Card key={r.id} className="p-3">
                <div className="flex items-center gap-3">
                  {STATUS_ICON[r.status] || <Clock className="h-4 w-4" />}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{r.automation_workflows?.name || "Workflow"}</span>
                      <Badge variant="outline" className="text-xs">{r.module}</Badge>
                      <Badge variant="secondary" className="text-xs">{r.trigger_event.replace(/_/g, " ")}</Badge>
                      <span className="text-xs text-muted-foreground">step {r.current_step_index}/{r.step_count}</span>
                    </div>
                    {r.error_message && <p className="text-xs text-destructive mt-1">{r.error_message}</p>}
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">{format(new Date(r.created_at), "MMM d HH:mm")}</span>
                </div>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="approvals" className="space-y-2">
            {myApprovals.length === 0 ? (
              <Card className="p-12 text-center text-muted-foreground">No approvals waiting on you.</Card>
            ) : myApprovals.map((a: any) => (
              <Card key={a.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold">{a.title}</h4>
                    {a.description && <p className="text-sm text-muted-foreground mt-1">{a.description}</p>}
                    <p className="text-xs text-muted-foreground mt-2">
                      {a.module} · {format(new Date(a.created_at), "PPp")}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => handleApproval(a.id, "rejected")}>Reject</Button>
                    <Button size="sm" onClick={() => handleApproval(a.id, "approved")}>Approve</Button>
                  </div>
                </div>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      </div>

      {/* Editor */}
      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Edit" : "New"} Automation</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Module</Label>
                  <Select value={editing.module} onValueChange={(v) => setEditing({ ...editing, module: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{AUTOMATION_MODULES.map(m => <SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Trigger</Label>
                  <Select value={editing.trigger_event} onValueChange={(v) => setEditing({ ...editing, trigger_event: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{AUTOMATION_TRIGGERS.map(t => <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1">
                <Label>Name</Label>
                <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="e.g. Auto-triage new high-priority risks" />
              </div>
              <div className="space-y-1">
                <Label>Description</Label>
                <Textarea rows={2} value={editing.description || ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
              </div>

              <StepEditor
                steps={editing.steps || []}
                onChange={(steps) => setEditing({ ...editing, steps })}
              />

              <div className="flex items-center gap-2">
                <Switch checked={editing.is_active} onCheckedChange={(v) => setEditing({ ...editing, is_active: v })} />
                <Label>Active</Label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditorOpen(false)}>Cancel</Button>
            <Button onClick={saveWorkflow}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

function StepEditor({ steps, onChange }: { steps: Step[]; onChange: (s: Step[]) => void }) {
  const addStep = (type: string) => {
    const meta = AUTOMATION_STEP_TYPES.find(s => s.key === type);
    onChange([...steps, { type, label: meta?.label, config: defaultConfig(type) }]);
  };
  const updateStep = (i: number, patch: Partial<Step>) => {
    const next = [...steps];
    next[i] = { ...next[i], ...patch, config: { ...(next[i].config || {}), ...(patch.config || {}) } };
    onChange(next);
  };
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= steps.length) return;
    const next = [...steps];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  const remove = (i: number) => onChange(steps.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>Steps ({steps.length})</Label>
        <Select value="" onValueChange={addStep}>
          <SelectTrigger className="w-[220px]"><SelectValue placeholder="+ Add step" /></SelectTrigger>
          <SelectContent>
            {Object.entries(
              AUTOMATION_STEP_TYPES.reduce((acc, s) => {
                (acc[s.group] ||= []).push(s);
                return acc;
              }, {} as Record<string, typeof AUTOMATION_STEP_TYPES>)
            ).map(([group, items]) => (
              <div key={group}>
                <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">{group}</div>
                {items.map(s => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
              </div>
            ))}
          </SelectContent>
        </Select>
      </div>
      {steps.length === 0 && (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          Add steps to define what the automation does.
        </Card>
      )}
      {steps.map((s, i) => (
        <Card key={i} className="p-3 space-y-2">
          <div className="flex items-center gap-2">
            <Badge variant="outline">{i + 1}</Badge>
            <Badge>{AUTOMATION_STEP_TYPES.find(t => t.key === s.type)?.label || s.type}</Badge>
            <Input
              className="flex-1 h-7 text-sm"
              value={s.label || ""}
              placeholder="Step label"
              onChange={(e) => updateStep(i, { label: e.target.value })}
            />
            <Button size="icon" variant="ghost" onClick={() => move(i, -1)} disabled={i === 0}><ChevronUp className="h-3 w-3" /></Button>
            <Button size="icon" variant="ghost" onClick={() => move(i, 1)} disabled={i === steps.length - 1}><ChevronDown className="h-3 w-3" /></Button>
            <Button size="icon" variant="ghost" onClick={() => remove(i)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
          </div>
          <StepConfigFields step={s} onChange={(config) => updateStep(i, { config })} />
        </Card>
      ))}
    </div>
  );
}

function defaultConfig(type: string): Record<string, any> {
  if (type.startsWith("ai_")) return { model: "google/gemini-2.5-flash", prompt: "", output_var: "ai_result" };
  if (type === "set_field") return { field: "", value: "" };
  if (type === "assign") return { assignee_field: "owner_id", user_id: "" };
  if (type === "add_tag") return { tag: "" };
  if (type === "notify") return { recipients: [], title: "", message: "" };
  if (type === "request_approval") return { title: "", description: "", assignee_user_id: "" };
  if (type === "create_task") return { title: "", description: "" };
  if (type === "log_note") return { message: "" };
  if (type === "condition") return { conditions: [] };
  return {};
}

function StepConfigFields({ step, onChange }: { step: Step; onChange: (c: any) => void }) {
  const c = step.config || {};
  const set = (patch: Record<string, any>) => onChange({ ...c, ...patch });

  if (step.type.startsWith("ai_")) {
    return (
      <div className="space-y-2">
        <Input placeholder="Model (e.g. google/gemini-2.5-flash)" value={c.model || ""} onChange={(e) => set({ model: e.target.value })} />
        <Textarea placeholder="Prompt (use {{entity.field}} or {{payload.x}})" rows={3} value={c.prompt || ""} onChange={(e) => set({ prompt: e.target.value })} />
        <Input placeholder="Output variable name" value={c.output_var || ""} onChange={(e) => set({ output_var: e.target.value })} />
      </div>
    );
  }
  if (step.type === "set_field") {
    return (
      <div className="grid grid-cols-2 gap-2">
        <Input placeholder="Field name" value={c.field || ""} onChange={(e) => set({ field: e.target.value })} />
        <Input placeholder="Value (or {{var}})" value={c.value || ""} onChange={(e) => set({ value: e.target.value })} />
      </div>
    );
  }
  if (step.type === "assign") {
    return (
      <div className="grid grid-cols-2 gap-2">
        <Input placeholder="Field (owner_id, assignee_id...)" value={c.assignee_field || ""} onChange={(e) => set({ assignee_field: e.target.value })} />
        <Input placeholder="User UUID" value={c.user_id || ""} onChange={(e) => set({ user_id: e.target.value })} />
      </div>
    );
  }
  if (step.type === "add_tag") {
    return <Input placeholder="Tag" value={c.tag || ""} onChange={(e) => set({ tag: e.target.value })} />;
  }
  if (step.type === "notify" || step.type === "send_email") {
    return (
      <div className="space-y-2">
        <Input placeholder="Recipient user UUIDs (comma separated)" value={(c.recipients || []).join(",")}
          onChange={(e) => set({ recipients: e.target.value.split(",").map(s => s.trim()).filter(Boolean) })} />
        <Input placeholder="Title" value={c.title || ""} onChange={(e) => set({ title: e.target.value })} />
        <Textarea rows={2} placeholder="Message" value={c.message || ""} onChange={(e) => set({ message: e.target.value })} />
      </div>
    );
  }
  if (step.type === "request_approval") {
    return (
      <div className="space-y-2">
        <Input placeholder="Approval title" value={c.title || ""} onChange={(e) => set({ title: e.target.value })} />
        <Textarea rows={2} placeholder="Description" value={c.description || ""} onChange={(e) => set({ description: e.target.value })} />
        <Input placeholder="Approver user UUID" value={c.assignee_user_id || ""} onChange={(e) => set({ assignee_user_id: e.target.value })} />
      </div>
    );
  }
  if (step.type === "create_task") {
    return (
      <div className="space-y-2">
        <Input placeholder="Task title" value={c.title || ""} onChange={(e) => set({ title: e.target.value })} />
        <Textarea rows={2} placeholder="Description" value={c.description || ""} onChange={(e) => set({ description: e.target.value })} />
      </div>
    );
  }
  if (step.type === "log_note") {
    return <Textarea rows={2} placeholder="Note text (supports {{var}})" value={c.message || ""} onChange={(e) => set({ message: e.target.value })} />;
  }
  if (step.type === "condition") {
    return (
      <Textarea rows={3} placeholder='Conditions JSON, e.g. [{"field":"status","op":"eq","value":"open"}]'
        value={JSON.stringify(c.conditions || [], null, 2)}
        onChange={(e) => {
          try { set({ conditions: JSON.parse(e.target.value) }); } catch {}
        }} />
    );
  }
  return null;
}
