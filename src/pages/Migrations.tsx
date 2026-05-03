import { useEffect, useRef, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, RefreshCcw, ArrowLeftRight } from "lucide-react";
import { MigrationWizard } from "@/components/migration/MigrationWizard";
import { listMigrationJobs, watchMigrationJob } from "@/lib/migration/runner";
import { useOrganization } from "@/hooks/useOrganization";
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

export default function Migrations() {
  const { currentOrganization } = useOrganization();
  const [open, setOpen] = useState(false);
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [loading, setLoading] = useState(false);
  const watchersRef = useRef<Map<string, () => void>>(new Map());

  const refresh = async () => {
    if (!currentOrganization?.id) return;
    setLoading(true);
    try {
      const data = (await listMigrationJobs(currentOrganization.id)) as JobRow[];
      setJobs(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOrganization?.id]);

  // Attach a poller for any running/draft job so progress updates live.
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
    return () => {
      // no-op; cleanup happens on unmount below
    };
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
    <AppLayout title="Migrations">
      <div className="container mx-auto py-6 space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <ArrowLeftRight className="h-6 w-6 text-primary" />
              Migrations
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Import projects, tasks, issues, and risks from other systems. Each run creates new records.
            </p>
          </div>
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
                No migrations yet. Click "New migration" to import from Jira.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Source</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Totals</TableHead>
                    <TableHead>Started</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jobs.map((j) => {
                    const totals = j.totals as Record<string, number> | null;
                    return (
                      <TableRow key={j.id}>
                        <TableCell className="font-medium">{j.source_label ?? j.source}</TableCell>
                        <TableCell>
                          <Badge variant={statusVariant(j.status)}>{j.status}</Badge>
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
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <MigrationWizard open={open} onOpenChange={setOpen} onCompleted={refresh} />
    </AppLayout>
  );
}
