import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2, ExternalLink } from "lucide-react";

export type CustomWidgetType = "note" | "links" | "metric";

export interface CustomWidget {
  id: string;
  title: string;
  widget_type: CustomWidgetType;
  config: any;
  position: number;
}

// Allow-list of entities a user can build a metric for.
// Grouped by platform area so users can pin a counter for almost anything they have access to.
export const METRIC_ENTITIES: Record<string, { label: string; group: string; statusField?: string }> = {
  // Delivery
  programmes:               { label: "Programmes",              group: "Delivery", statusField: "status" },
  projects:                 { label: "Projects",                group: "Delivery", statusField: "status" },
  products:                 { label: "Products",                group: "Delivery", statusField: "status" },
  work_packages:            { label: "Work Packages",           group: "Delivery", statusField: "status" },
  milestones:               { label: "Milestones",              group: "Delivery", statusField: "status" },
  stage_gates:              { label: "Stage Gates",             group: "Delivery", statusField: "status" },
  sprints:                  { label: "Sprints",                 group: "Delivery", statusField: "status" },
  tranches:                 { label: "Programme Tranches",      group: "Delivery", statusField: "status" },

  // Registers
  risks:                    { label: "Risks",                   group: "Registers", statusField: "status" },
  issues:                   { label: "Issues",                  group: "Registers", statusField: "status" },
  exceptions:               { label: "Exceptions",              group: "Registers", statusField: "status" },
  lessons_learned:          { label: "Lessons Learned",         group: "Registers" },
  stakeholders:             { label: "Stakeholders",            group: "Registers" },
  benefits:                 { label: "Benefits",                group: "Registers" },
  business_requirements:    { label: "Business Requirements",   group: "Registers", statusField: "status" },
  technical_requirements:   { label: "Technical Requirements",  group: "Registers", statusField: "status" },

  // Tasks & planning
  tasks:                    { label: "Tasks",                   group: "Tasks", statusField: "status" },
  daily_logs:               { label: "Daily Logs",              group: "Tasks" },
  punch_list_items:         { label: "Punch List Items",        group: "Tasks", statusField: "status" },
  rfis:                     { label: "RFIs",                    group: "Tasks", statusField: "status" },
  submittals:               { label: "Submittals",              group: "Tasks", statusField: "status" },

  // Service Management
  helpdesk_tickets:         { label: "Helpdesk Tickets",        group: "Service Management", statusField: "status" },
  change_requests:          { label: "Change Requests",         group: "Service Management", statusField: "status" },
  problems:                 { label: "Problems",                group: "Service Management", statusField: "status" },
  major_incidents:          { label: "Major Incidents",         group: "Service Management", statusField: "status" },
  configuration_items:      { label: "Configuration Items",     group: "Service Management", statusField: "status" },
  assets:                   { label: "Assets",                  group: "Service Management", statusField: "status" },
  asset_contracts:          { label: "Asset Contracts",         group: "Service Management", statusField: "status" },

  // Engagements
  client_engagements:       { label: "Client Engagements",      group: "Engagements", statusField: "status" },
  retainers:                { label: "Retainers",               group: "Engagements", statusField: "status" },

  // Knowledge & Learning
  kb_articles:              { label: "KB Articles",             group: "Knowledge", statusField: "status" },
  lms_courses:              { label: "Courses",                 group: "Knowledge", statusField: "status" },
  lms_enrollments:          { label: "Course Enrollments",      group: "Knowledge", statusField: "status" },
  lms_certificates:         { label: "Certificates Issued",     group: "Knowledge" },

  // Automation & AI
  automation_workflows:     { label: "Automation Workflows",    group: "Automation", statusField: "status" },
  automation_runs:          { label: "Automation Runs",         group: "Automation", statusField: "status" },
  cm_workflows:             { label: "Change Workflows",        group: "Automation", statusField: "status" },
  helpdesk_workflows:       { label: "Helpdesk Workflows",      group: "Automation", statusField: "status" },
  ai_insights:              { label: "AI Insights",             group: "Automation", statusField: "status" },

  // Governance
  approval_evidence:        { label: "Approvals Evidence",      group: "Governance" },
  governance_reports:       { label: "Governance Reports",      group: "Governance" },
  compliance_attestations:  { label: "Compliance Attestations", group: "Governance", statusField: "status" },
  documents:                { label: "Documents",               group: "Governance" },
  csat_responses:           { label: "CSAT Responses",          group: "Governance" },
};

function MetricBody({ config }: { config: any }) {
  const entity = config?.entity as string | undefined;
  const statusFilter = config?.status as string | undefined;
  const { data, isLoading } = useQuery({
    queryKey: ["custom-widget-metric", entity, statusFilter],
    enabled: !!entity && entity in METRIC_ENTITIES,
    queryFn: async () => {
      let q = (supabase as any).from(entity).select("id", { count: "exact", head: true });
      if (statusFilter) q = q.eq(METRIC_ENTITIES[entity!].statusField || "status", statusFilter);
      const { count, error } = await q;
      if (error) throw error;
      return count ?? 0;
    },
  });
  if (!entity || !(entity in METRIC_ENTITIES)) {
    return <p className="text-sm text-muted-foreground">No entity selected.</p>;
  }
  return (
    <div>
      <p className="text-3xl font-bold">{isLoading ? "…" : data}</p>
      <p className="text-xs text-muted-foreground mt-1">
        {METRIC_ENTITIES[entity].label}
        {statusFilter ? ` · ${statusFilter}` : ""}
      </p>
    </div>
  );
}

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
    <Card>
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
        {widget.widget_type === "metric" && <MetricBody config={widget.config} />}
      </CardContent>
    </Card>
  );
}
