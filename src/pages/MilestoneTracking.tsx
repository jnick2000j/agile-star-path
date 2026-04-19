import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import {
  Plus,
  Target,
  Flag,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Calendar,
  ChevronRight,
  Milestone,
} from "lucide-react";
import { format, differenceInDays, parseISO } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ApprovalTriadPanel } from "@/components/workflow/ApprovalTriadPanel";

type MilestoneStatus = "planned" | "in_progress" | "achieved" | "missed" | "deferred";

interface MilestoneData {
  id: string;
  name: string;
  description: string | null;
  status: MilestoneStatus;
  milestone_type: string;
  project_id: string | null;
  programme_id: string | null;
  product_id: string | null;
  work_package_id: string | null;
  target_date: string;
  actual_date: string | null;
  deliverables: string[] | null;
  acceptance_criteria: string | null;
  is_stage_boundary: boolean;
  organization_id: string | null;
  owner_id: string | null;
  created_by: string | null;
  created_at: string;
  reference_number: string | null;
}

interface WorkPackage {
  id: string;
  name: string;
  project_id: string | null;
}

const statusConfig: Record<MilestoneStatus, { label: string; icon: React.ElementType; color: string }> = {
  planned: { label: "Planned", icon: Clock, color: "bg-muted text-muted-foreground" },
  in_progress: { label: "In Progress", icon: Flag, color: "bg-primary/20 text-primary" },
  achieved: { label: "Achieved", icon: CheckCircle2, color: "bg-success/20 text-success" },
  missed: { label: "Missed", icon: AlertTriangle, color: "bg-destructive/20 text-destructive" },
  deferred: { label: "Deferred", icon: Clock, color: "bg-warning/20 text-warning" },
};

export default function MilestoneTracking({ embedded }: { embedded?: boolean }) {
  const { currentOrganization } = useOrganization();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedMilestone, setSelectedMilestone] = useState<MilestoneData | null>(null);
  const [entityFilter, setEntityFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    milestone_type: "deliverable",
    entity_type: "project",
    entity_id: "",
    work_package_id: "",
    target_date: "",
    acceptance_criteria: "",
    is_stage_boundary: false,
  });

  // Fetch milestones
  const { data: milestones = [], isLoading } = useQuery({
    queryKey: ["milestones", currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization?.id) return [];
      const { data, error } = await supabase
        .from("milestones")
        .select("*")
        .eq("organization_id", currentOrganization.id)
        .order("target_date", { ascending: true });
      if (error) throw error;
      return data as MilestoneData[];
    },
    enabled: !!currentOrganization?.id,
  });

  // Fetch entities for linking
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

  // Create milestone mutation
  const createMilestone = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase.from("milestones").insert({
        name: data.name,
        description: data.description || null,
        milestone_type: data.milestone_type,
        target_date: data.target_date,
        acceptance_criteria: data.acceptance_criteria || null,
        is_stage_boundary: data.is_stage_boundary,
        organization_id: currentOrganization?.id,
        created_by: user?.id,
        owner_id: user?.id,
        project_id: data.entity_type === "project" && data.entity_id ? data.entity_id : null,
        programme_id: data.entity_type === "program" && data.entity_id ? data.entity_id : null,
        product_id: data.entity_type === "product" && data.entity_id ? data.entity_id : null,
        work_package_id: data.work_package_id || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["milestones"] });
      toast.success("Milestone created successfully");
      setDialogOpen(false);
      setFormData({
        name: "",
        description: "",
        milestone_type: "deliverable",
        entity_type: "project",
        entity_id: "",
        work_package_id: "",
        target_date: "",
        acceptance_criteria: "",
        is_stage_boundary: false,
      });
    },
    onError: (error) => {
      toast.error("Failed to create milestone: " + error.message);
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
      queryClient.invalidateQueries({ queryKey: ["milestones"] });
      toast.success("Milestone updated");
    },
  });

  // Filter milestones
  const filteredMilestones = milestones.filter((m) => {
    if (entityFilter === "project" && !m.project_id) return false;
    if (entityFilter === "program" && !m.programme_id) return false;
    if (entityFilter === "product" && !m.product_id) return false;
    if (typeFilter !== "all" && m.milestone_type !== typeFilter) return false;
    return true;
  });

  // Stats
  const stats = {
    total: milestones.length,
    upcoming: milestones.filter((m) => m.status === "planned" || m.status === "in_progress").length,
    achieved: milestones.filter((m) => m.status === "achieved").length,
    missed: milestones.filter((m) => m.status === "missed").length,
    stageBoundaries: milestones.filter((m) => m.is_stage_boundary).length,
  };

  const getEntityName = (milestone: MilestoneData) => {
    if (milestone.project_id) {
      return projects.find((p) => p.id === milestone.project_id)?.name || "Project";
    }
    if (milestone.programme_id) {
      return programmes.find((p) => p.id === milestone.programme_id)?.name || "Program";
    }
    if (milestone.product_id) {
      return products.find((p) => p.id === milestone.product_id)?.name || "Product";
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

  const getDaysUntil = (dateStr: string) => {
    return differenceInDays(parseISO(dateStr), new Date());
  };

  // Group milestones by month
  const groupedMilestones = filteredMilestones.reduce((acc, milestone) => {
    const month = format(parseISO(milestone.target_date), "MMMM yyyy");
    if (!acc[month]) acc[month] = [];
    acc[month].push(milestone);
    return acc;
  }, {} as Record<string, MilestoneData[]>);

  const content = (
    <>
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Milestones</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <Target className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Upcoming</p>
                <p className="text-2xl font-bold">{stats.upcoming}</p>
              </div>
              <Clock className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Achieved</p>
                <p className="text-2xl font-bold">{stats.achieved}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-success" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Missed</p>
                <p className="text-2xl font-bold">{stats.missed}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-destructive" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Stage Gates</p>
                <p className="text-2xl font-bold">{stats.stageBoundaries}</p>
              </div>
              <Flag className="h-8 w-8 text-warning" />
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
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="deliverable">Deliverable</SelectItem>
              <SelectItem value="stage_gate">Stage Gate</SelectItem>
              <SelectItem value="tranche">Tranche</SelectItem>
              <SelectItem value="review">Review</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Milestone
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Create New Milestone</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <label className="text-sm font-medium">Milestone Name</label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Enter milestone name"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Description</label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Milestone description"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Type</label>
                  <Select
                    value={formData.milestone_type}
                    onValueChange={(v) => setFormData({ ...formData, milestone_type: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="deliverable">Key Deliverable</SelectItem>
                      <SelectItem value="stage_gate">Stage Gate</SelectItem>
                      <SelectItem value="tranche">Program Tranche</SelectItem>
                      <SelectItem value="review">Review Point</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Target Date</label>
                  <Input
                    type="date"
                    value={formData.target_date}
                    onChange={(e) => setFormData({ ...formData, target_date: e.target.value })}
                  />
                </div>
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
                    value={formData.entity_id}
                    onValueChange={(v) => setFormData({ ...formData, entity_id: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={`Select ${formData.entity_type}`} />
                    </SelectTrigger>
                    <SelectContent>
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
              <div>
                <label className="text-sm font-medium">Acceptance Criteria</label>
                <Textarea
                  value={formData.acceptance_criteria}
                  onChange={(e) => setFormData({ ...formData, acceptance_criteria: e.target.value })}
                  placeholder="Define criteria for milestone completion"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="stage_boundary"
                  checked={formData.is_stage_boundary}
                  onChange={(e) => setFormData({ ...formData, is_stage_boundary: e.target.checked })}
                  className="rounded border-input"
                />
                <label htmlFor="stage_boundary" className="text-sm">
                  This is a PRINCE2 stage boundary (go/no-go decision point)
                </label>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => createMilestone.mutate(formData)}
                  disabled={!formData.name || !formData.target_date || createMilestone.isPending}
                >
                  Create Milestone
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Timeline View */}
      {isLoading ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Loading milestones...
          </CardContent>
        </Card>
      ) : Object.keys(groupedMilestones).length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No milestones found. Create your first milestone to start tracking.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedMilestones).map(([month, monthMilestones]) => (
            <div key={month}>
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                {month}
              </h3>
              <div className="grid gap-4">
                {monthMilestones.map((milestone) => {
                  const config = statusConfig[milestone.status];
                  const StatusIcon = config.icon;
                  const daysUntil = getDaysUntil(milestone.target_date);
                  const isOverdue = daysUntil < 0 && milestone.status !== "achieved";

                  return (
                    <Card
                      key={milestone.id}
                      className={`border-l-4 cursor-pointer hover:shadow-md transition-shadow ${
                        milestone.is_stage_boundary
                          ? "border-l-warning"
                          : milestone.status === "achieved"
                          ? "border-l-success"
                          : isOverdue
                          ? "border-l-destructive"
                          : "border-l-primary"
                      }`}
                      onClick={() => setSelectedMilestone(milestone)}
                    >
                      <CardContent className="pt-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              {milestone.reference_number && (
                                <span className="font-mono text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                  {milestone.reference_number}
                                </span>
                              )}
                              <h4 className="font-semibold">{milestone.name}</h4>
                              {milestone.is_stage_boundary && (
                                <Badge variant="outline" className="border-warning text-warning">
                                  <Flag className="h-3 w-3 mr-1" />
                                  Stage Gate
                                </Badge>
                              )}
                              <Badge variant="outline">{milestone.milestone_type}</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mb-2">
                              {getEntityName(milestone)}
                              {milestone.work_package_id && (
                                <span className="ml-2 text-xs bg-muted px-2 py-0.5 rounded">
                                  WP: {getWorkPackageName(milestone.work_package_id)}
                                </span>
                              )}
                            </p>
                            {milestone.description && (
                              <p className="text-sm text-muted-foreground mb-2">
                                {milestone.description}
                              </p>
                            )}
                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                Target: {format(parseISO(milestone.target_date), "MMM d, yyyy")}
                              </span>
                              {milestone.actual_date && (
                                <span className="flex items-center gap-1 text-success">
                                  <CheckCircle2 className="h-3 w-3" />
                                  Achieved: {format(parseISO(milestone.actual_date), "MMM d, yyyy")}
                                </span>
                              )}
                              {!milestone.actual_date && milestone.status !== "achieved" && (
                                <span
                                  className={`font-medium ${isOverdue ? "text-destructive" : ""}`}
                                >
                                  {isOverdue
                                    ? `${Math.abs(daysUntil)} days overdue`
                                    : `${daysUntil} days remaining`}
                                </span>
                              )}
                            </div>
                          </div>
                          <div
                            className="flex items-center gap-2"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Badge className={config.color}>
                              <StatusIcon className="h-3 w-3 mr-1" />
                              {config.label}
                            </Badge>
                            <Select
                              value={milestone.status}
                              onValueChange={(v) =>
                                updateMilestoneStatus.mutate({
                                  id: milestone.id,
                                  status: v as MilestoneStatus,
                                })
                              }
                            >
                              <SelectTrigger className="w-32 h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="planned">Planned</SelectItem>
                                <SelectItem value="in_progress">In Progress</SelectItem>
                                <SelectItem value="achieved">Achieved</SelectItem>
                                <SelectItem value="missed">Missed</SelectItem>
                                <SelectItem value="deferred">Deferred</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Milestone Detail Dialog */}
      <Dialog open={!!selectedMilestone} onOpenChange={() => setSelectedMilestone(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedMilestone && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Milestone className="h-5 w-5" />
                  {selectedMilestone.name}
                </DialogTitle>
              </DialogHeader>
              <Tabs defaultValue="overview" className="mt-4">
                <TabsList>
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="signoff">Sign Off & Notify</TabsTrigger>
                </TabsList>
                <TabsContent value="overview" className="space-y-4 mt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Type</p>
                      <p className="font-medium capitalize">{selectedMilestone.milestone_type}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Status</p>
                      <Badge className={statusConfig[selectedMilestone.status].color}>
                        {statusConfig[selectedMilestone.status].label}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Target date</p>
                      <p className="font-medium">
                        {format(parseISO(selectedMilestone.target_date), "PPP")}
                      </p>
                    </div>
                    {selectedMilestone.actual_date && (
                      <div>
                        <p className="text-sm text-muted-foreground">Achieved on</p>
                        <p className="font-medium text-success">
                          {format(parseISO(selectedMilestone.actual_date), "PPP")}
                        </p>
                      </div>
                    )}
                  </div>
                  {selectedMilestone.description && (
                    <div>
                      <p className="text-sm text-muted-foreground">Description</p>
                      <p>{selectedMilestone.description}</p>
                    </div>
                  )}
                  {selectedMilestone.acceptance_criteria && (
                    <div>
                      <p className="text-sm text-muted-foreground">Acceptance criteria</p>
                      <p className="bg-muted p-3 rounded">{selectedMilestone.acceptance_criteria}</p>
                    </div>
                  )}
                </TabsContent>
                <TabsContent value="signoff" className="mt-4">
                  <ApprovalTriadPanel
                    entityType="milestone"
                    entityId={selectedMilestone.id}
                    entityTitle={selectedMilestone.name}
                    organizationId={selectedMilestone.organization_id}
                    ownerId={selectedMilestone.owner_id}
                    ownerLabel="Milestone owner"
                    onOwnerChange={async (newOwnerId) => {
                      const { error } = await supabase
                        .from("milestones")
                        .update({ owner_id: newOwnerId })
                        .eq("id", selectedMilestone.id);
                      if (error) throw error;
                      setSelectedMilestone({ ...selectedMilestone, owner_id: newOwnerId } as any);
                      queryClient.invalidateQueries({ queryKey: ["milestones"] });
                    }}
                  />
                </TabsContent>
              </Tabs>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );

  if (embedded) return content;

  return (
    <AppLayout title="Milestone Tracking" subtitle="Track key deliverables, stage gates, and programme tranches">
      {content}
    </AppLayout>
  );
}
