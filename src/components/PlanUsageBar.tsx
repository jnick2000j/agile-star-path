import { usePlanLimits } from "@/hooks/usePlanLimits";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { CreditCard, AlertTriangle } from "lucide-react";

export function PlanUsageBar() {
  const { limits, usage, loading, getUsagePercent } = usePlanLimits();

  if (loading || !limits) return null;

  const resources = [
    { key: "users" as const, label: "Users" },
    { key: "programmes" as const, label: "Programmes" },
    { key: "projects" as const, label: "Projects" },
    { key: "products" as const, label: "Products" },
  ];

  const maxKey = (key: string) => {
    const k = `max${key.charAt(0).toUpperCase() + key.slice(1)}` as keyof typeof limits;
    return limits[k] as number;
  };

  return (
    <Card className="p-4 mb-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-primary" />
          <span className="font-medium text-sm">{limits.planName} Plan</span>
          <Badge variant="outline" className="text-xs capitalize">{limits.status}</Badge>
        </div>
        {limits.trialEndsAt && limits.status === "trialing" && (
          <span className="text-xs text-muted-foreground">
            Trial ends {new Date(limits.trialEndsAt).toLocaleDateString()}
          </span>
        )}
      </div>
      <div className="grid grid-cols-4 gap-4">
        {resources.map(({ key, label }) => {
          const max = maxKey(key);
          const pct = getUsagePercent(key);
          const isUnlimited = max === -1;
          return (
            <div key={key}>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-muted-foreground">{label}</span>
                <span className="font-medium">
                  {usage[key]}{isUnlimited ? "" : ` / ${max}`}
                </span>
              </div>
              {!isUnlimited && (
                <Progress
                  value={pct}
                  className="h-1.5"
                />
              )}
              {pct >= 90 && !isUnlimited && (
                <div className="flex items-center gap-1 mt-1">
                  <AlertTriangle className="h-3 w-3 text-warning" />
                  <span className="text-xs text-warning">Near limit</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
