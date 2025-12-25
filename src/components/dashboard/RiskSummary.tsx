import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";

const riskData = [
  { name: "High", value: 8, color: "hsl(0 84.2% 60.2%)" },
  { name: "Medium", value: 15, color: "hsl(38 92% 50%)" },
  { name: "Low", value: 23, color: "hsl(142 71% 45%)" },
];

export function RiskSummary() {
  return (
    <div className="metric-card animate-slide-up" style={{ animationDelay: "0.15s" }}>
      <h3 className="text-lg font-semibold text-foreground mb-4">Risk Overview</h3>
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
        {riskData.map((item) => (
          <div key={item.name}>
            <p className="text-2xl font-semibold" style={{ color: item.color }}>{item.value}</p>
            <p className="text-xs text-muted-foreground">{item.name} Priority</p>
          </div>
        ))}
      </div>
    </div>
  );
}
