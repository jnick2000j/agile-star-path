import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { useAuth } from "@/hooks/useAuth";
import { useOrgAccessLevel } from "@/hooks/useOrgAccessLevel";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Plus,
  CheckCircle2,
  Clock,
  Circle,
  XCircle,
  Pause,
  ChevronRight,
  ChevronDown,
  CalendarDays,
  User,
  ListTree,
  MessageSquarePlus,
  Trash2,
  Copy,
  Repeat,
  CornerDownRight,
  Plus as PlusIcon,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { EntityUpdates } from "@/components/EntityUpdates";
import { TaskAssignments } from "@/components/TaskAssignments";
import { UpdateFrequencySettings } from "@/components/UpdateFrequencySettings";
import { EditTaskDialog } from "@/components/dialogs/EditTaskDialog";
import { RecurringTaskDialog } from "@/components/dialogs/RecurringTaskDialog";
import { format } from "date-fns";

type TaskStatus = "not_started" | "in_progress" | "on_hold" | "completed" | "cancelled";

interface Task {
  id: string;
  name: string;
  reference_number: string | null;
  description: string | null;
  status: TaskStatus;
  priority: string;
  parent_task_id: string | null;
  project_id: string | null;
  programme_id: string | null;
  product_id: string | null;
  work_package_id: string | null;
  risk_id: string | null;
  issue_id: string | null;
  assigned_to: string | null;
  planned_start: string | null;
  planned_end: string | null;
  actual_start: string | null;
  actual_end: string | null;
  estimated_hours: number | null;
  actual_hours: number | null;
  organization_id: string | null;
  created_by: string | null;
  created_at: string;
  completion_percentage: number;
}

interface WorkPackage {
  id: string;
  name: string;
  project_id: string | null;
}

const statusConfig: Record<TaskStatus, { label: string; icon: React.ElementType; color: string }> = {
  not_started: { label: "Not Started", icon: Circle, color: "bg-muted text-muted-foreground" },
  in_progress: { label: "In Progress", icon: Clock, color: "bg-primary/20 text-primary" },
  on_hold: { label: "On Hold", icon: Pause, color: "bg-warning/20 text-warning" },
  completed: { label: "Completed", icon: CheckCircle2, color: "bg-success/20 text-success" },
  cancelled: { label: "Cancelled", icon: XCircle, color: "bg-destructive/20 text-destructive" },
};

export default function TaskManagement({ embedded }: { embedded?: boolean }) {
  const { currentOrganization } = useOrganization();
  const { user } = useAuth();
  const { accessLevel } = useOrgAccessLevel();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const isOrgManager = accessLevel === "admin" || accessLevel === "manager";

  // Tasks the current user is explicitly assigned to via task_assignments
  const { data: myAssignedTaskIds = new Set<string>() } = useQuery({
    queryKey: ["my-task-assignments", user?.id, currentOrganization?.id],
    enabled: !!user?.id && !!currentOrganization?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("task_assignments")
        .select("task_id")
        .eq("user_id", user!.id);
      return new Set<string>((data || []).map((r: any) => r.task_id));
    },
  });

  const canLogTimeOnTask = (task: Task) =>
    isOrgManager ||
    task.assigned_to === user?.id ||
    myAssignedTaskIds.has(task.id);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [entityFilter, setEntityFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [editingTask, setEditingTask] = useState<any>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<{ id: string; name: string } | null>(null);
  const [recurringOpen, setRecurringOpen] = useState(false);
  const [recurringSeed, setRecurringSeed] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    priority: "medium",
    status: "not_started" as TaskStatus,
    entity_type: "project",
    entity_id: "",
    work_package_id: "",
    parent_task_id: "",
    planned_start: "",
    planned_end: "",
    estimated_hours: "",
  });

  // Fetch tasks
  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["tasks", currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization?.id) return [];
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("organization_id", currentOrganization.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Task[];
    },
    enabled: !!currentOrganization?.id,
  });

  // Fetch projects for linking
  const { data: projects = [] } = useQuery({
    queryKey: ["projects-list", currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization?.id) return [];
      const { data, error } = await supabase
        .from("projects")
        .select("id, name")
        .eq("organization_id", currentOrganization.id);
      if (error) throw error;
      return data;
    },
    enabled: !!currentOrganization?.id,
  });

  // Fetch programmes for linking
  const { data: programmes = [] } = useQuery({
    queryKey: ["programmes-list", currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization?.id) return [];
      const { data, error } = await supabase
        .from("programmes")
        .select("id, name")
        .eq("organization_id", currentOrganization.id);
      if (error) throw error;
      return data;
    },
    enabled: !!currentOrganization?.id,
  });

  // Fetch products for linking
  const { data: products = [] } = useQuery({
    queryKey: ["products-list", currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization?.id) return [];
      const { data, error } = await supabase
        .from("products")
        .select("id, name")
        .eq("organization_id", currentOrganization.id);
      if (error) throw error;
      return data;
    },
    enabled: !!currentOrganization?.id,
  });

  // Fetch work packages for linking
  const { data: workPackages = [] } = useQuery({
    queryKey: ["work-packages-list", currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization?.id) return [];
      const { data, error } = await supabase
        .from("work_packages")
        .select("id, name, project_id")
        .eq("organization_id", currentOrganization.id);
      if (error) throw error;
      return data as WorkPackage[];
    },
    enabled: !!currentOrganization?.id,
  });

  // Fetch risks for displaying linked items
  const { data: risksList = [] } = useQuery({
    queryKey: ["risks-mini-list", currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization?.id) return [];
      const { data } = await supabase
        .from("risks")
        .select("id, title, reference_number")
        .eq("organization_id", currentOrganization.id);
      return data || [];
    },
    enabled: !!currentOrganization?.id,
  });

  const { data: issuesList = [] } = useQuery({
    queryKey: ["issues-mini-list", currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization?.id) return [];
      const { data } = await supabase
        .from("issues")
        .select("id, title, reference_number")
        .eq("organization_id", currentOrganization.id);
      return data || [];
    },
    enabled: !!currentOrganization?.id,
  });

  // Create task mutation
  const createTask = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase.from("tasks").insert({
        name: data.name,
        description: data.description || null,
        priority: data.priority,
        status: data.status as TaskStatus,
        planned_start: data.planned_start || null,
        planned_end: data.planned_end || null,
        estimated_hours: data.estimated_hours ? parseFloat(data.estimated_hours) : null,
        organization_id: currentOrganization?.id,
        created_by: user?.id,
        project_id: data.entity_type === "project" && data.entity_id ? data.entity_id : null,
        programme_id: data.entity_type === "program" && data.entity_id ? data.entity_id : null,
        product_id: data.entity_type === "product" && data.entity_id ? data.entity_id : null,
        work_package_id: data.work_package_id || null,
        parent_task_id: data.parent_task_id || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Task created successfully");
      setDialogOpen(false);
      setFormData({
        name: "",
        description: "",
        priority: "medium",
        status: "not_started",
        entity_type: "project",
        entity_id: "",
        work_package_id: "",
        parent_task_id: "",
        planned_start: "",
        planned_end: "",
        estimated_hours: "",
      });
    },
    onError: (error) => {
      toast.error("Failed to create task: " + error.message);
    },
  });

  // Update task status mutation
  const updateTaskStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: TaskStatus }) => {
      const updateData: Record<string, unknown> = { status };
      if (status === "in_progress" && !tasks.find(t => t.id === id)?.actual_start) {
        updateData.actual_start = new Date().toISOString().split("T")[0];
      }
      if (status === "completed") {
        updateData.actual_end = new Date().toISOString().split("T")[0];
        updateData.completion_percentage = 100;
      }
      const { error } = await supabase.from("tasks").update(updateData).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Task status updated");
    },
  });

  // Delete task mutation
  const deleteTask = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Task deleted");
      setTaskToDelete(null);
    },
    onError: (error: any) => {
      toast.error("Failed to delete task: " + error.message);
    },
  });

  // Duplicate task mutation
  const duplicateTask = useMutation({
    mutationFn: async (task: Task) => {
      const { error } = await supabase.from("tasks").insert({
        name: `${task.name} (Copy)`,
        description: task.description,
        priority: task.priority,
        status: "not_started" as const,
        organization_id: task.organization_id,
        created_by: user?.id,
        project_id: task.project_id,
        programme_id: task.programme_id,
        product_id: task.product_id,
        work_package_id: task.work_package_id,
        assigned_to: task.assigned_to,
        risk_id: task.risk_id,
        issue_id: task.issue_id,
        estimated_hours: task.estimated_hours,
        planned_start: task.planned_start,
        planned_end: task.planned_end,
        completion_percentage: 0,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Task duplicated");
    },
    onError: (error: any) => {
      toast.error("Failed to duplicate task: " + error.message);
    },
  });

  const updateCompletion = useMutation({
    mutationFn: async ({ id, completion_percentage }: { id: string; completion_percentage: number }) => {
      const updateData: Record<string, unknown> = { completion_percentage };
      if (completion_percentage === 100) {
        updateData.status = "completed";
        updateData.actual_end = new Date().toISOString().split("T")[0];
      }
      const { error } = await supabase.from("tasks").update(updateData).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Completion updated");
    },
  });

  // Filter tasks
  const matchesFilters = (task: Task) => {
    if (statusFilter !== "all" && task.status !== statusFilter) return false;
    if (entityFilter === "project" && !task.project_id) return false;
    if (entityFilter === "program" && !task.programme_id) return false;
    if (entityFilter === "product" && !task.product_id) return false;
    return true;
  };

  // Group: render parents (or orphan subtasks whose parent is filtered out) followed by their subtasks
  const tasksById = new Map(tasks.map((t) => [t.id, t]));
  const childrenByParent = new Map<string, Task[]>();
  for (const t of tasks) {
    if (t.parent_task_id) {
      const arr = childrenByParent.get(t.parent_task_id) || [];
      arr.push(t);
      childrenByParent.set(t.parent_task_id, arr);
    }
  }
  const filteredTasksFlat: Array<{ task: Task; depth: number }> = [];
  const seen = new Set<string>();
  // Top-level first: tasks without a parent (or whose parent is missing)
  for (const t of tasks) {
    const isTopLevel = !t.parent_task_id || !tasksById.has(t.parent_task_id);
    if (!isTopLevel) continue;
    const childMatches = (childrenByParent.get(t.id) || []).some(matchesFilters);
    if (!matchesFilters(t) && !childMatches) continue;
    filteredTasksFlat.push({ task: t, depth: 0 });
    seen.add(t.id);
    for (const child of childrenByParent.get(t.id) || []) {
      if (!matchesFilters(child)) continue;
      filteredTasksFlat.push({ task: child, depth: 1 });
      seen.add(child.id);
    }
  }
  // Any matching subtasks whose parent didn't render (e.g. parent filtered out and we still want the child shown)
  for (const t of tasks) {
    if (seen.has(t.id)) continue;
    if (matchesFilters(t)) filteredTasksFlat.push({ task: t, depth: 0 });
  }
  const filteredTasks = filteredTasksFlat.map((x) => x.task);
  const depthByTaskId = new Map(filteredTasksFlat.map((x) => [x.task.id, x.depth]));

  // Calculate stats
  const stats = {
    total: tasks.length,
    notStarted: tasks.filter((t) => t.status === "not_started").length,
    inProgress: tasks.filter((t) => t.status === "in_progress").length,
    completed: tasks.filter((t) => t.status === "completed").length,
    onHold: tasks.filter((t) => t.status === "on_hold").length,
  };

  const completionRate = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;

  const getEntityName = (task: Task) => {
    if (task.project_id) {
      return projects.find((p) => p.id === task.project_id)?.name || "Project";
    }
    if (task.programme_id) {
      return programmes.find((p) => p.id === task.programme_id)?.name || "Program";
    }
    if (task.product_id) {
      return products.find((p) => p.id === task.product_id)?.name || "Product";
    }
    return "—";
  };

  const getEntityOptions = () => {
    if (formData.entity_type === "project") return projects;
    if (formData.entity_type === "program") return programmes;
    if (formData.entity_type === "product") return products;
    return [];
  };

  const getWorkPackageName = (workPackageId: string | null) => {
    if (!workPackageId) return null;
    return workPackages.find((wp) => wp.id === workPackageId)?.name || null;
  };

  const openCreateSubtaskFor = (parent: Task) => {
    setFormData({
      name: "",
      description: "",
      priority: parent.priority,
      status: "not_started",
      entity_type: parent.project_id ? "project" : parent.programme_id ? "program" : parent.product_id ? "product" : "project",
      entity_id: parent.project_id || parent.programme_id || parent.product_id || "",
      work_package_id: parent.work_package_id || "",
      parent_task_id: parent.id,
      planned_start: "",
      planned_end: "",
      estimated_hours: "",
    });
    setDialogOpen(true);
  };

  const content = (
    <>
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Tasks</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <ListTree className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Not Started</p>
                <p className="text-2xl font-bold">{stats.notStarted}</p>
              </div>
              <Circle className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">In Progress</p>
                <p className="text-2xl font-bold">{stats.inProgress}</p>
              </div>
              <Clock className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Completed</p>
                <p className="text-2xl font-bold">{stats.completed}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-success" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div>
              <p className="text-sm text-muted-foreground mb-2">Completion Rate</p>
              <Progress value={completionRate} className="h-2" />
              <p className="text-lg font-bold mt-1">{completionRate}%</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Actions */}
      <div className="flex flex-wrap gap-4 mb-6 items-center justify-between">
        <div className="flex gap-4">
          <Select value={entityFilter} onValueChange={setEntityFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Filter by entity" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Entities</SelectItem>
              <SelectItem value="project">Projects</SelectItem>
              <SelectItem value="program">Programs</SelectItem>
              <SelectItem value="product">Products</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="not_started">Not Started</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="on_hold">On Hold</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button
          variant="outline"
          onClick={() => {
            setRecurringSeed(null);
            setRecurringOpen(true);
          }}
        >
          <Repeat className="h-4 w-4 mr-2" />
          Recurring Tasks
        </Button>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Task
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Create New Task</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <label className="text-sm font-medium">Task Name</label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Enter task name"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Description</label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Task description"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Link To</label>
                  <Select
                    value={formData.entity_type}
                    onValueChange={(v) => setFormData({ ...formData, entity_type: v, entity_id: "" })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="project">Project</SelectItem>
                      <SelectItem value="program">Program</SelectItem>
                      <SelectItem value="product">Product</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Select {formData.entity_type}</label>
                  <Select
                    value={formData.entity_id || "none"}
                    onValueChange={(v) => setFormData({ ...formData, entity_id: v === "none" ? "" : v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={`Select ${formData.entity_type}`} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {getEntityOptions().map((entity) => (
                        <SelectItem key={entity.id} value={entity.id}>
                          {entity.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {formData.entity_type === "project" && formData.entity_id && (
                <div>
                  <label className="text-sm font-medium">Work Package (Optional)</label>
                  <Select
                    value={formData.work_package_id || "none"}
                    onValueChange={(v) => setFormData({ ...formData, work_package_id: v === "none" ? "" : v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select work package" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {workPackages
                        .filter((wp) => wp.project_id === formData.entity_id)
                        .map((wp) => (
                          <SelectItem key={wp.id} value={wp.id}>
                            {wp.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Priority</label>
                  <Select
                    value={formData.priority}
                    onValueChange={(v) => setFormData({ ...formData, priority: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Estimated Hours</label>
                  <Input
                    type="number"
                    value={formData.estimated_hours}
                    onChange={(e) => setFormData({ ...formData, estimated_hours: e.target.value })}
                    placeholder="0"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Planned Start</label>
                  <Input
                    type="date"
                    value={formData.planned_start}
                    onChange={(e) => setFormData({ ...formData, planned_start: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Planned End</label>
                  <Input
                    type="date"
                    value={formData.planned_end}
                    onChange={(e) => setFormData({ ...formData, planned_end: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => createTask.mutate(formData)}
                  disabled={!formData.name || createTask.isPending}
                >
                  Create Task
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Tasks Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[120px]">Ref</TableHead>
                <TableHead>Task</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Completion</TableHead>
                <TableHead>Timeline</TableHead>
                <TableHead>Hours</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    Loading tasks...
                  </TableCell>
                </TableRow>
              ) : filteredTasks.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    No tasks found. Create your first task to get started.
                  </TableCell>
                </TableRow>
              ) : (
                filteredTasks.map((task) => {
                  const config = statusConfig[task.status];
                  const StatusIcon = config.icon;
                  return (
                    <React.Fragment key={task.id}>
                    <TableRow>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {task.reference_number || "—"}
                      </TableCell>
                      <TableCell>
                        <div
                          className="cursor-pointer hover:text-primary"
                          onClick={() => { setEditingTask(task); setEditDialogOpen(true); }}
                        >
                          <p className="font-medium">{task.name}</p>
                          {task.description && (
                            <p className="text-xs text-muted-foreground line-clamp-1">
                              {task.description}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <Badge variant="outline">{getEntityName(task)}</Badge>
                          {task.work_package_id && (
                            <Badge variant="secondary" className="text-xs">
                              WP: {getWorkPackageName(task.work_package_id)}
                            </Badge>
                          )}
                          {task.risk_id && (() => {
                            const r = risksList.find((x: any) => x.id === task.risk_id);
                            return (
                              <Badge variant="outline" className="text-xs border-destructive/40 text-destructive">
                                Risk: {r?.reference_number || r?.title || "—"}
                              </Badge>
                            );
                          })()}
                          {task.issue_id && (() => {
                            const i = issuesList.find((x: any) => x.id === task.issue_id);
                            return (
                              <Badge variant="outline" className="text-xs border-warning/40 text-warning">
                                Issue: {i?.reference_number || i?.title || "—"}
                              </Badge>
                            );
                          })()}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            task.priority === "critical"
                              ? "border-destructive text-destructive"
                              : task.priority === "high"
                              ? "border-warning text-warning"
                              : ""
                          }
                        >
                          {task.priority}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={config.color}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {config.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 min-w-[120px]">
                          <Slider
                            value={[task.completion_percentage || 0]}
                            max={100}
                            step={5}
                            className="w-20"
                            onValueCommit={(val) =>
                              updateCompletion.mutate({ id: task.id, completion_percentage: val[0] })
                            }
                          />
                          <span className="text-xs font-medium w-8">{task.completion_percentage || 0}%</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {task.planned_start && task.planned_end ? (
                          <div className="text-xs">
                            <div className="flex items-center gap-1">
                              <CalendarDays className="h-3 w-3" />
                              {format(new Date(task.planned_start), "MMM d")} -{" "}
                              {format(new Date(task.planned_end), "MMM d")}
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {task.estimated_hours ? (
                          <span className="text-sm">
                            {task.actual_hours || 0}/{task.estimated_hours}h
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setExpandedTaskId(expandedTaskId === task.id ? null : task.id)}
                            title="Toggle updates"
                          >
                            {expandedTaskId === task.id ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <MessageSquarePlus className="h-4 w-4" />
                            )}
                          </Button>
                          <Select
                            value={task.status}
                            onValueChange={(v) =>
                              updateTaskStatus.mutate({ id: task.id, status: v as TaskStatus })
                            }
                          >
                            <SelectTrigger className="w-32 h-8">
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
                            className="h-8 w-8"
                            onClick={() => duplicateTask.mutate(task)}
                            title="Duplicate task"
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => {
                              setRecurringSeed({
                                name: task.name,
                                description: task.description,
                                priority: task.priority,
                                project_id: task.project_id,
                                programme_id: task.programme_id,
                                product_id: task.product_id,
                                work_package_id: task.work_package_id,
                                estimated_hours: task.estimated_hours,
                                assigned_to: task.assigned_to,
                              });
                              setRecurringOpen(true);
                            }}
                            title="Create recurring tasks from this"
                          >
                            <Repeat className="h-4 w-4" />
                          </Button>
                          {canLogTimeOnTask(task) && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => navigate(`/timesheets?taskId=${task.id}`)}
                              title="Log time on this task"
                            >
                              <Clock className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => setTaskToDelete({ id: task.id, name: task.name })}
                            title="Delete task"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    {expandedTaskId === task.id && (
                      <TableRow>
                        <TableCell colSpan={9} className="bg-muted/30 p-4 space-y-4">
                          <div className="grid gap-4 md:grid-cols-2">
                            <div>
                              <h4 className="text-sm font-medium mb-2">Assigned Users</h4>
                              <TaskAssignments taskId={task.id} organizationId={task.organization_id} />
                            </div>
                            <UpdateFrequencySettings entityType="task" entityId={task.id} organizationId={task.organization_id} />
                          </div>
                          <EntityUpdates
                            entityType="task"
                            entityId={task.id}
                            organizationId={task.organization_id}
                          />
                        </TableCell>
                      </TableRow>
                    )}
                    </React.Fragment>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <EditTaskDialog
        task={editingTask}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onUpdate={() => queryClient.invalidateQueries({ queryKey: ["tasks"] })}
      />

      <RecurringTaskDialog
        open={recurringOpen}
        onOpenChange={setRecurringOpen}
        seedTask={recurringSeed}
        onCreated={() => queryClient.invalidateQueries({ queryKey: ["tasks"] })}
      />

      <AlertDialog open={!!taskToDelete} onOpenChange={(open) => !open && setTaskToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this task?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{taskToDelete?.name}</strong>. This action cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (taskToDelete) deleteTask.mutate(taskToDelete.id);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );

  if (embedded) return content;

  return (
    <AppLayout title="Task Management" subtitle="PRINCE2 aligned task tracking with hierarchy">
      {content}
    </AppLayout>
  );
}
