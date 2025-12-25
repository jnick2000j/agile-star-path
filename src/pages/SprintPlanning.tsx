import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Plus, 
  Calendar,
  Target,
  GripVertical,
  ChevronRight,
  Play,
  CheckCircle2,
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

interface Product {
  id: string;
  name: string;
}

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

export default function SprintPlanning() {
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [features, setFeatures] = useState<Feature[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [draggedFeature, setDraggedFeature] = useState<string | null>(null);
  const [selectedFeature, setSelectedFeature] = useState<Feature | null>(null);
  const [featureDialogOpen, setFeatureDialogOpen] = useState(false);
  const { user } = useAuth();
  const { currentOrganization } = useOrganization();

  const [newSprint, setNewSprint] = useState({
    name: "",
    description: "",
    product_id: "",
    start_date: "",
    end_date: "",
    capacity_points: 40,
  });

  const fetchData = async () => {
    setLoading(true);

    let sprintQuery = supabase.from("sprints").select("*").order("start_date", { ascending: false });
    let productQuery = supabase.from("products").select("id, name").order("name");
    
    if (currentOrganization) {
      sprintQuery = sprintQuery.eq("organization_id", currentOrganization.id);
      productQuery = productQuery.eq("organization_id", currentOrganization.id);
    }

    const [sprintsRes, featuresRes, productsRes] = await Promise.all([
      sprintQuery,
      supabase.from("product_features").select("*").order("priority"),
      productQuery,
    ]);

    if (sprintsRes.error) console.error("Sprints error:", sprintsRes.error);
    if (featuresRes.error) console.error("Features error:", featuresRes.error);
    if (productsRes.error) console.error("Products error:", productsRes.error);

    setSprints(sprintsRes.data || []);
    setFeatures(featuresRes.data || []);
    setProducts(productsRes.data || []);
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

    const { error } = await supabase.from("sprints").insert({
      name: newSprint.name,
      description: newSprint.description || null,
      product_id: newSprint.product_id || null,
      start_date: newSprint.start_date || null,
      end_date: newSprint.end_date || null,
      capacity_points: newSprint.capacity_points,
      organization_id: currentOrganization?.id,
      created_by: user?.id,
    });

    if (error) {
      toast.error("Failed to create sprint");
      console.error(error);
    } else {
      toast.success("Sprint created successfully");
      setIsCreateOpen(false);
      setNewSprint({
        name: "",
        description: "",
        product_id: "",
        start_date: "",
        end_date: "",
        capacity_points: 40,
      });
      fetchData();
    }
  };

  const handleDragStart = (featureId: string) => {
    setDraggedFeature(featureId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDropOnSprint = async (sprintId: string | null) => {
    if (!draggedFeature) return;

    const { error } = await supabase
      .from("product_features")
      .update({ sprint_id: sprintId })
      .eq("id", draggedFeature);

    if (error) {
      toast.error("Failed to assign feature");
    } else {
      setFeatures(prev =>
        prev.map(f => f.id === draggedFeature ? { ...f, sprint_id: sprintId } : f)
      );
      toast.success(sprintId ? "Feature added to sprint" : "Feature removed from sprint");
    }
    setDraggedFeature(null);
  };

  const getSprintFeatures = (sprintId: string) => {
    return features.filter(f => f.sprint_id === sprintId);
  };

  const getSprintPoints = (sprintId: string) => {
    return getSprintFeatures(sprintId).reduce((sum, f) => sum + (f.story_points || 0), 0);
  };

  const backlogFeatures = features.filter(f => !f.sprint_id);

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

  return (
    <AppLayout title="Sprint Planning" subtitle="Plan and manage sprints with capacity tracking">
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Backlog Column */}
        <div className="lg:col-span-1">
          <div className="metric-card h-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold flex items-center gap-2">
                <Target className="h-5 w-5" />
                Backlog
              </h3>
              <Badge variant="secondary">{backlogFeatures.length}</Badge>
            </div>
            <div
              className="space-y-2 min-h-[400px] max-h-[600px] overflow-y-auto"
              onDragOver={handleDragOver}
              onDrop={() => handleDropOnSprint(null)}
              style={{
                backgroundColor: draggedFeature ? "hsl(var(--accent) / 0.1)" : undefined,
              }}
            >
              {backlogFeatures.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No unassigned features
                </p>
              ) : (
                backlogFeatures.map(feature => (
                  <div
                    key={feature.id}
                    draggable
                    onDragStart={() => handleDragStart(feature.id)}
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
              )}
            </div>
          </div>
        </div>

        {/* Sprints Column */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold">Sprints</h3>
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
                  <div className="space-y-2">
                    <Label>Product (Optional)</Label>
                    <Select
                      value={newSprint.product_id}
                      onValueChange={(v) => setNewSprint({ ...newSprint, product_id: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select product" />
                      </SelectTrigger>
                      <SelectContent>
                        {products.map(p => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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

          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading sprints...</div>
          ) : sprints.length === 0 ? (
            <div className="metric-card text-center py-12">
              <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No sprints created yet</p>
              <p className="text-sm text-muted-foreground">Create your first sprint to start planning</p>
            </div>
          ) : (
            sprints.map(sprint => {
              const sprintFeatures = getSprintFeatures(sprint.id);
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
                    backgroundColor: draggedFeature ? "hsl(var(--accent) / 0.1)" : undefined,
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
                    {sprintFeatures.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        Drag features here to add them to this sprint
                      </p>
                    ) : (
                      sprintFeatures.map(feature => (
                        <div
                          key={feature.id}
                          draggable
                          onDragStart={() => handleDragStart(feature.id)}
                          onClick={() => handleFeatureClick(feature)}
                          className={`p-3 rounded-lg bg-secondary/50 border-l-4 cursor-move hover:bg-secondary transition-colors ${priorityColors[feature.priority]}`}
                        >
                          <div className="flex items-center gap-2">
                            <GripVertical className="h-4 w-4 opacity-50" />
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
                      ))
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <FeatureDetailDialog
        feature={selectedFeature}
        open={featureDialogOpen}
        onOpenChange={setFeatureDialogOpen}
        onUpdate={fetchData}
        products={products}
      />
    </AppLayout>
  );
}
