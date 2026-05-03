import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, RefreshCcw, ArrowLeftRight, FileDown, FileJson } from "lucide-react";
import { MigrationWizard } from "@/components/migration/MigrationWizard";
import { listMigrationJobs, watchMigrationJob, downloadMigrationErrorReport } from "@/lib/migration/runner";
import { useOrganization } from "@/hooks/useOrganization";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

type JobRow = {
  id: string;
  source: string;
  source_label: string | null;
  status: string;
  totals: Record<string, number> | null;
  progress: { done?: number; total?: number; message?: string } | null;
  started_at: string | null;
  error_summary: string | null;
};

interface MigrationsPanelProps {
  showHeader?: boolean;
  /** When set, scope this panel to the given organization instead of the active one. */
  organizationIdOverride?: string;
}

export function MigrationsPanel({ showHeader = true, organizationIdOverride }: MigrationsPanelProps) {
  const { currentOrganization } = useOrganization();
  const effectiveOrgId = organizationIdOverride ?? currentOrganization?.id ?? null;
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const watchersRef = useRef<Map<string, () => void>>(new Map());

  const refresh = async () => {
    if (!effectiveOrgId) return;
    setLoading(true);
    try {
      const data = (await listMigrationJobs(effectiveOrgId)) as JobRow[];
      setJobs(data);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (jobId: string, fmt: "csv" | "json") => {
    setDownloadingId(jobId + fmt);
    try {
      const count = await downloadMigrationErrorReport(jobId, fmt);
      toast({
        title: count === 0 ? "No errors to report" : `Exported ${count} row${count === 1 ? "" : "s"}`,
        description:
          count === 0
            ? "This migration completed without skipped or failed rows."
            : `Downloaded as ${fmt.toUpperCase()}.`,
      });
    } catch (e) {
      toast({
        title: "Export failed",
        description: e instanceof Error ? e.message : "Could not generate report.",
        variant: "destructive",
      });
    } finally {
      setDownloadingId(null);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveOrgId]);

  useEffect(() => {
    const watchers = watchersRef.current;
    for (const job of jobs) {
      const isLive = job.status === "running" || job.status === "draft";
      if (isLive && !watchers.has(job.id)) {
        const stop = watchMigrationJob(job.id, (row) => {
          setJobs((prev) =>
            prev.map((j) =>
              j.id === row.id
                ? { ...j, status: row.status, progress: row.progress, totals: row.totals, error_summary: row.error_summary }
                : j,
            ),
          );
          if (row.status === "completed" || row.status === "failed") {
            const stopFn = watchers.get(row.id);
            stopFn?.();
            watchers.delete(row.id);
          }
        });
        watchers.set(job.id, stop);
      }
    }
  }, [jobs]);

  useEffect(() => {
    return () => {
      for (const stop of watchersRef.current.values()) stop();
      watchersRef.current.clear();
    };
  }, []);

  const statusVariant = (s: string) =>
    s === "completed" ? "default" : s === "failed" ? "destructive" : s === "running" ? "secondary" : "outline";

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        {showHeader ? (
          <div>
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <ArrowLeftRight className="h-5 w-5 text-primary" />
              Migrations
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Import projects, tasks, issues, and risks from other systems. Each run creates new records.
            </p>
          </div>
        ) : (
          <div />
        )}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
            <RefreshCcw className="h-4 w-4 mr-1" /> Refresh
          </Button>
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> New migration
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent migrations</CardTitle>
          <CardDescription>The last 50 migration runs for this organization.</CardDescription>
        </CardHeader>
        <CardContent>
          {jobs.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No migrations yet. Click "New migration" to import from Jira or CSV.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Source</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Totals</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="text-right">Error report</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.map((j) => {
                  const totals = j.totals;
                  const p = j.progress ?? {};
                  const isLive = j.status === "running";
                  const pct = p.total ? Math.min(100, Math.round(((p.done ?? 0) / p.total) * 100)) : 0;
                  const skippedCount = (totals?.skipped ?? 0) + (totals?.failed ?? 0);
                  const canDownload = j.status === "completed" || j.status === "failed";
                  return (
                    <TableRow key={j.id}>
                      <TableCell className="font-medium">{j.source_label ?? j.source}</TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(j.status)}>{j.status}</Badge>
                      </TableCell>
                      <TableCell className="text-xs min-w-[180px]">
                        {isLive ? (
                          <div className="space-y-1">
                            <Progress value={pct} className="h-1.5" />
                            <p className="text-muted-foreground truncate">
                              {p.done ?? 0} / {p.total ?? 0} — {p.message ?? ""}
                            </p>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">
                            {p.total ? `${p.done ?? 0} / ${p.total}` : "—"}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">
                        {totals
                          ? Object.entries(totals)
                              .filter(([k]) => k !== "errors")
                              .map(([k, v]) => `${k}: ${v}`)
                              .join(" · ")
                          : "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {j.started_at ? format(new Date(j.started_at), "PP p") : "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                        {j.error_summary ?? ""}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs"
                            disabled={!canDownload || downloadingId === j.id + "csv"}
                            onClick={() => handleDownload(j.id, "csv")}
                            title={
                              skippedCount > 0
                                ? `Download ${skippedCount} skipped/failed rows as CSV`
                                : "No skipped or failed rows recorded"
                            }
                          >
                            <FileDown className="h-3 w-3 mr-1" />
                            CSV
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs"
                            disabled={!canDownload || downloadingId === j.id + "json"}
                            onClick={() => handleDownload(j.id, "json")}
                          >
                            <FileJson className="h-3 w-3 mr-1" />
                            JSON
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <MigrationWizard open={open} onOpenChange={setOpen} onCompleted={refresh} organizationIdOverride={organizationIdOverride} />
    </div>
  );
}
