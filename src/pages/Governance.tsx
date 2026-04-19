import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import { useOrgAccessLevel } from "@/hooks/useOrgAccessLevel";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  FileText,
  Sparkles,
  ShieldCheck,
  Mail,
  CheckCircle2,
  ShieldAlert,
  Loader2,
  RefreshCw,
} from "lucide-react";

type Report = {
  id: string;
  organization_id: string;
  report_type: "highlight" | "end_stage" | "programme_status";
  scope_type: "programme" | "project";
  scope_id: string;
  title: string;
  period_start: string | null;
  period_end: string | null;
  status: "draft" | "approved" | "published" | "archived";
  content: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  generated_by: string | null;
  approved_by: string | null;
};

type CommsPack = {
  id: string;
  governance_report_id: string | null;
  title: string;
  email_subject: string | null;
  email_html: string | null;
  slack_markdown: string | null;
  pdf_summary: string | null;
  status: string;
  created_at: string;
};

type ScoreRow = {
  id: string;
  scope_type: string;
  scope_id: string;
  score: number;
  controls_score: number;
  cadence_score: number;
  hygiene_score: number;
  details: Record<string, unknown>;
  computed_at: string;
};

type EntityOption = { id: string; name: string };

const REPORT_LABELS = {
  highlight: "PRINCE2 Highlight Report",
  end_stage: "PRINCE2 End Stage Report",
  programme_status: "MSP Programme Status Report",
};

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "outline"> = {
  draft: "outline",
  approved: "secondary",
  published: "default",
  archived: "outline",
};

export default function Governance() {
  const { user } = useAuth();
  const { currentOrganization } = useOrganization();
  const { accessLevel, loading: accessLoading } = useOrgAccessLevel();
  const isManager = accessLevel === "admin" || accessLevel === "manager";

  const [reports, setReports] = useState<Report[]>([]);
  const [packs, setPacks] = useState<CommsPack[]>([]);
  const [scores, setScores] = useState<ScoreRow[]>([]);
  const [programmes, setProgrammes] = useState<EntityOption[]>([]);
  const [projects, setProjects] = useState<EntityOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [activeReport, setActiveReport] = useState<Report | null>(null);
  const [activePack, setActivePack] = useState<CommsPack | null>(null);
  const [packTab, setPackTab] = useState("email");
  const [packDialogOpen, setPackDialogOpen] = useState(false);
  const [selectedReportForPack, setSelectedReportForPack] = useState<string>("");

  const [genForm, setGenForm] = useState({
    report_type: "highlight" as Report["report_type"],
    scope_type: "programme" as Report["scope_type"],
    scope_id: "",
  });

  const fetchAll = async () => {
    if (!currentOrganization) return;
    setLoading(true);
    const [reportsRes, packsRes, scoresRes, progRes, projRes] = await Promise.all([
      supabase
        .from("governance_reports")
        .select("*")
        .eq("organization_id", currentOrganization.id)
        .order("updated_at", { ascending: false }),
      supabase
        .from("comms_packs")
        .select("*")
        .eq("organization_id", currentOrganization.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("compliance_scores")
        .select("*")
        .eq("organization_id", currentOrganization.id)
        .order("computed_at", { ascending: false }),
      supabase
        .from("programmes")
        .select("id, name")
        .eq("organization_id", currentOrganization.id)
        .order("name"),
      supabase
        .from("projects")
        .select("id, name")
        .eq("organization_id", currentOrganization.id)
        .order("name"),
    ]);

    setReports((reportsRes.data || []) as Report[]);
    setPacks((packsRes.data || []) as CommsPack[]);
    setScores((scoresRes.data || []) as ScoreRow[]);
    setProgrammes(progRes.data || []);
    setProjects(projRes.data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOrganization?.id]);

  const latestScoresByScope = useMemo(() => {
    const map = new Map<string, ScoreRow>();
    for (const s of scores) {
      const key = `${s.scope_type}:${s.scope_id}`;
      if (!map.has(key)) map.set(key, s);
    }
    return Array.from(map.values());
  }, [scores]);

  const handleGenerate = async () => {
    if (!currentOrganization || !genForm.scope_id) {
      toast.error("Please choose a scope");
      return;
    }
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-governance-report", {
        body: {
          report_type: genForm.report_type,
          scope_type: genForm.scope_type,
          scope_id: genForm.scope_id,
          organization_id: currentOrganization.id,
        },
      });
      if (error) throw error;
      toast.success("Draft report generated");
      setGenerateOpen(false);
      setGenForm({ ...genForm, scope_id: "" });
      fetchAll();
      if (data?.report) {
        setActiveReport(data.report as Report);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to generate report";
      toast.error(msg);
    } finally {
      setGenerating(false);
    }
  };

  const updateReportStatus = async (status: Report["status"]) => {
    if (!activeReport) return;
    const patch: Record<string, unknown> = { status };
    if (status === "approved") {
      patch.approved_by = user?.id;
      patch.approved_at = new Date().toISOString();
    }
    if (status === "published") {
      patch.published_at = new Date().toISOString();
    }
    const { error } = await supabase
      .from("governance_reports")
      .update(patch)
      .eq("id", activeReport.id);
    if (error) {
      toast.error("Failed to update status");
      return;
    }
    toast.success(`Report ${status}`);
    setActiveReport({ ...activeReport, ...patch } as Report);
    fetchAll();
  };

  const generateCommsPack = async (reportId?: string) => {
    const targetReportId = reportId || activeReport?.id;
    if (!targetReportId) return;
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-comms-pack", {
        body: { governance_report_id: targetReportId },
      });
      if (error) throw error;
      toast.success("Comms pack generated");
      setPackDialogOpen(false);
      setSelectedReportForPack("");
      fetchAll();
      if (data?.comms_pack) {
        setActivePack(data.comms_pack as CommsPack);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to generate comms pack";
      toast.error(msg);
    } finally {
      setGenerating(false);
    }
  };

  const eligibleReportsForPack = useMemo(
    () => reports.filter((r) => r.status === "approved" || r.status === "published"),
    [reports],
  );

  const recomputeScore = async (scope_type: "programme" | "project", scope_id: string) => {
    if (!currentOrganization) return;
    const { data, error } = await supabase.rpc("compute_compliance_score", {
      _scope_type: scope_type,
      _scope_id: scope_id,
    });
    if (error) {
      toast.error("Failed to compute score");
      return;
    }
    const result = data as { score: number; controls_score: number; cadence_score: number; hygiene_score: number; details: Record<string, unknown> };
    await (supabase.from("compliance_scores") as any).insert({
      organization_id: currentOrganization.id,
      scope_type,
      scope_id,
      score: result.score,
      controls_score: result.controls_score,
      cadence_score: result.cadence_score,
      hygiene_score: result.hygiene_score,
      details: result.details,
    });
    toast.success("Score updated");
    fetchAll();
  };

  const copyText = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied`);
    } catch {
      toast.error("Copy failed");
    }
  };

  const getScopeName = (scope_type: string, scope_id: string) => {
    if (scope_type === "programme") return programmes.find((p) => p.id === scope_id)?.name || "Unknown";
    if (scope_type === "project") return projects.find((p) => p.id === scope_id)?.name || "Unknown";
    return "Unknown";
  };

  const renderContentSection = (label: string, value: unknown) => {
    if (value == null || value === "") return null;
    if (Array.isArray(value)) {
      return (
        <div className="space-y-1">
          <h4 className="font-semibold text-sm">{label}</h4>
          <ul className="list-disc pl-5 space-y-1 text-sm">
            {value.map((v, i) => (
              <li key={i}>{String(v)}</li>
            ))}
          </ul>
        </div>
      );
    }
    return (
      <div className="space-y-1">
        <h4 className="font-semibold text-sm">{label}</h4>
        <p className="text-sm whitespace-pre-wrap">{String(value)}</p>
      </div>
    );
  };

  if (accessLoading) {
    return (
      <AppLayout title="Governance">
        <div className="p-6 text-muted-foreground">Loading…</div>
      </AppLayout>
    );
  }

  if (!isManager) {
    return (
      <AppLayout title="Governance" subtitle="AI-drafted governance reports & compliance">
        <div className="p-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <ShieldAlert className="h-6 w-6 text-muted-foreground" />
                <CardTitle>Managers and admins only</CardTitle>
              </div>
              <CardDescription>
                Generating governance reports and managing compliance is restricted to org managers and admins.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout
      title="Governance"
      subtitle="AI-drafted reports, compliance scores, and stakeholder comms packs"
    >
      <div className="p-6 space-y-6">
        <Tabs defaultValue="reports">
          <TabsList>
            <TabsTrigger value="reports">
              <FileText className="h-4 w-4 mr-2" />
              Reports
            </TabsTrigger>
            <TabsTrigger value="compliance">
              <ShieldCheck className="h-4 w-4 mr-2" />
              Compliance
            </TabsTrigger>
            <TabsTrigger value="comms">
              <Mail className="h-4 w-4 mr-2" />
              Comms Packs
            </TabsTrigger>
          </TabsList>

          {/* Reports tab */}
          <TabsContent value="reports" className="mt-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Governance reports</h2>
                <p className="text-sm text-muted-foreground">
                  AI-drafted Highlight, End Stage, and Programme Status reports
                </p>
              </div>
              <Dialog open={generateOpen} onOpenChange={setGenerateOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Generate report
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Generate governance report</DialogTitle>
                    <DialogDescription>
                      AI drafts a structured report from your live programme/project data.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Report type</Label>
                      <Select
                        value={genForm.report_type}
                        onValueChange={(v) => setGenForm({ ...genForm, report_type: v as Report["report_type"] })}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="highlight">PRINCE2 Highlight Report</SelectItem>
                          <SelectItem value="end_stage">PRINCE2 End Stage Report</SelectItem>
                          <SelectItem value="programme_status">MSP Programme Status Report</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>Scope</Label>
                        <Select
                          value={genForm.scope_type}
                          onValueChange={(v) => setGenForm({ ...genForm, scope_type: v as Report["scope_type"], scope_id: "" })}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="programme">Programme</SelectItem>
                            <SelectItem value="project">Project</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>{genForm.scope_type === "programme" ? "Programme" : "Project"}</Label>
                        <Select
                          value={genForm.scope_id}
                          onValueChange={(v) => setGenForm({ ...genForm, scope_id: v })}
                        >
                          <SelectTrigger><SelectValue placeholder="Choose…" /></SelectTrigger>
                          <SelectContent>
                            {(genForm.scope_type === "programme" ? programmes : projects).map((e) => (
                              <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setGenerateOpen(false)} disabled={generating}>
                      Cancel
                    </Button>
                    <Button onClick={handleGenerate} disabled={generating}>
                      {generating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
                      Generate
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            <Card>
              <CardContent className="p-0">
                {loading ? (
                  <div className="p-8 text-center text-muted-foreground">Loading…</div>
                ) : reports.length === 0 ? (
                  <div className="p-12 text-center text-muted-foreground">
                    No reports yet. Click <strong>Generate report</strong> to draft your first one.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Title</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Scope</TableHead>
                        <TableHead>Period</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Updated</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reports.map((r) => (
                        <TableRow key={r.id} className="cursor-pointer" onClick={() => setActiveReport(r)}>
                          <TableCell className="font-medium max-w-xs truncate">{r.title}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{REPORT_LABELS[r.report_type].replace(/^(PRINCE2|MSP) /, "")}</Badge>
                          </TableCell>
                          <TableCell className="text-sm">{getScopeName(r.scope_type, r.scope_id)}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {r.period_start} → {r.period_end}
                          </TableCell>
                          <TableCell>
                            <Badge variant={STATUS_VARIANTS[r.status]}>{r.status}</Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {format(new Date(r.updated_at), "PP")}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Compliance tab */}
          <TabsContent value="compliance" className="mt-4 space-y-4">
            <div>
              <h2 className="text-lg font-semibold">Compliance scores</h2>
              <p className="text-sm text-muted-foreground">
                Composite 0–100 score: <strong>40%</strong> controls completeness · <strong>30%</strong> update cadence · <strong>30%</strong> risk/issue hygiene
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[...programmes.map((p) => ({ ...p, type: "programme" as const })),
                ...projects.map((p) => ({ ...p, type: "project" as const }))].map((entity) => {
                const score = latestScoresByScope.find((s) => s.scope_type === entity.type && s.scope_id === entity.id);
                return (
                  <Card key={`${entity.type}:${entity.id}`}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-base">{entity.name}</CardTitle>
                          <CardDescription className="capitalize">{entity.type}</CardDescription>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => recomputeScore(entity.type, entity.id)}
                          title="Recompute score"
                        >
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {score ? (
                        <div className="space-y-3">
                          <div className="flex items-baseline gap-2">
                            <span className="text-3xl font-bold">{score.score}</span>
                            <span className="text-sm text-muted-foreground">/ 100</span>
                          </div>
                          <Progress value={score.score} />
                          <div className="grid grid-cols-3 gap-2 text-xs">
                            <div>
                              <p className="text-muted-foreground">Controls</p>
                              <p className="font-semibold">{score.controls_score}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Cadence</p>
                              <p className="font-semibold">{score.cadence_score}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Hygiene</p>
                              <p className="font-semibold">{score.hygiene_score}</p>
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Computed {format(new Date(score.computed_at), "PPp")}
                          </p>
                        </div>
                      ) : (
                        <Button variant="outline" size="sm" onClick={() => recomputeScore(entity.type, entity.id)}>
                          Compute score
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
              {programmes.length === 0 && projects.length === 0 && (
                <p className="text-muted-foreground col-span-full text-center py-8">
                  Create a programme or project to start scoring compliance.
                </p>
              )}
            </div>
          </TabsContent>

          {/* Comms packs tab */}
          <TabsContent value="comms" className="mt-4 space-y-4">
            <div>
              <h2 className="text-lg font-semibold">Comms packs</h2>
              <p className="text-sm text-muted-foreground">
                AI-generated executive email, Slack/Teams summary, and PDF 1-pager from each report
              </p>
            </div>
            <Card>
              <CardContent className="p-0">
                {loading ? (
                  <div className="p-8 text-center text-muted-foreground">Loading…</div>
                ) : packs.length === 0 ? (
                  <div className="p-12 text-center text-muted-foreground">
                    No comms packs yet. Open a report and click <strong>Generate comms pack</strong>.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Title</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Created</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {packs.map((p) => (
                        <TableRow key={p.id} className="cursor-pointer" onClick={() => setActivePack(p)}>
                          <TableCell className="font-medium">{p.title}</TableCell>
                          <TableCell>
                            <Badge variant={STATUS_VARIANTS[p.status] || "outline"}>{p.status}</Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {format(new Date(p.created_at), "PP")}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Report detail sheet */}
        <Sheet open={!!activeReport} onOpenChange={(open) => !open && setActiveReport(null)}>
          <SheetContent className="sm:max-w-3xl flex flex-col">
            {activeReport && (
              <>
                <SheetHeader>
                  <SheetTitle>{activeReport.title}</SheetTitle>
                  <SheetDescription asChild>
                    <div>
                      <div className="flex flex-wrap gap-2 mt-2">
                        <Badge variant="outline">{REPORT_LABELS[activeReport.report_type]}</Badge>
                        <Badge variant={STATUS_VARIANTS[activeReport.status]}>{activeReport.status}</Badge>
                        <Badge variant="secondary">
                          {getScopeName(activeReport.scope_type, activeReport.scope_id)}
                        </Badge>
                      </div>
                    </div>
                  </SheetDescription>
                </SheetHeader>
                <div className="flex-1 overflow-y-auto space-y-4 my-4 pr-2">
                  {Object.entries(activeReport.content || {}).map(([k, v]) => (
                    <div key={k}>
                      {renderContentSection(
                        k.split("_").map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(" "),
                        v,
                      )}
                    </div>
                  ))}
                </div>
                <div className="border-t pt-4 space-y-2">
                  <div className="flex flex-wrap gap-2">
                    {activeReport.status === "draft" && (
                      <Button onClick={() => updateReportStatus("approved")}>
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        Approve
                      </Button>
                    )}
                    {activeReport.status === "approved" && (
                      <Button onClick={() => updateReportStatus("published")}>
                        Publish to stakeholders
                      </Button>
                    )}
                    {activeReport.status === "published" && (
                      <Button variant="outline" onClick={() => updateReportStatus("archived")}>
                        Archive
                      </Button>
                    )}
                    <Button variant="outline" onClick={generateCommsPack} disabled={generating}>
                      {generating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
                      Generate comms pack
                    </Button>
                  </div>
                </div>
              </>
            )}
          </SheetContent>
        </Sheet>

        {/* Comms pack viewer */}
        <Sheet open={!!activePack} onOpenChange={(open) => !open && setActivePack(null)}>
          <SheetContent className="sm:max-w-3xl flex flex-col">
            {activePack && (
              <>
                <SheetHeader>
                  <SheetTitle>{activePack.title}</SheetTitle>
                </SheetHeader>
                <Tabs value={packTab} onValueChange={setPackTab} className="mt-4 flex-1 flex flex-col overflow-hidden">
                  <TabsList>
                    <TabsTrigger value="email">Executive email</TabsTrigger>
                    <TabsTrigger value="slack">Slack/Teams</TabsTrigger>
                    <TabsTrigger value="pdf">PDF 1-pager</TabsTrigger>
                  </TabsList>
                  <TabsContent value="email" className="flex-1 overflow-y-auto space-y-3 mt-3">
                    <div className="space-y-2">
                      <Label className="text-xs">Subject</Label>
                      <div className="flex gap-2">
                        <Input readOnly value={activePack.email_subject || ""} />
                        <Button variant="outline" size="sm" onClick={() => copyText(activePack.email_subject || "", "Subject")}>
                          Copy
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs">HTML preview</Label>
                        <Button variant="outline" size="sm" onClick={() => copyText(activePack.email_html || "", "HTML")}>
                          Copy HTML
                        </Button>
                      </div>
                      <Card>
                        <CardContent
                          className="p-4 prose prose-sm max-w-none"
                          dangerouslySetInnerHTML={{ __html: activePack.email_html || "" }}
                        />
                      </Card>
                    </div>
                  </TabsContent>
                  <TabsContent value="slack" className="flex-1 overflow-y-auto mt-3">
                    <div className="flex items-center justify-between mb-2">
                      <Label className="text-xs">Markdown</Label>
                      <Button variant="outline" size="sm" onClick={() => copyText(activePack.slack_markdown || "", "Markdown")}>
                        Copy
                      </Button>
                    </div>
                    <Card>
                      <CardContent className="p-4">
                        <pre className="text-xs whitespace-pre-wrap font-mono">{activePack.slack_markdown}</pre>
                      </CardContent>
                    </Card>
                  </TabsContent>
                  <TabsContent value="pdf" className="flex-1 overflow-y-auto mt-3">
                    <div className="flex items-center justify-between mb-2">
                      <Label className="text-xs">PDF source (markdown)</Label>
                      <Button variant="outline" size="sm" onClick={() => copyText(activePack.pdf_summary || "", "PDF summary")}>
                        Copy
                      </Button>
                    </div>
                    <Card>
                      <CardContent className="p-4">
                        <pre className="text-xs whitespace-pre-wrap font-mono">{activePack.pdf_summary}</pre>
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>
              </>
            )}
          </SheetContent>
        </Sheet>
      </div>
    </AppLayout>
  );
}
