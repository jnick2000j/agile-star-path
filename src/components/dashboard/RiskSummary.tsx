import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { RiskDrilldownDialog, RiskImpactLevel } from "./RiskDrilldownDialog";

const riskColors = {
  high: "hsl(0 84.2% 60.2%)",
  medium: "hsl(38 92% 50%)",
  low: "hsl(142 71% 45%)",
};

export function RiskSummary() {
  const [drilldownLevel, setDrilldownLevel] = useState<RiskImpactLevel | null>(null);

  const { data: risks = [], isLoading } = useQuery({
    queryKey: ["risks-summary"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("risks")
        .select("id, impact, status")
        .eq("status", "open");
      if (error) throw error;
      return data;
    },
  });

  const highCount = risks.filter(r => r.impact === "high").length;
  const mediumCount = risks.filter(r => r.impact === "medium").length;
  const lowCount = risks.filter(r => r.impact === "low").length;

  const riskData = [
    { name: "High", value: highCount, color: riskColors.high, level: "high" as const },
    { name: "Medium", value: mediumCount, color: riskColors.medium, level: "medium" as const },
    { name: "Low", value: lowCount, color: riskColors.low, level: "low" as const },
  ].filter(d => d.value > 0);

  const open = (level: RiskImpactLevel, count: number) => {
    if (count === 0) return;
    setDrilldownLevel(level);
  };

  if (isLoading) {
    return (
      <div className="metric-card animate-slide-up" style={{ animationDelay: "0.15s" }}>
        <h3 className="text-lg font-semibold text-foreground mb-4">Risk Overview</h3>
        <div className="text-center py-8 text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (risks.length === 0) {
    return (
      <div className="metric-card animate-slide-up" style={{ animationDelay: "0.15s" }}>
        <h3 className="text-lg font-semibold text-foreground mb-4">Risk Overview</h3>
        <div className="text-center py-8 text-muted-foreground">
          No open risks. Create risks in the Risk Register.
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="metric-card animate-slide-up" style={{ animationDelay: "0.15s" }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-foreground">Risk Overview</h3>
          <span className="text-xs text-muted-foreground">Click a segment to drill in</span>
        </div>
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={riskData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={4}
                dataKey="value"
                onClick={(entry: any) => entry?.level && open(entry.level, entry.value)}
                style={{ cursor: "pointer" }}
              >
                {riskData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                }}
              />
              <Legend
                verticalAlign="bottom"
                height={36}
                formatter={(value) => <span className="text-sm text-foreground">{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-4 text-center">
          <button
            onClick={() => open("high", highCount)}
            disabled={highCount === 0}
            className="rounded-lg p-2 hover:bg-accent transition-colors disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={`View ${highCount} high impact risks`}
          >
            <p className="text-2xl font-semibold" style={{ color: riskColors.high }}>{highCount}</p>
            <p className="text-xs text-muted-foreground">High</p>
          </button>
          <button
            onClick={() => open("medium", mediumCount)}
            disabled={mediumCount === 0}
            className="rounded-lg p-2 hover:bg-accent transition-colors disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={`View ${mediumCount} medium impact risks`}
          >
            <p className="text-2xl font-semibold" style={{ color: riskColors.medium }}>{mediumCount}</p>
            <p className="text-xs text-muted-foreground">Medium</p>
          </button>
          <button
            onClick={() => open("low", lowCount)}
            disabled={lowCount === 0}
            className="rounded-lg p-2 hover:bg-accent transition-colors disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={`View ${lowCount} low impact risks`}
          >
            <p className="text-2xl font-semibold" style={{ color: riskColors.low }}>{lowCount}</p>
            <p className="text-xs text-muted-foreground">Low</p>
          </button>
        </div>
      </div>

      <RiskDrilldownDialog
        open={drilldownLevel !== null}
        level={drilldownLevel}
        onOpenChange={(o) => !o && setDrilldownLevel(null)}
      />
    </>
  );
}
