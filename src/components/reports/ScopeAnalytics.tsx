import { Card } from "@/components/ui/card";

type Tone = "primary" | "success" | "warning" | "destructive" | "info" | "accent" | "secondary" | "muted";

const toneClass: Record<Tone, string> = {
  primary: "bg-primary/10 text-primary",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  destructive: "bg-destructive/10 text-destructive",
  info: "bg-info/10 text-info",
  accent: "bg-accent/10 text-accent-foreground",
  secondary: "bg-secondary/10 text-secondary-foreground",
  muted: "bg-muted text-muted-foreground",
};

export function ScopeStat({ label, value, tone = "primary" }: { label: string; value: number | string; tone?: Tone }) {
  return (
    <div className={`p-3 rounded-lg text-center ${toneClass[tone]}`}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}

export function ScopePanel({
  title, stats, breakdown,
}: {
  title: string;
  stats: { label: string; value: number | string; tone?: Tone }[];
  breakdown: Record<string, number>;
}) {
  const entries = Object.entries(breakdown);
  return (
    <div className="space-y-4">
      <Card className="p-4">
        <h3 className="text-lg font-semibold mb-3">{title}</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {stats.map((s) => (
            <ScopeStat key={s.label} label={s.label} value={s.value} tone={s.tone} />
          ))}
        </div>
      </Card>
      {entries.length > 0 && (
        <Card className="p-4">
          <h4 className="text-sm font-medium mb-3 text-muted-foreground">Breakdown by status</h4>
          <div className="space-y-2">
            {entries.map(([k, v]) => {
              const total = entries.reduce((a, [, n]) => a + n, 0);
              const pct = Math.round((v / Math.max(1, total)) * 100);
              return (
                <div key={k}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="capitalize">{k.replace(/_/g, " ")}</span>
                    <span className="text-muted-foreground">{v} · {pct}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}

export function statusBreakdown<T extends { status?: string | null }>(rows: T[]) {
  return countBy(rows, (r) => (r as any).status || "unknown");
}

export function countBy<T>(rows: T[], pick: (row: T) => string) {
  const map: Record<string, number> = {};
  for (const r of rows) {
    const k = pick(r);
    map[k] = (map[k] ?? 0) + 1;
  }
  return map;
}

type HelpdeskRow = {
  id: string;
  ticket_type: string | null;
  status: string | null;
  priority: string | null;
  created_at: string;
  first_response_at: string | null;
  resolved_at: string | null;
  sla_response_breached: boolean | null;
  sla_resolution_breached: boolean | null;
  csat_rating: number | null;
};

export function HelpdeskAnalytics({ tickets }: { tickets: HelpdeskRow[] }) {
  const open = tickets.filter((t) => !["resolved", "closed", "cancelled"].includes(t.status ?? ""));
  const resolved = tickets.filter((t) => t.resolved_at);
  const respBreaches = tickets.filter((t) => t.sla_response_breached).length;
  const resolBreaches = tickets.filter((t) => t.sla_resolution_breached).length;
  const respondedCount = tickets.filter((t) => t.first_response_at).length;
  const slaResponsePct = respondedCount
    ? Math.round((1 - respBreaches / Math.max(1, respondedCount)) * 100)
    : 100;
  const slaResolutionPct = resolved.length
    ? Math.round((1 - resolBreaches / Math.max(1, resolved.length)) * 100)
    : 100;
  const csatRated = tickets.filter((t) => typeof t.csat_rating === "number");
  const csatAvg = csatRated.length
    ? (csatRated.reduce((a, t) => a + (t.csat_rating ?? 0), 0) / csatRated.length).toFixed(1)
    : "—";
  const mttrMs = resolved.length
    ? resolved.reduce(
        (acc, t) => acc + (new Date(t.resolved_at!).getTime() - new Date(t.created_at).getTime()),
        0,
      ) / resolved.length
    : 0;
  const mttrHours = mttrMs ? (mttrMs / 3600_000).toFixed(1) : "—";

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <h3 className="text-lg font-semibold mb-3">Service Desk KPIs</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <ScopeStat label="Total Tickets" value={tickets.length} tone="primary" />
          <ScopeStat label="Open" value={open.length} tone="warning" />
          <ScopeStat label="Resolved" value={resolved.length} tone="success" />
          <ScopeStat label="Resp. SLA Met" value={`${slaResponsePct}%`} tone={slaResponsePct >= 90 ? "success" : "warning"} />
          <ScopeStat label="Resol. SLA Met" value={`${slaResolutionPct}%`} tone={slaResolutionPct >= 90 ? "success" : "warning"} />
          <ScopeStat label="MTTR (hrs)" value={mttrHours} tone="info" />
        </div>
      </Card>
      <div className="grid gap-4 md:grid-cols-3">
        <BreakdownCard title="By type" data={countBy(tickets, (t) => t.ticket_type ?? "unknown")} />
        <BreakdownCard title="By priority" data={countBy(tickets, (t) => t.priority ?? "unknown")} />
        <BreakdownCard title="By status" data={countBy(tickets, (t) => t.status ?? "unknown")} />
      </div>
      <Card className="p-4">
        <h4 className="text-sm font-medium text-muted-foreground">CSAT</h4>
        <p className="text-3xl font-bold mt-1">{csatAvg}{csatAvg !== "—" && <span className="text-sm text-muted-foreground"> / 5</span>}</p>
        <p className="text-xs text-muted-foreground mt-1">{csatRated.length} ratings collected</p>
      </Card>
    </div>
  );
}

type ChangeRow = {
  id: string;
  status: string | null;
  change_type: string | null;
  impact: string | null;
  urgency: string | null;
  risk_score: number | null;
  downtime_required: boolean | null;
  downtime_minutes: number | null;
  planned_end_at: string | null;
  actual_end_at: string | null;
  created_at: string;
};

export function ChangeAnalytics({ changes }: { changes: ChangeRow[] }) {
  const open = changes.filter((c) => !["closed", "implemented", "rejected", "cancelled"].includes(c.status ?? ""));
  const implemented = changes.filter((c) => c.status === "implemented" || c.status === "closed");
  const emergency = changes.filter((c) => c.change_type === "emergency");
  const overdue = changes.filter(
    (c) => c.planned_end_at && !c.actual_end_at && new Date(c.planned_end_at) < new Date() &&
      !["closed", "implemented", "rejected", "cancelled"].includes(c.status ?? ""),
  );
  const downtimeMins = changes.reduce((a, c) => a + (c.downtime_required ? (c.downtime_minutes ?? 0) : 0), 0);
  const avgRisk = changes.length
    ? Math.round(changes.reduce((a, c) => a + (c.risk_score ?? 0), 0) / changes.length)
    : 0;

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <h3 className="text-lg font-semibold mb-3">Change Management KPIs</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <ScopeStat label="Total Changes" value={changes.length} tone="primary" />
          <ScopeStat label="In Flight" value={open.length} tone="warning" />
          <ScopeStat label="Implemented" value={implemented.length} tone="success" />
          <ScopeStat label="Emergency" value={emergency.length} tone="destructive" />
          <ScopeStat label="Overdue" value={overdue.length} tone={overdue.length ? "destructive" : "muted"} />
          <ScopeStat label="Avg Risk" value={avgRisk} tone="info" />
        </div>
      </Card>
      <div className="grid gap-4 md:grid-cols-3">
        <BreakdownCard title="By type" data={countBy(changes, (c) => c.change_type ?? "unknown")} />
        <BreakdownCard title="By status" data={countBy(changes, (c) => c.status ?? "unknown")} />
        <BreakdownCard title="By impact" data={countBy(changes, (c) => c.impact ?? "unknown")} />
      </div>
      <Card className="p-4">
        <h4 className="text-sm font-medium text-muted-foreground">Planned downtime exposure</h4>
        <p className="text-3xl font-bold mt-1">{downtimeMins} <span className="text-sm text-muted-foreground">minutes</span></p>
        <p className="text-xs text-muted-foreground mt-1">
          Across {changes.filter((c) => c.downtime_required).length} changes flagged as requiring downtime.
        </p>
      </Card>
    </div>
  );
}

function BreakdownCard({ title, data }: { title: string; data: Record<string, number> }) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((a, [, n]) => a + n, 0);
  if (entries.length === 0) {
    return (
      <Card className="p-4">
        <h4 className="text-sm font-medium text-muted-foreground mb-2">{title}</h4>
        <p className="text-xs text-muted-foreground">No data.</p>
      </Card>
    );
  }
  return (
    <Card className="p-4">
      <h4 className="text-sm font-medium text-muted-foreground mb-3">{title}</h4>
      <div className="space-y-2">
        {entries.map(([k, v]) => {
          const pct = Math.round((v / Math.max(1, total)) * 100);
          return (
            <div key={k}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="capitalize">{k.replace(/_/g, " ")}</span>
                <span className="text-muted-foreground">{v} · {pct}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
