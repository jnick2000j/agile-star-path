import { useState, useEffect } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ArrowLeft,
  Building2,
  Calendar,
  Target,
  Users,
  TrendingUp,
  FolderKanban,
  DollarSign,
  CheckCircle2,
  Clock,
  AlertTriangle,
  History,
  FileText,
  RefreshCw,
  XCircle,
  Archive,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { EntityStatusActions } from "@/components/EntityStatusActions";
import { DocumentUpload } from "@/components/DocumentUpload";
import { format } from "date-fns";

interface Programme {
  id: string;
  name: string;
  description: string | null;
  status: string;
  progress: number;
  start_date: string | null;
  end_date: string | null;
  sponsor: string | null;
  tranche: string | null;
  budget: string | null;
  benefits_target: string | null;
  organization_id: string | null;
  created_at: string;
}

interface Project {
  id: string;
  name: string;
  description: string | null;
  stage: string;
  priority: string;
  health: string;
  start_date: string | null;
  end_date: string | null;
}

interface Benefit {
  id: string;
  name: string;
  description: string | null;
  category: string;
  status: string;
  target_value: string | null;
  current_value: string | null;
  realization: number;
  type: string;
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

const statusConfig: Record<string, { label: string; className: string }> = {
  active: { label: "Active", className: "bg-success/10 text-success border-success/20" },
  "at-risk": { label: "At Risk", className: "bg-destructive/10 text-destructive border-destructive/20" },
  "on-hold": { label: "On Hold", className: "bg-warning/10 text-warning border-warning/20" },
  completed: { label: "Completed", className: "bg-primary/10 text-primary border-primary/20" },
  pending: { label: "Pending", className: "bg-info/10 text-info border-info/20" },
  rejected: { label: "Rejected", className: "bg-destructive/10 text-destructive border-destructive/20" },
  deferred: { label: "Deferred", className: "bg-muted text-muted-foreground border-muted" },
  closed: { label: "Closed", className: "bg-muted text-muted-foreground border-muted" },
};

const stageConfig: Record<string, { label: string; className: string }> = {
  initiation: { label: "Initiation", className: "bg-info/10 text-info" },
  planning: { label: "Planning", className: "bg-warning/10 text-warning" },
  execution: { label: "Execution", className: "bg-primary/10 text-primary" },
  monitoring: { label: "Monitoring", className: "bg-purple-500/10 text-purple-600" },
  closure: { label: "Closure", className: "bg-success/10 text-success" },
};

const healthConfig: Record<string, { label: string; className: string }> = {
  green: { label: "Green", className: "bg-success/10 text-success" },
  amber: { label: "Amber", className: "bg-warning/10 text-warning" },
  red: { label: "Red", className: "bg-destructive/10 text-destructive" },
};

const benefitStatusConfig: Record<string, { label: string; className: string }> = {
  identified: { label: "Identified", className: "bg-muted text-muted-foreground" },
  planned: { label: "Planned", className: "bg-info/10 text-info" },
  in_progress: { label: "In Progress", className: "bg-warning/10 text-warning" },
  realized: { label: "Realized", className: "bg-success/10 text-success" },
  measured: { label: "Measured", className: "bg-primary/10 text-primary" },
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

export default function ProgrammeDetails() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const programmeId = searchParams.get("id");

  const [programme, setProgramme] = useState<Programme | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [benefits, setBenefits] = useState<Benefit[]>([]);
  const [statusHistory, setStatusHistory] = useState<StatusHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProgramme = async () => {
    if (!programmeId) return;

    const { data, error } = await supabase
      .from("programmes")
      .select("*")
      .eq("id", programmeId)
      .single();

    if (!error && data) {
      setProgramme(data);
    }
  };

  const fetchProjects = async () => {
    if (!programmeId) return;

    const { data } = await supabase
      .from("projects")
      .select("*")
      .eq("programme_id", programmeId)
      .order("name");

    setProjects(data || []);
  };

  const fetchBenefits = async () => {
    if (!programmeId) return;

    const { data } = await supabase
      .from("benefits")
      .select("*")
      .eq("programme_id", programmeId)
      .order("created_at", { ascending: false });

    setBenefits(data || []);
  };

  const fetchStatusHistory = async () => {
    if (!programmeId) return;

    const { data } = await supabase
      .from("status_history")
      .select("*")
      .eq("entity_type", "programme")
      .eq("entity_id", programmeId)
      .order("changed_at", { ascending: false });

    if (data) {
      // Fetch user names for history entries
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
    await Promise.all([fetchProgramme(), fetchProjects(), fetchBenefits(), fetchStatusHistory()]);
    setLoading(false);
  };

  useEffect(() => {
    if (programmeId) {
      fetchAllData();
    }
  }, [programmeId]);

  if (!programmeId) {
    return (
      <AppLayout title="Programme Details" subtitle="View programme information">
        <div className="flex flex-col items-center justify-center py-12">
          <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No programme selected</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate("/programmes")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Programmes
          </Button>
        </div>
      </AppLayout>
    );
  }

  if (loading) {
    return (
      <AppLayout title="Programme Details" subtitle="Loading...">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </AppLayout>
    );
  }

  if (!programme) {
    return (
      <AppLayout title="Programme Details" subtitle="Programme not found">
        <div className="flex flex-col items-center justify-center py-12">
          <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
          <p className="text-muted-foreground">Programme not found</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate("/programmes")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Programmes
          </Button>
        </div>
      </AppLayout>
    );
  }

  const status = statusConfig[programme.status] || statusConfig.pending;
  const realizedBenefits = benefits.filter((b) => b.status === "realized" || b.status === "measured").length;
  const avgRealization = benefits.length > 0 
    ? Math.round(benefits.reduce((acc, b) => acc + b.realization, 0) / benefits.length)
    : 0;

  return (
    <AppLayout 
      title={programme.name} 
      subtitle="Programme Details"
    >
      <div className="space-y-6">
        {/* Header with actions */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate("/programmes")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Programmes
          </Button>
          <div className="flex items-center gap-2">
            <DocumentUpload
              entityType="programme"
              entityId={programme.id}
              entityName={programme.name}
            />
            <EntityStatusActions
              entityType="programme"
              entityId={programme.id}
              entityName={programme.name}
              currentStatus={programme.status}
              onStatusChange={fetchAllData}
            />
          </div>
        </div>

        {/* Programme Overview Card */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-2xl">{programme.name}</CardTitle>
                <CardDescription className="mt-2">{programme.description}</CardDescription>
              </div>
              <Badge variant="outline" className={cn("text-sm", status.className)}>
                {status.label}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Users className="h-4 w-4" />
                  Sponsor
                </div>
                <p className="font-medium">{programme.sponsor || "Unassigned"}</p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <DollarSign className="h-4 w-4" />
                  Budget
                </div>
                <p className="font-medium">{programme.budget || "Not set"}</p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Target className="h-4 w-4" />
                  Benefits Target
                </div>
                <p className="font-medium">{programme.benefits_target || "Not set"}</p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  Timeline
                </div>
                <p className="font-medium">
                  {programme.start_date && programme.end_date
                    ? `${format(new Date(programme.start_date), "MMM d, yyyy")} - ${format(new Date(programme.end_date), "MMM d, yyyy")}`
                    : programme.start_date
                    ? `From ${format(new Date(programme.start_date), "MMM d, yyyy")}`
                    : "Not set"}
                </p>
              </div>
            </div>

            <div className="mt-6 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Overall Progress</span>
                <span className="font-medium">{programme.progress}%</span>
              </div>
              <Progress value={programme.progress} className="h-3" />
            </div>
          </CardContent>
        </Card>

        {/* Tabs for different sections */}
        <Tabs defaultValue="projects" className="space-y-4">
          <TabsList>
            <TabsTrigger value="projects" className="gap-2">
              <FolderKanban className="h-4 w-4" />
              Linked Projects ({projects.length})
            </TabsTrigger>
            <TabsTrigger value="benefits" className="gap-2">
              <TrendingUp className="h-4 w-4" />
              Benefits ({benefits.length})
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-2">
              <History className="h-4 w-4" />
              Status Timeline
            </TabsTrigger>
          </TabsList>

          {/* Linked Projects Tab */}
          <TabsContent value="projects">
            <Card>
              <CardHeader>
                <CardTitle>Linked Projects</CardTitle>
                <CardDescription>Projects that are part of this programme</CardDescription>
              </CardHeader>
              <CardContent>
                {projects.length === 0 ? (
                  <div className="text-center py-8">
                    <FolderKanban className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No projects linked to this programme</p>
                    <Button variant="outline" className="mt-4" onClick={() => navigate("/projects")}>
                      View All Projects
                    </Button>
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {projects.map((project) => {
                      const stage = stageConfig[project.stage] || stageConfig.initiation;
                      const health = healthConfig[project.health] || healthConfig.green;

                      return (
                        <div
                          key={project.id}
                          className="p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer"
                          onClick={() => navigate(`/projects?id=${project.id}`)}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <h4 className="font-medium">{project.name}</h4>
                            <Badge className={cn("text-xs", health.className)}>{health.label}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                            {project.description || "No description"}
                          </p>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className={cn("text-xs", stage.className)}>
                              {stage.label}
                            </Badge>
                            <Badge variant="outline" className="text-xs capitalize">
                              {project.priority}
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

          {/* Benefits Tab */}
          <TabsContent value="benefits">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                <div>
                    <CardTitle>Programme Benefits</CardTitle>
                    <CardDescription>
                      {realizedBenefits} of {benefits.length} benefits realized • Avg realization: {avgRealization}%
                    </CardDescription>
                  </div>
                  <Button variant="outline" onClick={() => navigate("/registers/benefits")}>
                    <TrendingUp className="h-4 w-4 mr-2" />
                    View All Benefits
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {benefits.length === 0 ? (
                  <div className="text-center py-8">
                    <TrendingUp className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No benefits registered for this programme</p>
                    <Button variant="outline" className="mt-4" onClick={() => navigate("/registers/benefits")}>
                      Register Benefits
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {benefits.map((benefit) => {
                      const benefitStatus = benefitStatusConfig[benefit.status] || benefitStatusConfig.identified;

                      return (
                        <div
                          key={benefit.id}
                          className="p-4 rounded-lg border bg-card"
                        >
                          <div className="flex items-start justify-between mb-2">
                            <h4 className="font-medium">{benefit.name}</h4>
                            <Badge className={cn("text-xs", benefitStatus.className)}>
                              {benefitStatus.label}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mb-3">
                            {benefit.description || "No description"}
                          </p>
                          <div className="flex items-center gap-4 text-sm flex-wrap">
                            <div>
                              <span className="text-muted-foreground">Category: </span>
                              <span className="capitalize">{benefit.category}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Type: </span>
                              <span className="capitalize">{benefit.type}</span>
                            </div>
                            {benefit.target_value && (
                              <div>
                                <span className="text-muted-foreground">Target: </span>
                                <span>{benefit.target_value}</span>
                              </div>
                            )}
                            {benefit.current_value && (
                              <div>
                                <span className="text-muted-foreground">Current: </span>
                                <span className="text-success font-medium">{benefit.current_value}</span>
                              </div>
                            )}
                            <div>
                              <span className="text-muted-foreground">Realization: </span>
                              <span className="font-medium">{benefit.realization}%</span>
                            </div>
                          </div>
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
                <CardDescription>History of status changes for this programme</CardDescription>
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
                      {/* Timeline line */}
                      <div className="absolute left-2 top-2 bottom-2 w-0.5 bg-border" />

                      {statusHistory.map((entry, index) => {
                        const Icon = actionIcons[entry.action] || CheckCircle2;
                        const actionLabel = actionLabels[entry.action] || entry.action;

                        return (
                          <div key={entry.id} className="relative">
                            {/* Timeline dot */}
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
