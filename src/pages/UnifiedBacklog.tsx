import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Search,
  Plus,
  GripVertical,
  Filter,
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
import { EntitySelector } from "@/components/EntitySelector";

interface BacklogItem {
  id: string;
  name: string;
  description: string | null;
  status: string;
  priority: string;
  story_points: number | null;
  entity_type: "program" | "project" | "product";
  entity_id: string;
  entity_name: string;
  sprint_id: string | null;
}

interface Entity {
  id: string;
  name: string;
}

const statusColumns = [
  { id: "backlog", label: "Backlog", color: "bg-muted" },
  { id: "planned", label: "Planned", color: "bg-info/10" },
  { id: "in_progress", label: "In Progress", color: "bg-warning/10" },
  { id: "review", label: "Review", color: "bg-primary/10" },
  { id: "done", label: "Done", color: "bg-success/10" },
];

const priorityConfig: Record<string, { label: string; color: string }> = {
  high: { label: "High", color: "bg-destructive/10 text-destructive border-destructive/30" },
  medium: { label: "Medium", color: "bg-warning/10 text-warning border-warning/30" },
  low: { label: "Low", color: "bg-muted text-muted-foreground border-border" },
};

const entityTypeConfig = {
  programme: { icon: Layers, color: "bg-primary/10 text-primary" },
  project: { icon: FolderKanban, color: "bg-success/10 text-success" },
  product: { icon: Package, color: "bg-warning/10 text-warning" },
};

export default function UnifiedBacklog() {
  const [items, setItems] = useState<BacklogItem[]>([]);
  const [programmes, setProgrammes] = useState<Entity[]>([]);
  const [projects, setProjects] = useState<Entity[]>([]);
  const [products, setProducts] = useState<Entity[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [entityFilter, setEntityFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const { user } = useAuth();
  const { currentOrganization } = useOrganization();

  const [newItem, setNewItem] = useState({
    name: "",
    description: "",
    programme_id: "",
    project_id: "",
    product_id: "",
    priority: "medium",
    story_points: "",
  });

  const fetchData = async () => {
    setLoading(true);

    // Build queries with org filtering
    let programmesQuery = supabase.from("programmes").select("id, name").order("name");
    let projectsQuery = supabase.from("projects").select("id, name").order("name");
    let productsQuery = supabase.from("products").select("id, name").order("name");
    let tasksQuery = supabase.from("tasks").select("*").order("priority");
    let featuresQuery = supabase.from("product_features").select("*").order("priority");

    if (currentOrganization) {
      programmesQuery = programmesQuery.eq("organization_id", currentOrganization.id);
      projectsQuery = projectsQuery.eq("organization_id", currentOrganization.id);
      productsQuery = productsQuery.eq("organization_id", currentOrganization.id);
      tasksQuery = tasksQuery.eq("organization_id", currentOrganization.id);
    }

    const [programmesRes, projectsRes, productsRes, tasksRes, featuresRes] = await Promise.all([
      programmesQuery,
      projectsQuery,
      productsQuery,
      tasksQuery,
      featuresQuery,
    ]);

    setProgrammes(programmesRes.data || []);
    setProjects(projectsRes.data || []);
    setProducts(productsRes.data || []);

    // Transform tasks to backlog items
    const taskItems: BacklogItem[] = (tasksRes.data || []).map((task: any) => {
      let entityType: "program" | "project" | "product" = "project";
      let entityId = "";
      let entityName = "";

      if (task.product_id) {
        entityType = "product";
        entityId = task.product_id;
        entityName = productsRes.data?.find((p: Entity) => p.id === task.product_id)?.name || "Unknown";
      } else if (task.project_id) {
        entityType = "project";
        entityId = task.project_id;
        entityName = projectsRes.data?.find((p: Entity) => p.id === task.project_id)?.name || "Unknown";
      } else if (task.programme_id) {
        entityType = "program";
        entityId = task.programme_id;
        entityName = programmesRes.data?.find((p: Entity) => p.id === task.programme_id)?.name || "Unknown";
      }

      // Map task status to backlog status
      let status = "backlog";
      if (task.status === "not_started") status = "backlog";
      else if (task.status === "in_progress") status = "in_progress";
      else if (task.status === "on_hold") status = "planned";
      else if (task.status === "completed") status = "done";

      return {
        id: `task-${task.id}`,
        name: task.name,
        description: task.description,
        status,
        priority: task.priority,
        story_points: task.story_points,
        entity_type: entityType,
        entity_id: entityId,
        entity_name: entityName,
        sprint_id: null,
      };
    });

    // Transform features to backlog items
    const featureItems: BacklogItem[] = (featuresRes.data || []).map((feature: any) => ({
      id: `feature-${feature.id}`,
      name: feature.name,
      description: feature.description,
      status: feature.status,
      priority: feature.priority,
      story_points: feature.story_points,
      entity_type: "product" as const,
      entity_id: feature.product_id,
      entity_name: productsRes.data?.find((p: Entity) => p.id === feature.product_id)?.name || "Unknown",
      sprint_id: feature.sprint_id,
    }));

    setItems([...taskItems, ...featureItems]);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [currentOrganization]);

  const handleDragStart = (itemId: string) => {
    setDraggedItem(itemId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (newStatus: string) => {
    if (!draggedItem) return;

    const [type, id] = draggedItem.split("-");
    const table = type === "task" ? "tasks" : "product_features";

    // Map backlog status to task/feature status
    let dbStatus = newStatus;
    if (type === "task") {
      if (newStatus === "backlog") dbStatus = "not_started";
      else if (newStatus === "planned") dbStatus = "on_hold";
      else if (newStatus === "review") dbStatus = "in_progress";
      else if (newStatus === "done") dbStatus = "completed";
    }

    try {
      await supabase.from(table).update({ status: dbStatus }).eq("id", id);
      setItems((prev) =>
        prev.map((item) => (item.id === draggedItem ? { ...item, status: newStatus } : item))
      );
      toast.success("Item status updated");
    } catch (error) {
      toast.error("Failed to update status");
    }

    setDraggedItem(null);
  };

  const handleCreateItem = async () => {
    if (!newItem.name) {
      toast.error("Please enter a name");
      return;
    }

    // Determine which entity type to create for
    let entityType: "program" | "project" | "product" | null = null;
    if (newItem.product_id) entityType = "product";
    else if (newItem.project_id) entityType = "project";
    else if (newItem.programme_id) entityType = "program";

    if (!entityType) {
      toast.error("Please select a program, project, or product");
      return;
    }

    // Create as task for programmes/projects, feature for products
    if (entityType === "product") {
      const { error } = await supabase.from("product_features").insert({
        name: newItem.name,
        description: newItem.description || null,
        product_id: newItem.product_id,
        priority: newItem.priority,
        story_points: newItem.story_points ? Number(newItem.story_points) : null,
        status: "backlog",
        created_by: user?.id,
      });

      if (error) {
        toast.error("Failed to create feature");
        console.error(error);
        return;
      }
    } else {
      const { error } = await supabase.from("tasks").insert({
        name: newItem.name,
        description: newItem.description || null,
        programme_id: newItem.programme_id || null,
        project_id: newItem.project_id || null,
        product_id: newItem.product_id || null,
        priority: newItem.priority,
        story_points: newItem.story_points ? Number(newItem.story_points) : null,
        status: "not_started",
        organization_id: currentOrganization?.id,
        created_by: user?.id,
      });

      if (error) {
        toast.error("Failed to create task");
        console.error(error);
        return;
      }
    }

    toast.success("Backlog item created");
    setIsCreateOpen(false);
    setNewItem({
      name: "",
      description: "",
      programme_id: "",
      project_id: "",
      product_id: "",
      priority: "medium",
      story_points: "",
    });
    fetchData();
  };

  const filteredItems = items.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesEntity = entityFilter === "all" || item.entity_id === entityFilter;
    const matchesType = typeFilter === "all" || item.entity_type === typeFilter;
    return matchesSearch && matchesEntity && matchesType;
  });

  const getItemsForStatus = (status: string) => {
    return filteredItems.filter((item) => item.status === status);
  };

  return (
    <AppLayout title="Unified Backlog" subtitle="Manage work items across programmes, projects, and products">
      <div className="space-y-6">
        {/* Header Controls */}
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <div className="flex gap-4 flex-1 flex-wrap">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[150px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="program">Programs</SelectItem>
                <SelectItem value="project">Projects</SelectItem>
                <SelectItem value="product">Products</SelectItem>
              </SelectContent>
            </Select>
            <Select value={entityFilter} onValueChange={setEntityFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filter by entity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Entities</SelectItem>
                {programmes.length > 0 && (
                  <>
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                      Programmes
                    </div>
                    {programmes.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </>
                )}
                {projects.length > 0 && (
                  <>
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                      Projects
                    </div>
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </>
                )}
                {products.length > 0 && (
                  <>
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                      Products
                    </div>
                    {products.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </>
                )}
              </SelectContent>
            </Select>
          </div>

          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Item
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>Create Backlog Item</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Name *</Label>
                  <Input
                    value={newItem.name}
                    onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                    placeholder="Enter item name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    value={newItem.description}
                    onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                    placeholder="Describe the work item"
                  />
                </div>

                <EntitySelector
                  programmeId={newItem.programme_id}
                  projectId={newItem.project_id}
                  productId={newItem.product_id}
                  onProgrammeChange={(v) => setNewItem({ ...newItem, programme_id: v })}
                  onProjectChange={(v) => setNewItem({ ...newItem, project_id: v })}
                  onProductChange={(v) => setNewItem({ ...newItem, product_id: v })}
                />

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Priority</Label>
                    <Select
                      value={newItem.priority}
                      onValueChange={(v) => setNewItem({ ...newItem, priority: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="low">Low</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Story Points</Label>
                    <Input
                      type="number"
                      value={newItem.story_points}
                      onChange={(e) => setNewItem({ ...newItem, story_points: e.target.value })}
                      placeholder="e.g., 5"
                    />
                  </div>
                </div>

                <Button onClick={handleCreateItem} className="w-full">
                  Create Item
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Kanban Board */}
        <div className="flex gap-4 overflow-x-auto pb-4">
          {statusColumns.map((column) => (
            <div key={column.id} className="flex-shrink-0 w-[300px]">
              <div className={`rounded-t-lg p-3 ${column.color}`}>
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">{column.label}</h3>
                  <Badge variant="secondary">{getItemsForStatus(column.id).length}</Badge>
                </div>
              </div>
              <div
                className="bg-secondary/30 rounded-b-lg p-3 min-h-[500px] space-y-3"
                onDragOver={handleDragOver}
                onDrop={() => handleDrop(column.id)}
                style={{
                  backgroundColor: draggedItem ? "hsl(var(--accent) / 0.2)" : undefined,
                }}
              >
                {loading ? (
                  <div className="text-center text-muted-foreground py-8">Loading...</div>
                ) : (
                  getItemsForStatus(column.id).map((item) => {
                    const priorityConf = priorityConfig[item.priority] || priorityConfig.medium;
                    const entityConf = entityTypeConfig[item.entity_type];
                    const EntityIcon = entityConf.icon;

                    return (
                      <div
                        key={item.id}
                        draggable
                        onDragStart={() => handleDragStart(item.id)}
                        className={`p-3 rounded-lg bg-card border-2 cursor-move transition-all hover:shadow-md ${priorityConf.color}`}
                      >
                        <div className="flex items-start gap-2">
                          <GripVertical className="h-4 w-4 mt-0.5 opacity-50 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm">{item.name}</p>
                            <div className="flex items-center gap-1 mt-1">
                              <Badge className={`text-xs ${entityConf.color}`}>
                                <EntityIcon className="h-3 w-3 mr-1" />
                                {item.entity_type}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1 truncate">
                              {item.entity_name}
                            </p>
                            {item.description && (
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                {item.description}
                              </p>
                            )}
                            <div className="flex flex-wrap gap-1 mt-2">
                              <Badge variant="outline" className="text-xs capitalize">
                                {item.priority}
                              </Badge>
                              {item.story_points && (
                                <Badge variant="secondary" className="text-xs">
                                  {item.story_points} pts
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                {!loading && getItemsForStatus(column.id).length === 0 && (
                  <div className="text-center text-muted-foreground py-8 text-sm">
                    Drop items here
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}