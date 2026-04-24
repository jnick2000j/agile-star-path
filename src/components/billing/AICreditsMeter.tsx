import { useEffect, useState, useCallback } from "react";
import { Sparkles, AlertTriangle, Infinity as InfinityIcon, RefreshCw } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";

interface CreditStatus {
  quota: number;
  used: number;
  remaining: number;
  unlimited: boolean;
  purchased?: number;
  period_start: string;
  period_end: string;
}

interface Props {
  /** "compact" → header chip, "full" → full card with meter, "menu" → dropdown menu row */
  variant?: "compact" | "full" | "menu";
  /** If true, render nothing when no org is selected. */
  hideWhenEmpty?: boolean;
}

export function AICreditsMeter({ variant = "full", hideWhenEmpty = false }: Props) {
  const { currentOrganization } = useOrganization();
  const [status, setStatus] = useState<CreditStatus | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!currentOrganization?.id) {
      setStatus(null);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.rpc("get_ai_credit_status", {
      _org_id: currentOrganization.id,
    });
    if (!error && data) setStatus(data as unknown as CreditStatus);
    setLoading(false);
  }, [currentOrganization?.id]);

  useEffect(() => {
    load();
    // Refresh every 60s in case other users in the org consume credits.
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [load]);

  // Listen for in-app events so the meter updates immediately after an AI call.
  useEffect(() => {
    const handler = () => load();
    window.addEventListener("ai-credits-changed", handler);
    return () => window.removeEventListener("ai-credits-changed", handler);
  }, [load]);

  if (!currentOrganization?.id && hideWhenEmpty) return null;
  if (!status) {
    if (variant === "compact") return null;
    if (variant === "menu") {
      return (
        <div className="px-2 py-1.5 flex items-center gap-2 text-xs text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5" /> Loading AI credits…
        </div>
      );
    }
    return (
      <Card className="p-4 flex items-center gap-2 text-sm text-muted-foreground">
        <Sparkles className="h-4 w-4" /> Loading AI credits…
      </Card>
    );
  }

  const purchased = status.purchased ?? 0;
  const totalQuota = status.unlimited ? 0 : status.quota + purchased;
  const pct = status.unlimited || totalQuota === 0
    ? 0
    : Math.min(100, Math.round((status.used / totalQuota) * 100));
  const isLow = !status.unlimited && totalQuota > 0 && status.remaining <= Math.max(1, totalQuota * 0.1);
  const isExhausted = !status.unlimited && status.remaining === 0 && totalQuota > 0;
  const isDisabled = status.quota === 0 && purchased === 0;
  const resetLabel = new Date(status.period_end).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });

  if (variant === "menu") {
    const iconClass = isExhausted ? "text-destructive" : isLow ? "text-warning" : "text-primary";
    return (
      <div className="px-2 py-1.5">
        <div className="flex items-center gap-2 text-xs">
          <Sparkles className={`h-3.5 w-3.5 ${iconClass}`} />
          <span className="font-medium">AI Credits</span>
          {status.unlimited && (
            <Badge variant="outline" className="text-[10px] gap-1 h-4 px-1">
              <InfinityIcon className="h-2.5 w-2.5" /> Unlimited
            </Badge>
          )}
          {isLow && !isExhausted && !status.unlimited && (
            <Badge variant="outline" className="text-[10px] gap-1 h-4 px-1 border-warning text-warning">
              Low
            </Badge>
          )}
          {isExhausted && (
            <Badge variant="destructive" className="text-[10px] h-4 px-1">Exhausted</Badge>
          )}
        </div>
        {!status.unlimited && !isDisabled && (
          <>
            <div className="mt-1.5 flex items-baseline gap-1 text-xs">
              <span className="font-medium text-foreground">{status.remaining.toLocaleString()}</span>
              <span className="text-muted-foreground">of {totalQuota.toLocaleString()} left</span>
              {purchased > 0 && (
                <span className="text-[10px] text-primary">+{purchased} bought</span>
              )}
            </div>
            <Progress value={pct} className="h-1.5 mt-1" />
            <p className="mt-1 text-[10px] text-muted-foreground">Resets {resetLabel}</p>
          </>
        )}
        {status.unlimited && (
          <p className="mt-1 text-[10px] text-muted-foreground">Unlimited AI usage on your plan.</p>
        )}
        {isDisabled && (
          <p className="mt-1 text-[10px] text-muted-foreground">Upgrade your plan to unlock AI features.</p>
        )}
      </div>
    );
  }

  if (variant === "compact") {
    return (
      <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-md border bg-card text-xs">
        <Sparkles className={`h-3.5 w-3.5 ${isExhausted ? "text-destructive" : isLow ? "text-warning" : "text-primary"}`} />
        {status.unlimited ? (
          <span className="font-medium flex items-center gap-1">
            AI <InfinityIcon className="h-3 w-3" />
          </span>
        ) : isDisabled ? (
          <span className="text-muted-foreground">AI disabled</span>
        ) : (
          <>
            <span className="font-medium">{status.remaining}</span>
            <span className="text-muted-foreground">/ {totalQuota} AI credits</span>
            {purchased > 0 && (
              <span className="text-[10px] text-primary">+{purchased} bought</span>
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="font-medium text-sm">AI Credits</span>
          {status.unlimited && (
            <Badge variant="outline" className="text-xs gap-1">
              <InfinityIcon className="h-3 w-3" /> Unlimited
            </Badge>
          )}
          {isDisabled && (
            <Badge variant="outline" className="text-xs">Not included in plan</Badge>
          )}
          {isLow && !isExhausted && !status.unlimited && (
            <Badge variant="outline" className="text-xs gap-1 border-warning text-warning">
              <AlertTriangle className="h-3 w-3" /> Low
            </Badge>
          )}
          {isExhausted && (
            <Badge variant="destructive" className="text-xs">Exhausted</Badge>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={load} disabled={loading} className="h-7">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {!status.unlimited && !isDisabled && (
        <>
          <Progress value={pct} className="h-2" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>
              <span className="font-medium text-foreground">{status.used.toLocaleString()}</span>
              {" / "}
              {totalQuota.toLocaleString()} used this month
              {purchased > 0 && (
                <span className="ml-1 text-primary">
                  (includes +{purchased.toLocaleString()} purchased)
                </span>
              )}
            </span>
            <span>Resets {resetLabel}</span>
          </div>
        </>
      )}

      {status.unlimited && (
        <p className="text-xs text-muted-foreground">
          Your plan includes unlimited AI usage. Activity is still logged for transparency.
        </p>
      )}

      {isDisabled && (
        <p className="text-xs text-muted-foreground">
          Upgrade your plan to unlock AI drafting, summaries, translations and the advisor.
        </p>
      )}
    </Card>
  );
}

/** Convenience: dispatch this after any AI call so meters refresh immediately. */
export function notifyAiCreditsChanged() {
  window.dispatchEvent(new Event("ai-credits-changed"));
}
