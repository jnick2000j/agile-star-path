import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { BarChart3, Plus, Trash2, Edit, Play, Download, Mail, Clock, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

const DATASETS = [
  { value: "tickets", label: "Tickets" },
  { value: "csat", label: "CSAT Responses" },
  { value: "approvals", label: "Approvals" },
  { value: "sla_breaches", label: "SLA Breaches" },
];

const COLUMN_PRESETS: Record<string, string[]> = {
  tickets: ["reference_number", "subject", "status", "priority", "ticket_type", "category", "assignee_id", "reporter_email", "created_at", "resolved_at"],
  csat: ["ticket_id", "score", "comment", "created_at"],
  approvals: ["ticket_id", "step_order", "step_name", "status", "approver_user_id", "decided_at", "comment"],
  sla_breaches: ["reference_number", "subject", "priority", "sla_response_breached", "sla_resolution_breached", "sla_response_due_at", "sla_resolution_due_at"],
};

interface ReportForm {
  id?: string;
  name: string;
  description: string;
  dataset: string;
  filters: Record<string, any>;
  columns: string[];
  sort_by: string;
  sort_dir: "asc" | "desc";
  schedule_interval: string;
  recipients: string;
  is_enabled: boolean;
}

const empty: ReportForm = {
  name: "",
  description: "",
  dataset: "tickets",
  filters: {},
  columns: COLUMN_PRESETS.tickets,
  sort_by: "created_at",
  sort_dir: "desc",
  schedule_interval: "",
  recipients: "",
  is_enabled: true,
};

export default function HelpdeskReportsPage() {
  const { user } = useAuth();
  const { currentOrganization } = useOrganization();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<ReportForm | null>(null);
  const [running, setRunning] = useState<string | null>(null);

  const orgId = currentOrganization?.id;

  const { data: reports = [] } = useQuery({
    queryKey: ["helpdesk-reports", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data } = await supabase
        .from("helpdesk_reports")
        .select("*")
        .eq("organization_id", orgId!)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: runs = [] } = useQuery({
    queryKey: ["helpdesk-report-runs", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data } = await supabase
        .from("helpdesk_report_runs")
        .select("*")
        .eq("organization_id", orgId!)
        .order("started_at", { ascending: false })
        .limit(20);
      return data ?? [];
    },
    refetchInterval: 5000,
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!editing || !orgId) throw new Error("Missing data");
      const payload: any = {
        organization_id: orgId,
        name: editing.name,
        description: editing.description || null,
        dataset: editing.dataset,
        filters: editing.filters,
        columns: editing.columns,
        sort_by: editing.sort_by || null,
        sort_dir: editing.sort_dir,
        schedule_interval: editing.schedule_interval || null,
        recipients: editing.recipients
          ? editing.recipients.split(",").map((s) => s.trim()).filter(Boolean)
          : null,
        is_enabled: editing.is_enabled,
        created_by: user?.id ?? null,
      };
      if (editing.schedule_interval && !editing.id) {
        const { data } = await supabase.rpc("helpdesk_report_compute_next_run", {
          _interval: editing.schedule_interval,
        });
        payload.next_run_at = data;
      }
      if (editing.id) {
        const { error } = await supabase.from("helpdesk_reports").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("helpdesk_reports").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Report saved");
      qc.invalidateQueries({ queryKey: ["helpdesk-reports", orgId] });
      setEditing(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const removeReport = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("helpdesk_reports").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Report deleted");
      qc.invalidateQueries({ queryKey: ["helpdesk-reports", orgId] });
    },
  });

  const runReport = async (id: string, name: string, downloadCsv = true) => {
    setRunning(id);
    try {
      const { data, error } = await supabase.functions.invoke("helpdesk-report-runner", {
        body: { reportId: id, source: "manual" },
      });
      if (error) throw error;
      const result = data?.results?.[0];
      if (!result?.ok) throw new Error(result?.error || "Run failed");

      if (downloadCsv && result.csv) {
        const blob = new Blob([result.csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${name.replace(/[^a-z0-9]/gi, "_")}_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      }
      toast.success(`Report run: ${result.rows} rows${result.emailed ? `, emailed to ${result.emailed}` : ""}`);
      qc.invalidateQueries({ queryKey: ["helpdesk-report-runs", orgId] });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setRunning(null);
    }
  };

  const startEdit = (r?: any) => {
    if (r) {
      setEditing({
        id: r.id,
        name: r.name,
        description: r.description ?? "",
        dataset: r.dataset,
        filters: r.filters ?? {},
        columns: r.columns ?? [],
        sort_by: r.sort_by ?? "created_at",
        sort_dir: r.sort_dir ?? "desc",
        schedule_interval: r.schedule_interval ?? "",
        recipients: (r.recipients ?? []).join(", "),
        is_enabled: r.is_enabled,
      });
    } else {
      setEditing({ ...empty });
    }
  };

  const toggleColumn = (col: string) => {
    if (!editing) return;
    const has = editing.columns.includes(col);
    setEditing({
      ...editing,
      columns: has ? editing.columns.filter((c) => c !== col) : [...editing.columns, col],
    });
  };

  const datasetCols = editing ? COLUMN_PRESETS[editing.dataset] || [] : [];

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="h-6 w-6" />Reports & Exports
          </h1>
          <p className="text-muted-foreground text-sm">
            Build custom reports, export to CSV, and schedule email delivery.
          </p>
        </div>
        <Button onClick={() => startEdit()}><Plus className="h-4 w-4 mr-1" />New Report</Button>
      </div>

      <div className="grid gap-3">
        {reports.length === 0 && (
          <Card className="p-8 text-center text-muted-foreground">
            No reports yet. Create one to start exporting helpdesk data.
          </Card>
        )}
        {reports.map((r: any) => (
          <Card key={r.id} className="p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">{r.name}</h3>
                  <Badge variant="outline" className="capitalize">{r.dataset.replace("_", " ")}</Badge>
                  {r.is_enabled ? (
                    <Badge variant="outline" className="text-success border-success/40">Active</Badge>
                  ) : (
                    <Badge variant="outline">Disabled</Badge>
                  )}
                  {r.schedule_interval && (
                    <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />{r.schedule_interval}</Badge>
                  )}
                </div>
                {r.description && <p className="text-sm text-muted-foreground">{r.description}</p>}
                <div className="flex flex-wrap gap-1 text-xs text-muted-foreground">
                  <span>{(r.columns ?? []).length} columns</span>
                  {r.recipients?.length > 0 && (
                    <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{r.recipients.length} recipients</span>
                  )}
                  {r.last_run_at && <span>· last run {formatDistanceToNow(new Date(r.last_run_at), { addSuffix: true })}</span>}
                  {r.next_run_at && <span>· next run {formatDistanceToNow(new Date(r.next_run_at), { addSuffix: true })}</span>}
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button size="sm" variant="outline" onClick={() => runReport(r.id, r.name)} disabled={running === r.id}>
                  {running === r.id ? "Running…" : (<><Download className="h-4 w-4 mr-1" />Run</>)}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => startEdit(r)}><Edit className="h-4 w-4" /></Button>
                <Button size="sm" variant="ghost" onClick={() => removeReport.mutate(r.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Card className="p-4">
        <h3 className="font-semibold mb-3">Recent Runs</h3>
        {runs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No runs yet.</p>
        ) : (
          <div className="space-y-1 text-sm">
            {runs.map((run: any) => {
              const report = reports.find((r: any) => r.id === run.report_id);
              return (
                <div key={run.id} className="flex items-center justify-between border-b py-1 last:border-0">
                  <div className="flex items-center gap-2">
                    {run.status === "success" ? (
                      <CheckCircle2 className="h-4 w-4 text-success" />
                    ) : run.status === "failed" ? (
                      <XCircle className="h-4 w-4 text-destructive" />
                    ) : (
                      <Clock className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className="font-medium">{report?.name || "Deleted report"}</span>
                    <Badge variant="outline" className="text-xs">{run.trigger_source}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {run.row_count ?? 0} rows · {formatDistanceToNow(new Date(run.started_at), { addSuffix: true })}
                    {run.error_message && <span className="text-destructive ml-2">· {run.error_message}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Edit" : "New"} Report</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Label>Name</Label>
                  <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
                </div>
                <div className="col-span-2">
                  <Label>Description</Label>
                  <Textarea rows={2} value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
                </div>
                <div>
                  <Label>Dataset</Label>
                  <Select value={editing.dataset} onValueChange={(v) => setEditing({ ...editing, dataset: v, columns: COLUMN_PRESETS[v] || [] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {DATASETS.map((d) => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Sort by</Label>
                  <Input value={editing.sort_by} onChange={(e) => setEditing({ ...editing, sort_by: e.target.value })} />
                </div>
              </div>

              <div className="border-t pt-3 space-y-2">
                <Label>Columns</Label>
                <div className="flex flex-wrap gap-1">
                  {datasetCols.map((c) => (
                    <Badge
                      key={c}
                      variant={editing.columns.includes(c) ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => toggleColumn(c)}
                    >
                      {c}
                    </Badge>
                  ))}
                </div>
              </div>

              {editing.dataset === "tickets" && (
                <div className="border-t pt-3 grid grid-cols-2 gap-3">
                  <Label className="col-span-2 text-sm">Filters (optional)</Label>
                  <div>
                    <Label className="text-xs">Status</Label>
                    <Input
                      placeholder="e.g. open"
                      value={editing.filters.status ?? ""}
                      onChange={(e) => setEditing({ ...editing, filters: { ...editing.filters, status: e.target.value || undefined } })}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Priority</Label>
                    <Input
                      placeholder="e.g. high"
                      value={editing.filters.priority ?? ""}
                      onChange={(e) => setEditing({ ...editing, filters: { ...editing.filters, priority: e.target.value || undefined } })}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Created after</Label>
                    <Input
                      type="date"
                      value={editing.filters.created_after?.slice(0, 10) ?? ""}
                      onChange={(e) => setEditing({ ...editing, filters: { ...editing.filters, created_after: e.target.value || undefined } })}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Created before</Label>
                    <Input
                      type="date"
                      value={editing.filters.created_before?.slice(0, 10) ?? ""}
                      onChange={(e) => setEditing({ ...editing, filters: { ...editing.filters, created_before: e.target.value || undefined } })}
                    />
                  </div>
                </div>
              )}

              <div className="border-t pt-3 space-y-3">
                <Label className="font-semibold">Schedule (optional)</Label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Interval</Label>
                    <Select value={editing.schedule_interval || "none"} onValueChange={(v) => setEditing({ ...editing, schedule_interval: v === "none" ? "" : v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No schedule</SelectItem>
                        <SelectItem value="hourly">Hourly</SelectItem>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2 mt-5">
                    <Switch checked={editing.is_enabled} onCheckedChange={(v) => setEditing({ ...editing, is_enabled: v })} />
                    <Label>Enabled</Label>
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Email recipients (comma-separated)</Label>
                  <Input
                    placeholder="alice@org.com, bob@org.com"
                    value={editing.recipients}
                    onChange={(e) => setEditing({ ...editing, recipients: e.target.value })}
                  />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending || !editing?.name}>
              {save.isPending ? "Saving…" : "Save report"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
