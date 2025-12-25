import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Search, 
  Filter,
  AlertTriangle,
  ArrowUpRight,
  Download
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CreateRiskDialog } from "@/components/dialogs/CreateRiskDialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Risk {
  id: string;
  title: string;
  description: string;
  programme: string;
  project?: string;
  category: string;
  probability: "very-low" | "low" | "medium" | "high" | "very-high";
  impact: "very-low" | "low" | "medium" | "high" | "very-high";
  score: number;
  owner: string;
  status: "open" | "mitigating" | "closed" | "accepted";
  response: string;
  dateIdentified: string;
  reviewDate: string;
}

const risks: Risk[] = [
  { id: "RSK001", title: "Resource availability constraints", description: "Key technical resources may not be available during critical project phases", programme: "Digital Transformation", project: "Mobile App Redesign", category: "Resource", probability: "high", impact: "high", score: 16, owner: "Michael Chen", status: "mitigating", response: "Reduce", dateIdentified: "Jan 10, 2024", reviewDate: "Jan 25, 2024" },
  { id: "RSK002", title: "Third-party API dependency", description: "Critical dependency on external payment provider API stability", programme: "Customer Experience", project: "Customer Portal V2", category: "Technical", probability: "medium", impact: "very-high", score: 15, owner: "Sarah Wilson", status: "open", response: "Contingency", dateIdentified: "Feb 5, 2024", reviewDate: "Feb 20, 2024" },
  { id: "RSK003", title: "Regulatory compliance changes", description: "Upcoming GDPR amendments may require system modifications", programme: "Digital Transformation", category: "Compliance", probability: "medium", impact: "high", score: 12, owner: "Jane Smith", status: "open", response: "Accept", dateIdentified: "Jan 15, 2024", reviewDate: "Mar 1, 2024" },
  { id: "RSK004", title: "Budget overrun potential", description: "Cloud infrastructure costs exceeding initial estimates", programme: "Infrastructure Modernization", project: "Cloud Migration", category: "Financial", probability: "high", impact: "medium", score: 12, owner: "James Taylor", status: "mitigating", response: "Reduce", dateIdentified: "Dec 20, 2023", reviewDate: "Jan 30, 2024" },
  { id: "RSK005", title: "Stakeholder engagement decline", description: "Key business stakeholders showing reduced engagement in steering meetings", programme: "Data Analytics Platform", category: "Stakeholder", probability: "medium", impact: "medium", score: 9, owner: "Lisa Anderson", status: "open", response: "Reduce", dateIdentified: "Feb 1, 2024", reviewDate: "Feb 15, 2024" },
  { id: "RSK006", title: "Legacy system integration issues", description: "Complex integration with legacy ERP system may cause delays", programme: "Digital Transformation", project: "API Gateway", category: "Technical", probability: "high", impact: "high", score: 16, owner: "Rachel Green", status: "mitigating", response: "Reduce", dateIdentified: "Jan 25, 2024", reviewDate: "Feb 10, 2024" },
  { id: "RSK007", title: "Data quality concerns", description: "Source data quality may impact analytics accuracy", programme: "Data Analytics Platform", project: "Reporting Dashboard", category: "Quality", probability: "medium", impact: "high", score: 12, owner: "Irene Adler", status: "open", response: "Reduce", dateIdentified: "Feb 10, 2024", reviewDate: "Feb 25, 2024" },
  { id: "RSK008", title: "Vendor contract expiry", description: "Key software license expiring before migration complete", programme: "Security Enhancement", category: "Commercial", probability: "low", impact: "very-high", score: 10, owner: "Frank Castle", status: "closed", response: "Avoid", dateIdentified: "Nov 15, 2023", reviewDate: "Jan 15, 2024" },
];

const probabilityConfig = {
  "very-low": { label: "Very Low", value: 1 },
  low: { label: "Low", value: 2 },
  medium: { label: "Medium", value: 3 },
  high: { label: "High", value: 4 },
  "very-high": { label: "Very High", value: 5 },
};

const statusConfig = {
  open: { label: "Open", className: "bg-destructive/10 text-destructive" },
  mitigating: { label: "Mitigating", className: "bg-warning/10 text-warning" },
  closed: { label: "Closed", className: "bg-success/10 text-success" },
  accepted: { label: "Accepted", className: "bg-primary/10 text-primary" },
};

const getScoreColor = (score: number) => {
  if (score >= 15) return "bg-destructive text-destructive-foreground";
  if (score >= 10) return "bg-warning text-warning-foreground";
  if (score >= 5) return "bg-info text-info-foreground";
  return "bg-success text-success-foreground";
};

export default function RiskRegister() {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredRisks = risks.filter((r) =>
    r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.programme.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const openRisks = risks.filter(r => r.status === "open" || r.status === "mitigating").length;
  const highRisks = risks.filter(r => r.score >= 15).length;

  return (
    <AppLayout title="Risk Register" subtitle="PRINCE2 MSP risk management">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <div className="metric-card">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <p className="text-2xl font-semibold">{risks.length}</p>
              <p className="text-sm text-muted-foreground">Total Risks</p>
            </div>
          </div>
        </div>
        <div className="metric-card">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/10">
              <AlertTriangle className="h-5 w-5 text-warning" />
            </div>
            <div>
              <p className="text-2xl font-semibold">{openRisks}</p>
              <p className="text-sm text-muted-foreground">Open Risks</p>
            </div>
          </div>
        </div>
        <div className="metric-card">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <p className="text-2xl font-semibold">{highRisks}</p>
              <p className="text-sm text-muted-foreground">High Priority</p>
            </div>
          </div>
        </div>
        <div className="metric-card">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
              <AlertTriangle className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-2xl font-semibold">{risks.filter(r => r.status === "closed").length}</p>
              <p className="text-sm text-muted-foreground">Closed Risks</p>
            </div>
          </div>
        </div>
      </div>

      {/* Actions Bar */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search risks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            Export
          </Button>
          <Button variant="outline" className="gap-2">
            <Filter className="h-4 w-4" />
            Filter
          </Button>
          <CreateRiskDialog />
        </div>
      </div>

      {/* Risks Table */}
      <div className="metric-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[80px]">ID</TableHead>
              <TableHead>Risk Title</TableHead>
              <TableHead>Programme/Project</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="text-center">P</TableHead>
              <TableHead className="text-center">I</TableHead>
              <TableHead className="text-center">Score</TableHead>
              <TableHead>Response</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRisks.map((risk, index) => (
              <TableRow 
                key={risk.id} 
                className="animate-fade-in cursor-pointer hover:bg-muted/50"
                style={{ animationDelay: `${index * 0.03}s` }}
              >
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {risk.id}
                </TableCell>
                <TableCell>
                  <div>
                    <p className="font-medium">{risk.title}</p>
                    <p className="text-xs text-muted-foreground line-clamp-1">{risk.description}</p>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  <div>
                    <p className="text-sm">{risk.programme}</p>
                    {risk.project && <p className="text-xs text-muted-foreground">{risk.project}</p>}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs">{risk.category}</Badge>
                </TableCell>
                <TableCell className="text-center font-medium">
                  {probabilityConfig[risk.probability].value}
                </TableCell>
                <TableCell className="text-center font-medium">
                  {probabilityConfig[risk.impact].value}
                </TableCell>
                <TableCell className="text-center">
                  <Badge className={cn("text-xs", getScoreColor(risk.score))}>
                    {risk.score}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm">{risk.response}</TableCell>
                <TableCell className="text-muted-foreground">{risk.owner}</TableCell>
                <TableCell>
                  <Badge variant="secondary" className={cn("text-xs", statusConfig[risk.status].className)}>
                    {statusConfig[risk.status].label}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <ArrowUpRight className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </AppLayout>
  );
}
