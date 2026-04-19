import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import ChangeControl from "./ChangeControl";
import ExceptionManagement from "./ExceptionManagement";
import QualityManagement from "./QualityManagement";
import MilestoneTracking from "./MilestoneTracking";
import StageGates from "./StageGates";
import { QuickActionTabs } from "@/components/QuickActionTabs";
import {
  ListTodo,
  Target,
  Flag,
  FileEdit,
  AlertTriangle,
  ClipboardCheck,
  CheckCircle2,
  Clock,
  XCircle,
  ArrowRight,
  TrendingUp,
  LayoutDashboard,
} from "lucide-react";
import { format, parseISO, differenceInDays } from "date-fns";

export default function PRINCE2Dashboard() {
  const { currentOrganization } = useOrganization();

  // Fetch tasks
  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks-overview", currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization?.id) return [];
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("organization_id", currentOrganization.id)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
    enabled: !!currentOrganization?.id,
  });

  // Fetch milestones
  const { data: milestones = [] } = useQuery({
    queryKey: ["milestones-overview", currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization?.id) return [];
      const { data, error } = await supabase
        .from("milestones")
        .select("*")
        .eq("organization_id", currentOrganization.id)
        .order("target_date", { ascending: true })
        .limit(100);
      if (error) throw error;
      return data;
    },
    enabled: !!currentOrganization?.id,
  });

  // Fetch stage gates
  const { data: stageGates = [] } = useQuery({
    queryKey: ["stage-gates-overview", currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization?.id) return [];
      const { data, error } = await supabase
        .from("stage_gates")
        .select("*")
        .eq("organization_id", currentOrganization.id)
        .order("stage_number", { ascending: true })
        .limit(100);
      if (error) throw error;
      return data;
    },
    enabled: !!currentOrganization?.id,
  });

  // Fetch exceptions
  const { data: exceptions = [] } = useQuery({
    queryKey: ["exceptions-overview", currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization?.id) return [];
      const { data, error } = await supabase
        .from("exceptions")
        .select("*")
        .eq("organization_id", currentOrganization.id)
        .order("date_raised", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
    enabled: !!currentOrganization?.id,
  });

  // Fetch change requests
  const { data: changeRequests = [] } = useQuery({
    queryKey: ["change-requests-overview", currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization?.id) return [];
      const { data, error } = await supabase
        .from("change_requests")
        .select("*")
        .eq("organization_id", currentOrganization.id)
        .order("date_raised", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
    enabled: !!currentOrganization?.id,
  });

  // Fetch quality records
  const { data: qualityRecords = [] } = useQuery({
    queryKey: ["quality-records-overview", currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization?.id) return [];
      const { data, error } = await supabase
        .from("quality_records")
        .select("*")
        .eq("organization_id", currentOrganization.id)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
    enabled: !!currentOrganization?.id,
  });

  // Calculate stats
  const taskStats = {
    total: tasks.length,
    inProgress: tasks.filter((t) => t.status === "in_progress").length,
    completed: tasks.filter((t) => t.status === "completed").length,
    notStarted: tasks.filter((t) => t.status === "not_started").length,
  };

  const milestoneStats = {
    total: milestones.length,
    achieved: milestones.filter((m) => m.status === "achieved").length,
    upcoming: milestones.filter((m) => m.status === "planned" || m.status === "in_progress").length,
    missed: milestones.filter((m) => m.status === "missed").length,
  };

  const gateStats = {
    total: stageGates.length,
    pending: stageGates.filter((g) => g.gate_decision === "pending").length,
    approved: stageGates.filter((g) => g.gate_decision === "approved").length,
    conditional: stageGates.filter((g) => g.gate_decision === "conditional").length,
  };

  const exceptionStats = {
    total: exceptions.length,
    open: exceptions.filter((e) => e.status === "raised" || e.status === "under_review" || e.status === "escalated").length,
    resolved: exceptions.filter((e) => e.status === "resolved" || e.status === "closed").length,
  };

  const changeStats = {
    total: changeRequests.length,
    pending: changeRequests.filter((c) => c.status === "pending" || c.status === "under_review").length,
    approved: changeRequests.filter((c) => c.status === "approved" || c.status === "implemented").length,
    rejected: changeRequests.filter((c) => c.status === "rejected" || c.status === "withdrawn").length,
  };

  const qualityStats = {
    total: qualityRecords.length,
    passed: qualityRecords.filter((q) => q.status === "passed").length,
    failed: qualityRecords.filter((q) => q.status === "failed").length,
    pending: qualityRecords.filter((q) => q.status === "planned" || q.status === "in_progress").length,
  };

  // Get upcoming milestones (next 30 days)
  const upcomingMilestones = milestones
    .filter((m) => {
      if (m.status === "achieved" || m.status === "missed") return false;
      const daysUntil = differenceInDays(parseISO(m.target_date), new Date());
      return daysUntil >= 0 && daysUntil <= 30;
    })
    .slice(0, 5);

  // Get recent exceptions
  const recentExceptions = exceptions
    .filter((e) => e.status !== "closed" && e.status !== "resolved")
    .slice(0, 5);

  // Get pending change requests
  const pendingChanges = changeRequests
    .filter((c) => c.status === "pending" || c.status === "under_review")
    .slice(0, 5);

  const taskCompletion = taskStats.total > 0 ? Math.round((taskStats.completed / taskStats.total) * 100) : 0;
  const milestoneCompletion = milestoneStats.total > 0 ? Math.round((milestoneStats.achieved / milestoneStats.total) * 100) : 0;
  const qualityPassRate = qualityStats.total > 0 ? Math.round((qualityStats.passed / (qualityStats.passed + qualityStats.failed || 1)) * 100) : 0;

  return (
    <AppLayout title="PRINCE2" subtitle="Project management aligned with PRINCE2 methodology">
      <Tabs defaultValue="dashboard" className="space-y-6">
        <QuickActionTabs
          items={[
            { value: "dashboard", label: "Dashboard", icon: LayoutDashboard },
            { value: "milestones", label: "Milestones", icon: Target },
            { value: "stage-gates", label: "Stage Gates", icon: Flag },
            { value: "change-control", label: "Change Control", icon: FileEdit },
            { value: "exceptions", label: "Exceptions", icon: AlertTriangle },
            { value: "quality", label: "Quality", icon: ClipboardCheck },
          ]}
        />

        <TabsContent value="dashboard">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between mb-2">
              <ListTodo className="h-5 w-5 text-primary" />
              <span className="text-xs text-muted-foreground">Tasks</span>
            </div>
            <p className="text-2xl font-bold">{taskStats.total}</p>
            <p className="text-xs text-muted-foreground">{taskStats.inProgress} in progress</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between mb-2">
              <Target className="h-5 w-5 text-primary" />
              <span className="text-xs text-muted-foreground">Milestones</span>
            </div>
            <p className="text-2xl font-bold">{milestoneStats.total}</p>
            <p className="text-xs text-muted-foreground">{milestoneStats.upcoming} upcoming</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between mb-2">
              <Flag className="h-5 w-5 text-primary" />
              <span className="text-xs text-muted-foreground">Stage Gates</span>
            </div>
            <p className="text-2xl font-bold">{gateStats.total}</p>
            <p className="text-xs text-muted-foreground">{gateStats.pending} pending</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between mb-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              <span className="text-xs text-muted-foreground">Exceptions</span>
            </div>
            <p className="text-2xl font-bold">{exceptionStats.total}</p>
            <p className="text-xs text-muted-foreground">{exceptionStats.open} open</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between mb-2">
              <FileEdit className="h-5 w-5 text-primary" />
              <span className="text-xs text-muted-foreground">Changes</span>
            </div>
            <p className="text-2xl font-bold">{changeStats.total}</p>
            <p className="text-xs text-muted-foreground">{changeStats.pending} pending</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between mb-2">
              <ClipboardCheck className="h-5 w-5 text-primary" />
              <span className="text-xs text-muted-foreground">Quality</span>
            </div>
            <p className="text-2xl font-bold">{qualityStats.total}</p>
            <p className="text-xs text-muted-foreground">{qualityStats.passed} passed</p>
          </CardContent>
        </Card>
      </div>

      {/* Progress Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Task Completion</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <Progress value={taskCompletion} className="flex-1 h-2" />
              <span className="text-lg font-bold">{taskCompletion}%</span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {taskStats.completed} of {taskStats.total} tasks completed
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Milestone Achievement</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <Progress value={milestoneCompletion} className="flex-1 h-2" />
              <span className="text-lg font-bold">{milestoneCompletion}%</span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {milestoneStats.achieved} of {milestoneStats.total} milestones achieved
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Quality Pass Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <Progress value={qualityPassRate} className="flex-1 h-2" />
              <span className="text-lg font-bold">{qualityPassRate}%</span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {qualityStats.passed} of {qualityStats.passed + qualityStats.failed} reviews passed
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming Milestones */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Upcoming Milestones</CardTitle>
              <CardDescription>Next 30 days</CardDescription>
            </div>
            <Link to="/prince2/milestones">
              <Button variant="ghost" size="sm">
                View All <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {upcomingMilestones.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No upcoming milestones</p>
            ) : (
              <div className="space-y-3">
                {upcomingMilestones.map((milestone) => {
                  const daysUntil = differenceInDays(parseISO(milestone.target_date), new Date());
                  return (
                    <div key={milestone.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-3">
                        <Target className="h-4 w-4 text-primary" />
                        <div>
                          <p className="text-sm font-medium">{milestone.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(parseISO(milestone.target_date), "MMM d, yyyy")}
                          </p>
                        </div>
                      </div>
                      <Badge variant={daysUntil <= 7 ? "destructive" : "secondary"}>
                        {daysUntil === 0 ? "Today" : `${daysUntil} days`}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Open Exceptions */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Open Exceptions</CardTitle>
              <CardDescription>Tolerance breaches requiring attention</CardDescription>
            </div>
            <Link to="/prince2/exceptions">
              <Button variant="ghost" size="sm">
                View All <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {recentExceptions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No open exceptions</p>
            ) : (
              <div className="space-y-3">
                {recentExceptions.map((exception) => (
                  <div key={exception.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-3">
                      <AlertTriangle className="h-4 w-4 text-warning" />
                      <div>
                        <p className="text-sm font-medium">{exception.title}</p>
                        <p className="text-xs text-muted-foreground">{exception.reference_number}</p>
                      </div>
                    </div>
                    <Badge
                      variant={
                        exception.severity === "critical"
                          ? "destructive"
                          : exception.severity === "high"
                          ? "destructive"
                          : "secondary"
                      }
                    >
                      {exception.severity}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pending Change Requests */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Pending Change Requests</CardTitle>
              <CardDescription>Awaiting review or approval</CardDescription>
            </div>
            <Link to="/prince2/change-control">
              <Button variant="ghost" size="sm">
                View All <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {pendingChanges.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No pending changes</p>
            ) : (
              <div className="space-y-3">
                {pendingChanges.map((change) => (
                  <div key={change.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-3">
                      <FileEdit className="h-4 w-4 text-primary" />
                      <div>
                        <p className="text-sm font-medium">{change.title}</p>
                        <p className="text-xs text-muted-foreground">{change.reference_number}</p>
                      </div>
                    </div>
                    <Badge variant={change.priority === "high" || change.priority === "critical" ? "destructive" : "secondary"}>
                      {change.priority}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Stage Gate Status */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Stage Gate Status</CardTitle>
              <CardDescription>Decision point overview</CardDescription>
            </div>
            <Link to="/prince2/stage-gates">
              <Button variant="ghost" size="sm">
                View All <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-lg bg-muted/50 text-center">
                <Clock className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
                <p className="text-2xl font-bold">{gateStats.pending}</p>
                <p className="text-xs text-muted-foreground">Pending</p>
              </div>
              <div className="p-4 rounded-lg bg-success/10 text-center">
                <CheckCircle2 className="h-6 w-6 text-success mx-auto mb-2" />
                <p className="text-2xl font-bold">{gateStats.approved}</p>
                <p className="text-xs text-muted-foreground">Approved</p>
              </div>
              <div className="p-4 rounded-lg bg-warning/10 text-center">
                <AlertTriangle className="h-6 w-6 text-warning mx-auto mb-2" />
                <p className="text-2xl font-bold">{gateStats.conditional}</p>
                <p className="text-xs text-muted-foreground">Conditional</p>
              </div>
              <div className="p-4 rounded-lg bg-primary/10 text-center">
                <TrendingUp className="h-6 w-6 text-primary mx-auto mb-2" />
                <p className="text-2xl font-bold">{gateStats.total}</p>
                <p className="text-xs text-muted-foreground">Total Gates</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
        </TabsContent>

        <TabsContent value="milestones">
          <MilestoneTracking embedded />
        </TabsContent>

        <TabsContent value="stage-gates">
          <StageGates embedded />
        </TabsContent>

        <TabsContent value="change-control">
          <ChangeControl embedded />
        </TabsContent>

        <TabsContent value="exceptions">
          <ExceptionManagement embedded />
        </TabsContent>

        <TabsContent value="quality">
          <QualityManagement embedded />
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}
