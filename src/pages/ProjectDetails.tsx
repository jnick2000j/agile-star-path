import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { QuickActionTabs } from "@/components/QuickActionTabs";
import { AISummaryPanel } from "@/components/ai/AISummaryPanel";
import {
  ArrowLeft,
  FolderKanban,
  Calendar,
  Users,
  Package,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Clock,
  History,
  RefreshCw,
  XCircle,
  Archive,
  Layers,
  ListTodo,
  FileText,
  MessageSquarePlus,
  LifeBuoy,
  Workflow,
} from "lucide-react";
import { AutomationsTab } from "@/components/automations/AutomationsTab";
import { EntityTicketsCard } from "@/components/helpdesk/EntityTicketsCard";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { EntityStatusActions } from "@/components/EntityStatusActions";
import { EntityUpdates } from "@/components/EntityUpdates";
import { EntityAssignments } from "@/components/EntityAssignments";
import { UpdateFrequencySettings } from "@/components/UpdateFrequencySettings";
import { DocumentUpload } from "@/components/DocumentUpload";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { EntitySprintsTab } from "@/components/EntitySprintsTab";
import { format } from "date-fns";

interface Project {
  id: string;
  name: string;
  description: string | null;
  stage: string;
  priority: string;
  health: string;
  methodology: string;
  start_date: string | null;
  end_date: string | null;
  organization_id: string | null;
  programme_id: string | null;
  manager_id: string | null;
  created_at: string;
}

interface WorkPackage {
  id: string;
  name: string;
  description: string | null;
  status: string;
  assigned_to: string | null;
  progress: number;
  target_start: string | null;
  target_end: string | null;
}

interface Risk {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  probability: string;
  impact: string;
  status: string;
  response: string | null;
}

interface Issue {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  resolution: string | null;
  date_raised: string | null;
}

interface TaskItem {
  id: string;
  name: string;
  description: string | null;
  status: string;
  priority: string;
  assigned_to: string | null;
  planned_start: string | null;
  planned_end: string | null;
  story_points: number | null;
}

interface ProductItem {
  id: string;
  name: string;
  description: string | null;
  stage: string;
  status: string;
  product_type: string;
  launch_date: string | null;
}

interface StatusHistoryEntry {
  id: string;
  old_status: string | null;
  new_status: string;
  action: string;
  reason: string | null;
  changed_by: string | null;
  changed_at: string;
  changer_name?: string;
}

const stageConfig: Record<string, { label: string; className: string }> = {
  initiation: { label: "Initiation", className: "bg-info/10 text-info border-info/20" },
  planning: { label: "Planning", className: "bg-warning/10 text-warning border-warning/20" },
  execution: { label: "Execution", className: "bg-primary/10 text-primary border-primary/20" },
  monitoring: { label: "Monitoring", className: "bg-purple-500/10 text-purple-600 border-purple-500/20" },
  closure: { label: "Closure", className: "bg-success/10 text-success border-success/20" },
};

const healthConfig: Record<string, { label: string; className: string }> = {
  green: { label: "Green", className: "bg-success/10 text-success" },
  amber: { label: "Amber", className: "bg-warning/10 text-warning" },
  red: { label: "Red", className: "bg-destructive/10 text-destructive" },
};

const priorityConfig: Record<string, { label: string; className: string }> = {
  high: { label: "High", className: "bg-destructive/10 text-destructive" },
  medium: { label: "Medium", className: "bg-warning/10 text-warning" },
  low: { label: "Low", className: "bg-muted text-muted-foreground" },
};

const productStageConfig: Record<string, { label: string; className: string }> = {
  ideation: { label: "Ideation", className: "bg-purple-500/10 text-purple-600" },
  discovery: { label: "Discovery", className: "bg-info/10 text-info" },
  development: { label: "Development", className: "bg-warning/10 text-warning" },
  launch: { label: "Launch", className: "bg-success/10 text-success" },
  growth: { label: "Growth", className: "bg-primary/10 text-primary" },
  maturity: { label: "Maturity", className: "bg-muted text-muted-foreground" },
  sunset: { label: "Sunset", className: "bg-orange-500/10 text-orange-600" },
};

const wpStatusConfig: Record<string, { label: string; className: string }> = {
  pending: { label: "Pending", className: "bg-muted text-muted-foreground" },
  authorized: { label: "Authorized", className: "bg-info/10 text-info" },
  in_progress: { label: "In Progress", className: "bg-warning/10 text-warning" },
  completed: { label: "Completed", className: "bg-success/10 text-success" },
  closed: { label: "Closed", className: "bg-muted text-muted-foreground" },
};

const riskStatusConfig: Record<string, { label: string; className: string }> = {
  open: { label: "Open", className: "bg-destructive/10 text-destructive" },
  mitigating: { label: "Mitigating", className: "bg-warning/10 text-warning" },
  closed: { label: "Closed", className: "bg-success/10 text-success" },
  accepted: { label: "Accepted", className: "bg-info/10 text-info" },
};

const issueStatusConfig: Record<string, { label: string; className: string }> = {
  open: { label: "Open", className: "bg-destructive/10 text-destructive" },
  in_progress: { label: "In Progress", className: "bg-warning/10 text-warning" },
  resolved: { label: "Resolved", className: "bg-success/10 text-success" },
  closed: { label: "Closed", className: "bg-muted text-muted-foreground" },
};

const actionIcons: Record<string, React.ElementType> = {
  created: CheckCircle2,
  approved: CheckCircle2,
  rejected: XCircle,
  deferred: Clock,
  reopened: RefreshCw,
  closed: Archive,
  on_hold: Clock,
};

const actionLabels: Record<string, string> = {
  created: "Created",
  approved: "Approved",
  rejected: "Rejected",
  deferred: "Deferred",
  reopened: "Reopened",
  closed: "Closed",
  on_hold: "Put On Hold",
};

export default function ProjectDetails() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const projectId = searchParams.get("id");

  const [project, setProject] = useState<Project | null>(null);
  const [programName, setProgrammeName] = useState<string | null>(null);
  const [workPackages, setWorkPackages] = useState<WorkPackage[]>([]);
  const [risks, setRisks] = useState<Risk[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [statusHistory, setStatusHistory] = useState<StatusHistoryEntry[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [brief, setBrief] = useState({
    background: "",
    objectives: "",
    scope: "",
    constraints: "",
    assumptions: "",
    business_case_summary: "",
    cost_estimate: "",
    timeline_estimate: "",
    risk_summary: "",
  });
  const [briefSaving, setBriefSaving] = useState(false);

  const fetchProject = async () => {
    if (!projectId) return;

    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .single();

    if (!error && data) {
      setProject(data);
      
      // Fetch programme name if linked
      if (data.programme_id) {
        const { data: progData } = await supabase
          .from("programmes")
          .select("name")
          .eq("id", data.programme_id)
          .single();
        setProgrammeName(progData?.name || null);
      }
    }
  };

  const fetchWorkPackages = async () => {
    if (!projectId) return;

    const { data } = await supabase
      .from("work_packages")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });

    setWorkPackages(data || []);
  };

  const fetchRisks = async () => {
    if (!projectId) return;

    const { data } = await supabase
      .from("risks")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });

    setRisks(data || []);
  };

  const fetchIssues = async () => {
    if (!projectId) return;

    const { data } = await supabase
      .from("issues")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });

    setIssues(data || []);
  };

  const fetchStatusHistory = async () => {
    if (!projectId) return;

    const { data } = await supabase
      .from("status_history")
      .select("*")
      .eq("entity_type", "project")
      .eq("entity_id", projectId)
      .order("changed_at", { ascending: false });

    if (data) {
      const userIds = [...new Set(data.map((h) => h.changed_by).filter(Boolean))];
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name, first_name, last_name")
          .in("id", userIds);

        const profileMap = new Map(
          profiles?.map((p) => [
            p.id,
            p.full_name || `${p.first_name || ""} ${p.last_name || ""}`.trim() || "Unknown",
          ])
        );

        setStatusHistory(
          data.map((h) => ({
            ...h,
            changer_name: h.changed_by ? profileMap.get(h.changed_by) || "Unknown" : "System",
          }))
        );
      } else {
        setStatusHistory(data);
      }
    }
  };

  const fetchTasks = async () => {
    if (!projectId) return;

    const { data } = await supabase
      .from("tasks")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });

    setTasks(data || []);
  };

  const fetchProducts = async () => {
    if (!projectId) return;

    // Fetch products directly linked to this project, or linked via the same programme
    let query = supabase.from("products").select("*").order("name");

    if (project?.programme_id) {
      query = query.or(`project_id.eq.${projectId},programme_id.eq.${project.programme_id}`);
    } else {
      query = query.eq("project_id", projectId);
    }

    const { data } = await query;
    setProducts(data || []);
  };

  const fetchAllData = async () => {
    setLoading(true);
    await Promise.all([fetchProject(), fetchWorkPackages(), fetchRisks(), fetchIssues(), fetchTasks(), fetchStatusHistory()]);
    setLoading(false);
  };

  useEffect(() => {
    if (projectId) {
      fetchAllData();
    }
  }, [projectId]);

  useEffect(() => {
    if (project?.programme_id) {
      fetchProducts();
    }
  }, [project?.programme_id]);

  if (!projectId) {
    return (
      <AppLayout title="Project Details" subtitle="View project information">
        <div className="flex flex-col items-center justify-center py-12">
          <FolderKanban className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No project selected</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate("/projects")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Projects
          </Button>
        </div>
      </AppLayout>
    );
  }

  if (loading) {
    return (
      <AppLayout title="Project Details" subtitle="Loading...">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </AppLayout>
    );
  }

  if (!project) {
    return (
      <AppLayout title="Project Details" subtitle="Project not found">
        <div className="flex flex-col items-center justify-center py-12">
          <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
          <p className="text-muted-foreground">Project not found</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate("/projects")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Projects
          </Button>
        </div>
      </AppLayout>
    );
  }

  const stage = stageConfig[project.stage] || stageConfig.initiation;
  const health = healthConfig[project.health] || healthConfig.green;
  const priority = priorityConfig[project.priority] || priorityConfig.medium;
  const openRisks = risks.filter((r) => r.status === "open" || r.status === "mitigating").length;
  const openIssues = issues.filter((i) => i.status === "open" || i.status === "in_progress").length;
  const completedWPs = workPackages.filter((wp) => wp.status === "completed" || wp.status === "closed").length;

  return (
    <AppLayout title={project.name} subtitle="Project Details">
      <div className="space-y-6">
        {/* Header with actions */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate("/projects")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Projects
          </Button>
          <div className="flex items-center gap-2">
            <DocumentUpload
              entityType="project"
              entityId={project.id}
              entityName={project.name}
            />
            <EntityStatusActions
              entityType="project"
              entityId={project.id}
              entityName={project.name}
              currentStatus={project.stage}
              onStatusChange={fetchAllData}
            />
          </div>
        </div>

        {/* Project Overview Card */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-2xl">{project.name}</CardTitle>
                <CardDescription className="mt-2">{project.description}</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={cn("text-sm", stage.className)}>
                  {stage.label}
                </Badge>
                <Badge className={cn("text-sm", health.className)}>
                  {health.label}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Layers className="h-4 w-4" />
                  
                </div>
                <p className="font-medium">{programName || "Not linked"}</p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Users className="h-4 w-4" />
                  Methodology
                </div>
                <p className="font-medium capitalize">{project.methodology}</p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <AlertTriangle className="h-4 w-4" />
                  Priority
                </div>
                <Badge className={cn("text-sm", priority.className)}>{priority.label}</Badge>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  Timeline
                </div>
                <p className="font-medium">
                  {project.start_date && project.end_date
                    ? `${format(new Date(project.start_date), "MMM d, yyyy")} - ${format(new Date(project.end_date), "MMM d, yyyy")}`
                    : project.start_date
                    ? `From ${format(new Date(project.start_date), "MMM d, yyyy")}`
                    : "Not set"}
                </p>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <div className="p-4 rounded-lg bg-muted/50">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Work Packages</span>
                  <Package className="h-4 w-4 text-muted-foreground" />
                </div>
                <p className="text-2xl font-bold mt-2">{workPackages.length}</p>
                <p className="text-xs text-muted-foreground">{completedWPs} completed</p>
              </div>
              <div className="p-4 rounded-lg bg-destructive/5">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Open Risks</span>
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                </div>
                <p className="text-2xl font-bold mt-2 text-destructive">{openRisks}</p>
                <p className="text-xs text-muted-foreground">{risks.length} total</p>
              </div>
              <div className="p-4 rounded-lg bg-warning/5">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Open Issues</span>
                  <AlertCircle className="h-4 w-4 text-warning" />
                </div>
                <p className="text-2xl font-bold mt-2 text-warning">{openIssues}</p>
                <p className="text-xs text-muted-foreground">{issues.length} total</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <AISummaryPanel
          scopeType="project"
          scopeId={project.id}
          summaryKind="entity_overview"
          title="AI Project Overview"
        />

        {/* Tabs for different sections */}
        <Tabs defaultValue="workpackages" className="space-y-4">
          <QuickActionTabs
            items={[
              { value: "workpackages", label: "Work Packages", icon: Package, count: workPackages.length },
              { value: "tasks", label: "Tasks", icon: ListTodo, count: tasks.length },
              { value: "sprints", label: "Sprints", icon: Calendar },
              { value: "products", label: "Products", icon: Layers, count: products.length },
              { value: "risks", label: "Risks", icon: AlertTriangle, count: risks.length },
              { value: "issues", label: "Issues", icon: AlertCircle, count: issues.length },
              { value: "brief", label: "Project Brief", icon: FileText },
              { value: "team", label: "Team", icon: Users },
              { value: "updates", label: "Updates", icon: MessageSquarePlus },
              { value: "tickets", label: "Tickets", icon: LifeBuoy },
              { value: "automations", label: "Automations", icon: Workflow },
              { value: "history", label: "Status Timeline", icon: History },
            ]}
            />
          />

          {/* Work Packages Tab */}
          <TabsContent value="workpackages">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Work Packages</CardTitle>
                    <CardDescription>PRINCE2 work packages for this project</CardDescription>
                  </div>
                  <Button variant="outline" onClick={() => navigate("/projects/work-packages")}>
                    <Package className="h-4 w-4 mr-2" />
                    Manage Work Packages
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {workPackages.length === 0 ? (
                  <div className="text-center py-8">
                    <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No work packages for this project</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {workPackages.map((wp) => {
                      const wpStatus = wpStatusConfig[wp.status] || wpStatusConfig.pending;

                      return (
                        <div key={wp.id} className="p-4 rounded-lg border bg-card">
                          <div className="flex items-start justify-between mb-2">
                            <h4 className="font-medium">{wp.name}</h4>
                            <Badge className={cn("text-xs", wpStatus.className)}>
                              {wpStatus.label}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mb-3">
                            {wp.description || "No description"}
                          </p>
                          <div className="flex items-center gap-4 text-sm">
                            <div>
                              <span className="text-muted-foreground">Assigned: </span>
                              <span>{wp.assigned_to || "Unassigned"}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Progress: </span>
                              <span className="font-medium">{wp.progress}%</span>
                            </div>
                          </div>
                          <Progress value={wp.progress} className="h-2 mt-2" />
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tasks Tab */}
          <TabsContent value="tasks">
            <Card>
              <CardHeader>
                <CardTitle>Linked Tasks</CardTitle>
                <CardDescription>Tasks associated with this project</CardDescription>
              </CardHeader>
              <CardContent>
                {tasks.length === 0 ? (
                  <div className="text-center py-8">
                    <ListTodo className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No tasks linked to this project yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {tasks.map((task) => {
                      const taskPriority = priorityConfig[task.priority] || { label: task.priority, className: "bg-muted text-muted-foreground" };
                      const taskStatusMap: Record<string, { label: string; className: string }> = {
                        not_started: { label: "Not Started", className: "bg-muted text-muted-foreground" },
                        in_progress: { label: "In Progress", className: "bg-warning/10 text-warning" },
                        completed: { label: "Completed", className: "bg-success/10 text-success" },
                        on_hold: { label: "On Hold", className: "bg-info/10 text-info" },
                        cancelled: { label: "Cancelled", className: "bg-destructive/10 text-destructive" },
                      };
                      const taskStatus = taskStatusMap[task.status] || { label: task.status, className: "bg-muted text-muted-foreground" };
                      return (
                        <div key={task.id} className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
                          <div className="space-y-1">
                            <p className="font-medium">{task.name}</p>
                            {task.description && (
                              <p className="text-sm text-muted-foreground line-clamp-1">{task.description}</p>
                            )}
                            <div className="flex items-center gap-2">
                              {task.planned_start && task.planned_end && (
                                <span className="text-xs text-muted-foreground">
                                  {format(new Date(task.planned_start), "MMM d")} - {format(new Date(task.planned_end), "MMM d, yyyy")}
                                </span>
                              )}
                              {task.story_points && (
                                <Badge variant="outline" className="text-xs">{task.story_points} pts</Badge>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className={cn("text-xs", taskPriority.className)}>
                              {taskPriority.label}
                            </Badge>
                            <Badge variant="secondary" className={cn("text-xs", taskStatus.className)}>
                              {taskStatus.label}
                            </Badge>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Products Tab */}
          <TabsContent value="products">
            <Card>
              <CardHeader>
                <CardTitle>Linked Products</CardTitle>
                <CardDescription>Products associated with this project's program</CardDescription>
              </CardHeader>
              <CardContent>
                {products.length === 0 ? (
                  <div className="text-center py-8">
                    <Layers className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No products linked yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {products.map((product) => {
                      const stage = productStageConfig[product.stage] || { label: product.stage, className: "bg-muted text-muted-foreground" };
                      return (
                        <div
                          key={product.id}
                          className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer"
                          onClick={() => navigate(`/products/details?id=${product.id}`)}
                        >
                          <div className="space-y-1">
                            <p className="font-medium">{product.name}</p>
                            {product.description && (
                              <p className="text-sm text-muted-foreground line-clamp-1">{product.description}</p>
                            )}
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs capitalize">{product.product_type}</Badge>
                              {product.launch_date && (
                                <span className="text-xs text-muted-foreground">
                                  Launch: {format(new Date(product.launch_date), "MMM d, yyyy")}
                                </span>
                              )}
                            </div>
                          </div>
                          <Badge variant="secondary" className={cn("text-xs", stage.className)}>
                            {stage.label}
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Risks Tab */}
          <TabsContent value="risks">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Project Risks</CardTitle>
                    <CardDescription>{openRisks} open risks requiring attention</CardDescription>
                  </div>
                  <Button variant="outline" onClick={() => navigate("/registers/risks")}>
                    <AlertTriangle className="h-4 w-4 mr-2" />
                    View Risk Register
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {risks.length === 0 ? (
                  <div className="text-center py-8">
                    <AlertTriangle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No risks registered for this project</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {risks.map((risk) => {
                      const riskStatus = riskStatusConfig[risk.status] || riskStatusConfig.open;

                      return (
                        <div key={risk.id} className="p-4 rounded-lg border bg-card">
                          <div className="flex items-start justify-between mb-2">
                            <h4 className="font-medium">{risk.title}</h4>
                            <Badge className={cn("text-xs", riskStatus.className)}>
                              {riskStatus.label}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mb-3">
                            {risk.description || "No description"}
                          </p>
                          <div className="flex items-center gap-4 text-sm flex-wrap">
                            <div>
                              <span className="text-muted-foreground">Category: </span>
                              <span className="capitalize">{risk.category || "N/A"}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Probability: </span>
                              <span className="capitalize">{risk.probability}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Impact: </span>
                              <span className="capitalize">{risk.impact}</span>
                            </div>
                          </div>
                          {risk.response && (
                            <div className="mt-2 p-2 bg-muted/50 rounded text-sm">
                              <span className="text-muted-foreground">Response: </span>
                              {risk.response}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Issues Tab */}
          <TabsContent value="issues">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Project Issues</CardTitle>
                    <CardDescription>{openIssues} issues needing resolution</CardDescription>
                  </div>
                  <Button variant="outline" onClick={() => navigate("/registers/issues")}>
                    <AlertCircle className="h-4 w-4 mr-2" />
                    View Issue Register
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {issues.length === 0 ? (
                  <div className="text-center py-8">
                    <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No issues reported for this project</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {issues.map((issue) => {
                      const issueStatus = issueStatusConfig[issue.status] || issueStatusConfig.open;
                      const issuePriority = priorityConfig[issue.priority] || priorityConfig.medium;

                      return (
                        <div key={issue.id} className="p-4 rounded-lg border bg-card">
                          <div className="flex items-start justify-between mb-2">
                            <h4 className="font-medium">{issue.title}</h4>
                            <div className="flex items-center gap-2">
                              <Badge className={cn("text-xs", issuePriority.className)}>
                                {issuePriority.label}
                              </Badge>
                              <Badge className={cn("text-xs", issueStatus.className)}>
                                {issueStatus.label}
                              </Badge>
                            </div>
                          </div>
                          <p className="text-sm text-muted-foreground mb-3">
                            {issue.description || "No description"}
                          </p>
                          {issue.date_raised && (
                            <p className="text-xs text-muted-foreground">
                              Reported: {format(new Date(issue.date_raised), "MMM d, yyyy")}
                            </p>
                          )}
                          {issue.resolution && (
                            <div className="mt-2 p-2 bg-success/5 rounded text-sm">
                              <span className="text-muted-foreground">Resolution: </span>
                              {issue.resolution}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Project Brief Tab */}
          <TabsContent value="brief">
            <Card>
              <CardHeader>
                <CardTitle>PRINCE2 Project Brief</CardTitle>
                <CardDescription>Project Initiation Document — background, objectives, scope, and business case</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="sm:col-span-2 space-y-2">
                      <Label>Project Background</Label>
                      <Textarea
                        value={brief.background}
                        onChange={(e) => setBrief({ ...brief, background: e.target.value })}
                        placeholder="Why is this project needed? What is the business context?"
                        rows={3}
                      />
                    </div>
                    <div className="sm:col-span-2 space-y-2">
                      <Label>Project Objectives</Label>
                      <Textarea
                        value={brief.objectives}
                        onChange={(e) => setBrief({ ...brief, objectives: e.target.value })}
                        placeholder="What will the project achieve? (SMART objectives)"
                        rows={3}
                      />
                    </div>
                    <div className="sm:col-span-2 space-y-2">
                      <Label>Scope</Label>
                      <Textarea
                        value={brief.scope}
                        onChange={(e) => setBrief({ ...brief, scope: e.target.value })}
                        placeholder="What is in scope? What is explicitly out of scope?"
                        rows={2}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Constraints</Label>
                      <Textarea
                        value={brief.constraints}
                        onChange={(e) => setBrief({ ...brief, constraints: e.target.value })}
                        placeholder="Budget, time, resource constraints..."
                        rows={2}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Assumptions</Label>
                      <Textarea
                        value={brief.assumptions}
                        onChange={(e) => setBrief({ ...brief, assumptions: e.target.value })}
                        placeholder="Key assumptions made..."
                        rows={2}
                      />
                    </div>
                    <div className="sm:col-span-2 space-y-2">
                      <Label>Business Case Summary</Label>
                      <Textarea
                        value={brief.business_case_summary}
                        onChange={(e) => setBrief({ ...brief, business_case_summary: e.target.value })}
                        placeholder="Summarize the business justification and expected benefits"
                        rows={2}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Cost Estimate</Label>
                      <Input
                        value={brief.cost_estimate}
                        onChange={(e) => setBrief({ ...brief, cost_estimate: e.target.value })}
                        placeholder="e.g., £500,000"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Timeline Estimate</Label>
                      <Input
                        value={brief.timeline_estimate}
                        onChange={(e) => setBrief({ ...brief, timeline_estimate: e.target.value })}
                        placeholder="e.g., 6 months"
                      />
                    </div>
                    <div className="sm:col-span-2 space-y-2">
                      <Label>Risk Summary</Label>
                      <Textarea
                        value={brief.risk_summary}
                        onChange={(e) => setBrief({ ...brief, risk_summary: e.target.value })}
                        placeholder="Summary of key risks identified"
                        rows={2}
                      />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">Brief data is stored locally in this session. A future update will persist this to the database.</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tickets Tab */}
          <TabsContent value="tickets">
            {project && <EntityTicketsCard scope="project" entityId={project.id} entityName={project.name} />}
          </TabsContent>

          {/* Status Timeline Tab */}
          <TabsContent value="history">
            <Card>
              <CardHeader>
                <CardTitle>Status Timeline</CardTitle>
                <CardDescription>History of status changes for this project</CardDescription>
              </CardHeader>
              <CardContent>
                {statusHistory.length === 0 ? (
                  <div className="text-center py-8">
                    <History className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No status changes recorded</p>
                  </div>
                ) : (
                  <ScrollArea className="h-[400px]">
                    <div className="relative pl-6 space-y-6">
                      <div className="absolute left-2 top-2 bottom-2 w-0.5 bg-border" />

                      {statusHistory.map((entry) => {
                        const Icon = actionIcons[entry.action] || CheckCircle2;
                        const actionLabel = actionLabels[entry.action] || entry.action;

                        return (
                          <div key={entry.id} className="relative">
                            <div className="absolute -left-4 top-1 w-4 h-4 rounded-full bg-background border-2 border-primary flex items-center justify-center">
                              <Icon className="h-2.5 w-2.5 text-primary" />
                            </div>

                            <div className="bg-muted/50 rounded-lg p-4">
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">{actionLabel}</span>
                                  {entry.old_status && (
                                    <>
                                      <Badge variant="outline" className="text-xs">
                                        {entry.old_status}
                                      </Badge>
                                      <span className="text-muted-foreground">→</span>
                                    </>
                                  )}
                                  <Badge variant="secondary" className="text-xs">
                                    {entry.new_status}
                                  </Badge>
                                </div>
                                <span className="text-xs text-muted-foreground">
                                  {format(new Date(entry.changed_at), "MMM d, yyyy 'at' h:mm a")}
                                </span>
                              </div>

                              <div className="text-sm text-muted-foreground">
                                By {entry.changer_name || "Unknown"}
                              </div>

                              {entry.reason && (
                                <div className="mt-2 p-2 bg-background rounded text-sm">
                                  <span className="text-muted-foreground">Reason: </span>
                                  {entry.reason}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="team">
            {project && (
              <div className="grid gap-4 md:grid-cols-2">
                <EntityAssignments entityType="project" entityId={project.id} organizationId={project.organization_id} />
                <UpdateFrequencySettings entityType="project" entityId={project.id} organizationId={project.organization_id} />
              </div>
            )}
          </TabsContent>

          <TabsContent value="updates">
            <Card>
              <CardHeader>
                <CardTitle>Progress Updates</CardTitle>
                <CardDescription>Timestamped updates for this project — these feed into reports</CardDescription>
              </CardHeader>
              <CardContent>
                {project && (
                  <EntityUpdates
                    entityType="project"
                    entityId={project.id}
                    organizationId={project.organization_id}
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sprints">
            <EntitySprintsTab
              entityType="project"
              entityId={project.id}
              organizationId={project.organization_id}
            />
          </TabsContent>

          <TabsContent value="automations">
            <AutomationsTab module="project" entityId={project.id} entityType="project" />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
