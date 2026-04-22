import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { toast } from "sonner";
import {
  CheckCircle2,
  Circle,
  Clock,
  Pause,
  Plus,
  Trash2,
  XCircle,
  ListChecks,
  Link2,
} from "lucide-react";

type Parent =
  | { kind: "risk"; id: string; organizationId: string; programmeId?: string | null; projectId?: string | null; productId?: string | null }
  | { kind: "issue"; id: string; organizationId: string; programmeId?: string | null; projectId?: string | null; productId?: string | null };

interface RemediationTasksPanelProps {
  parent: Parent;
}

type TaskStatus = "not_started" | "in_progress" | "on_hold" | "completed" | "cancelled";

const statusConfig: Record<TaskStatus, { label: string; icon: React.ElementType; color: string }> = {
  not_started: { label: "Not Started", icon: Circle, color: "bg-muted text-muted-foreground" },
  in_progress: { label: "In Progress", icon: Clock, color: "bg-primary/20 text-primary" },
  on_hold: { label: "On Hold", icon: Pause, color: "bg-warning/20 text-warning" },
  completed: { label: "Completed", icon: CheckCircle2, color: "bg-success/20 text-success" },
  cancelled: { label: "Cancelled", icon: XCircle, color: "bg-destructive/20 text-destructive" },
};

export function RemediationTasksPanel({ parent }: RemediationTasksPanelProps) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [showLinkPopover, setShowLinkPopover] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [plannedEnd, setPlannedEnd] = useState("");

  const filterCol = parent.kind === "risk" ? "risk_id" : "issue_id";

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["remediation-tasks", parent.kind, parent.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("id, name, reference_number, description, status, priority, planned_end, completion_percentage")
        .eq(filterCol, parent.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Available unlinked tasks within the same org for linking
  const { data: linkableTasks = [] } = useQuery({
    queryKey: ["linkable-tasks", parent.kind, parent.id, parent.organizationId],
    queryFn: async () => {
      const linkedIds = new Set((tasks || []).map((t: any) => t.id));
      const { data } = await supabase
        .from("tasks")
        .select("id, name, reference_number, status, risk_id, issue_id")
        .eq("organization_id", parent.organizationId)
        .is(filterCol, null)
        .order("created_at", { ascending: false })
        .limit(100);
      return (data || []).filter((t: any) => !linkedIds.has(t.id));
    },
    enabled: showLinkPopover,
  });

  const createTask = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("Task name required");
      const payload: Record<string, unknown> = {
        name: name.trim(),
        description: description || null,
        priority,
        planned_end: plannedEnd || null,
        organization_id: parent.organizationId,
        created_by: user?.id,
        programme_id: parent.programmeId || null,
        project_id: parent.projectId || null,
        product_id: parent.productId || null,
      };
      payload[filterCol] = parent.id;
      const { error } = await supabase.from("tasks").insert(payload as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["remediation-tasks", parent.kind, parent.id] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Remediation task added");
      setName("");
      setDescription("");
      setPriority("medium");
      setPlannedEnd("");
      setShowForm(false);
    },
    onError: (err: any) => toast.error(err.message || "Failed to add task"),
  });

  const linkExistingTask = useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase
        .from("tasks")
        .update({ [filterCol]: parent.id })
        .eq("id", taskId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["remediation-tasks", parent.kind, parent.id] });
      qc.invalidateQueries({ queryKey: ["linkable-tasks", parent.kind, parent.id] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Task linked");
      setShowLinkPopover(false);
    },
    onError: (err: any) => toast.error(err.message || "Failed to link"),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: TaskStatus }) => {
      const updateData: Record<string, unknown> = { status };
      if (status === "completed") {
        updateData.completion_percentage = 100;
        updateData.actual_end = new Date().toISOString().split("T")[0];
      }
      const { error } = await supabase.from("tasks").update(updateData).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["remediation-tasks", parent.kind, parent.id] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: (err: any) => toast.error(err.message || "Failed to update"),
  });

  const removeTask = useMutation({
    mutationFn: async (id: string) => {
      // Unlink rather than delete the task entirely
      const { error } = await supabase
        .from("tasks")
        .update({ [filterCol]: null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["remediation-tasks", parent.kind, parent.id] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Task unlinked");
    },
    onError: (err: any) => toast.error(err.message || "Failed to unlink"),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ListChecks className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Remediation Tasks ({tasks.length})</h3>
        </div>
        <div className="flex gap-2">
          <Popover open={showLinkPopover} onOpenChange={setShowLinkPopover}>
            <PopoverTrigger asChild>
              <Button size="sm" variant="outline">
                <Link2 className="h-3.5 w-3.5 mr-1" />
                Link Existing
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="end">
              <Command>
                <CommandInput placeholder="Search tasks..." />
                <CommandList>
                  <CommandEmpty>No unlinked tasks found.</CommandEmpty>
                  <CommandGroup>
                    {linkableTasks.map((t: any) => (
                      <CommandItem
                        key={t.id}
                        value={`${t.reference_number || ""} ${t.name}`}
                        onSelect={() => linkExistingTask.mutate(t.id)}
                      >
                        <div className="flex flex-col gap-0.5 w-full">
                          <div className="flex items-center gap-2">
                            {t.reference_number && (
                              <span className="font-mono text-[10px] text-muted-foreground">
                                {t.reference_number}
                              </span>
                            )}
                            <span className="text-sm truncate">{t.name}</span>
                          </div>
                          <Badge variant="outline" className="text-[9px] w-fit">
                            {t.status}
                          </Badge>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          <Button size="sm" variant="outline" onClick={() => setShowForm((s) => !s)}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            {showForm ? "Cancel" : "New Task"}
          </Button>
        </div>
      </div>

      {showForm && (
        <div className="rounded-md border bg-muted/30 p-3 space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Task Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Patch vulnerable library" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Action to remediate this..." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Due Date</Label>
              <Input type="date" value={plannedEnd} onChange={(e) => setPlannedEnd(e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end">
            <Button size="sm" onClick={() => createTask.mutate()} disabled={!name.trim() || createTask.isPending}>
              Create Task
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {isLoading ? (
          <p className="text-xs text-muted-foreground">Loading tasks…</p>
        ) : tasks.length === 0 ? (
          <p className="text-xs text-muted-foreground">No remediation tasks yet. Add a new one or link an existing task.</p>
        ) : (
          tasks.map((t: any) => {
            const cfg = statusConfig[t.status as TaskStatus];
            const Icon = cfg?.icon || Circle;
            return (
              <div key={t.id} className="flex items-center gap-2 rounded-md border bg-card p-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {t.reference_number && (
                      <span className="font-mono text-[10px] text-muted-foreground">{t.reference_number}</span>
                    )}
                    <p className="font-medium text-sm truncate">{t.name}</p>
                    <Badge variant="outline" className="text-[10px]">{t.priority}</Badge>
                  </div>
                  {t.description && (
                    <p className="text-xs text-muted-foreground line-clamp-1">{t.description}</p>
                  )}
                </div>
                <Badge className={cfg?.color}>
                  <Icon className="h-3 w-3 mr-1" />
                  {cfg?.label || t.status}
                </Badge>
                <Select
                  value={t.status}
                  onValueChange={(v) => updateStatus.mutate({ id: t.id, status: v as TaskStatus })}
                >
                  <SelectTrigger className="w-32 h-7 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="not_started">Not Started</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="on_hold">On Hold</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  onClick={() => removeTask.mutate(t.id)}
                  title="Unlink task"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
