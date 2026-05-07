import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
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
  Calendar,
  Plus,
  Play,
  CheckCircle2,
  ArrowLeft,
  ChevronRight,
  GripVertical,
  Trash2,
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
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { EditTaskDialog } from "@/components/dialogs/EditTaskDialog";

type EntityType = "programme" | "project" | "product";

interface EntitySprintsTabProps {
  entityType: EntityType;
  entityId: string;
  organizationId?: string | null;
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  planning: { label: "Planning", color: "bg-muted text-muted-foreground", icon: Calendar },
  active: { label: "Active", color: "bg-primary/10 text-primary", icon: Play },
  completed: { label: "Completed", color: "bg-success/10 text-success", icon: CheckCircle2 },
};

const priorityColors: Record<string, string> = {
  critical: "border-l-destructive",
  high: "border-l-destructive",
  medium: "border-l-warning",
  low: "border-l-muted-foreground",
};

export function EntitySprintsTab({ entityType, entityId, organizationId }: EntitySprintsTabProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [expandedSprintId, setExpandedSprintId] = useState<string | null>(null);
  const [editingTask, setEditingTask] = useState<any>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [sprintToDelete, setSprintToDelete] = useState<{ id: string; name: string } | null>(null);
  const [newSprint, setNewSprint] = useState({
    name: "",
    description: "",
    start_date: "",
    end_date: "",
    capacity_points: 40,
  });

  const entityColumn = entityType === "programme" ? "programme_id" : entityType === "project" ? "project_id" : "product_id";

  const { data: sprints = [], isLoading } = useQuery({
    queryKey: ["entity-sprints", entityType, entityId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sprints")
        .select("*")
        .eq(entityColumn, entityId)
        .order("start_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: sprintItems = [] } = useQuery({
    queryKey: ["sprint-items", entityType, entityId, expandedSprintId],
    queryFn: async () => {
      if (!expandedSprintId) return [];
      const [tasksRes, featuresRes] = await Promise.all([
        supabase.from("tasks").select("*").eq("sprint_id", expandedSprintId).order("priority"),
        supabase.from("product_features").select("*").eq("sprint_id", expandedSprintId).order("priority"),
      ]);
      return {
        tasks: tasksRes.data || [],
        features: featuresRes.data || [],
      };
    },
    enabled: !!expandedSprintId,
  });

  const createSprint = useMutation({
    mutationFn: async () => {
      if (!newSprint.name) throw new Error("Sprint name is required");
      const insertData: any = {
        name: newSprint.name,
        description: newSprint.description || null,
        start_date: newSprint.start_date || null,
        end_date: newSprint.end_date || null,
        capacity_points: newSprint.capacity_points,
        organization_id: organizationId,
        created_by: user?.id,
        [entityColumn]: entityId,
      };
      const { error } = await supabase.from("sprints").insert(insertData);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["entity-sprints", entityType, entityId] });
      toast.success("Sprint created");
      setIsCreateOpen(false);
      setNewSprint({ name: "", description: "", start_date: "", end_date: "", capacity_points: 40 });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const updateSprintStatus = useMutation({
    mutationFn: async ({ sprintId, status }: { sprintId: string; status: string }) => {
      const { error } = await supabase.from("sprints").update({ status }).eq("id", sprintId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["entity-sprints", entityType, entityId] });
      toast.success("Sprint status updated");
    },
  });

  const deleteSprint = useMutation({
    mutationFn: async (sprintId: string) => {
      const { error } = await supabase.from("sprints").delete().eq("id", sprintId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["entity-sprints", entityType, entityId] });
      toast.success("Sprint deleted");
      setSprintToDelete(null);
    },
    onError: (error: any) => {
      toast.error("Failed to delete sprint: " + error.message);
    },
  });

  const getSprintPoints = (sprintId: string) => {
    if (!sprintItems || !("tasks" in sprintItems) || expandedSprintId !== sprintId) return 0;
    const taskPts = (sprintItems as any).tasks?.reduce((s: number, t: any) => s + (t.story_points || 0), 0) || 0;
    const featPts = (sprintItems as any).features?.reduce((s: number, f: any) => s + (f.story_points || 0), 0) || 0;
    return taskPts + featPts;
  };

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Loading sprints...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Sprints</CardTitle>
            <CardDescription>Sprint planning and execution</CardDescription>
          </div>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" /> New Sprint
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Sprint</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Sprint Name *</Label>
                  <Input
                    value={newSprint.name}
                    onChange={(e) => setNewSprint({ ...newSprint, name: e.target.value })}
                    placeholder="e.g., Sprint 1"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    value={newSprint.description}
                    onChange={(e) => setNewSprint({ ...newSprint, description: e.target.value })}
                    placeholder="Sprint goals"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Start Date</Label>
                    <Input
                      type="date"
                      value={newSprint.start_date}
                      onChange={(e) => setNewSprint({ ...newSprint, start_date: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>End Date</Label>
                    <Input
                      type="date"
                      value={newSprint.end_date}
                      onChange={(e) => setNewSprint({ ...newSprint, end_date: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Capacity (Story Points)</Label>
                  <Input
                    type="number"
                    value={newSprint.capacity_points}
                    onChange={(e) => setNewSprint({ ...newSprint, capacity_points: Number(e.target.value) })}
                  />
                </div>
                <Button onClick={() => createSprint.mutate()} className="w-full" disabled={createSprint.isPending}>
                  Create Sprint
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {sprints.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No sprints yet. Create your first sprint to start planning.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {sprints.map((sprint: any) => {
              const isExpanded = expandedSprintId === sprint.id;
              const conf = statusConfig[sprint.status] || statusConfig.planning;
              const StatusIcon = conf.icon;

              return (
                <div key={sprint.id} className="border rounded-lg">
                  {/* Sprint Header */}
                  <div
                    className="p-4 cursor-pointer hover:bg-muted/30 transition-colors"
                    onClick={() => setExpandedSprintId(isExpanded ? null : sprint.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <ChevronRight className={cn("h-4 w-4 transition-transform", isExpanded && "rotate-90")} />
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold">{sprint.name}</h4>
                            <Badge className={conf.color}>
                              <StatusIcon className="h-3 w-3 mr-1" />
                              {conf.label}
                            </Badge>
                          </div>
                          {sprint.description && (
                            <p className="text-sm text-muted-foreground mt-0.5">{sprint.description}</p>
                          )}
                          <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
                            {sprint.start_date && <span>Start: {new Date(sprint.start_date).toLocaleDateString()}</span>}
                            {sprint.end_date && <span>End: {new Date(sprint.end_date).toLocaleDateString()}</span>}
                            <span>Capacity: {sprint.capacity_points} pts</span>
                          </div>
                        </div>
                      </div>
                      <div onClick={(e) => e.stopPropagation()} className="flex items-center gap-1">
                        <Select
                          value={sprint.status}
                          onValueChange={(v) => updateSprintStatus.mutate({ sprintId: sprint.id, status: v })}
                        >
                          <SelectTrigger className="w-[120px] h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="planning">Planning</SelectItem>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => setSprintToDelete({ id: sprint.id, name: sprint.name })}
                          title="Delete sprint"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Sprint Drill-Down */}
                  {isExpanded && (
                    <div className="border-t p-4 bg-muted/10">
                      {!sprintItems || (!("tasks" in sprintItems)) ? (
                        <p className="text-sm text-muted-foreground text-center py-4">Loading items...</p>
                      ) : (
                        <>
                          {/* Capacity bar */}
                          {(() => {
                            const usedPts = getSprintPoints(sprint.id);
                            const pct = sprint.capacity_points > 0 ? Math.min((usedPts / sprint.capacity_points) * 100, 100) : 0;
                            return (
                              <div className="mb-4">
                                <div className="flex justify-between text-sm mb-1">
                                  <span className="text-muted-foreground">Capacity Used</span>
                                  <span className={usedPts > sprint.capacity_points ? "text-destructive font-medium" : ""}>
                                    {usedPts} / {sprint.capacity_points} pts
                                  </span>
                                </div>
                                <Progress value={pct} className={usedPts > sprint.capacity_points ? "[&>div]:bg-destructive" : ""} />
                              </div>
                            );
                          })()}

                          {(sprintItems as any).tasks?.length === 0 && (sprintItems as any).features?.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-4">
                              No items in this sprint. Assign tasks or features from the Sprint Planning page.
                            </p>
                          ) : (
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Type</TableHead>
                                  <TableHead>Name</TableHead>
                                  <TableHead>Priority</TableHead>
                                  <TableHead>Status</TableHead>
                                  <TableHead>Points</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {(sprintItems as any).tasks?.map((task: any) => (
                                  <TableRow
                                    key={task.id}
                                    className="cursor-pointer hover:bg-muted/50"
                                    onClick={() => { setEditingTask(task); setEditDialogOpen(true); }}
                                  >
                                    <TableCell>
                                      <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-600 border-blue-500/30">
                                        Task
                                      </Badge>
                                    </TableCell>
                                    <TableCell className="font-medium">{task.name}</TableCell>
                                    <TableCell>
                                      <Badge variant="outline" className="text-xs capitalize">{task.priority}</Badge>
                                    </TableCell>
                                    <TableCell>
                                      <Badge variant="outline" className="text-xs capitalize">
                                        {task.status.replace("_", " ")}
                                      </Badge>
                                    </TableCell>
                                    <TableCell>{task.story_points || "—"}</TableCell>
                                  </TableRow>
                                ))}
                                {(sprintItems as any).features?.map((feature: any) => (
                                  <TableRow key={feature.id}>
                                    <TableCell>
                                      <Badge variant="outline" className="text-xs bg-purple-500/10 text-purple-600 border-purple-500/30">
                                        Feature
                                      </Badge>
                                    </TableCell>
                                    <TableCell className="font-medium">{feature.name}</TableCell>
                                    <TableCell>
                                      <Badge variant="outline" className="text-xs capitalize">{feature.priority}</Badge>
                                    </TableCell>
                                    <TableCell>
                                      <Badge variant="outline" className="text-xs capitalize">
                                        {feature.status.replace("_", " ")}
                                      </Badge>
                                    </TableCell>
                                    <TableCell>{feature.story_points || "—"}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      <EditTaskDialog
        task={editingTask}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onUpdate={() => {
          queryClient.invalidateQueries({ queryKey: ["sprint-items"] });
          queryClient.invalidateQueries({ queryKey: ["entity-sprints"] });
        }}
      />
    </Card>
  );
}
