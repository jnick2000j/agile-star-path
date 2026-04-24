import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { TaskAssignments } from "@/components/TaskAssignments";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Save, Trash2, Clock } from "lucide-react";

interface TaskData {
  id: string;
  name: string;
  description: string | null;
  status: string;
  priority: string;
  planned_start: string | null;
  planned_end: string | null;
  estimated_hours: number | null;
  story_points: number | null;
  sprint_id: string | null;
  project_id: string | null;
  programme_id: string | null;
  product_id: string | null;
  work_package_id: string | null;
  risk_id: string | null;
  issue_id: string | null;
}

interface EditTaskDialogProps {
  task: TaskData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: () => void;
}

export function EditTaskDialog({ task, open, onOpenChange, onUpdate }: EditTaskDialogProps) {
  const { currentOrganization } = useOrganization();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [status, setStatus] = useState("not_started");
  const [plannedStart, setPlannedStart] = useState("");
  const [plannedEnd, setPlannedEnd] = useState("");
  const [estimatedHours, setEstimatedHours] = useState("");
  const [storyPoints, setStoryPoints] = useState("");
  const [sprintId, setSprintId] = useState("");
  const [programmeId, setProgrammeId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [productId, setProductId] = useState("");
  const [workPackageId, setWorkPackageId] = useState("");
  const [riskId, setRiskId] = useState("");
  const [issueId, setIssueId] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: sprints = [] } = useQuery({
    queryKey: ["sprints-for-task", currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization?.id) return [];
      const { data, error } = await supabase
        .from("sprints")
        .select("id, name, status")
        .eq("organization_id", currentOrganization.id)
        .in("status", ["planning", "active"])
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!currentOrganization?.id && open,
  });

  const { data: programmes = [] } = useQuery({
    queryKey: ["programmes-for-task", currentOrganization?.id],
    queryFn: async () => {
      const q = supabase.from("programmes").select("id, name").order("name");
      const { data } = currentOrganization?.id
        ? await q.or(`organization_id.eq.${currentOrganization.id},organization_id.is.null`)
        : await q;
      return data || [];
    },
    enabled: open,
  });

  const { data: projects = [] } = useQuery({
    queryKey: ["projects-for-task", currentOrganization?.id],
    queryFn: async () => {
      const q = supabase.from("projects").select("id, name, programme_id").order("name");
      const { data } = currentOrganization?.id
        ? await q.or(`organization_id.eq.${currentOrganization.id},organization_id.is.null`)
        : await q;
      return data || [];
    },
    enabled: open,
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products-for-task", currentOrganization?.id],
    queryFn: async () => {
      const q = supabase.from("products").select("id, name, programme_id, project_id").order("name");
      const { data } = currentOrganization?.id
        ? await q.or(`organization_id.eq.${currentOrganization.id},organization_id.is.null`)
        : await q;
      return data || [];
    },
    enabled: open,
  });

  const { data: workPackages = [] } = useQuery({
    queryKey: ["wp-for-task", projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data } = await supabase
        .from("work_packages")
        .select("id, name")
        .eq("project_id", projectId)
        .order("name");
      return data || [];
    },
    enabled: open && !!projectId,
  });

  const { data: risks = [] } = useQuery({
    queryKey: ["risks-for-task", currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization?.id) return [];
      const { data } = await supabase
        .from("risks")
        .select("id, title, reference_number")
        .eq("organization_id", currentOrganization.id)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: open && !!currentOrganization?.id,
  });

  const { data: issues = [] } = useQuery({
    queryKey: ["issues-for-task", currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization?.id) return [];
      const { data } = await supabase
        .from("issues")
        .select("id, title, reference_number")
        .eq("organization_id", currentOrganization.id)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: open && !!currentOrganization?.id,
  });

  useEffect(() => {
    if (task) {
      setName(task.name);
      setDescription(task.description || "");
      setPriority(task.priority);
      setStatus(task.status);
      setPlannedStart(task.planned_start || "");
      setPlannedEnd(task.planned_end || "");
      setEstimatedHours(task.estimated_hours?.toString() || "");
      setStoryPoints(task.story_points?.toString() || "");
      setSprintId(task.sprint_id || "");
      setProgrammeId(task.programme_id || "");
      setProjectId(task.project_id || "");
      setProductId(task.product_id || "");
      setWorkPackageId(task.work_package_id || "");
      setRiskId((task as any).risk_id || "");
      setIssueId((task as any).issue_id || "");
    }
  }, [task]);

  if (!task) return null;

  const handleSave = async () => {
    setSaving(true);
    const updateData: Record<string, unknown> = {
      name,
      description: description || null,
      priority,
      status,
      planned_start: plannedStart || null,
      planned_end: plannedEnd || null,
      estimated_hours: estimatedHours ? Number(estimatedHours) : null,
      story_points: storyPoints ? Number(storyPoints) : null,
      sprint_id: sprintId || null,
      programme_id: programmeId || null,
      project_id: projectId || null,
      product_id: productId || null,
      work_package_id: workPackageId || null,
      risk_id: riskId || null,
      issue_id: issueId || null,
    };

    if (status === "completed") {
      updateData.completion_percentage = 100;
      updateData.actual_end = new Date().toISOString().split("T")[0];
    }

    const { error } = await supabase.from("tasks").update(updateData).eq("id", task.id);

    if (error) {
      toast.error("Failed to update task");
      console.error(error);
    } else {
      toast.success("Task updated");
      onOpenChange(false);
      onUpdate();
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    const { error } = await supabase.from("tasks").delete().eq("id", task.id);
    if (error) {
      toast.error("Failed to delete task");
    } else {
      toast.success("Task deleted");
      onOpenChange(false);
      onUpdate();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>Edit Task</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Priority</Label>
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
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="not_started">Not Started</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="on_hold">On Hold</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Story Points</Label>
              <Input
                type="number"
                value={storyPoints}
                onChange={(e) => setStoryPoints(e.target.value)}
                placeholder="—"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Program</Label>
              <Select value={programmeId || "none"} onValueChange={(v) => { setProgrammeId(v === "none" ? "" : v); }}>
                <SelectTrigger><SelectValue placeholder="No program" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Program</SelectItem>
                  {programmes.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Project</Label>
              <Select value={projectId || "none"} onValueChange={(v) => { setProjectId(v === "none" ? "" : v); setWorkPackageId(""); }}>
                <SelectTrigger><SelectValue placeholder="No project" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Project</SelectItem>
                  {projects
                    .filter((p: any) => !programmeId || p.programme_id === programmeId || !p.programme_id)
                    .map((p: any) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Product</Label>
              <Select value={productId || "none"} onValueChange={(v) => setProductId(v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="No product" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Product</SelectItem>
                  {products
                    .filter((p: any) => (!programmeId || p.programme_id === programmeId || !p.programme_id) && (!projectId || p.project_id === projectId || !p.project_id))
                    .map((p: any) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Work Package</Label>
              <Select value={workPackageId || "none"} onValueChange={(v) => setWorkPackageId(v === "none" ? "" : v)} disabled={!projectId}>
                <SelectTrigger><SelectValue placeholder={projectId ? "No work package" : "Select project first"} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Work Package</SelectItem>
                  {workPackages.map((w: any) => (
                    <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Linked Risk</Label>
              <Select value={riskId || "none"} onValueChange={(v) => setRiskId(v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="No linked risk" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Risk</SelectItem>
                  {risks.map((r: any) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.reference_number ? `${r.reference_number} — ` : ""}{r.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Linked Issue</Label>
              <Select value={issueId || "none"} onValueChange={(v) => setIssueId(v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="No linked issue" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Issue</SelectItem>
                  {issues.map((i: any) => (
                    <SelectItem key={i.id} value={i.id}>
                      {i.reference_number ? `${i.reference_number} — ` : ""}{i.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Sprint</Label>
            <Select value={sprintId || "none"} onValueChange={(v) => setSprintId(v === "none" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="No sprint" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No Sprint</SelectItem>
                {sprints.map((s: any) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name} ({s.status})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <TaskAssignments
            taskId={task.id}
            organizationId={currentOrganization?.id}
            projectId={task.project_id}
            programmeId={task.programme_id}
            productId={task.product_id}
          />
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Planned Start</Label>
              <Input
                type="date"
                value={plannedStart}
                onChange={(e) => setPlannedStart(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Planned End</Label>
              <Input
                type="date"
                value={plannedEnd}
                onChange={(e) => setPlannedEnd(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Est. Hours</Label>
              <Input
                type="number"
                value={estimatedHours}
                onChange={(e) => setEstimatedHours(e.target.value)}
                placeholder="—"
              />
            </div>
          </div>
          <div className="flex justify-between pt-2">
            <Button variant="destructive" size="sm" onClick={handleDelete}>
              <Trash2 className="h-4 w-4 mr-1" /> Delete
            </Button>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  if (!task) return;
                  onOpenChange(false);
                  navigate(`/timesheets?taskId=${task.id}`);
                }}
                disabled={!task}
              >
                <Clock className="h-4 w-4 mr-1" /> Log Time
              </Button>
              <Button onClick={handleSave} disabled={saving || !name}>
                <Save className="h-4 w-4 mr-1" /> Save Changes
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
