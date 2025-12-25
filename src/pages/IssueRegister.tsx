import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Search, 
  Filter,
  AlertCircle,
  ArrowUpRight,
  Download
} from "lucide-react";
import { CreateIssueDialog } from "@/components/dialogs/CreateIssueDialog";
import { DocumentUpload } from "@/components/DocumentUpload";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Issue {
  id: string;
  title: string;
  description: string;
  programme: string;
  project?: string;
  type: "problem" | "concern" | "change-request" | "off-specification";
  priority: "critical" | "high" | "medium" | "low";
  status: "open" | "investigating" | "pending" | "resolved" | "closed";
  owner: string;
  dateRaised: string;
  targetDate: string;
  resolution?: string;
}

const issues: Issue[] = [
  { id: "ISS001", title: "API response time degradation", description: "Production API response times have increased by 40% over the past week", programme: "Digital Transformation", project: "API Gateway", type: "problem", priority: "critical", status: "investigating", owner: "Rachel Green", dateRaised: "Jan 20, 2024", targetDate: "Jan 25, 2024" },
  { id: "ISS002", title: "Scope change request - additional reporting", description: "Business requests additional compliance reporting functionality", programme: "Data Analytics Platform", project: "Reporting Dashboard", type: "change-request", priority: "medium", status: "pending", owner: "Irene Adler", dateRaised: "Jan 18, 2024", targetDate: "Feb 5, 2024" },
  { id: "ISS003", title: "Vendor delivery delay", description: "Hardware vendor has delayed delivery by 2 weeks", programme: "Infrastructure Modernization", type: "problem", priority: "high", status: "open", owner: "James Taylor", dateRaised: "Jan 22, 2024", targetDate: "Feb 1, 2024" },
  { id: "ISS004", title: "Security audit findings", description: "External security audit identified 3 medium-priority vulnerabilities", programme: "Security Enhancement", type: "off-specification", priority: "high", status: "investigating", owner: "Frank Castle", dateRaised: "Jan 15, 2024", targetDate: "Jan 30, 2024" },
  { id: "ISS005", title: "User acceptance testing concerns", description: "Business users reporting usability concerns during UAT", programme: "Customer Experience", project: "Customer Portal V2", type: "concern", priority: "medium", status: "open", owner: "Chris Martin", dateRaised: "Jan 19, 2024", targetDate: "Feb 2, 2024" },
  { id: "ISS006", title: "Integration test failures", description: "Intermittent failures in payment gateway integration tests", programme: "Digital Transformation", project: "Mobile App Redesign", type: "problem", priority: "high", status: "resolved", owner: "Alex Turner", dateRaised: "Jan 10, 2024", targetDate: "Jan 18, 2024", resolution: "Configuration issue identified and fixed" },
];

const typeConfig = {
  problem: { label: "Problem", className: "bg-destructive/10 text-destructive" },
  concern: { label: "Concern", className: "bg-warning/10 text-warning" },
  "change-request": { label: "Change Request", className: "bg-primary/10 text-primary" },
  "off-specification": { label: "Off-Spec", className: "bg-info/10 text-info" },
};

const priorityConfig = {
  critical: { label: "Critical", className: "bg-destructive text-destructive-foreground" },
  high: { label: "High", className: "bg-destructive/10 text-destructive" },
  medium: { label: "Medium", className: "bg-warning/10 text-warning" },
  low: { label: "Low", className: "bg-success/10 text-success" },
};

const statusConfig = {
  open: { label: "Open", className: "bg-destructive/10 text-destructive" },
  investigating: { label: "Investigating", className: "bg-warning/10 text-warning" },
  pending: { label: "Pending", className: "bg-info/10 text-info" },
  resolved: { label: "Resolved", className: "bg-success/10 text-success" },
  closed: { label: "Closed", className: "bg-muted text-muted-foreground" },
};

export default function IssueRegister() {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredIssues = issues.filter((i) =>
    i.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    i.programme.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <AppLayout title="Issue Register" subtitle="PRINCE2 MSP issue management">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <div className="metric-card">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10">
              <AlertCircle className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <p className="text-2xl font-semibold">{issues.length}</p>
              <p className="text-sm text-muted-foreground">Total Issues</p>
            </div>
          </div>
        </div>
        <div className="metric-card">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/10">
              <AlertCircle className="h-5 w-5 text-warning" />
            </div>
            <div>
              <p className="text-2xl font-semibold">{issues.filter(i => i.status === "open" || i.status === "investigating").length}</p>
              <p className="text-sm text-muted-foreground">Active Issues</p>
            </div>
          </div>
        </div>
        <div className="metric-card">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10">
              <AlertCircle className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <p className="text-2xl font-semibold">{issues.filter(i => i.priority === "critical" || i.priority === "high").length}</p>
              <p className="text-sm text-muted-foreground">High Priority</p>
            </div>
          </div>
        </div>
        <div className="metric-card">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
              <AlertCircle className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-2xl font-semibold">{issues.filter(i => i.status === "resolved" || i.status === "closed").length}</p>
              <p className="text-sm text-muted-foreground">Resolved</p>
            </div>
          </div>
        </div>
      </div>

      {/* Actions Bar */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search issues..."
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
          <CreateIssueDialog onSuccess={() => {}} />
        </div>
      </div>

      {/* Issues Table */}
      <div className="metric-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[80px]">ID</TableHead>
              <TableHead>Issue Title</TableHead>
              <TableHead>Programme/Project</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Target Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredIssues.map((issue, index) => (
              <TableRow 
                key={issue.id} 
                className="animate-fade-in cursor-pointer hover:bg-muted/50"
                style={{ animationDelay: `${index * 0.03}s` }}
              >
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {issue.id}
                </TableCell>
                <TableCell>
                  <div>
                    <p className="font-medium">{issue.title}</p>
                    <p className="text-xs text-muted-foreground line-clamp-1">{issue.description}</p>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  <div>
                    <p className="text-sm">{issue.programme}</p>
                    {issue.project && <p className="text-xs text-muted-foreground">{issue.project}</p>}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary" className={cn("text-xs", typeConfig[issue.type].className)}>
                    {typeConfig[issue.type].label}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary" className={cn("text-xs", priorityConfig[issue.priority].className)}>
                    {priorityConfig[issue.priority].label}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">{issue.owner}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{issue.targetDate}</TableCell>
                <TableCell>
                  <Badge variant="secondary" className={cn("text-xs", statusConfig[issue.status].className)}>
                    {statusConfig[issue.status].label}
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
