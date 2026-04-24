import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ArrowRight, LifeBuoy } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { usePlanFeatures } from "@/hooks/usePlanFeatures";
import { formatDistanceToNow } from "date-fns";

const statusTone: Record<string, string> = {
  open: "bg-info/15 text-info",
  in_progress: "bg-warning/15 text-warning",
  pending: "bg-muted text-muted-foreground",
  resolved: "bg-success/15 text-success",
  closed: "bg-muted text-muted-foreground",
};

const priorityTone: Record<string, string> = {
  urgent: "bg-destructive/15 text-destructive",
  high: "bg-warning/15 text-warning",
  medium: "bg-info/15 text-info",
  low: "bg-muted text-muted-foreground",
};

export function HelpdeskSummary() {
  const { currentOrganization } = useOrganization();
  const { hasFeature } = usePlanFeatures();
  const enabled = hasFeature("feature_helpdesk");

  const { data } = useQuery({
    queryKey: ["dashboard-helpdesk", currentOrganization?.id],
    enabled: !!currentOrganization?.id && enabled,
    queryFn: async () => {
      const orgId = currentOrganization!.id;
      const [openCount, urgentCount, recent] = await Promise.all([
        supabase
          .from("helpdesk_tickets")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", orgId)
          .in("status", ["new", "open", "pending"]),
        supabase
          .from("helpdesk_tickets")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", orgId)
          .eq("priority", "urgent")
          .neq("status", "closed"),
        supabase
          .from("helpdesk_tickets")
          .select("id, reference_number, subject, status, priority, created_at")
          .eq("organization_id", orgId)
          .order("created_at", { ascending: false })
          .limit(5),
      ]);
      return {
        open: openCount.count ?? 0,
        urgent: urgentCount.count ?? 0,
        recent: recent.data ?? [],
      };
    },
  });

  if (!enabled) return null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <LifeBuoy className="h-4 w-4 text-primary" />
          Helpdesk
        </CardTitle>
        <Button asChild variant="ghost" size="sm" className="h-7">
          <Link to="/support">
            View all <ArrowRight className="h-3 w-3 ml-1" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-md border bg-card p-3">
            <p className="text-xs text-muted-foreground">Open tickets</p>
            <p className="text-2xl font-semibold tabular-nums">{data?.open ?? 0}</p>
          </div>
          <div className="rounded-md border bg-card p-3">
            <p className="text-xs text-muted-foreground">Urgent</p>
            <p className="text-2xl font-semibold tabular-nums text-destructive">
              {data?.urgent ?? 0}
            </p>
          </div>
        </div>

        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">Recent tickets</p>
          {data?.recent.length ? (
            <ul className="space-y-1.5">
              {data.recent.map((t: any) => (
                <li key={t.id}>
                  <Link
                    to={`/support/${t.id}`}
                    className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent/50 transition-colors group"
                  >
                    <Badge
                      variant="outline"
                      className={`text-[10px] px-1.5 py-0 ${priorityTone[t.priority] || ""}`}
                    >
                      {t.priority}
                    </Badge>
                    <span className="text-sm truncate flex-1 group-hover:text-primary">
                      {t.reference_number ? `${t.reference_number} · ` : ""}
                      {t.subject}
                    </span>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {formatDistanceToNow(new Date(t.created_at), { addSuffix: true })}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No tickets yet.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
