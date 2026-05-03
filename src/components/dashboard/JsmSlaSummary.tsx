import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ArrowRight, Clock, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";

interface SlaRow {
  sla_name: string;
  elapsed_minutes: number | null;
  remaining_minutes: number | null;
  goal_minutes: number | null;
  breached: boolean;
  cycle_state: string | null;
}

interface SlaAggregate {
  name: string;
  total: number;
  breached: number;
  avgElapsedMin: number | null;
  avgRemainingMin: number | null;
}

function fmtDuration(mins: number | null): string {
  if (mins === null || Number.isNaN(mins)) return "—";
  const abs = Math.abs(mins);
  if (abs < 60) return `${Math.round(abs)}m`;
  if (abs < 60 * 24) return `${(abs / 60).toFixed(1)}h`;
  return `${(abs / 60 / 24).toFixed(1)}d`;
}

/**
 * Surfaces Jira Service Management SLA metrics imported via the migration
 * runner: time to first response, time to resolution, etc. Aggregates by
 * SLA name and shows breach rate + averages.
 */
export function JsmSlaSummary() {
  const { currentOrganization } = useOrganization();

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-jsm-sla", currentOrganization?.id],
    enabled: !!currentOrganization?.id,
    queryFn: async (): Promise<SlaAggregate[]> => {
      const orgId = currentOrganization!.id;
      const { data, error } = await supabase
        .from("migration_sla_metrics")
        .select(
          "sla_name,elapsed_minutes,remaining_minutes,goal_minutes,breached,cycle_state",
        )
        .eq("organization_id", orgId)
        .limit(2000);
      if (error) throw error;

      const groups = new Map<string, SlaRow[]>();
      for (const row of (data ?? []) as SlaRow[]) {
        const key = row.sla_name;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(row);
      }

      const aggregates: SlaAggregate[] = [];
      for (const [name, rows] of groups) {
        const elapsed = rows
          .map((r) => r.elapsed_minutes)
          .filter((v): v is number => typeof v === "number");
        const remaining = rows
          .map((r) => r.remaining_minutes)
          .filter((v): v is number => typeof v === "number");
        aggregates.push({
          name,
          total: rows.length,
          breached: rows.filter((r) => r.breached).length,
          avgElapsedMin: elapsed.length
            ? elapsed.reduce((s, v) => s + v, 0) / elapsed.length
            : null,
          avgRemainingMin: remaining.length
            ? remaining.reduce((s, v) => s + v, 0) / remaining.length
            : null,
        });
      }
      // Surface the two PIMP-standard SLAs first
      aggregates.sort((a, b) => {
        const rank = (n: string) =>
          /first response/i.test(n) ? 0 : /resolution/i.test(n) ? 1 : 2;
        return rank(a.name) - rank(b.name) || b.total - a.total;
      });
      return aggregates;
    },
  });

  const aggregates = data ?? [];
  const hasData = aggregates.length > 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Clock className="h-4 w-4 text-primary" />
          Service Management SLAs
        </CardTitle>
        <Button asChild variant="ghost" size="sm" className="text-xs">
          <Link to="/admin/migrations">
            View imports <ArrowRight className="ml-1 h-3 w-3" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <p className="text-xs text-muted-foreground">Loading SLA metrics…</p>
        ) : !hasData ? (
          <p className="text-xs text-muted-foreground">
            No SLA data yet. Run a Jira Service Management import to populate
            time-to-first-response and time-to-resolution metrics.
          </p>
        ) : (
          aggregates.slice(0, 4).map((a) => {
            const breachRate = a.total > 0 ? (a.breached / a.total) * 100 : 0;
            const tone =
              breachRate >= 25
                ? "bg-destructive/15 text-destructive"
                : breachRate > 0
                  ? "bg-warning/15 text-warning"
                  : "bg-success/15 text-success";
            const Icon = breachRate > 0 ? AlertTriangle : CheckCircle2;
            return (
              <div
                key={a.name}
                className="rounded-md border p-3 space-y-1.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium truncate">{a.name}</p>
                  <Badge className={`${tone} gap-1`} variant="secondary">
                    <Icon className="h-3 w-3" />
                    {breachRate.toFixed(0)}% breached
                  </Badge>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                  <div>
                    <p className="text-[10px] uppercase">Tickets</p>
                    <p className="text-foreground font-medium">{a.total}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase">Avg elapsed</p>
                    <p className="text-foreground font-medium">
                      {fmtDuration(a.avgElapsedMin)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase">Avg remaining</p>
                    <p className="text-foreground font-medium">
                      {fmtDuration(a.avgRemainingMin)}
                    </p>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
