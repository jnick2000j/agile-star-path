import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CreateWeeklyReportDialog } from "@/components/dialogs/CreateWeeklyReportDialog";
import {
  Plus,
  Search,
  Send,
  FileText,
  Clock,
  CheckCircle,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "@/components/ui/use-toast";
import { format } from "date-fns";

const statusConfig = {
  draft: { label: "Draft", className: "bg-muted text-muted-foreground" },
  submitted: { label: "Submitted", className: "bg-primary/10 text-primary" },
  approved: { label: "Approved", className: "bg-success/10 text-success" },
};

const healthConfig = {
  green: "bg-success",
  amber: "bg-warning",
  red: "bg-destructive",
};

export default function Updates() {
  const [searchQuery, setSearchQuery] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [expandedReport, setExpandedReport] = useState<string | null>(null);
  const { user, userRole } = useAuth();
  const isStakeholder = ["stakeholder", "org_stakeholder", "programme_stakeholder", "project_stakeholder", "product_stakeholder"].includes(userRole || "");
  const queryClient = useQueryClient();

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ["weekly-reports"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("weekly_reports")
        .select(`*, programmes (name), projects (name), products (name)`)
        .order("week_ending", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const submitReport = useMutation({
    mutationFn: async (reportId: string) => {
      const { error } = await supabase
        .from("weekly_reports")
        .update({
          status: "submitted",
          submitted_at: new Date().toISOString(),
          submitted_by: user?.id,
        })
        .eq("id", reportId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["weekly-reports"] });
      toast({ title: "Report submitted" });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const generateSummary = useMutation({
    mutationFn: async (report: any) => {
      const { data, error } = await supabase.functions.invoke("summarize-weekly-report", {
        body: {
          report_id: report.id,
          week_ending: report.week_ending,
          programme_id: report.programme_id,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["weekly-reports"] });
      toast({ title: "AI Summary generated", description: "The report has been updated with AI-generated summaries." });
    },
    onError: (error) => {
      toast({ title: "Error generating summary", description: error.message, variant: "destructive" });
    },
  });

  const getReportEntityName = (report: any) => {
    if (report.report_type === "project" && report.projects?.name) return report.projects.name;
    if (report.report_type === "product" && report.products?.name) return report.products.name;
    return report.programmes?.name || "Unknown";
  };

  const getReportTypeLabel = (report: any) => {
    if (report.report_type === "project") return "Project";
    if (report.report_type === "product") return "Product";
    return "Program";
  };

  const filteredReports = reports.filter((r: any) => {
    const name = getReportEntityName(r);
    return name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const draftCount = reports.filter((r: any) => r.status === "draft").length;
  const submittedCount = reports.filter((r: any) => r.status === "submitted").length;
  const approvedCount = reports.filter((r: any) => r.status === "approved").length;

  return (
    <AppLayout title="Updates" subtitle="Status reports and communications for programs, projects, and products">
      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <div className="metric-card">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-semibold">{reports.length}</p>
              <p className="text-sm text-muted-foreground">Total Reports</p>
            </div>
          </div>
        </div>
        <div className="metric-card">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
              <Clock className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-2xl font-semibold">{draftCount}</p>
              <p className="text-sm text-muted-foreground">Pending</p>
            </div>
          </div>
        </div>
        <div className="metric-card">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Send className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-semibold">{submittedCount}</p>
              <p className="text-sm text-muted-foreground">Submitted</p>
            </div>
          </div>
        </div>
        <div className="metric-card">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
              <CheckCircle className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-2xl font-semibold">{approvedCount}</p>
              <p className="text-sm text-muted-foreground">Approved</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search reports..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        {!isStakeholder && (
          <Button className="gap-2" onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4" />
            New Report
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading reports...</div>
      ) : filteredReports.length === 0 ? (
        <div className="text-center py-12">
          <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No reports yet</h3>
          <p className="text-muted-foreground mb-4">
            {isStakeholder ? "No reports available to view." : "Create your first weekly report to get started."}
          </p>
          {!isStakeholder && (
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Report
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {filteredReports.map((report: any, index: number) => {
            const health = report.overall_health as keyof typeof healthConfig;
            const status = report.status as keyof typeof statusConfig;
            const isExpanded = expandedReport === report.id;
            return (
              <Card key={report.id} className="animate-slide-up" style={{ animationDelay: `${index * 0.1}s` }}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <div className={cn("h-3 w-3 rounded-full", healthConfig[health] || "bg-muted")} />
                        <CardTitle className="text-lg">{getReportEntityName(report)}</CardTitle>
                        <Badge variant="outline" className="text-xs">{getReportTypeLabel(report)}</Badge>
                      </div>
                      <CardDescription>
                        Week ending {format(new Date(report.week_ending), "MMM d, yyyy")}
                      </CardDescription>
                    </div>
                    <Badge variant="secondary" className={cn("text-xs", statusConfig[status]?.className)}>
                      {statusConfig[status]?.label || status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* AI Summary */}
                  {report.ai_summary && (
                    <div className="bg-primary/5 border border-primary/10 rounded-lg p-3">
                      <div className="flex items-center gap-1.5 mb-2">
                        <Sparkles className="h-3.5 w-3.5 text-primary" />
                        <h4 className="text-sm font-medium text-primary">AI Summary</h4>
                      </div>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{report.ai_summary}</p>
                    </div>
                  )}

                  {/* Section summaries - collapsed by default */}
                  {(report.task_summary || report.project_summary || report.programme_summary || report.product_summary) && (
                    <div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1 text-xs w-full justify-start"
                        onClick={() => setExpandedReport(isExpanded ? null : report.id)}
                      >
                        {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                        {isExpanded ? "Hide" : "Show"} detailed summaries
                      </Button>
                      {isExpanded && (
                        <div className="space-y-3 mt-2">
                          {report.task_summary && (
                            <div>
                              <h5 className="text-xs font-medium text-muted-foreground uppercase mb-1">Tasks</h5>
                              <p className="text-sm">{report.task_summary}</p>
                            </div>
                          )}
                          {report.project_summary && (
                            <div>
                              <h5 className="text-xs font-medium text-muted-foreground uppercase mb-1">Projects</h5>
                              <p className="text-sm">{report.project_summary}</p>
                            </div>
                          )}
                          {report.programme_summary && (
                            <div>
                              <h5 className="text-xs font-medium text-muted-foreground uppercase mb-1">Programme</h5>
                              <p className="text-sm">{report.programme_summary}</p>
                            </div>
                          )}
                          {report.product_summary && (
                            <div>
                              <h5 className="text-xs font-medium text-muted-foreground uppercase mb-1">Products</h5>
                              <p className="text-sm">{report.product_summary}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {report.highlights && report.highlights.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-foreground mb-2">Highlights</h4>
                      <ul className="space-y-1">
                        {report.highlights.map((highlight: string, i: number) => (
                          <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                            <span className="text-success mt-1">•</span>
                            {highlight}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {report.risks_issues && report.risks_issues.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-foreground mb-2">Risks & Issues</h4>
                      <ul className="space-y-1">
                        {report.risks_issues.map((item: string, i: number) => (
                          <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                            <span className="text-warning mt-1">•</span>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {report.next_week && report.next_week.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-foreground mb-2">Next Week</h4>
                      <ul className="space-y-1">
                        {report.next_week.map((item: string, i: number) => (
                          <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                            <span className="text-primary mt-1">•</span>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="pt-4 border-t border-border flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                      {report.submitted_at ? (
                        <>Submitted {format(new Date(report.submitted_at), "MMM d, yyyy h:mm a")}</>
                      ) : (
                        <>Created {format(new Date(report.created_at), "MMM d, yyyy")}</>
                      )}
                    </div>
                    {!isStakeholder && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1"
                          onClick={() => generateSummary.mutate(report)}
                          disabled={generateSummary.isPending}
                        >
                          <Sparkles className="h-3 w-3" />
                          {generateSummary.isPending ? "Generating..." : "AI Summary"}
                        </Button>
                        {report.status === "draft" && (
                          <Button
                            size="sm"
                            className="gap-1"
                            onClick={() => submitReport.mutate(report.id)}
                            disabled={submitReport.isPending}
                          >
                            <Send className="h-3 w-3" />
                            Submit
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <CreateWeeklyReportDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} />
    </AppLayout>
  );
}
