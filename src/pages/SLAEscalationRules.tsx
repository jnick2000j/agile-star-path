import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  AlarmClock,
  Plus,
  Pencil,
  Trash2,
  Play,
  Activity,
  ShieldAlert,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import { useOrgAccessLevel } from "@/hooks/useOrgAccessLevel";
import { format } from "date-fns";
import { toast } from "sonner";
import { Link } from "react-router-dom";

interface RuleForm {
  id?: string;
  name: string;
  description: string;
  is_active: boolean;
  sla_leg: "response" | "resolution";
  trigger_type: "warning" | "breach";
  threshold_percent: number;
  priority_filter: string[];
  raise_priority: boolean;
  reassign_to: string | null;
  notify_assignee: boolean;
  notify_user_ids: string[];
  post_internal_note: boolean;
  note_template: string;
}

const empty: RuleForm = {
  name: "",
  description: "",
  is_active: true,
  sla_leg: "resolution",
  trigger_type: "warning",
  threshold_percent: 80,
  priority_filter: [],
  raise_priority: false,
  reassign_to: null,
  notify_assignee: true,
  notify_user_ids: [],
  post_internal_note: true,
  note_template: "",
};

const PRIORITIES = ["low", "medium", "high", "urgent"];

export default function SLAEscalationRules() {
  const { user } = useAuth();
  const { currentOrganization } = useOrganization();
  const { accessLevel } = useOrgAccessLevel();
  const isAdmin = accessLevel === "admin";
  const qc = useQueryClient();
  const [editing, setEditing] = useState<RuleForm | null>(null);
  const [open, setOpen] = useState(false);
  const [running, setRunning] = useState(false);

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ["sla-esc-rules", currentOrganization?.id],
    enabled: !!currentOrganization?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("helpdesk_sla_escalation_rules")
        .select("*")
        .eq("organization_id", currentOrganization!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: events = [] } = useQuery({
    queryKey: ["sla-esc-events", currentOrganization?.id],
    enabled: !!currentOrganization?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("helpdesk_sla_escalation_events")
        .select("*, helpdesk_sla_escalation_rules(name)")
        .eq("organization_id", currentOrganization!.id)
        .order("fired_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });

  const startNew = () => {
    setEditing({ ...empty });
    setOpen(true);
  };
  const startEdit = (r: any) => {
    setEditing({
      id: r.id,
      name: r.name,
      description: r.description ?? "",
      is_active: r.is_active,
      sla_leg: r.sla_leg,
      trigger_type: r.trigger_type,
      threshold_percent: r.threshold_percent,
      priority_filter: r.priority_filter ?? [],
      raise_priority: r.raise_priority,
      reassign_to: r.reassign_to,
      notify_assignee: r.notify_assignee,
      notify_user_ids: r.notify_user_ids ?? [],
      post_internal_note: r.post_internal_note,
      note_template: r.note_template ?? "",
    });
    setOpen(true);
  };

  const save = async () => {
    if (!editing || !currentOrganization) return;
    if (!editing.name.trim()) {
      toast.error("Name is required");
      return;
    }
    const payload: any = {
      organization_id: currentOrganization.id,
      name: editing.name.trim(),
      description: editing.description.trim() || null,
      is_active: editing.is_active,
      sla_leg: editing.sla_leg,
      trigger_type: editing.trigger_type,
      threshold_percent: editing.threshold_percent,
      priority_filter: editing.priority_filter.length ? editing.priority_filter : null,
      raise_priority: editing.raise_priority,
      reassign_to: editing.reassign_to,
      notify_assignee: editing.notify_assignee,
      notify_user_ids: editing.notify_user_ids,
      post_internal_note: editing.post_internal_note,
      note_template: editing.note_template.trim() || null,
    };
    let error;
    if (editing.id) {
      ({ error } = await supabase
        .from("helpdesk_sla_escalation_rules")
        .update(payload)
        .eq("id", editing.id));
    } else {
      payload.created_by = user?.id;
      ({ error } = await supabase.from("helpdesk_sla_escalation_rules").insert(payload));
    }
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(editing.id ? "Rule updated" : "Rule created");
    setOpen(false);
    setEditing(null);
    qc.invalidateQueries({ queryKey: ["sla-esc-rules"] });
  };

  const remove = async (r: any) => {
    const { error } = await supabase
      .from("helpdesk_sla_escalation_rules")
      .delete()
      .eq("id", r.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Rule deleted");
    qc.invalidateQueries({ queryKey: ["sla-esc-rules"] });
  };

  const runNow = async () => {
    setRunning(true);
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sla-escalation-engine`;
      const resp = await fetch(url, { method: "POST" });
      const data = await resp.json();
      if (data.ok) {
        toast.success(
          `Engine ran: ${data.rulesEvaluated} rule(s) evaluated, ${data.eventsFired} event(s) fired`
        );
        qc.invalidateQueries({ queryKey: ["sla-esc-events"] });
      } else {
        toast.error(data.error ?? "Engine failed");
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Engine failed");
    } finally {
      setRunning(false);
    }
  };

  const togglePriority = (p: string) => {
    if (!editing) return;
    setEditing({
      ...editing,
      priority_filter: editing.priority_filter.includes(p)
        ? editing.priority_filter.filter((x) => x !== p)
        : [...editing.priority_filter, p],
    });
  };

  return (
    <AppLayout title="SLA Escalation Engine">
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <AlarmClock className="h-6 w-6" /> SLA Escalation Engine
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Automatically escalate tickets approaching or breaching their SLA.
              The engine runs every 5 minutes.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={runNow} disabled={running}>
              <Play className="h-4 w-4 mr-2" /> {running ? "Running…" : "Run now"}
            </Button>
            {isAdmin && (
              <Button onClick={startNew}>
                <Plus className="h-4 w-4 mr-2" /> New Rule
              </Button>
            )}
          </div>
        </div>

        <Tabs defaultValue="rules">
          <TabsList>
            <TabsTrigger value="rules">
              <ShieldAlert className="h-4 w-4 mr-2" /> Rules ({rules.length})
            </TabsTrigger>
            <TabsTrigger value="events">
              <Activity className="h-4 w-4 mr-2" /> Recent Escalations ({events.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="rules" className="space-y-3 mt-4">
            {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
            {!isLoading && rules.length === 0 && (
              <Card className="p-12 text-center text-muted-foreground">
                No escalation rules yet. {isAdmin ? "Click New Rule to create one." : "Ask an Administrator to create one."}
              </Card>
            )}
            {rules.map((r: any) => (
              <Card key={r.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{r.name}</h3>
                      <Badge variant={r.is_active ? "default" : "outline"}>
                        {r.is_active ? "Active" : "Disabled"}
                      </Badge>
                      <Badge variant={r.trigger_type === "breach" ? "destructive" : "secondary"}>
                        {r.trigger_type === "breach" ? "Breach" : `Warning @ ${r.threshold_percent}%`}
                      </Badge>
                      <Badge variant="outline">{r.sla_leg} SLA</Badge>
                    </div>
                    {r.description && (
                      <p className="text-sm text-muted-foreground mt-1">{r.description}</p>
                    )}
                    <div className="flex flex-wrap gap-1 mt-2 text-xs">
                      {r.priority_filter?.length > 0 && (
                        <Badge variant="outline">
                          Priorities: {r.priority_filter.join(", ")}
                        </Badge>
                      )}
                      {r.raise_priority && <Badge variant="outline">↑ priority</Badge>}
                      {r.reassign_to && <Badge variant="outline">reassign</Badge>}
                      {r.notify_assignee && <Badge variant="outline">notify assignee</Badge>}
                      {(r.notify_user_ids?.length ?? 0) > 0 && (
                        <Badge variant="outline">notify {r.notify_user_ids.length} user(s)</Badge>
                      )}
                      {r.post_internal_note && <Badge variant="outline">internal note</Badge>}
                    </div>
                  </div>
                  {isAdmin && (
                    <div className="flex items-center gap-1">
                      <Button size="icon" variant="ghost" onClick={() => startEdit(r)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="icon" variant="ghost">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete rule?</AlertDialogTitle>
                            <AlertDialogDescription>
                              "{r.name}" will be removed. Past events are kept for audit.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => remove(r)}>
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="events" className="space-y-2 mt-4">
            {events.length === 0 && (
              <Card className="p-12 text-center text-muted-foreground">
                No escalations have fired yet.
              </Card>
            )}
            {events.map((e: any) => (
              <Card key={e.id} className="p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={e.trigger_type === "breach" ? "destructive" : "secondary"}>
                        {e.trigger_type}
                      </Badge>
                      <Badge variant="outline">{e.sla_leg} SLA</Badge>
                      <span className="text-sm font-medium">
                        {e.helpdesk_sla_escalation_rules?.name ?? "Rule deleted"}
                      </span>
                      <Link
                        to={`/support/tickets/${e.ticket_id}`}
                        className="text-sm text-primary hover:underline"
                      >
                        View ticket →
                      </Link>
                    </div>
                    {Array.isArray(e.actions_taken) && e.actions_taken.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Actions: {e.actions_taken.join(" · ")}
                      </p>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {format(new Date(e.fired_at), "PP p")}
                  </span>
                </div>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Edit Rule" : "New Escalation Rule"}</DialogTitle>
          </DialogHeader>

          {editing && (
            <div className="space-y-4">
              <div>
                <Label>Name *</Label>
                <Input
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  placeholder="Escalate urgent tickets at 80% SLA"
                />
              </div>
              <div>
                <Label>Description</Label>
                <Input
                  value={editing.description}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>SLA leg</Label>
                  <Select
                    value={editing.sla_leg}
                    onValueChange={(v: any) => setEditing({ ...editing, sla_leg: v })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="response">First response</SelectItem>
                      <SelectItem value="resolution">Resolution</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Trigger</Label>
                  <Select
                    value={editing.trigger_type}
                    onValueChange={(v: any) => setEditing({ ...editing, trigger_type: v })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="warning">Warning (approaching)</SelectItem>
                      <SelectItem value="breach">Breach (already missed)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {editing.trigger_type === "warning" && (
                <div>
                  <Label>Threshold (% of SLA elapsed): {editing.threshold_percent}%</Label>
                  <Input
                    type="number"
                    min={1}
                    max={100}
                    value={editing.threshold_percent}
                    onChange={(e) =>
                      setEditing({ ...editing, threshold_percent: Number(e.target.value) })
                    }
                  />
                </div>
              )}

              <div>
                <Label>Apply only to priorities (leave empty for all)</Label>
                <div className="flex gap-2 mt-1">
                  {PRIORITIES.map((p) => (
                    <Button
                      key={p}
                      type="button"
                      size="sm"
                      variant={editing.priority_filter.includes(p) ? "default" : "outline"}
                      onClick={() => togglePriority(p)}
                    >
                      {p}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="border-t pt-4 space-y-3">
                <h4 className="font-medium text-sm">Actions</h4>
                <div className="flex items-center justify-between">
                  <Label htmlFor="raise" className="font-normal">Raise priority by one level</Label>
                  <Switch
                    id="raise"
                    checked={editing.raise_priority}
                    onCheckedChange={(v) => setEditing({ ...editing, raise_priority: v })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="notify-assignee" className="font-normal">Notify current assignee</Label>
                  <Switch
                    id="notify-assignee"
                    checked={editing.notify_assignee}
                    onCheckedChange={(v) => setEditing({ ...editing, notify_assignee: v })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="note" className="font-normal">Post internal note on ticket</Label>
                  <Switch
                    id="note"
                    checked={editing.post_internal_note}
                    onCheckedChange={(v) => setEditing({ ...editing, post_internal_note: v })}
                  />
                </div>
                {editing.post_internal_note && (
                  <div>
                    <Label className="text-xs">
                      Note template (use {"{{rule.name}}"}, {"{{rule.trigger_type}}"}, {"{{rule.sla_leg}}"}, {"{{actions}}"})
                    </Label>
                    <Textarea
                      rows={3}
                      value={editing.note_template}
                      onChange={(e) => setEditing({ ...editing, note_template: e.target.value })}
                      placeholder="Leave blank for default"
                    />
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between border-t pt-4">
                <Label htmlFor="active" className="font-normal">Rule active</Label>
                <Switch
                  id="active"
                  checked={editing.is_active}
                  onCheckedChange={(v) => setEditing({ ...editing, is_active: v })}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save}>{editing?.id ? "Save changes" : "Create rule"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
