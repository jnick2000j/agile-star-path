import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { QuickActionTabs } from "@/components/QuickActionTabs";
import { 
  Plus, 
  Calendar,
  Target,
  GripVertical,
  ChevronRight,
  Play,
  CheckCircle2,
  Layers,
  FolderKanban,
  Package,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import { toast } from "sonner";
import { FeatureDetailDialog } from "@/components/dialogs/FeatureDetailDialog";

interface Sprint {
  id: string;
  name: string;
  description: string | null;
  product_id: string | null;
  programme_id: string | null;
  project_id: string | null;
  start_date: string | null;
  end_date: string | null;
  capacity_points: number;
  status: string;
}

interface Feature {
  id: string;
  name: string;
  description: string | null;
  status: string;
  priority: string;
  moscow: string | null;
  product_id: string;
  target_release: string | null;
  reach_score: number | null;
  impact_score: number | null;
  confidence_score: number | null;
  effort_score: number | null;
  story_points: number | null;
  sprint_id: string | null;
}

interface Task {
  id: string;
  name: string;
  description: string | null;
  status: string;
  priority: string;
  story_points: number | null;
  programme_id: string | null;
  project_id: string | null;
  product_id: string | null;
  sprint_id: string | null;
}

interface Entity {
  id: string;
  name: string;
}

type EntityType = "program" | "project" | "product";

const statusConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  planning: { label: "Planning", color: "bg-muted text-muted-foreground", icon: Calendar },
  active: { label: "Active", color: "bg-primary/10 text-primary", icon: Play },
  completed: { label: "Completed", color: "bg-success/10 text-success", icon: CheckCircle2 },
};

const priorityColors: Record<string, string> = {
  high: "border-l-destructive",
  medium: "border-l-warning",
  low: "border-l-muted-foreground",
};

const entityTypeConfig: Record<EntityType, { icon: React.ElementType; color: string; label: string }> = {
  program: { icon: Layers, color: "bg-primary/10 text-primary", label: "Programs" },
  project: { icon: FolderKanban, color: "bg-success/10 text-success", label: "Projects" },
  product: { icon: Package, color: "bg-warning/10 text-warning", label: "Products" },
};

export default function SprintPlanning({ embedded }: { embedded?: boolean }) {
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [features, setFeatures] = useState<Feature[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [programmes, setProgrammes] = useState<Entity[]>([]);
  const [projects, setProjects] = useState<Entity[]>([]);
  const [products, setProducts] = useState<Entity[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [draggedItem, setDraggedItem] = useState<{ id: string; type: "feature" | "task" } | null>(null);
  const [selectedFeature, setSelectedFeature] = useState<Feature | null>(null);
  const [featureDialogOpen, setFeatureDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<EntityType>("project");
  const [entityFilter, setEntityFilter] = useState<string>("all");
  const { user } = useAuth();
  const { currentOrganization } = useOrganization();

  const [newSprint, setNewSprint] = useState({
    name: "",
    description: "",
    entity_type: "project" as EntityType,
    entity_id: "",
    start_date: "",
    end_date: "",
    capacity_points: 40,
  });

  const fetchData = async () => {
    setLoading(true);

    let sprintQuery = supabase.from("sprints").select("*").order("start_date", { ascending: false });
    let programmeQuery = supabase.from("programmes").select("id, name").order("name");
    let projectQuery = supabase.from("projects").select("id, name").order("name");
    let productQuery = supabase.from("products").select("id, name").order("name");
    let taskQuery = supabase.from("tasks").select("*").order("priority");
    
    if (currentOrganization) {
      sprintQuery = sprintQuery.eq("organization_id", currentOrganization.id);
      programmeQuery = programmeQuery.eq("organization_id", currentOrganization.id);
      projectQuery = projectQuery.eq("organization_id", currentOrganization.id);
      productQuery = productQuery.eq("organization_id", currentOrganization.id);
      taskQuery = taskQuery.eq("organization_id", currentOrganization.id);
    }

    const [sprintsRes, featuresRes, programmesRes, projectsRes, productsRes, tasksRes] = await Promise.all([
      sprintQuery,
      supabase.from("product_features").select("*").order("priority"),
      programmeQuery,
      projectQuery,
      productQuery,
      taskQuery,
    ]);

    if (sprintsRes.error) console.error("Sprints error:", sprintsRes.error);
    if (featuresRes.error) console.error("Features error:", featuresRes.error);
    if (programmesRes.error) console.error("Programmes error:", programmesRes.error);
    if (projectsRes.error) console.error("Projects error:", projectsRes.error);
    if (productsRes.error) console.error("Products error:", productsRes.error);
    if (tasksRes.error) console.error("Tasks error:", tasksRes.error);

    setSprints(sprintsRes.data || []);
    setFeatures(featuresRes.data || []);
    setProgrammes(programmesRes.data || []);
    setProjects(projectsRes.data || []);
    setProducts(productsRes.data || []);
    setTasks(tasksRes.data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [currentOrganization]);

  const handleCreateSprint = async () => {
    if (!newSprint.name) {
      toast.error("Please enter a sprint name");
      return;
    }

    if (!newSprint.entity_id) {
      toast.error("Please select an entity");
      return;
    }

    const insertData: any = {
      name: newSprint.name,
      description: newSprint.description || null,
      start_date: newSprint.start_date || null,
      end_date: newSprint.end_date || null,
      capacity_points: newSprint.capacity_points,
      organization_id: currentOrganization?.id,
      created_by: user?.id,
    };

    // Set the appropriate entity ID
    if (newSprint.entity_type === "program") {
      insertData.programme_id = newSprint.entity_id;
    } else if (newSprint.entity_type === "project") {
      insertData.project_id = newSprint.entity_id;
    } else {
      insertData.product_id = newSprint.entity_id;
    }

    const { error } = await supabase.from("sprints").insert(insertData);

    if (error) {
      toast.error("Failed to create sprint");
      console.error(error);
    } else {
      toast.success("Sprint created successfully");
      setIsCreateOpen(false);
      setNewSprint({
        name: "",
        description: "",
        entity_type: "project",
        entity_id: "",
        start_date: "",
        end_date: "",
        capacity_points: 40,
      });
      fetchData();
    }
  };

  const handleDragStart = (id: string, type: "feature" | "task") => {
    setDraggedItem({ id, type });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDropOnSprint = async (sprintId: string | null) => {
    if (!draggedItem) return;

    const table = draggedItem.type === "feature" ? "product_features" : "tasks";

    const { error } = await supabase
      .from(table)
      .update({ sprint_id: sprintId })
      .eq("id", draggedItem.id);

    if (error) {
      toast.error("Failed to assign item");
    } else {
      if (draggedItem.type === "feature") {
        setFeatures(prev =>
          prev.map(f => f.id === draggedItem.id ? { ...f, sprint_id: sprintId } : f)
        );
      } else {
        setTasks(prev =>
          prev.map(t => t.id === draggedItem.id ? { ...t, sprint_id: sprintId } : t)
        );
      }
      toast.success(sprintId ? "Item added to sprint" : "Item removed from sprint");
    }
    setDraggedItem(null);
  };

  const getSprintsByEntityType = (type: EntityType) => {
    return sprints.filter(s => {
      if (type === "program") return s.programme_id != null;
      if (type === "project") return s.project_id != null;
      return s.product_id != null;
    });
  };

  const getSprintFeatures = (sprintId: string) => {
    return features.filter(f => f.sprint_id === sprintId);
  };

  const getSprintTasks = (sprintId: string) => {
    return tasks.filter(t => t.sprint_id === sprintId);
  };

  const getSprintPoints = (sprintId: string) => {
    const featurePoints = getSprintFeatures(sprintId).reduce((sum, f) => sum + (f.story_points || 0), 0);
    const taskPoints = getSprintTasks(sprintId).reduce((sum, t) => sum + (t.story_points || 0), 0);
    return featurePoints + taskPoints;
  };

  const getBacklogItems = (type: EntityType): (Feature | Task)[] => {
    if (type === "product") {
      return features.filter(f => !f.sprint_id);
    }
    return tasks.filter(t => {
      if (t.sprint_id) return false;
      if (type === "program") return t.programme_id != null && !t.project_id;
      return t.project_id != null;
    });
  };

  const getEntityName = (sprint: Sprint) => {
    if (sprint.programme_id) {
      return programmes.find(p => p.id === sprint.programme_id)?.name || "Unknown";
    }
    if (sprint.project_id) {
      return projects.find(p => p.id === sprint.project_id)?.name || "Unknown";
    }
    if (sprint.product_id) {
      return products.find(p => p.id === sprint.product_id)?.name || "Unknown";
    }
    return "Unassigned";
  };

  const handleUpdateSprintStatus = async (sprintId: string, newStatus: string) => {
    const { error } = await supabase
      .from("sprints")
      .update({ status: newStatus })
      .eq("id", sprintId);

    if (error) {
      toast.error("Failed to update sprint status");
    } else {
      setSprints(prev =>
        prev.map(s => s.id === sprintId ? { ...s, status: newStatus } : s)
      );
      toast.success("Sprint status updated");
    }
  };

  const handleFeatureClick = (feature: Feature) => {
    setSelectedFeature(feature);
    setFeatureDialogOpen(true);
  };

  const getEntitiesForType = (type: EntityType) => {
    if (type === "program") return programmes;
    if (type === "project") return projects;
    return products;
  };

  const filteredSprints = getSprintsByEntityType(activeTab).filter(s => {
    if (entityFilter === "all") return true;
    if (activeTab === "program") return s.programme_id === entityFilter;
    if (activeTab === "project") return s.project_id === entityFilter;
    return s.product_id === entityFilter;
  });

  const content = (
    <>
      <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v as EntityType); setEntityFilter("all"); }}>
        <div className="flex flex-col sm:flex-row justify-between gap-4 mb-6">
          <TabsList>
            {Object.entries(entityTypeConfig).map(([key, config]) => {
              const Icon = config.icon;
              return (
                <TabsTrigger key={key} value={key} className="gap-2">
                  <Icon className="h-4 w-4" />
                  {config.label}
                </TabsTrigger>
              );
            })}
          </TabsList>

          <div className="flex gap-2">
            <Select value={entityFilter} onValueChange={setEntityFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder={`Filter by ${activeTab}`} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All {entityTypeConfig[activeTab].label}</SelectItem>
                {getEntitiesForType(activeTab).map(e => (
                  <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  New Sprint
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New Sprint</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Sprint Name *</Label>
                    <Input
                      value={newSprint.name}
                      onChange={(e) => setNewSprint({ ...newSprint, name: e.target.value })}
                      placeholder="e.g., Sprint 1 - User Authentication"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Textarea
                      value={newSprint.description}
                      onChange={(e) => setNewSprint({ ...newSprint, description: e.target.value })}
                      placeholder="Sprint goals and objectives"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Entity Type *</Label>
                      <Select
                        value={newSprint.entity_type}
                        onValueChange={(v) => setNewSprint({ ...newSprint, entity_type: v as EntityType, entity_id: "" })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="program">Program</SelectItem>
                          <SelectItem value="project">Project</SelectItem>
                          <SelectItem value="product">Product</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>{entityTypeConfig[newSprint.entity_type].label.slice(0, -1)} *</Label>
                      <Select
                        value={newSprint.entity_id}
                        onValueChange={(v) => setNewSprint({ ...newSprint, entity_id: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select..." />
                        </SelectTrigger>
                        <SelectContent>
                          {getEntitiesForType(newSprint.entity_type).map(e => (
                            <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
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
                  <Button onClick={handleCreateSprint} className="w-full">
                    Create Sprint
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {Object.keys(entityTypeConfig).map((type) => (
          <TabsContent key={type} value={type} className="mt-0">
            <div className="grid gap-6 lg:grid-cols-3">
              {/* Backlog Column */}
              <div className="lg:col-span-1">
                <div className="metric-card h-full">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold flex items-center gap-2">
                      <Target className="h-5 w-5" />
                      Backlog
                    </h3>
                    <Badge variant="secondary">{getBacklogItems(type as EntityType).length}</Badge>
                  </div>
                  <div
                    className="space-y-2 min-h-[400px] max-h-[600px] overflow-y-auto"
                    onDragOver={handleDragOver}
                    onDrop={() => handleDropOnSprint(null)}
                    style={{
                      backgroundColor: draggedItem ? "hsl(var(--accent) / 0.1)" : undefined,
                    }}
                  >
                    {type === "product" ? (
                      getBacklogItems(type as EntityType).length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-8">
                          No unassigned features
                        </p>
                      ) : (
                        (getBacklogItems(type as EntityType) as Feature[]).map(feature => (
                          <div
                            key={feature.id}
                            draggable
                            onDragStart={() => handleDragStart(feature.id, "feature")}
                            onClick={() => handleFeatureClick(feature)}
                            className={`p-3 rounded-lg bg-card border-l-4 cursor-move hover:shadow-md transition-shadow ${priorityColors[feature.priority]}`}
                          >
                            <div className="flex items-start gap-2">
                              <GripVertical className="h-4 w-4 mt-0.5 opacity-50 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm truncate">{feature.name}</p>
                                <div className="flex gap-1 mt-1 flex-wrap">
                                  <Badge variant="outline" className="text-xs capitalize">
                                    {feature.priority}
                                  </Badge>
                                  {feature.story_points && (
                                    <Badge variant="secondary" className="text-xs">
                                      {feature.story_points} pts
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))
                      )
                    ) : (
                      getBacklogItems(type as EntityType).length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-8">
                          No tasks available
                        </p>
                      ) : (
                        (getBacklogItems(type as EntityType) as Task[]).map(task => (
                          <div
                            key={task.id}
                            draggable
                            onDragStart={() => handleDragStart(task.id, "task")}
                            className={`p-3 rounded-lg bg-card border-l-4 cursor-move hover:shadow-md transition-shadow ${priorityColors[task.priority]}`}
                          >
                            <div className="flex items-start gap-2">
                              <GripVertical className="h-4 w-4 mt-0.5 opacity-50 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm truncate">{task.name}</p>
                                <div className="flex gap-1 mt-1 flex-wrap">
                                  <Badge variant="outline" className="text-xs capitalize">
                                    {task.priority}
                                  </Badge>
                                  {task.story_points && (
                                    <Badge variant="secondary" className="text-xs">
                                      {task.story_points} pts
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))
                      )
                    )}
                  </div>
                </div>
              </div>

              {/* Sprints Column */}
              <div className="lg:col-span-2 space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="font-semibold">Sprints</h3>
                </div>

                {loading ? (
                  <div className="text-center py-8 text-muted-foreground">Loading sprints...</div>
                ) : filteredSprints.length === 0 ? (
                  <div className="metric-card text-center py-12">
                    <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No sprints created yet</p>
                    <p className="text-sm text-muted-foreground">Create your first sprint to start planning</p>
                  </div>
                ) : (
                  filteredSprints.map(sprint => {
                    const usedPoints = getSprintPoints(sprint.id);
                    const capacityPercent = sprint.capacity_points > 0
                      ? Math.min((usedPoints / sprint.capacity_points) * 100, 100)
                      : 0;
                    const statusConf = statusConfig[sprint.status] || statusConfig.planning;
                    const StatusIcon = statusConf.icon;

                    return (
                      <div
                        key={sprint.id}
                        className="metric-card"
                        onDragOver={handleDragOver}
                        onDrop={() => handleDropOnSprint(sprint.id)}
                        style={{
                          backgroundColor: draggedItem ? "hsl(var(--accent) / 0.1)" : undefined,
                        }}
                      >
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h4 className="font-semibold">{sprint.name}</h4>
                              <Badge className={statusConf.color}>
                                <StatusIcon className="h-3 w-3 mr-1" />
                                {statusConf.label}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">{getEntityName(sprint)}</p>
                            {sprint.description && (
                              <p className="text-sm text-muted-foreground mt-1">{sprint.description}</p>
                            )}
                            {(sprint.start_date || sprint.end_date) && (
                              <p className="text-xs text-muted-foreground mt-1">
                                {sprint.start_date && new Date(sprint.start_date).toLocaleDateString()}
                                {sprint.start_date && sprint.end_date && " - "}
                                {sprint.end_date && new Date(sprint.end_date).toLocaleDateString()}
                              </p>
                            )}
                          </div>
                          <Select
                            value={sprint.status}
                            onValueChange={(v) => handleUpdateSprintStatus(sprint.id, v)}
                          >
                            <SelectTrigger className="w-[130px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="planning">Planning</SelectItem>
                              <SelectItem value="active">Active</SelectItem>
                              <SelectItem value="completed">Completed</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Capacity Bar */}
                        <div className="mb-4">
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-muted-foreground">Capacity</span>
                            <span className={usedPoints > sprint.capacity_points ? "text-destructive font-medium" : ""}>
                              {usedPoints} / {sprint.capacity_points} pts
                            </span>
                          </div>
                          <Progress
                            value={capacityPercent}
                            className={usedPoints > sprint.capacity_points ? "[&>div]:bg-destructive" : ""}
                          />
                        </div>

                        {/* Sprint Features */}
                        <div className="space-y-2 min-h-[100px]">
                        {(() => {
                          const sprintFeatures = getSprintFeatures(sprint.id);
                          const sprintTasks = getSprintTasks(sprint.id);
                          const hasItems = sprintFeatures.length > 0 || sprintTasks.length > 0;

                          if (!hasItems) {
                            return (
                              <p className="text-sm text-muted-foreground text-center py-4">
                                Drag items here to add them to this sprint
                              </p>
                            );
                          }

                          return (
                            <>
                              {sprintFeatures.map(feature => (
                                <div
                                  key={feature.id}
                                  draggable
                                  onDragStart={() => handleDragStart(feature.id, "feature")}
                                  onClick={() => handleFeatureClick(feature)}
                                  className={`p-3 rounded-lg bg-secondary/50 border-l-4 cursor-move hover:bg-secondary transition-colors ${priorityColors[feature.priority]}`}
                                >
                                  <div className="flex items-center gap-2">
                                    <GripVertical className="h-4 w-4 opacity-50" />
                                    <Badge variant="outline" className="text-xs bg-purple-500/10 text-purple-600 border-purple-500/30">Feature</Badge>
                                    <span className="font-medium text-sm flex-1 truncate">{feature.name}</span>
                                    <div className="flex gap-1">
                                      <Badge variant="outline" className="text-xs capitalize">
                                        {feature.status.replace("_", " ")}
                                      </Badge>
                                      {feature.story_points && (
                                        <Badge variant="secondary" className="text-xs">
                                          {feature.story_points} pts
                                        </Badge>
                                      )}
                                    </div>
                                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                  </div>
                                </div>
                              ))}
                              {sprintTasks.map(task => (
                                <div
                                  key={task.id}
                                  draggable
                                  onDragStart={() => handleDragStart(task.id, "task")}
                                  className={`p-3 rounded-lg bg-secondary/50 border-l-4 cursor-move hover:bg-secondary transition-colors ${priorityColors[task.priority]}`}
                                >
                                  <div className="flex items-center gap-2">
                                    <GripVertical className="h-4 w-4 opacity-50" />
                                    <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-600 border-blue-500/30">Task</Badge>
                                    <span className="font-medium text-sm flex-1 truncate">{task.name}</span>
                                    <div className="flex gap-1">
                                      <Badge variant="outline" className="text-xs capitalize">
                                        {task.status.replace("_", " ")}
                                      </Badge>
                                      {task.story_points && (
                                        <Badge variant="secondary" className="text-xs">
                                          {task.story_points} pts
                                        </Badge>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </>
                          );
                        })()}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </TabsContent>
        ))}
      </Tabs>

      <FeatureDetailDialog
        feature={selectedFeature}
        open={featureDialogOpen}
        onOpenChange={setFeatureDialogOpen}
        onUpdate={fetchData}
        products={products}
      />
    </>
  );

  if (embedded) return content;

  return (
    <AppLayout title="Sprint Planning" subtitle="Plan and manage sprints across programmes, projects, and products">
      {content}
    </AppLayout>
  );
}