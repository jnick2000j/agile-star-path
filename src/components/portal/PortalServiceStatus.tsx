import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertTriangle, AlertOctagon, Wrench, Activity, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { format } from "date-fns";

const STATUS_META: Record<string, { label: string; icon: any; color: string }> = {
  operational: { label: "Operational", icon: CheckCircle2, color: "text-success" },
  degraded: { label: "Degraded", icon: Activity, color: "text-warning" },
  partial_outage: { label: "Partial Outage", icon: AlertTriangle, color: "text-warning" },
  major_outage: { label: "Major Outage", icon: AlertOctagon, color: "text-destructive" },
  maintenance: { label: "Maintenance", icon: Wrench, color: "text-info" },
};

const IMPACT_STYLES: Record<string, string> = {
  none: "bg-muted",
  minor: "bg-info/10 text-info",
  major: "bg-warning/10 text-warning",
  critical: "bg-destructive text-destructive-foreground",
};

export function PortalServiceStatus() {
  const { currentOrganization } = useOrganization();

  const { data: components = [] } = useQuery({
    queryKey: ["portal-status-components", currentOrganization?.id],
    enabled: !!currentOrganization?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("status_page_components")
        .select("id, name, current_status, group_name, description")
        .eq("organization_id", currentOrganization!.id)
        .eq("is_public", true)
        .order("display_order", { ascending: true });
      return data ?? [];
    },
  });

  const { data: incidents = [] } = useQuery({
    queryKey: ["portal-status-incidents", currentOrganization?.id],
    enabled: !!currentOrganization?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("status_page_incidents")
        .select("id, title, impact, status, started_at")
        .eq("organization_id", currentOrganization!.id)
        .eq("is_published", true)
        .neq("status", "resolved")
        .order("started_at", { ascending: false })
        .limit(5);
      return data ?? [];
    },
  });

  const overallKey = components.length === 0
    ? "operational"
    : components.some((c: any) => c.current_status === "major_outage")
    ? "major_outage"
    : components.some((c: any) => ["partial_outage", "degraded"].includes(c.current_status))
    ? "degraded"
    : components.some((c: any) => c.current_status === "maintenance")
    ? "maintenance"
    : "operational";

  const meta = STATUS_META[overallKey];
  const Icon = meta.icon;
  const overallLabel = overallKey === "operational" ? "All systems operational" : meta.label;

  const degradedComponents = components.filter((c: any) => c.current_status !== "operational");

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold flex items-center gap-2">
          <Activity className="h-4 w-4" /> Service Status
        </h2>
        <Link to="/status" className="text-sm text-primary hover:underline flex items-center gap-1">
          Full status page <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      <div className={`flex items-center gap-2 text-base font-medium ${meta.color}`}>
        <Icon className="h-5 w-5" />
        {overallLabel}
      </div>

      {incidents.length > 0 && (
        <div className="mt-4 space-y-2">
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Active incidents
          </div>
          {incidents.map((i: any) => (
            <div key={i.id} className="flex items-center justify-between gap-2 rounded-md border border-l-4 border-l-destructive p-2 text-sm">
              <div className="min-w-0 flex-1">
                <div className="font-medium truncate">{i.title}</div>
                <div className="text-xs text-muted-foreground">
                  Started {format(new Date(i.started_at), "PP p")}
                </div>
              </div>
              <Badge className={IMPACT_STYLES[i.impact] ?? ""}>{i.impact}</Badge>
            </div>
          ))}
        </div>
      )}

      {degradedComponents.length > 0 && incidents.length === 0 && (
        <div className="mt-3 text-xs text-muted-foreground">
          {degradedComponents.length} component{degradedComponents.length === 1 ? "" : "s"} affected — see status page for details.
        </div>
      )}
    </Card>
  );
}
