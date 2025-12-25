import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

const benefitsData = [
  { name: "Q1", planned: 240, realized: 220 },
  { name: "Q2", planned: 380, realized: 350 },
  { name: "Q3", planned: 520, realized: 480 },
  { name: "Q4", planned: 680, realized: 0 },
];

export function BenefitsTracker() {
  return (
    <div className="metric-card animate-slide-up" style={{ animationDelay: "0.3s" }}>
      <h3 className="text-lg font-semibold text-foreground mb-4">Benefits Realization (£K)</h3>
      <div className="h-[250px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={benefitsData} barGap={8}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis 
              dataKey="name" 
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
              axisLine={{ stroke: "hsl(var(--border))" }}
            />
            <YAxis 
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
              axisLine={{ stroke: "hsl(var(--border))" }}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: "hsl(var(--card))", 
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
              }}
              labelStyle={{ color: "hsl(var(--foreground))" }}
            />
            <Legend 
              formatter={(value) => <span className="text-sm text-foreground capitalize">{value}</span>}
            />
            <Bar dataKey="planned" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            <Bar dataKey="realized" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
