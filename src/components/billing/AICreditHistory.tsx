import { useEffect, useState, useCallback } from "react";
import { History, Loader2, Sparkles, TrendingUp, Wallet } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { format } from "date-fns";

interface PurchaseRow {
  id: string;
  pack_id: string;
  credits: number;
  amount_cents: number;
  currency: string;
  status: string;
  environment: string;
  period_start: string;
  created_at: string;
}

interface CreditStatus {
  quota: number;
  used: number;
  remaining: number;
  unlimited: boolean;
  purchased: number;
  period_start: string;
  period_end: string;
}

export function AICreditHistory() {
  const { currentOrganization } = useOrganization();
  const [purchases, setPurchases] = useState<PurchaseRow[]>([]);
  const [status, setStatus] = useState<CreditStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!currentOrganization?.id) {
      setPurchases([]);
      setStatus(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const [historyRes, statusRes] = await Promise.all([
      supabase.rpc("get_org_credit_purchase_history", {
        _org_id: currentOrganization.id,
        _limit: 25,
      }),
      supabase.rpc("get_ai_credit_status", { _org_id: currentOrganization.id }),
    ]);
    if (!historyRes.error && historyRes.data) setPurchases(historyRes.data as PurchaseRow[]);
    if (!statusRes.error && statusRes.data) setStatus(statusRes.data as unknown as CreditStatus);
    setLoading(false);
  }, [currentOrganization?.id]);

  useEffect(() => {
    load();
    const handler = () => load();
    window.addEventListener("ai-credits-changed", handler);
    return () => window.removeEventListener("ai-credits-changed", handler);
  }, [load]);

  const totalPurchasedThisPeriod = status?.purchased ?? 0;
  const totalLifetime = purchases
    .filter((p) => p.status === "completed")
    .reduce((acc, p) => acc + p.credits, 0);
  const totalSpentCents = purchases
    .filter((p) => p.status === "completed")
    .reduce((acc, p) => acc + p.amount_cents, 0);

  return (
    <Card className="p-6 space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-lg font-bold flex items-center gap-2">
            <History className="h-4 w-4 text-primary" />
            AI Credit Activity
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Breakdown of credits purchased, consumed and remaining for this organization.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={load} disabled={loading}>
          {loading && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
          Refresh
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile
          icon={<Sparkles className="h-4 w-4" />}
          label="Used this month"
          value={status?.used?.toLocaleString() ?? "—"}
          hint={
            status?.unlimited
              ? "Unlimited plan"
              : `of ${(status ? status.quota + (status.purchased ?? 0) : 0).toLocaleString()} available`
          }
        />
        <StatTile
          icon={<Wallet className="h-4 w-4" />}
          label="Remaining"
          value={status?.unlimited ? "∞" : (status?.remaining ?? 0).toLocaleString()}
          hint={
            status?.period_end
              ? `Resets ${format(new Date(status.period_end), "MMM d")}`
              : ""
          }
        />
        <StatTile
          icon={<TrendingUp className="h-4 w-4" />}
          label="Bought this month"
          value={totalPurchasedThisPeriod.toLocaleString()}
          hint={`${totalLifetime.toLocaleString()} credits lifetime · $${(totalSpentCents / 100).toFixed(2)} spent`}
        />
      </div>

      <div>
        <h4 className="text-sm font-semibold mb-2">Purchase history</h4>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : purchases.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">
            No purchases yet. Buy a pack above to top up your credits.
          </p>
        ) : (
          <div className="rounded-md border divide-y">
            {purchases.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-3 p-3 text-sm flex-wrap">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{p.credits.toLocaleString()} credits</span>
                    <code className="text-[10px] text-muted-foreground">{p.pack_id}</code>
                    {p.status !== "completed" && (
                      <Badge variant="outline" className="text-[10px]">{p.status}</Badge>
                    )}
                    {p.environment !== "live" && (
                      <Badge variant="outline" className="text-[10px]">{p.environment}</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(p.created_at), "PP p")} · valid for{" "}
                    {format(new Date(p.period_start), "MMM yyyy")}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">
                    ${(p.amount_cents / 100).toFixed(2)}{" "}
                    <span className="text-xs text-muted-foreground uppercase">{p.currency}</span>
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

function StatTile({
  icon, label, value, hint,
}: { icon: React.ReactNode; label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-md border p-3 space-y-1">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className="text-2xl font-bold">{value}</p>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}
