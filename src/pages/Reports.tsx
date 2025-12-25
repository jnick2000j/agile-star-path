import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { 
  BarChart3, 
  PieChart, 
  TrendingUp, 
  Download,
  Calendar,
  FileText,
  Mail
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart as RechartsPie, Pie, Cell, Legend } from "recharts";

const programmeData = [
  { name: "Digital Trans.", onTrack: 6, atRisk: 1, delayed: 1 },
  { name: "CX Programme", onTrack: 3, atRisk: 2, delayed: 0 },
  { name: "Infrastructure", onTrack: 5, atRisk: 1, delayed: 0 },
  { name: "Data Analytics", onTrack: 2, atRisk: 1, delayed: 1 },
  { name: "Security", onTrack: 7, atRisk: 0, delayed: 0 },
];

const benefitsTrendData = [
  { month: "Jul", target: 150, actual: 140 },
  { month: "Aug", target: 200, actual: 195 },
  { month: "Sep", target: 280, actual: 265 },
  { month: "Oct", target: 380, actual: 350 },
  { month: "Nov", target: 480, actual: 420 },
  { month: "Dec", target: 600, actual: 520 },
  { month: "Jan", target: 720, actual: 650 },
];

const resourceAllocation = [
  { name: "Development", value: 35, color: "hsl(217, 91%, 50%)" },
  { name: "Testing", value: 20, color: "hsl(142, 71%, 45%)" },
  { name: "Analysis", value: 15, color: "hsl(38, 92%, 50%)" },
  { name: "Management", value: 20, color: "hsl(280, 65%, 60%)" },
  { name: "Support", value: 10, color: "hsl(199, 89%, 48%)" },
];

const scheduledReports = [
  { name: "Executive Summary", frequency: "Weekly", nextRun: "Jan 29, 2024", recipients: 5 },
  { name: "Risk Dashboard", frequency: "Daily", nextRun: "Jan 24, 2024", recipients: 12 },
  { name: "Benefits Tracker", frequency: "Monthly", nextRun: "Feb 1, 2024", recipients: 8 },
  { name: "Project Status", frequency: "Weekly", nextRun: "Jan 29, 2024", recipients: 15 },
];

export default function Reports() {
  return (
    <AppLayout title="Reports & Analytics" subtitle="Programme insights and automated reporting">
      {/* Quick Actions */}
      <div className="flex flex-wrap gap-3 mb-6">
        <Button className="gap-2">
          <FileText className="h-4 w-4" />
          Generate Report
        </Button>
        <Button variant="outline" className="gap-2">
          <Mail className="h-4 w-4" />
          Schedule Email
        </Button>
        <Button variant="outline" className="gap-2">
          <Download className="h-4 w-4" />
          Export All Data
        </Button>
      </div>

      {/* Charts Grid */}
      <div className="grid gap-6 lg:grid-cols-2 mb-6">
        {/* Project Status by Programme */}
        <div className="metric-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Project Status by Programme</h3>
            <BarChart3 className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={programmeData} layout="vertical" barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                <XAxis type="number" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  width={100}
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} 
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: "hsl(var(--card))", 
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                />
                <Legend />
                <Bar dataKey="onTrack" name="On Track" fill="hsl(var(--success))" radius={[0, 4, 4, 0]} />
                <Bar dataKey="atRisk" name="At Risk" fill="hsl(var(--warning))" radius={[0, 4, 4, 0]} />
                <Bar dataKey="delayed" name="Delayed" fill="hsl(var(--destructive))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Benefits Trend */}
        <div className="metric-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Benefits Realization Trend (£K)</h3>
            <TrendingUp className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={benefitsTrendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="month" 
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                />
                <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: "hsl(var(--card))", 
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="target" 
                  name="Target"
                  stroke="hsl(var(--primary))" 
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={false}
                />
                <Line 
                  type="monotone" 
                  dataKey="actual" 
                  name="Actual"
                  stroke="hsl(var(--success))" 
                  strokeWidth={2}
                  dot={{ fill: "hsl(var(--success))" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3 mb-6">
        {/* Resource Allocation */}
        <div className="metric-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Resource Allocation</h3>
            <PieChart className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <RechartsPie>
                <Pie
                  data={resourceAllocation}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {resourceAllocation.map((entry, index) => (
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
                <Legend />
              </RechartsPie>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Scheduled Reports */}
        <div className="metric-card lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Scheduled Reports</h3>
            <Button variant="outline" size="sm" className="gap-2">
              <Calendar className="h-4 w-4" />
              Manage
            </Button>
          </div>
          <div className="space-y-3">
            {scheduledReports.map((report, index) => (
              <div 
                key={index}
                className="flex items-center justify-between p-3 rounded-lg bg-secondary/50"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">{report.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {report.frequency} • {report.recipients} recipients
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Next run</p>
                  <p className="text-sm font-medium">{report.nextRun}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
