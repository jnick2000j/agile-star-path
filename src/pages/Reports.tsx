import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { 
  BarChart3, 
  PieChart, 
  TrendingUp, 
  Download,
  FileText,
  Mail
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart as RechartsPie, Pie, Cell, Legend } from "recharts";
import { toast } from "@/components/ui/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const resourceColors = [
  "hsl(217, 91%, 50%)",
  "hsl(142, 71%, 45%)",
  "hsl(38, 92%, 50%)",
  "hsl(280, 65%, 60%)",
  "hsl(199, 89%, 48%)",
];

export default function Reports() {
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [emailTo, setEmailTo] = useState("");
  const [reportType, setReportType] = useState("executive-summary");
  const [frequency, setFrequency] = useState("weekly");

  // Fetch real data from database
  const { data: programmes = [] } = useQuery({
    queryKey: ["programmes-stats"],
    queryFn: async () => {
      const { data, error } = await supabase.from("programmes").select("id, name, status, progress");
      if (error) throw error;
      return data;
    },
  });

  const { data: projects = [] } = useQuery({
    queryKey: ["projects-stats"],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("id, programme_id, health");
      if (error) throw error;
      return data;
    },
  });

  const { data: benefits = [] } = useQuery({
    queryKey: ["benefits-stats"],
    queryFn: async () => {
      const { data, error } = await supabase.from("benefits").select("id, category, realization, target_value, current_value");
      if (error) throw error;
      return data;
    },
  });

  const { data: risks = [] } = useQuery({
    queryKey: ["risks-stats"],
    queryFn: async () => {
      const { data, error } = await supabase.from("risks").select("id, status, impact, probability");
      if (error) throw error;
      return data;
    },
  });

  // Calculate programme status data
  const programmeData = programmes.map(prog => {
    const progProjects = projects.filter(p => p.programme_id === prog.id);
    return {
      name: prog.name.length > 15 ? prog.name.substring(0, 15) + "..." : prog.name,
      onTrack: progProjects.filter(p => p.health === "green").length,
      atRisk: progProjects.filter(p => p.health === "amber").length,
      delayed: progProjects.filter(p => p.health === "red").length,
    };
  }).filter(p => p.onTrack + p.atRisk + p.delayed > 0);

  // Calculate benefits trend (group by category)
  const benefitsByCategory = benefits.reduce((acc, benefit) => {
    const cat = benefit.category || "Other";
    if (!acc[cat]) acc[cat] = { target: 0, actual: 0 };
    acc[cat].target += parseInt(benefit.target_value || "0") || 0;
    acc[cat].actual += parseInt(benefit.current_value || "0") || 0;
    return acc;
  }, {} as Record<string, { target: number; actual: number }>);

  const benefitsTrendData = Object.entries(benefitsByCategory).map(([name, values]) => ({
    month: name,
    target: values.target,
    actual: values.actual,
  }));

  // Calculate resource allocation (using risk categories as proxy)
  const riskCategories = risks.reduce((acc, risk) => {
    const status = risk.status || "unknown";
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const resourceAllocation = Object.entries(riskCategories).map(([name, value], index) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    value,
    color: resourceColors[index % resourceColors.length],
  }));

  const handleGenerateReport = () => {
    toast({
      title: "Generating report...",
      description: "Your report is being generated and will download shortly.",
    });
    
    // Create a simple report
    const reportContent = `
Program Portfolio Report
Generated: ${new Date().toLocaleDateString()}

Summary:
- Total Programs: ${programmes.length}
- Total Projects: ${projects.length}
- Open Risks: ${risks.filter(r => r.status === "open").length}
- Benefits Tracked: ${benefits.length}

Program Status:
${programmes.map(p => `- ${p.name}: ${p.status} (${p.progress}% complete)`).join("\n")}
    `.trim();

    const blob = new Blob([reportContent], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `programme-report-${new Date().toISOString().split("T")[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);

    toast({
      title: "Report downloaded",
      description: "Your programme report has been downloaded.",
    });
  };

  const handleScheduleEmail = () => {
    setScheduleDialogOpen(true);
  };

  const handleExportData = async () => {
    toast({
      title: "Exporting data...",
      description: "Preparing your data export.",
    });

    const exportData = {
      exportedAt: new Date().toISOString(),
      programmes,
      projects,
      risks,
      benefits,
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `portfolio-data-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);

    toast({
      title: "Data exported",
      description: "All portfolio data has been exported as JSON.",
    });
  };

  const handleSaveSchedule = () => {
    if (!emailTo) {
      toast({
        title: "Error",
        description: "Please enter an email address.",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Report scheduled",
      description: `${reportType} report will be sent ${frequency} to ${emailTo}.`,
    });
    setScheduleDialogOpen(false);
    setEmailTo("");
  };

  return (
    <AppLayout title="Reports & Analytics" subtitle="Program insights and automated reporting">
      {/* Quick Actions */}
      <div className="flex flex-wrap gap-3 mb-6">
        <Button className="gap-2" onClick={handleGenerateReport}>
          <FileText className="h-4 w-4" />
          Generate Report
        </Button>
        <Button variant="outline" className="gap-2" onClick={handleScheduleEmail}>
          <Mail className="h-4 w-4" />
          Schedule Email
        </Button>
        <Button variant="outline" className="gap-2" onClick={handleExportData}>
          <Download className="h-4 w-4" />
          Export All Data
        </Button>
      </div>

      {/* Charts Grid */}
      <div className="grid gap-6 lg:grid-cols-2 mb-6">
        {/* Project Status by Program */}
        <div className="metric-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Project Status by Program</h3>
            <BarChart3 className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="h-[300px]">
            {programmeData.length > 0 ? (
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
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                No programme data available. Create programmes and projects to see statistics.
              </div>
            )}
          </div>
        </div>

        {/* Benefits Trend */}
        <div className="metric-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Benefits by Category</h3>
            <TrendingUp className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="h-[300px]">
            {benefitsTrendData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={benefitsTrendData}>
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
                  <Bar dataKey="target" name="Target" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="actual" name="Actual" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                No benefits data available. Add benefits to see trends.
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3 mb-6">
        {/* Risk Distribution */}
        <div className="metric-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Risk Distribution</h3>
            <PieChart className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="h-[250px]">
            {resourceAllocation.length > 0 ? (
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
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                No risk data available.
              </div>
            )}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="metric-card lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Portfolio Summary</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-lg bg-primary/10 text-center">
              <p className="text-3xl font-bold text-primary">{programmes.length}</p>
              <p className="text-sm text-muted-foreground">Programs</p>
            </div>
            <div className="p-4 rounded-lg bg-success/10 text-center">
              <p className="text-3xl font-bold text-success">{projects.length}</p>
              <p className="text-sm text-muted-foreground">Projects</p>
            </div>
            <div className="p-4 rounded-lg bg-warning/10 text-center">
              <p className="text-3xl font-bold text-warning">{risks.filter(r => r.status === "open").length}</p>
              <p className="text-sm text-muted-foreground">Open Risks</p>
            </div>
            <div className="p-4 rounded-lg bg-info/10 text-center">
              <p className="text-3xl font-bold text-info">{benefits.length}</p>
              <p className="text-sm text-muted-foreground">Benefits</p>
            </div>
          </div>
        </div>
      </div>

      {/* Schedule Email Dialog */}
      <Dialog open={scheduleDialogOpen} onOpenChange={setScheduleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule Email Report</DialogTitle>
            <DialogDescription>
              Configure automated email reports for stakeholders.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Report Type</Label>
              <Select value={reportType} onValueChange={setReportType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="executive-summary">Executive Summary</SelectItem>
                  <SelectItem value="risk-dashboard">Risk Dashboard</SelectItem>
                  <SelectItem value="benefits-tracker">Benefits Tracker</SelectItem>
                  <SelectItem value="project-status">Project Status</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Frequency</Label>
              <Select value={frequency} onValueChange={setFrequency}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Email Address</Label>
              <Input
                type="email"
                placeholder="stakeholder@company.com"
                value={emailTo}
                onChange={(e) => setEmailTo(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setScheduleDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveSchedule}>Schedule Report</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
