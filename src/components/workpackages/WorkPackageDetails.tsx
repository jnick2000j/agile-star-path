import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Plus,
  CheckCircle2,
  Clock,
  Circle,
  XCircle,
  Pause,
  Target,
  Flag,
  AlertTriangle,
  User,
  Timer,
  TrendingUp,
} from "lucide-react";
import { format } from "date-fns";
import { useAuth } from "@/hooks/useAuth";

type TaskStatus = "not_started" | "in_progress" | "on_hold" | "completed" | "cancelled";
type MilestoneStatus = "planned" | "in_progress" | "achieved" | "missed" | "deferred";

interface Task {
  id: string;
  name: string;
  description: string | null;
  status: TaskStatus;
  priority: string;
  assigned_to: string | null;
  planned_start: string | null;
  planned_end: string | null;
  estimated_hours: number | null;
  actual_hours: number | null;
  story_points: number | null;
}

interface Milestone {
  id: string;
  name: string;
  description: string | null;
  status: MilestoneStatus;
  milestone_type: string;
  target_date: string;
  actual_date: string | null;
}

interface WorkPackageDetailsProps {
  workPackageId: string;
  projectId: string | null;
  organizationId: string | null;
}

const taskStatusConfig: Record<TaskStatus, { label: string; icon: React.ElementType; color: string }> = {
  not_started: { label: "Not Started", icon: Circle, color: "bg-muted text-muted-foreground" },
  in_progress: { label: "In Progress", icon: Clock, color: "bg-primary/20 text-primary" },
  on_hold: { label: "On Hold", icon: Pause, color: "bg-warning/20 text-warning" },
  completed: { label: "Completed", icon: CheckCircle2, color: "bg-success/20 text-success" },
  cancelled: { label: "Cancelled", icon: XCircle, color: "bg-destructive/20 text-destructive" },
};

const milestoneStatusConfig: Record<MilestoneStatus, { label: string; icon: React.ElementType; color: string }> = {
  planned: { label: "Planned", icon: Clock, color: "bg-muted text-muted-foreground" },
  in_progress: { label: "In Progress", icon: Flag, color: "bg-primary/20 text-primary" },
  achieved: { label: "Achieved", icon: CheckCircle2, color: "bg-success/20 text-success" },
  missed: { label: "Missed", icon: AlertTriangle, color: "bg-destructive/20 text-destructive" },
  deferred: { label: "Deferred", icon: Clock, color: "bg-warning/20 text-warning" },
};

export function WorkPackageDetails({ workPackageId, projectId, organizationId }: WorkPackageDetailsProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [milestoneDialogOpen, setMilestoneDialogOpen] = useState(false);

  const [taskForm, setTaskForm] = useState({
    name: "",
    description: "",
    priority: "medium",
    assigned_to: "",
    planned_start: "",
    planned_end: "",
    estimated_hours: "",
    story_points: "",
  });

  const [milestoneForm, setMilestoneForm] = useState({
    name: "",
    description: "",
    milestone_type: "deliverable",
    target_date: "",
  });

  // Fetch tasks for this work package
  const { data: tasks = [], isLoading: tasksLoading } = useQuery({
    queryKey: ["work-package-tasks", workPackageId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("id, name, description, status, priority, assigned_to, planned_start, planned_end, estimated_hours, actual_hours, story_points")
        .eq("work_package_id", workPackageId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Task[];
    },
    enabled: !!workPackageId,
  });

  // Fetch milestones for this work package
  const { data: milestones = [], isLoading: milestonesLoading } = useQuery({
    queryKey: ["work-package-milestones", workPackageId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("milestones")
        .select("id, name, description, status, milestone_type, target_date, actual_date")
        .eq("work_package_id", workPackageId)
        .order("target_date", { ascending: true });
      if (error) throw error;
      return data as Milestone[];
    },
    enabled: !!workPackageId,
  });

  // Create task mutation
  const createTask = useMutation({
    mutationFn: async (data: typeof taskForm) => {
      const { error } = await supabase.from("tasks").insert({
        name: data.name,
        description: data.description || null,
        priority: data.priority,
        status: "not_started" as TaskStatus,
        assigned_to: data.assigned_to || null,
        planned_start: data.planned_start || null,
        planned_end: data.planned_end || null,
        estimated_hours: data.estimated_hours ? parseFloat(data.estimated_hours) : null,
        story_points: data.story_points ? parseInt(data.story_points) : null,
        work_package_id: workPackageId,
        project_id: projectId,
        organization_id: organizationId,
        created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["work-package-tasks", workPackageId] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Task created");
      setTaskDialogOpen(false);
      setTaskForm({
        name: "",
        description: "",
        priority: "medium",
        assigned_to: "",
        planned_start: "",
        planned_end: "",
        estimated_hours: "",
        story_points: "",
      });
    },
    onError: (error) => {
      toast.error("Failed to create task: " + error.message);
    },
  });

  // Create milestone mutation
  const createMilestone = useMutation({
    mutationFn: async (data: typeof milestoneForm) => {
      const { error } = await supabase.from("milestones").insert({
        name: data.name,
        description: data.description || null,
        milestone_type: data.milestone_type,
        target_date: data.target_date,
        status: "planned" as MilestoneStatus,
        work_package_id: workPackageId,
        project_id: projectId,
        organization_id: organizationId,
        created_by: user?.id,
        owner_id: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["work-package-milestones", workPackageId] });
      queryClient.invalidateQueries({ queryKey: ["milestones"] });
      toast.success("Milestone created");
      setMilestoneDialogOpen(false);
      setMilestoneForm({
        name: "",
        description: "",
        milestone_type: "deliverable",
        target_date: "",
      });
    },
    onError: (error) => {
      toast.error("Failed to create milestone: " + error.message);
    },
  });

  // Update task status
  const updateTaskStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: TaskStatus }) => {
      const updateData: Record<string, unknown> = { status };
      if (status === "in_progress" && !tasks.find(t => t.id === id)?.planned_start) {
        updateData.actual_start = new Date().toISOString().split("T")[0];
      }
      if (status === "completed") {
        updateData.actual_end = new Date().toISOString().split("T")[0];
      }
      const { error } = await supabase.from("tasks").update(updateData).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["work-package-tasks", workPackageId] });
    },
  });

  // Update milestone status
  const updateMilestoneStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: MilestoneStatus }) => {
      const updateData: Record<string, unknown> = { status };
      if (status === "achieved") {
        updateData.actual_date = new Date().toISOString().split("T")[0];
      }
      const { error } = await supabase.from("milestones").update(updateData).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["work-package-milestones", workPackageId] });
    },
  });

  // Stats calculations
  const taskStats = {
    total: tasks.length,
    completed: tasks.filter(t => t.status === "completed").length,
    totalEstimatedHours: tasks.reduce((sum, t) => sum + (t.estimated_hours || 0), 0),
    totalActualHours: tasks.reduce((sum, t) => sum + (t.actual_hours || 0), 0),
    totalStoryPoints: tasks.reduce((sum, t) => sum + (t.story_points || 0), 0),
  };

  const milestoneStats = {
    total: milestones.length,
    achieved: milestones.filter(m => m.status === "achieved").length,
  };

  const taskProgress = taskStats.total > 0 ? Math.round((taskStats.completed / taskStats.total) * 100) : 0;
  const milestoneProgress = milestoneStats.total > 0 ? Math.round((milestoneStats.achieved / milestoneStats.total) * 100) : 0;

  return (
    <div className="bg-muted/30 border-t p-4">
      <Tabs defaultValue="tasks" className="w-full">
        <div className="flex items-center justify-between mb-4">
          <TabsList>
            <TabsTrigger value="tasks">Tasks ({tasks.length})</TabsTrigger>
            <TabsTrigger value="milestones">Milestones ({milestones.length})</TabsTrigger>
            <TabsTrigger value="summary">Summary</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="tasks" className="mt-0">
          <div className="flex justify-between items-center mb-3">
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <CheckCircle2 className="h-4 w-4 text-success" />
                {taskStats.completed}/{taskStats.total} completed
              </span>
              <span className="flex items-center gap-1">
                <Timer className="h-4 w-4" />
                {taskStats.totalEstimatedHours}h estimated
              </span>
              {taskStats.totalStoryPoints > 0 && (
                <span className="flex items-center gap-1">
                  <TrendingUp className="h-4 w-4" />
                  {taskStats.totalStoryPoints} points
                </span>
              )}
            </div>
            <Dialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline">
                  <Plus className="h-4 w-4 mr-1" />
                  Add Task
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Task to Work Package</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <div>
                    <label className="text-sm font-medium">Task Name</label>
                    <Input
                      value={taskForm.name}
                      onChange={(e) => setTaskForm({ ...taskForm, name: e.target.value })}
                      placeholder="Enter task name"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Description</label>
                    <Textarea
                      value={taskForm.description}
                      onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
                      placeholder="Task description"
                      rows={2}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium">Priority</label>
                      <Select
                        value={taskForm.priority}
                        onValueChange={(v) => setTaskForm({ ...taskForm, priority: v })}
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
                      <label className="text-sm font-medium">Assigned To</label>
                      <Input
                        value={taskForm.assigned_to}
                        onChange={(e) => setTaskForm({ ...taskForm, assigned_to: e.target.value })}
                        placeholder="Resource name"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium">Planned Start</label>
                      <Input
                        type="date"
                        value={taskForm.planned_start}
                        onChange={(e) => setTaskForm({ ...taskForm, planned_start: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Planned End</label>
                      <Input
                        type="date"
                        value={taskForm.planned_end}
                        onChange={(e) => setTaskForm({ ...taskForm, planned_end: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium">Estimated Hours</label>
                      <Input
                        type="number"
                        value={taskForm.estimated_hours}
                        onChange={(e) => setTaskForm({ ...taskForm, estimated_hours: e.target.value })}
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Story Points</label>
                      <Input
                        type="number"
                        value={taskForm.story_points}
                        onChange={(e) => setTaskForm({ ...taskForm, story_points: e.target.value })}
                        placeholder="0"
                      />
                    </div>
                  </div>
                  <Button
                    onClick={() => createTask.mutate(taskForm)}
                    disabled={!taskForm.name || createTask.isPending}
                    className="w-full"
                  >
                    Create Task
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {tasksLoading ? (
            <div className="text-center py-4 text-muted-foreground">Loading tasks...</div>
          ) : tasks.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground">
              No tasks yet. Add tasks to track work within this package.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-background">
                  <TableHead>Task</TableHead>
                  <TableHead>Assigned To</TableHead>
                  <TableHead>Effort</TableHead>
                  <TableHead>Timeline</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasks.map((task) => {
                  const StatusIcon = taskStatusConfig[task.status].icon;
                  return (
                    <TableRow key={task.id} className="bg-background">
                      <TableCell>
                        <div>
                          <p className="font-medium">{task.name}</p>
                          {task.description && (
                            <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                              {task.description}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <User className="h-3 w-3 text-muted-foreground" />
                          {task.assigned_to || "Unassigned"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm space-y-0.5">
                          {task.estimated_hours && (
                            <div className="flex items-center gap-1">
                              <Timer className="h-3 w-3 text-muted-foreground" />
                              {task.estimated_hours}h
                              {task.actual_hours && (
                                <span className="text-muted-foreground">
                                  ({task.actual_hours}h actual)
                                </span>
                              )}
                            </div>
                          )}
                          {task.story_points && (
                            <div className="text-xs text-muted-foreground">
                              {task.story_points} points
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {task.planned_start && task.planned_end ? (
                            <span>
                              {format(new Date(task.planned_start), "MMM d")} -{" "}
                              {format(new Date(task.planned_end), "MMM d")}
                            </span>
                          ) : task.planned_start ? (
                            <span>From {format(new Date(task.planned_start), "MMM d")}</span>
                          ) : task.planned_end ? (
                            <span>Due {format(new Date(task.planned_end), "MMM d")}</span>
                          ) : (
                            <span className="text-muted-foreground">No dates</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={task.status}
                          onValueChange={(v) => updateTaskStatus.mutate({ id: task.id, status: v as TaskStatus })}
                        >
                          <SelectTrigger className="w-[130px] h-7">
                            <Badge className={`${taskStatusConfig[task.status].color} text-xs`}>
                              <StatusIcon className="h-3 w-3 mr-1" />
                              {taskStatusConfig[task.status].label}
                            </Badge>
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(taskStatusConfig).map(([key, conf]) => (
                              <SelectItem key={key} value={key}>{conf.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </TabsContent>

        <TabsContent value="milestones" className="mt-0">
          <div className="flex justify-between items-center mb-3">
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Target className="h-4 w-4 text-success" />
                {milestoneStats.achieved}/{milestoneStats.total} achieved
              </span>
            </div>
            <Dialog open={milestoneDialogOpen} onOpenChange={setMilestoneDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline">
                  <Plus className="h-4 w-4 mr-1" />
                  Add Milestone
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Milestone to Work Package</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <div>
                    <label className="text-sm font-medium">Milestone Name</label>
                    <Input
                      value={milestoneForm.name}
                      onChange={(e) => setMilestoneForm({ ...milestoneForm, name: e.target.value })}
                      placeholder="Enter milestone name"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Description</label>
                    <Textarea
                      value={milestoneForm.description}
                      onChange={(e) => setMilestoneForm({ ...milestoneForm, description: e.target.value })}
                      placeholder="Milestone description"
                      rows={2}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium">Type</label>
                      <Select
                        value={milestoneForm.milestone_type}
                        onValueChange={(v) => setMilestoneForm({ ...milestoneForm, milestone_type: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="deliverable">Deliverable</SelectItem>
                          <SelectItem value="stage_gate">Stage Gate</SelectItem>
                          <SelectItem value="review">Review Point</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Target Date</label>
                      <Input
                        type="date"
                        value={milestoneForm.target_date}
                        onChange={(e) => setMilestoneForm({ ...milestoneForm, target_date: e.target.value })}
                      />
                    </div>
                  </div>
                  <Button
                    onClick={() => createMilestone.mutate(milestoneForm)}
                    disabled={!milestoneForm.name || !milestoneForm.target_date || createMilestone.isPending}
                    className="w-full"
                  >
                    Create Milestone
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {milestonesLoading ? (
            <div className="text-center py-4 text-muted-foreground">Loading milestones...</div>
          ) : milestones.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground">
              No milestones yet. Add milestones to track key deliverables.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-background">
                  <TableHead>Milestone</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Target Date</TableHead>
                  <TableHead>Actual Date</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {milestones.map((milestone) => {
                  const StatusIcon = milestoneStatusConfig[milestone.status].icon;
                  return (
                    <TableRow key={milestone.id} className="bg-background">
                      <TableCell>
                        <div>
                          <p className="font-medium">{milestone.name}</p>
                          {milestone.description && (
                            <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                              {milestone.description}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {milestone.milestone_type.replace("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {format(new Date(milestone.target_date), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell>
                        {milestone.actual_date ? (
                          format(new Date(milestone.actual_date), "MMM d, yyyy")
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={milestone.status}
                          onValueChange={(v) => updateMilestoneStatus.mutate({ id: milestone.id, status: v as MilestoneStatus })}
                        >
                          <SelectTrigger className="w-[130px] h-7">
                            <Badge className={`${milestoneStatusConfig[milestone.status].color} text-xs`}>
                              <StatusIcon className="h-3 w-3 mr-1" />
                              {milestoneStatusConfig[milestone.status].label}
                            </Badge>
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(milestoneStatusConfig).map(([key, conf]) => (
                              <SelectItem key={key} value={key}>{conf.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </TabsContent>

        <TabsContent value="summary" className="mt-0">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-background rounded-lg p-4 border">
              <div className="text-sm text-muted-foreground mb-1">Task Progress</div>
              <div className="text-2xl font-bold mb-2">{taskProgress}%</div>
              <Progress value={taskProgress} className="h-2" />
              <div className="text-xs text-muted-foreground mt-1">
                {taskStats.completed} of {taskStats.total} tasks
              </div>
            </div>
            <div className="bg-background rounded-lg p-4 border">
              <div className="text-sm text-muted-foreground mb-1">Milestone Progress</div>
              <div className="text-2xl font-bold mb-2">{milestoneProgress}%</div>
              <Progress value={milestoneProgress} className="h-2" />
              <div className="text-xs text-muted-foreground mt-1">
                {milestoneStats.achieved} of {milestoneStats.total} milestones
              </div>
            </div>
            <div className="bg-background rounded-lg p-4 border">
              <div className="text-sm text-muted-foreground mb-1">Level of Effort</div>
              <div className="text-2xl font-bold">{taskStats.totalEstimatedHours}h</div>
              <div className="text-xs text-muted-foreground mt-1">
                {taskStats.totalActualHours}h actual spent
              </div>
            </div>
            <div className="bg-background rounded-lg p-4 border">
              <div className="text-sm text-muted-foreground mb-1">Story Points</div>
              <div className="text-2xl font-bold">{taskStats.totalStoryPoints}</div>
              <div className="text-xs text-muted-foreground mt-1">
                total points allocated
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
