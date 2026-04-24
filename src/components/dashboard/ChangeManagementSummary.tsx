import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ArrowRight, GitPullRequest } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { usePlanFeatures } from "@/hooks/usePlanFeatures";
import { formatDistanceToNow } from "date-fns";

const impactTone: Record<string, string> = {
  critical: "bg-destructive/15 text-destructive",
  high: "bg-warning/15 text-warning",
  medium: "bg-info/15 text-info",
  low: "bg-muted text-muted-foreground",
};

export function ChangeManagementSummary() {
  const { currentOrganization } = useOrganization();
  const { hasFeature } = usePlanFeatures();
  const enabled = hasFeature("feature_change_management");

  const { data } = useQuery({
    queryKey: ["dashboard-changes", currentOrganization?.id],
    enabled: !!currentOrganization?.id && enabled,
    queryFn: async () => {
      const orgId = currentOrganization!.id;
      const [pendingCount, scheduledCount, recent] = await Promise.all([
        supabase
          .from("change_management_requests")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", orgId)
          .in("status", ["submitted", "in_review", "cab_review"]),
        supabase
          .from("change_management_requests")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", orgId)
          .in("status", ["approved", "scheduled"]),
        supabase
          .from("change_management_requests")
          .select("id, reference_number, title, status, impact, planned_start_at, created_at")
          .eq("organization_id", orgId)
          .order("created_at", { ascending: false })
          .limit(5),
      ]);
      return {
        pending: pendingCount.count ?? 0,
        scheduled: scheduledCount.count ?? 0,
        recent: recent.data ?? [],
      };
    },
  });

  if (!enabled) return null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <GitPullRequest className="h-4 w-4 text-primary" />
          Change Management
        </CardTitle>
        <Button asChild variant="ghost" size="sm" className="h-7">
          <Link to="/change-management">
            View all <ArrowRight className="h-3 w-3 ml-1" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-md border bg-card p-3">
            <p className="text-xs text-muted-foreground">Pending approval</p>
            <p className="text-2xl font-semibold tabular-nums">{data?.pending ?? 0}</p>
          </div>
          <div className="rounded-md border bg-card p-3">
            <p className="text-xs text-muted-foreground">Scheduled</p>
            <p className="text-2xl font-semibold tabular-nums text-info">
              {data?.scheduled ?? 0}
            </p>
          </div>
        </div>

        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">Recent changes</p>
          {data?.recent.length ? (
            <ul className="space-y-1.5">
              {data.recent.map((c: any) => (
                <li key={c.id}>
                  <Link
                    to={`/change-management/${c.id}`}
                    className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent/50 transition-colors group"
                  >
                    <Badge
                      variant="outline"
                      className={`text-[10px] px-1.5 py-0 ${impactTone[c.impact] || ""}`}
                    >
                      {c.impact}
                    </Badge>
                    <span className="text-sm truncate flex-1 group-hover:text-primary">
                      {c.reference_number ? `${c.reference_number} · ` : ""}
                      {c.title}
                    </span>
                    <span className="text-xs text-muted-foreground shrink-0 capitalize">
                      {String(c.status).replace(/_/g, " ")}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No change requests yet.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
