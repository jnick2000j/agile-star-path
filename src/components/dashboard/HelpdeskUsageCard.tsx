import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Headphones, Users, GitPullRequest, ArrowUpRight, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { usePlanFeatures } from "@/hooks/usePlanFeatures";

interface UsageRow {
  key: string;
  label: string;
  icon: typeof Headphones;
  used: number;
  limit: number;
  unit: string;
  enabled: boolean;
}

const startOfMonthISO = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
};

export function HelpdeskUsageCard() {
  const { currentOrganization } = useOrganization();
  const { features, hasFeature, getLimit, loading: featuresLoading } = usePlanFeatures();
  const [usage, setUsage] = useState<{ tickets: number; agents: number; approvers: number } | null>(null);
  const [loading, setLoading] = useState(true);

  const helpdeskOn = hasFeature("feature_helpdesk");
  const cmOn = hasFeature("feature_change_management");

  useEffect(() => {
    if (!currentOrganization?.id || featuresLoading) return;
    if (!helpdeskOn && !cmOn) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    const fetchUsage = async () => {
      setLoading(true);
      const startOfMonth = startOfMonthISO();

      const [ticketsRes, agentsRes, approversRes] = await Promise.all([
        helpdeskOn
          ? supabase
              .from("helpdesk_tickets")
              .select("id", { count: "exact", head: true })
              .eq("organization_id", currentOrganization.id)
              .gte("created_at", startOfMonth)
          : Promise.resolve({ count: 0 } as any),
        helpdeskOn
          ? supabase
              .from("helpdesk_tickets")
              .select("assigned_to")
              .eq("organization_id", currentOrganization.id)
              .not("assigned_to", "is", null)
          : Promise.resolve({ data: [] as any[] } as any),
        cmOn
          ? supabase
              .from("change_management_approvals")
              .select("approver_id")
              .eq("organization_id", currentOrganization.id)
              .not("approver_id", "is", null)
          : Promise.resolve({ data: [] as any[] } as any),
      ]);

      if (cancelled) return;

      const distinctAgents = new Set(
        (agentsRes.data || []).map((r: any) => r.assigned_to).filter(Boolean),
      ).size;
      const distinctApprovers = new Set(
        (approversRes.data || []).map((r: any) => r.approver_id).filter(Boolean),
      ).size;

      setUsage({
        tickets: ticketsRes.count ?? 0,
        agents: distinctAgents,
        approvers: distinctApprovers,
      });
      setLoading(false);
    };

    fetchUsage();
    return () => {
      cancelled = true;
    };
  }, [currentOrganization?.id, helpdeskOn, cmOn, featuresLoading]);

  // Hide entirely if neither module is enabled
  if (!featuresLoading && !helpdeskOn && !cmOn) return null;

  const rows: UsageRow[] = [
    {
      key: "agents",
      label: "Helpdesk agents",
      icon: Users,
      used: usage?.agents ?? 0,
      limit: getLimit("helpdesk_max_agents"),
      unit: "agents",
      enabled: helpdeskOn,
    },
    {
      key: "tickets",
      label: "Tickets this month",
      icon: Headphones,
      used: usage?.tickets ?? 0,
      limit: getLimit("helpdesk_max_tickets_per_month"),
      unit: "tickets",
      enabled: helpdeskOn,
    },
    {
      key: "approvers",
      label: "CAB approvers",
      icon: GitPullRequest,
      used: usage?.approvers ?? 0,
      limit: getLimit("cm_max_approvers"),
      unit: "approvers",
      enabled: cmOn,
    },
  ].filter((r) => r.enabled);

  const anyOver = rows.some((r) => r.limit > 0 && r.limit !== -1 && r.used >= r.limit);
  const anyNear = rows.some((r) => {
    if (r.limit <= 0 || r.limit === -1) return false;
    return r.used / r.limit >= 0.8 && r.used < r.limit;
  });

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-md bg-primary/10">
            <Headphones className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">Service desk usage</h3>
            <p className="text-xs text-muted-foreground">
              {helpdeskOn && cmOn
                ? "Helpdesk + Change Management"
                : helpdeskOn
                ? "Helpdesk module"
                : "Change Management module"}
            </p>
          </div>
        </div>
        {anyOver ? (
          <Badge variant="destructive" className="text-[10px]">Over limit</Badge>
        ) : anyNear ? (
          <Badge variant="secondary" className="text-[10px] bg-warning/15 text-warning hover:bg-warning/15">
            Approaching limit
          </Badge>
        ) : (
          <Badge variant="secondary" className="text-[10px]">Healthy</Badge>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-4">
          {rows.map((row) => {
            const unlimited = row.limit === -1;
            const limit = unlimited ? Infinity : row.limit;
            const pct = unlimited || limit === 0 ? 0 : Math.min(100, Math.round((row.used / limit) * 100));
            const over = !unlimited && row.used >= limit;
            const near = !unlimited && !over && pct >= 80;
            const Icon = row.icon;
            return (
              <div key={row.key}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-medium">
                    <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>{row.label}</span>
                  </div>
                  <span
                    className={`text-xs font-medium ${
                      over ? "text-destructive" : near ? "text-warning" : "text-muted-foreground"
                    }`}
                  >
                    {row.used.toLocaleString()}
                    <span className="text-muted-foreground">
                      {" / "}
                      {unlimited ? "∞" : row.limit.toLocaleString()}
                    </span>
                  </span>
                </div>
                <Progress
                  value={unlimited ? 0 : pct}
                  className={`h-1.5 ${
                    over
                      ? "[&>div]:bg-destructive"
                      : near
                      ? "[&>div]:bg-warning"
                      : "[&>div]:bg-primary"
                  }`}
                />
              </div>
            );
          })}
        </div>
      )}

      {(anyOver || anyNear) && (
        <div className="mt-4 pt-4 border-t">
          <Button asChild variant="outline" size="sm" className="w-full gap-1.5">
            <Link to="/billing">
              {anyOver ? "Upgrade to keep working" : "Review plan & upgrade"}
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      )}
    </Card>
  );
}
