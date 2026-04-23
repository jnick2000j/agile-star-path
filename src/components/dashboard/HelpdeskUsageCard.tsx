import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ArrowRight, LifeBuoy } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { usePlanFeatures } from "@/hooks/usePlanFeatures";

interface UsageRow {
  label: string;
  used: number;
  limit: number;
  enabled: boolean;
  href: string;
  linkLabel: string;
}

export function HelpdeskUsageCard() {
  const { currentOrganization } = useOrganization();
  const { hasFeature, getLimit } = usePlanFeatures();

  const helpdeskOn = hasFeature("feature_helpdesk");
  const cmOn = hasFeature("feature_change_management");

  const { data: usage } = useQuery({
    queryKey: ["helpdesk-usage", currentOrganization?.id],
    enabled: !!currentOrganization?.id && (helpdeskOn || cmOn),
    queryFn: async () => {
      const orgId = currentOrganization!.id;
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);

      const [tickets, agents, approvers] = await Promise.all([
        supabase
          .from("helpdesk_tickets")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", orgId)
          .gte("created_at", monthStart.toISOString()),
        supabase
          .from("helpdesk_tickets")
          .select("assigned_to")
          .eq("organization_id", orgId)
          .not("assigned_to", "is", null),
        supabase
          .from("change_management_approvals")
          .select("approver_id")
          .eq("organization_id", orgId)
          .not("approver_id", "is", null),
      ]);

      const uniqueAgents = new Set((agents.data ?? []).map((r: any) => r.assigned_to)).size;
      const uniqueApprovers = new Set((approvers.data ?? []).map((r: any) => r.approver_id)).size;

      return {
        tickets: tickets.count ?? 0,
        agents: uniqueAgents,
        approvers: uniqueApprovers,
      };
    },
  });

  if (!helpdeskOn && !cmOn) return null;

  const rows: UsageRow[] = [
    {
      label: "Helpdesk agents",
      used: usage?.agents ?? 0,
      limit: getLimit("helpdesk_max_agents"),
      enabled: helpdeskOn,
      href: "/team",
      linkLabel: "View agents",
    },
    {
      label: "Tickets this month",
      used: usage?.tickets ?? 0,
      limit: getLimit("helpdesk_max_tickets_per_month"),
      enabled: helpdeskOn,
      href: "/support",
      linkLabel: "View tickets",
    },
    {
      label: "CAB approvers",
      used: usage?.approvers ?? 0,
      limit: getLimit("cm_max_approvers"),
      enabled: cmOn,
      href: "/change-management",
      linkLabel: "View CAB approvals",
    },
  ].filter((r) => r.enabled);

  const statusFor = (used: number, limit: number) => {
    if (limit < 0) return { pct: 0, tone: "healthy" as const };
    if (limit === 0) return { pct: 100, tone: "over" as const };
    const pct = Math.min(100, Math.round((used / limit) * 100));
    if (used >= limit) return { pct, tone: "over" as const };
    if (pct >= 80) return { pct, tone: "warn" as const };
    return { pct, tone: "healthy" as const };
  };

  const toneClasses: Record<string, string> = {
    healthy: "[&>div]:bg-primary",
    warn: "[&>div]:bg-warning",
    over: "[&>div]:bg-destructive",
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <LifeBuoy className="h-4 w-4 text-primary" />
          Service desk usage
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {rows.map((row) => {
          const { pct, tone } = statusFor(row.used, row.limit);
          const limitLabel = row.limit < 0 ? "Unlimited" : row.limit;
          return (
            <div key={row.label} className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{row.label}</span>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground tabular-nums">
                    {row.used} / {limitLabel}
                  </span>
                  {tone === "warn" && <Badge variant="secondary">Approaching</Badge>}
                  {tone === "over" && <Badge variant="destructive">Over limit</Badge>}
                </div>
              </div>
              <Progress value={pct} className={toneClasses[tone]} />
              <div className="flex justify-end">
                <Button
                  asChild
                  variant="link"
                  size="sm"
                  className="h-auto p-0 text-xs text-muted-foreground hover:text-primary"
                >
                  <Link to={row.href}>
                    {row.linkLabel}
                    <ArrowRight className="ml-1 h-3 w-3" />
                  </Link>
                </Button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
