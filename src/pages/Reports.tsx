import { useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import {
  BarChart3, PieChart, Download, FileText,
  Sparkles, Send, Loader2, Copy, RotateCcw, Save, CalendarClock,
  BookOpen, Filter, LayoutGrid, Layers, FolderKanban, Package,
  LifeBuoy, GitBranch,
} from "lucide-react";
import { Tooltip, ResponsiveContainer, PieChart as RechartsPie, Pie, Cell, Legend } from "recharts";
import { toast } from "@/components/ui/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { QuickActionTabs } from "@/components/QuickActionTabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import ReactMarkdown from "react-markdown";

import { ReportTemplates, ReportTemplate } from "@/components/reports/ReportTemplates";
import { ReportDownloader } from "@/components/reports/ReportDownloader";
import { SavedReports } from "@/components/reports/SavedReports";
import { ScheduleReportDialog } from "@/components/reports/ScheduleReportDialog";
import { ScheduledReportsList } from "@/components/reports/ScheduledReportsList";
import { StatusIndicators } from "@/components/dashboard/StatusIndicators";
import {
  ScopeStat, ScopePanel, statusBreakdown, countBy,
  HelpdeskAnalytics, ChangeAnalytics,
} from "@/components/reports/ScopeAnalytics";

const resourceColors = [
  "hsl(217, 91%, 50%)",
  "hsl(142, 71%, 45%)",
  "hsl(38, 92%, 50%)",
  "hsl(280, 65%, 60%)",
  "hsl(199, 89%, 48%)",
];

export default function Reports() {
  const { currentOrganization } = useOrganization();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // AI Report state
  const [reportQuery, setReportQuery] = useState("");
  const [reportTitle, setReportTitle] = useState("");
  const [reportContent, setReportContent] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeTemplateKey, setActiveTemplateKey] = useState<string | undefined>();
  const abortControllerRef = useRef<AbortController | null>(null);

  // Schedule dialog
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [schedPrefillQuery, setSchedPrefillQuery] = useState("");
  const [schedPrefillTitle, setSchedPrefillTitle] = useState("");
  const [schedPrefillTemplate, setSchedPrefillTemplate] = useState<string | undefined>();

  // Template filter
  const [templateFilter, setTemplateFilter] = useState("all");

  // Main tab
  const [mainTab, setMainTab] = useState("builder");

  // Analytics scope toggle
  const [analyticsScope, setAnalyticsScope] = useState<
    "portfolio" | "programs" | "projects" | "products" | "helpdesk" | "change"
  >("portfolio");

  // Fetch real data
  const { data: programmes = [] } = useQuery({
    queryKey: ["programmes-stats"],
    queryFn: async () => {
      const { data, error } = await supabase.from("programmes").select("id, name, status, progress");
      if (error) throw error;
      return data;
    },
  });

  const { data: projects = [] } = useQuery({
    queryKey: ["projects-stats"],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("id, programme_id, health");
      if (error) throw error;
      return data;
    },
  });

  const { data: benefits = [] } = useQuery({
    queryKey: ["benefits-stats"],
    queryFn: async () => {
      const { data, error } = await supabase.from("benefits").select("id, category, realization, target_value, current_value");
      if (error) throw error;
      return data;
    },
  });

  const { data: risks = [] } = useQuery({
    queryKey: ["risks-stats"],
    queryFn: async () => {
      const { data, error } = await supabase.from("risks").select("id, status, impact, probability");
      if (error) throw error;
      return data;
    },
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products-stats"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("id");
      if (error) throw error;
      return data;
    },
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks-stats"],
    queryFn: async () => {
      const { data, error } = await supabase.from("product_features").select("id");
      if (error) throw error;
      return data;
    },
  });

  const { data: helpdeskTickets = [] } = useQuery({
    queryKey: ["helpdesk-tickets-stats", currentOrganization?.id],
    queryFn: async () => {
      let q = supabase.from("helpdesk_tickets").select(
        "id, ticket_type, status, priority, created_at, first_response_at, resolved_at, " +
        "sla_response_breached, sla_resolution_breached, csat_rating"
      );
      if (currentOrganization?.id) q = q.eq("organization_id", currentOrganization.id);
      const { data, error } = await q.limit(1000);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: cmRequests = [] } = useQuery({
    queryKey: ["cm-requests-stats", currentOrganization?.id],
    queryFn: async () => {
      let q = supabase.from("change_management_requests").select(
        "id, status, change_type, impact, urgency, risk_score, downtime_required, " +
        "downtime_minutes, planned_start_at, planned_end_at, actual_end_at, created_at"
      );
      if (currentOrganization?.id) q = q.eq("organization_id", currentOrganization.id);
      const { data, error } = await q.limit(1000);
      if (error) throw error;
      return data ?? [];
    },
  });

  // Chart data
  const riskCategories = risks.reduce((acc, r) => {
    const s = r.status || "unknown";
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const resourceAllocation = Object.entries(riskCategories).map(([name, value], i) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    value,
    color: resourceColors[i % resourceColors.length],
  }));

  // AI Generation
  const handleGenerateAIReport = async (queryText?: string, titleText?: string) => {
    const q = queryText || reportQuery;
    if (!q.trim()) {
      toast({ title: "Please enter a query", description: "Describe what report you'd like.", variant: "destructive" });
      return;
    }

    setIsGenerating(true);
    setReportContent("");
    if (titleText) setReportTitle(titleText);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-report`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ query: q }),
          signal: controller.signal,
        }
      );

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.error || `Request failed (${resp.status})`);
      }

      if (!resp.body) throw new Error("No response body");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let fullContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              fullContent += content;
              setReportContent(fullContent);
            }
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }

      // Final flush
      if (textBuffer.trim()) {
        for (let raw of textBuffer.split("\n")) {
          if (!raw) continue;
          if (raw.endsWith("\r")) raw = raw.slice(0, -1);
          if (!raw.startsWith("data: ")) continue;
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === "[DONE]") continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              fullContent += content;
              setReportContent(fullContent);
            }
          } catch { /* ignore */ }
        }
      }
    } catch (error: any) {
      if (error.name === "AbortError") return;
      console.error("Report generation error:", error);
      toast({ title: "Report generation failed", description: error.message || "An error occurred.", variant: "destructive" });
    } finally {
      setIsGenerating(false);
      abortControllerRef.current = null;
    }
  };

  const handleTemplateSelect = (template: ReportTemplate) => {
    setReportQuery(template.query);
    setReportTitle(template.title);
    setActiveTemplateKey(template.key);
    handleGenerateAIReport(template.query, template.title);
  };

  const handleSaveReport = async () => {
    if (!reportContent || !user) return;
    const title = reportTitle || `Report - ${new Date().toLocaleDateString()}`;

    const { error } = await supabase.from("saved_reports").insert({
      title,
      query: reportQuery,
      content: reportContent,
      template_key: activeTemplateKey || null,
      organization_id: currentOrganization?.id || null,
      created_by: user.id,
    });

    if (error) {
      toast({ title: "Error", description: "Could not save report.", variant: "destructive" });
    } else {
      toast({ title: "Saved", description: "Report saved successfully." });
      queryClient.invalidateQueries({ queryKey: ["saved-reports"] });
    }
  };

  const handleScheduleFromCurrent = () => {
    setSchedPrefillQuery(reportQuery);
    setSchedPrefillTitle(reportTitle || "Custom Report");
    setSchedPrefillTemplate(activeTemplateKey);
    setScheduleOpen(true);
  };

  const handleCopyReport = () => {
    navigator.clipboard.writeText(reportContent);
    toast({ title: "Copied", description: "Report copied to clipboard." });
  };

  const handleReset = () => {
    setReportContent("");
    setReportQuery("");
    setReportTitle("");
    setActiveTemplateKey(undefined);
  };

  return (
    <AppLayout title="Reports & Analytics" subtitle="AI-powered reports, templates, scheduling, and multi-format downloads">
      {/* Main Tabs */}
      <Tabs value={mainTab} onValueChange={setMainTab} className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <QuickActionTabs
            items={[
              { value: "builder", label: "Report Builder", icon: Sparkles },
              { value: "templates", label: "Templates", icon: BookOpen },
              { value: "saved", label: "Saved Reports", icon: Save },
              { value: "scheduled", label: "Scheduled", icon: CalendarClock },
              { value: "analytics", label: "Analytics", icon: BarChart3 },
            ]}
            className="flex-1 grid-cols-5 sm:grid-cols-5 md:grid-cols-5 lg:grid-cols-5"
          />

          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => { setSchedPrefillQuery(""); setSchedPrefillTitle(""); setSchedPrefillTemplate(undefined); setScheduleOpen(true); }}>
              <CalendarClock className="h-3.5 w-3.5" />
              Schedule Report
            </Button>
          </div>
        </div>

        {/* Report Builder Tab */}
        <TabsContent value="builder" className="space-y-4">
          <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                AI Custom Report Builder
              </CardTitle>
              <CardDescription>
                Ask any question about your portfolio data or select a template to generate a professional report.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Title input */}
              <Input
                placeholder="Report title (optional)"
                value={reportTitle}
                onChange={(e) => setReportTitle(e.target.value)}
                className="max-w-md"
              />

              {/* Query Input */}
              <div className="flex gap-2">
                <Textarea
                  placeholder="e.g. Give me a risk analysis across all projects with recommendations..."
                  value={reportQuery}
                  onChange={(e) => setReportQuery(e.target.value)}
                  className="min-h-[80px] resize-none"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleGenerateAIReport();
                    }
                  }}
                />
                <div className="flex flex-col gap-2">
                  <Button
                    onClick={() => handleGenerateAIReport()}
                    disabled={isGenerating || !reportQuery.trim()}
                    className="gap-2"
                  >
                    {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    Generate
                  </Button>
                  {isGenerating && (
                    <Button variant="outline" size="sm" onClick={() => abortControllerRef.current?.abort()}>
                      Cancel
                    </Button>
                  )}
                </div>
              </div>

              {/* Report Output */}
              {(reportContent || isGenerating) && (
                <div className="border rounded-lg bg-card">
                  <div className="flex items-center justify-between px-4 py-2 border-b">
                    <span className="text-sm font-medium flex items-center gap-2">
                      {isGenerating && <Loader2 className="h-3 w-3 animate-spin" />}
                      {isGenerating ? "Generating report..." : reportTitle || "Generated Report"}
                    </span>
                    {reportContent && !isGenerating && (
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" className="gap-1 h-7" onClick={handleSaveReport}>
                          <Save className="h-3 w-3" /> Save
                        </Button>
                        <Button variant="ghost" size="sm" className="gap-1 h-7" onClick={handleCopyReport}>
                          <Copy className="h-3 w-3" /> Copy
                        </Button>
                        <ReportDownloader content={reportContent} title={reportTitle || "Report"} />
                        <Button variant="ghost" size="sm" className="gap-1 h-7" onClick={handleScheduleFromCurrent}>
                          <CalendarClock className="h-3 w-3" /> Schedule
                        </Button>
                        <Button variant="ghost" size="sm" className="gap-1 h-7" onClick={handleReset}>
                          <RotateCcw className="h-3 w-3" /> Reset
                        </Button>
                      </div>
                    )}
                  </div>
                  <ScrollArea className="max-h-[500px]">
                    <div className="p-4 prose prose-sm dark:prose-invert max-w-none">
                      <ReactMarkdown>{reportContent || "..."}</ReactMarkdown>
                    </div>
                  </ScrollArea>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Templates Tab */}
        <TabsContent value="templates" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Report Templates</h3>
              <p className="text-sm text-muted-foreground">
                Click any template to generate a report instantly using AI.
              </p>
            </div>
            <Select value={templateFilter} onValueChange={setTemplateFilter}>
              <SelectTrigger className="w-[160px]">
                <Filter className="h-3.5 w-3.5 mr-1.5" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Templates</SelectItem>
                <SelectItem value="prince2">PRINCE2</SelectItem>
                <SelectItem value="msp">MSP</SelectItem>
                <SelectItem value="agile">Agile</SelectItem>
                <SelectItem value="product">Product</SelectItem>
                <SelectItem value="change">Change Mgmt</SelectItem>
                <SelectItem value="helpdesk">Helpdesk</SelectItem>
                <SelectItem value="general">General</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <ReportTemplates
            onSelectTemplate={(t) => {
              setMainTab("builder");
              handleTemplateSelect(t);
            }}
            filterCategory={templateFilter}
          />
        </TabsContent>

        {/* Saved Reports Tab */}
        <TabsContent value="saved">
          <SavedReports />
        </TabsContent>

        {/* Scheduled Tab */}
        <TabsContent value="scheduled">
          <ScheduledReportsList />
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-6">
          {/* Scope switcher */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="inline-flex items-center gap-1 rounded-lg border bg-muted/40 p-1 flex-wrap">
              {([
                { key: "portfolio", label: "Portfolio", icon: LayoutGrid },
                { key: "programs",  label: "Programs",  icon: Layers },
                { key: "projects",  label: "Projects",  icon: FolderKanban },
                { key: "products",  label: "Products",  icon: Package },
                { key: "helpdesk",  label: "Helpdesk",  icon: LifeBuoy },
                { key: "change",    label: "Change Mgmt", icon: GitBranch },
              ] as const).map((s) => {
                const Icon = s.icon;
                const active = analyticsScope === s.key;
                return (
                  <button
                    key={s.key}
                    onClick={() => setAnalyticsScope(s.key)}
                    className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                      active
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:bg-background/60 hover:text-foreground"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {s.label}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" className="gap-2" onClick={() => {
                const exportData = {
                  exportedAt: new Date().toISOString(),
                  scope: analyticsScope,
                  programmes, projects, products, risks, benefits,
                  helpdeskTickets, cmRequests,
                };
                const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url; a.download = `${analyticsScope}-data-${new Date().toISOString().split("T")[0]}.json`; a.click();
                URL.revokeObjectURL(url);
                toast({ title: "Exported", description: "Analytics data exported as JSON." });
              }}>
                <Download className="h-3.5 w-3.5" /> Export
              </Button>
              <Button size="sm" className="gap-2" onClick={() => {
                const scopeQueries: Record<typeof analyticsScope, { q: string; t: string }> = {
                  portfolio: { q: "Generate an executive portfolio overview across programmes, projects, products, helpdesk and change management.", t: "Portfolio Overview" },
                  programs:  { q: "Generate a detailed programme portfolio analysis including health, tranches, benefits, and stakeholders.", t: "Programmes Analytics" },
                  projects:  { q: "Generate a project portfolio analysis covering health, schedule, risk, milestones and resourcing.", t: "Projects Analytics" },
                  products:  { q: "Generate a product portfolio analysis covering roadmap, backlog, RICE prioritisation and KPIs.", t: "Products Analytics" },
                  helpdesk:  { q: "Generate a service desk performance report covering volume, SLA attainment, MTTR, CSAT and incident/problem trends.", t: "Helpdesk Analytics" },
                  change:    { q: "Generate a change management report covering pipeline, risk profile, success rate, downtime exposure and approval lead times.", t: "Change Management Analytics" },
                };
                const sel = scopeQueries[analyticsScope];
                setMainTab("builder");
                handleGenerateAIReport(sel.q, sel.t);
              }}>
                <Sparkles className="h-3.5 w-3.5" /> AI Report on This View
              </Button>
            </div>
          </div>

          {analyticsScope === "portfolio" && (
            <>
              <StatusIndicators />
              <div className="grid gap-6 lg:grid-cols-3">
                <div className="metric-card">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">Risk Distribution</h3>
                    <PieChart className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="h-[250px]">
                    {resourceAllocation.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <RechartsPie>
                          <Pie data={resourceAllocation} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={4} dataKey="value">
                            {resourceAllocation.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} />
                          <Legend />
                        </RechartsPie>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex items-center justify-center h-full text-muted-foreground">
                        No risk data available.
                      </div>
                    )}
                  </div>
                </div>

                <div className="metric-card lg:col-span-2">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">Portfolio Summary</h3>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
                    <ScopeStat label="Programs"    value={programmes.length}                                    tone="primary" />
                    <ScopeStat label="Projects"    value={projects.length}                                      tone="success" />
                    <ScopeStat label="Products"    value={products.length}                                      tone="accent" />
                    <ScopeStat label="Tasks"       value={tasks.length}                                         tone="secondary" />
                    <ScopeStat label="Open Risks"  value={risks.filter(r => r.status === "open").length}        tone="warning" />
                    <ScopeStat label="Benefits"    value={benefits.length}                                      tone="info" />
                    <ScopeStat label="Tickets"     value={helpdeskTickets.length}                               tone="info" />
                    <ScopeStat label="Changes"     value={cmRequests.length}                                    tone="warning" />
                  </div>
                </div>
              </div>
            </>
          )}

          {analyticsScope === "programs" && (
            <ScopePanel
              title="Programmes"
              stats={[
                { label: "Total",    value: programmes.length, tone: "primary" },
                { label: "Active",   value: programmes.filter(p => p.status === "active").length, tone: "success" },
                { label: "On Hold",  value: programmes.filter(p => p.status === "on_hold").length, tone: "warning" },
                { label: "Closed",  value: programmes.filter(p => p.status === "closed").length, tone: "muted" },
                { label: "Avg Progress", value: `${Math.round(programmes.reduce((a, p) => a + (p.progress ?? 0), 0) / Math.max(1, programmes.length))}%`, tone: "info" },
              ]}
              breakdown={statusBreakdown(programmes)}
            />
          )}

          {analyticsScope === "projects" && (
            <ScopePanel
              title="Projects"
              stats={[
                { label: "Total",       value: projects.length, tone: "primary" },
                { label: "On Track",    value: projects.filter((p: any) => p.health === "green" || p.health === "on_track").length, tone: "success" },
                { label: "At Risk",     value: projects.filter((p: any) => p.health === "amber" || p.health === "at_risk").length, tone: "warning" },
                { label: "Off Track",   value: projects.filter((p: any) => p.health === "red" || p.health === "off_track").length, tone: "destructive" },
              ]}
              breakdown={countBy(projects, (p: any) => p.health || "unknown")}
            />
          )}

          {analyticsScope === "products" && (
            <ScopePanel
              title="Products"
              stats={[
                { label: "Total",    value: products.length,                                  tone: "primary" },
                { label: "Features", value: tasks.length,                                     tone: "info" },
                { label: "Benefits", value: benefits.length,                                  tone: "success" },
              ]}
              breakdown={{}}
            />
          )}

          {analyticsScope === "helpdesk" && (
            <HelpdeskAnalytics tickets={helpdeskTickets as any} />
          )}

          {analyticsScope === "change" && (
            <ChangeAnalytics changes={cmRequests as any} />
          )}
        </TabsContent>
      </Tabs>

      {/* Schedule Dialog */}
      <ScheduleReportDialog
        open={scheduleOpen}
        onOpenChange={setScheduleOpen}
        prefillQuery={schedPrefillQuery}
        prefillTitle={schedPrefillTitle}
        prefillTemplateKey={schedPrefillTemplate}
      />
    </AppLayout>
  );
}
