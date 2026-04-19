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
  BookOpen, Filter,
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
          {/* Quick Actions */}
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" className="gap-2" onClick={() => {
              const txt = `Program Portfolio Report\nGenerated: ${new Date().toLocaleDateString()}\n\nSummary:\n- Total Programs: ${programmes.length}\n- Total Projects: ${projects.length}\n- Open Risks: ${risks.filter(r => r.status === "open").length}\n- Benefits Tracked: ${benefits.length}\n\nProgram Status:\n${programmes.map(p => `- ${p.name}: ${p.status} (${p.progress}% complete)`).join("\n")}`;
              const blob = new Blob([txt], { type: "text/plain" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url; a.download = `portfolio-report-${new Date().toISOString().split("T")[0]}.txt`; a.click();
              URL.revokeObjectURL(url);
              toast({ title: "Downloaded", description: "Quick report exported." });
            }}>
              <FileText className="h-4 w-4" /> Quick Report
            </Button>
            <Button variant="outline" className="gap-2" onClick={() => {
              const exportData = { exportedAt: new Date().toISOString(), programmes, projects, risks, benefits };
              const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url; a.download = `portfolio-data-${new Date().toISOString().split("T")[0]}.json`; a.click();
              URL.revokeObjectURL(url);
              toast({ title: "Exported", description: "All portfolio data exported as JSON." });
            }}>
              <Download className="h-4 w-4" /> Export All Data
            </Button>
          </div>

          {/* Status Overview */}
          <StatusIndicators />

          {/* Charts Grid */}
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
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <div className="p-4 rounded-lg bg-primary/10 text-center">
                  <p className="text-3xl font-bold text-primary">{programmes.length}</p>
                  <p className="text-sm text-muted-foreground">Programs</p>
                </div>
                <div className="p-4 rounded-lg bg-success/10 text-center">
                  <p className="text-3xl font-bold text-success">{projects.length}</p>
                  <p className="text-sm text-muted-foreground">Projects</p>
                </div>
                <div className="p-4 rounded-lg bg-accent/10 text-center">
                  <p className="text-3xl font-bold text-accent-foreground">{products.length}</p>
                  <p className="text-sm text-muted-foreground">Products</p>
                </div>
                <div className="p-4 rounded-lg bg-secondary/10 text-center">
                  <p className="text-3xl font-bold text-secondary-foreground">{tasks.length}</p>
                  <p className="text-sm text-muted-foreground">Tasks</p>
                </div>
                <div className="p-4 rounded-lg bg-warning/10 text-center">
                  <p className="text-3xl font-bold text-warning">{risks.filter(r => r.status === "open").length}</p>
                  <p className="text-sm text-muted-foreground">Open Risks</p>
                </div>
                <div className="p-4 rounded-lg bg-info/10 text-center">
                  <p className="text-3xl font-bold text-info">{benefits.length}</p>
                  <p className="text-sm text-muted-foreground">Benefits</p>
                </div>
              </div>
            </div>
          </div>
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
