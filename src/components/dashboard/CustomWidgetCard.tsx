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
export const METRIC_ENTITIES: Record<string, { label: string; statusField?: string }> = {
  programmes: { label: "Programmes", statusField: "status" },
  projects:   { label: "Projects",   statusField: "status" },
  products:   { label: "Products",   statusField: "status" },
  risks:      { label: "Risks",      statusField: "status" },
  issues:     { label: "Issues",     statusField: "status" },
  tasks:      { label: "Tasks",      statusField: "status" },
  milestones: { label: "Milestones", statusField: "status" },
  benefits:   { label: "Benefits" },
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
