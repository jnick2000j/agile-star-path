import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2, ExternalLink, User, ChevronRight } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";

export type CustomWidgetType = "note" | "links" | "metric" | "list" | "chart" | "composite";

/** Sub-item kinds usable inside a composite widget. */
export type CompositeItemKind = "metric" | "chart" | "list" | "note" | "links";
export interface CompositeItem {
  label?: string;
  kind: CompositeItemKind;
  config: any;
}

export interface CustomWidget {
  id: string;
  title: string;
  widget_type: CustomWidgetType;
  config: any;
  position: number;
}

// Allow-list of entities a user can build a metric/list/chart for.
// `ownerField` is the column used when the widget is filtered to "only mine".
// `titleField` is the human-readable display column for drill-down rows.
export const METRIC_ENTITIES: Record<
  string,
  { label: string; group: string; statusField?: string; ownerField?: string; titleField?: string }
> = {
  // Delivery
  programmes:               { label: "Programmes",              group: "Delivery", statusField: "status", ownerField: "manager_id", titleField: "name" },
  projects:                 { label: "Projects",                group: "Delivery", statusField: "status", ownerField: "manager_id", titleField: "name" },
  products:                 { label: "Products",                group: "Delivery", statusField: "status", ownerField: "created_by",  titleField: "name" },
  work_packages:            { label: "Work Packages",           group: "Delivery", statusField: "status", ownerField: "assigned_to", titleField: "name" },
  milestones:               { label: "Milestones",              group: "Delivery", statusField: "status", ownerField: "owner_id",    titleField: "name" },
  stage_gates:              { label: "Stage Gates",             group: "Delivery", statusField: "status", titleField: "name" },
  sprints:                  { label: "Sprints",                 group: "Delivery", statusField: "status", titleField: "name" },
  tranches:                 { label: "Programme Tranches",      group: "Delivery", statusField: "status", titleField: "name" },

  // Registers
  risks:                    { label: "Risks",                   group: "Registers", statusField: "status", ownerField: "owner_id", titleField: "title" },
  issues:                   { label: "Issues",                  group: "Registers", statusField: "status", ownerField: "owner_id", titleField: "title" },
  exceptions:               { label: "Exceptions",              group: "Registers", statusField: "status", ownerField: "owner_id", titleField: "title" },
  lessons_learned:          { label: "Lessons Learned",         group: "Registers", ownerField: "owner_id", titleField: "title" },
  stakeholders:             { label: "Stakeholders",            group: "Registers", ownerField: "created_by", titleField: "name" },
  benefits:                 { label: "Benefits",                group: "Registers", titleField: "name" },
  business_requirements:    { label: "Business Requirements",   group: "Registers", statusField: "status", ownerField: "owner_id", titleField: "name" },
  technical_requirements:   { label: "Technical Requirements",  group: "Registers", statusField: "status", ownerField: "owner_id", titleField: "name" },

  // Tasks & planning
  tasks:                    { label: "Tasks",                   group: "Tasks", statusField: "status", ownerField: "assigned_to", titleField: "name" },
  daily_logs:               { label: "Daily Logs",              group: "Tasks", ownerField: "created_by" },
  punch_list_items:         { label: "Punch List Items",        group: "Tasks", statusField: "status", ownerField: "assigned_to" },
  rfis:                     { label: "RFIs",                    group: "Tasks", statusField: "status", ownerField: "assigned_to", titleField: "subject" },
  submittals:               { label: "Submittals",              group: "Tasks", statusField: "status", titleField: "title" },

  // Service Management
  helpdesk_tickets:         { label: "Helpdesk Tickets",        group: "Service Management", statusField: "status", ownerField: "assignee_id", titleField: "subject" },
  change_requests:          { label: "Change Requests",         group: "Service Management", statusField: "status", ownerField: "owner_id",    titleField: "title" },
  problems:                 { label: "Problems",                group: "Service Management", statusField: "status", ownerField: "assignee_id", titleField: "title" },
  major_incidents:          { label: "Major Incidents",         group: "Service Management", statusField: "status", ownerField: "created_by",  titleField: "title" },
  configuration_items:      { label: "Configuration Items",     group: "Service Management", statusField: "status", titleField: "name" },
  assets:                   { label: "Assets",                  group: "Service Management", statusField: "status", titleField: "name" },
  asset_contracts:          { label: "Asset Contracts",         group: "Service Management", statusField: "status", titleField: "name" },

  // Engagements
  client_engagements:       { label: "Client Engagements",      group: "Engagements", statusField: "status" },
  retainers:                { label: "Retainers",               group: "Engagements", statusField: "status" },

  // Knowledge & Learning
  kb_articles:              { label: "KB Articles",             group: "Knowledge", statusField: "status", titleField: "title" },
  lms_courses:              { label: "Courses",                 group: "Knowledge", statusField: "status", titleField: "title" },
  lms_enrollments:          { label: "Course Enrollments",      group: "Knowledge", statusField: "status", ownerField: "user_id" },
  lms_certificates:         { label: "Certificates Issued",     group: "Knowledge", ownerField: "user_id" },

  // Automation & AI
  automation_workflows:     { label: "Automation Workflows",    group: "Automation", statusField: "status", titleField: "name" },
  automation_runs:          { label: "Automation Runs",         group: "Automation", statusField: "status" },
  cm_workflows:             { label: "Change Workflows",        group: "Automation", statusField: "status", titleField: "name" },
  helpdesk_workflows:       { label: "Helpdesk Workflows",      group: "Automation", statusField: "status", titleField: "name" },
  ai_insights:              { label: "AI Insights",             group: "Automation", statusField: "status", titleField: "title" },

  // Governance
  approval_evidence:        { label: "Approvals Evidence",      group: "Governance" },
  governance_reports:       { label: "Governance Reports",      group: "Governance", titleField: "title" },
  compliance_attestations:  { label: "Compliance Attestations", group: "Governance", statusField: "status" },
  documents:                { label: "Documents",               group: "Governance", titleField: "name" },
  csat_responses:           { label: "CSAT Responses",          group: "Governance" },
};

// Build a Supabase query with shared filters.
function applyFilters(
  q: any,
  meta: { statusField?: string; ownerField?: string },
  opts: { status?: string; mine?: boolean; userId?: string },
) {
  if (opts.status && meta.statusField) q = q.eq(meta.statusField, opts.status);
  if (opts.mine && meta.ownerField && opts.userId) q = q.eq(meta.ownerField, opts.userId);
  return q;
}

// ----- Drill-down dialog ---------------------------------------------------

function DrillDownDialog({
  open, onOpenChange, entity, status, mine, title,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  entity: string;
  status?: string;
  mine?: boolean;
  title: string;
}) {
  const { user } = useAuth();
  const meta = METRIC_ENTITIES[entity];
  const titleField = meta?.titleField;
  const statusField = meta?.statusField;

  const { data, isLoading } = useQuery({
    queryKey: ["widget-drilldown", entity, status, mine, user?.id, titleField, statusField],
    enabled: open && !!meta,
    queryFn: async () => {
      const cols = ["id", "created_at"];
      if (titleField) cols.push(titleField);
      if (statusField) cols.push(statusField);
      let q = (supabase as any).from(entity).select(cols.join(","));
      q = applyFilters(q, meta!, { status, mine, userId: user?.id });
      q = q.order("created_at", { ascending: false }).limit(100);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto">
          {isLoading ? (
            <p className="text-sm text-muted-foreground p-4">Loading…</p>
          ) : !data || data.length === 0 ? (
            <p className="text-sm text-muted-foreground p-4">No records found.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{titleField ? "Name" : "ID"}</TableHead>
                  {statusField ? <TableHead>Status</TableHead> : null}
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">
                      {titleField ? (r[titleField] || "—") : r.id.slice(0, 8)}
                    </TableCell>
                    {statusField ? (
                      <TableCell className="text-muted-foreground">{r[statusField] || "—"}</TableCell>
                    ) : null}
                    <TableCell className="text-muted-foreground text-xs">
                      {r.created_at ? new Date(r.created_at).toLocaleDateString() : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
        <p className="text-xs text-muted-foreground">Showing up to 100 most recent matching records.</p>
      </DialogContent>
    </Dialog>
  );
}

// ----- Metric widget (clickable to drill down) -----------------------------

function MetricBody({ widgetTitle, config }: { widgetTitle: string; config: any }) {
  const { user } = useAuth();
  const [drillOpen, setDrillOpen] = useState(false);
  const entity = config?.entity as string | undefined;
  const statusFilter = config?.status as string | undefined;
  const mineOnly = !!config?.mine;
  const meta = entity ? METRIC_ENTITIES[entity] : undefined;
  const ownerField = meta?.ownerField;
  const canFilterMine = mineOnly && !!ownerField && !!user;

  const { data, isLoading } = useQuery({
    queryKey: ["custom-widget-metric", entity, statusFilter, mineOnly, user?.id],
    enabled: !!entity && entity in METRIC_ENTITIES && (!mineOnly || !!user),
    queryFn: async () => {
      let q = (supabase as any).from(entity).select("id", { count: "exact", head: true });
      q = applyFilters(q, meta!, { status: statusFilter, mine: mineOnly, userId: user?.id });
      const { count, error } = await q;
      if (error) throw error;
      return count ?? 0;
    },
  });
  if (!entity || !meta) {
    return <p className="text-sm text-muted-foreground">No entity selected.</p>;
  }
  return (
    <>
      <button
        type="button"
        onClick={() => setDrillOpen(true)}
        className="text-left group/metric"
        title="Click to drill down"
      >
        <p className="text-3xl font-bold group-hover/metric:text-primary transition-colors">
          {isLoading ? "…" : data}
        </p>
        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5 flex-wrap">
          <span>{meta.label}</span>
          {statusFilter ? <span>· {statusFilter}</span> : null}
          {mineOnly ? (
            <span className="inline-flex items-center gap-1 text-primary">
              <User className="h-3 w-3" /> mine
            </span>
          ) : null}
          {mineOnly && !ownerField ? (
            <span className="text-warning">(no owner field)</span>
          ) : null}
          <ChevronRight className="h-3 w-3 opacity-0 group-hover/metric:opacity-100 transition-opacity" />
        </p>
      </button>
      <DrillDownDialog
        open={drillOpen}
        onOpenChange={setDrillOpen}
        entity={entity}
        status={statusFilter}
        mine={canFilterMine}
        title={widgetTitle}
      />
    </>
  );
}

// ----- List widget --------------------------------------------------------

function ListBody({ widgetTitle, config }: { widgetTitle: string; config: any }) {
  const { user } = useAuth();
  const [drillOpen, setDrillOpen] = useState(false);
  const entity = config?.entity as string | undefined;
  const statusFilter = config?.status as string | undefined;
  const mineOnly = !!config?.mine;
  const limit = Math.max(1, Math.min(20, Number(config?.limit) || 5));
  const meta = entity ? METRIC_ENTITIES[entity] : undefined;
  const titleField = meta?.titleField;

  const { data, isLoading } = useQuery({
    queryKey: ["custom-widget-list", entity, statusFilter, mineOnly, limit, user?.id],
    enabled: !!entity && !!meta && (!mineOnly || !!user),
    queryFn: async () => {
      const cols = ["id", "created_at"];
      if (titleField) cols.push(titleField);
      if (meta!.statusField) cols.push(meta!.statusField);
      let q = (supabase as any).from(entity).select(cols.join(","));
      q = applyFilters(q, meta!, { status: statusFilter, mine: mineOnly, userId: user?.id });
      q = q.order("created_at", { ascending: false }).limit(limit);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  if (!entity || !meta) {
    return <p className="text-sm text-muted-foreground">No entity selected.</p>;
  }
  return (
    <>
      <div className="space-y-1">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : !data || data.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">No items.</p>
        ) : (
          <ul className="divide-y -mx-1">
            {data.map((r: any) => (
              <li key={r.id} className="px-1 py-1.5 text-sm flex items-center justify-between gap-2">
                <span className="truncate">{titleField ? (r[titleField] || "—") : r.id.slice(0, 8)}</span>
                {meta.statusField && r[meta.statusField] ? (
                  <span className="text-xs text-muted-foreground shrink-0">{r[meta.statusField]}</span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs gap-1"
          onClick={() => setDrillOpen(true)}
        >
          View all <ChevronRight className="h-3 w-3" />
        </Button>
      </div>
      <DrillDownDialog
        open={drillOpen}
        onOpenChange={setDrillOpen}
        entity={entity}
        status={statusFilter}
        mine={mineOnly && !!meta.ownerField && !!user}
        title={widgetTitle}
      />
    </>
  );
}

// ----- Chart widget -------------------------------------------------------

const CHART_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--info))",
  "hsl(var(--success))",
  "hsl(var(--warning))",
  "hsl(var(--destructive))",
  "hsl(var(--accent))",
];

function ChartBody({ widgetTitle, config }: { widgetTitle: string; config: any }) {
  const { user } = useAuth();
  const [drillStatus, setDrillStatus] = useState<string | null>(null);
  const entity = config?.entity as string | undefined;
  const mineOnly = !!config?.mine;
  const meta = entity ? METRIC_ENTITIES[entity] : undefined;
  const groupField = meta?.statusField;

  const { data, isLoading } = useQuery({
    queryKey: ["custom-widget-chart", entity, mineOnly, user?.id],
    enabled: !!entity && !!meta && !!groupField && (!mineOnly || !!user),
    queryFn: async () => {
      let q = (supabase as any).from(entity).select(`id, ${groupField}`);
      q = applyFilters(q, meta!, { mine: mineOnly, userId: user?.id });
      q = q.limit(1000);
      const { data, error } = await q;
      if (error) throw error;
      const counts = new Map<string, number>();
      for (const row of (data || []) as any[]) {
        const k = (row as any)[groupField!] || "—";
        counts.set(k, (counts.get(k) || 0) + 1);
      }
      return Array.from(counts.entries()).map(([name, value]) => ({ name, value }));
    },
  });

  if (!entity || !meta) return <p className="text-sm text-muted-foreground">No entity selected.</p>;
  if (!groupField) {
    return <p className="text-sm text-muted-foreground">This entity has no status field to chart.</p>;
  }

  return (
    <>
      <div className="h-48 w-full">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : !data || data.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">No data.</p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 6,
                  fontSize: 12,
                }}
              />
              <Bar
                dataKey="value"
                cursor="pointer"
                onClick={(d: any) => setDrillStatus(d?.name ?? null)}
                radius={[4, 4, 0, 0]}
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
      <p className="text-xs text-muted-foreground mt-1">Click a bar to drill down.</p>
      <DrillDownDialog
        open={drillStatus !== null}
        onOpenChange={(b) => !b && setDrillStatus(null)}
        entity={entity}
        status={drillStatus || undefined}
        mine={mineOnly && !!meta.ownerField && !!user}
        title={`${widgetTitle} — ${drillStatus ?? ""}`}
      />
    </>
  );
}

// ----- Note / Links bodies (unchanged) ------------------------------------

function NoteBody({ config }: { config: any }) {
  return (
    <p className="text-sm whitespace-pre-wrap text-foreground/90">
      {config?.text || <span className="text-muted-foreground italic">Empty note</span>}
    </p>
  );
}

function LinksBody({ config }: { config: any }) {
  const links = (config?.links as { label: string; url: string }[]) || [];
  if (!links.length) return <p className="text-sm text-muted-foreground italic">No links yet.</p>;
  return (
    <ul className="space-y-2">
      {links.map((l, i) => (
        <li key={i}>
          <a
            href={l.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary hover:underline inline-flex items-center gap-1"
          >
            <ExternalLink className="h-3 w-3" />
            {l.label || l.url}
          </a>
        </li>
      ))}
    </ul>
  );
}

// ----- Composite widget ---------------------------------------------------

function CompositeItemRenderer({ item, parentTitle }: { item: CompositeItem; parentTitle: string }) {
  const childTitle = item.label?.trim() || parentTitle;
  switch (item.kind) {
    case "metric": return <MetricBody widgetTitle={childTitle} config={item.config} />;
    case "list":   return <ListBody widgetTitle={childTitle} config={item.config} />;
    case "chart":  return <ChartBody widgetTitle={childTitle} config={item.config} />;
    case "note":   return <NoteBody config={item.config} />;
    case "links":  return <LinksBody config={item.config} />;
    default:       return null;
  }
}

function CompositeBody({ widgetTitle, config }: { widgetTitle: string; config: any }) {
  const items: CompositeItem[] = Array.isArray(config?.items) ? config.items : [];
  const columns = Math.max(1, Math.min(3, Number(config?.columns) || 2));
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground italic">No items in this composite widget yet.</p>;
  }
  const gridCls =
    columns === 1 ? "grid grid-cols-1 gap-4"
    : columns === 3 ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
    : "grid grid-cols-1 sm:grid-cols-2 gap-4";
  return (
    <div className={gridCls}>
      {items.map((item, i) => (
        <div key={i} className="rounded-md border bg-card p-3 space-y-1">
          {item.label ? (
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{item.label}</p>
          ) : null}
          <CompositeItemRenderer item={item} parentTitle={widgetTitle} />
        </div>
      ))}
    </div>
  );
}

export function CustomWidgetCard({
  widget,
  onEdit,
  onDelete,
}: {
  widget: CustomWidget;
  onEdit: (w: CustomWidget) => void;
  onDelete: (w: CustomWidget) => void;
}) {
  return (
    <Card className={widget.widget_type === "composite" ? "md:col-span-2" : undefined}>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <CardTitle className="text-base font-semibold">{widget.title}</CardTitle>
        <div className="flex gap-1">
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onEdit(widget)}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onDelete(widget)}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {widget.widget_type === "note" && <NoteBody config={widget.config} />}
        {widget.widget_type === "links" && <LinksBody config={widget.config} />}
        {widget.widget_type === "metric" && <MetricBody widgetTitle={widget.title} config={widget.config} />}
        {widget.widget_type === "list" && <ListBody widgetTitle={widget.title} config={widget.config} />}
        {widget.widget_type === "chart" && <ChartBody widgetTitle={widget.title} config={widget.config} />}
        {widget.widget_type === "composite" && <CompositeBody widgetTitle={widget.title} config={widget.config} />}
      </CardContent>
    </Card>
  );
}
