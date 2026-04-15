import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { EntityStatusActions } from "@/components/EntityStatusActions";
import { DocumentUpload } from "@/components/DocumentUpload";
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
  const [loading, setLoading] = useState(true);

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

  const fetchAllData = async () => {
    setLoading(true);
    await Promise.all([fetchProject(), fetchWorkPackages(), fetchRisks(), fetchIssues(), fetchStatusHistory()]);
    setLoading(false);
  };

  useEffect(() => {
    if (projectId) {
      fetchAllData();
    }
  }, [projectId]);

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

        {/* Tabs for different sections */}
        <Tabs defaultValue="workpackages" className="space-y-4">
          <TabsList>
            <TabsTrigger value="workpackages" className="gap-2">
              <Package className="h-4 w-4" />
              Work Packages ({workPackages.length})
            </TabsTrigger>
            <TabsTrigger value="risks" className="gap-2">
              <AlertTriangle className="h-4 w-4" />
              Risks ({risks.length})
            </TabsTrigger>
            <TabsTrigger value="issues" className="gap-2">
              <AlertCircle className="h-4 w-4" />
              Issues ({issues.length})
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-2">
              <History className="h-4 w-4" />
              Status Timeline
            </TabsTrigger>
          </TabsList>

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
        </Tabs>
      </div>
    </AppLayout>
  );
}
