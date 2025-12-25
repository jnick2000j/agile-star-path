import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { 
  Plus, 
  Search, 
  Filter,
  Calendar,
  Send,
  FileText,
  Clock,
  CheckCircle
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface WeeklyReport {
  id: string;
  programme: string;
  weekEnding: string;
  status: "draft" | "submitted" | "approved";
  submittedBy: string;
  submittedAt?: string;
  highlights: string[];
  risksIssues: string[];
  nextWeek: string[];
  overallHealth: "green" | "amber" | "red";
}

const reports: WeeklyReport[] = [
  {
    id: "WR001",
    programme: "Digital Transformation",
    weekEnding: "Jan 26, 2024",
    status: "submitted",
    submittedBy: "Michael Chen",
    submittedAt: "Jan 26, 2024 5:30 PM",
    highlights: [
      "Mobile app beta version released to pilot users",
      "API Gateway integration testing completed successfully",
      "Stakeholder demo delivered with positive feedback"
    ],
    risksIssues: [
      "Resource constraint on frontend development team",
      "Third-party API documentation incomplete"
    ],
    nextWeek: [
      "Begin Phase 2 development sprint",
      "Conduct pilot user feedback sessions",
      "Finalize security review findings"
    ],
    overallHealth: "green"
  },
  {
    id: "WR002",
    programme: "Customer Experience",
    weekEnding: "Jan 26, 2024",
    status: "draft",
    submittedBy: "Sarah Wilson",
    highlights: [
      "Customer portal UAT completed",
      "Training materials developed for support team"
    ],
    risksIssues: [
      "Delay in third-party integration causing timeline risk",
      "Usability concerns raised during UAT"
    ],
    nextWeek: [
      "Address UAT feedback items",
      "Complete integration testing"
    ],
    overallHealth: "amber"
  },
  {
    id: "WR003",
    programme: "Infrastructure Modernization",
    weekEnding: "Jan 26, 2024",
    status: "approved",
    submittedBy: "James Taylor",
    submittedAt: "Jan 25, 2024 4:15 PM",
    highlights: [
      "Cloud migration Phase 3 completed",
      "Performance improvements of 40% achieved",
      "Zero downtime during migration window"
    ],
    risksIssues: [
      "Budget monitoring required for cloud costs"
    ],
    nextWeek: [
      "Begin Phase 4 planning",
      "Decommission legacy servers"
    ],
    overallHealth: "green"
  },
];

const statusConfig = {
  draft: { label: "Draft", className: "bg-muted text-muted-foreground" },
  submitted: { label: "Submitted", className: "bg-primary/10 text-primary" },
  approved: { label: "Approved", className: "bg-success/10 text-success" },
};

const healthConfig = {
  green: "bg-success",
  amber: "bg-warning",
  red: "bg-destructive",
};

export default function WeeklyUpdates() {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredReports = reports.filter((r) =>
    r.programme.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <AppLayout title="Weekly Updates" subtitle="Programme status reports and communications">
      {/* Summary */}
      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <div className="metric-card">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-semibold">{reports.length}</p>
              <p className="text-sm text-muted-foreground">This Week</p>
            </div>
          </div>
        </div>
        <div className="metric-card">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
              <Clock className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-2xl font-semibold">{reports.filter(r => r.status === "draft").length}</p>
              <p className="text-sm text-muted-foreground">Pending</p>
            </div>
          </div>
        </div>
        <div className="metric-card">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Send className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-semibold">{reports.filter(r => r.status === "submitted").length}</p>
              <p className="text-sm text-muted-foreground">Submitted</p>
            </div>
          </div>
        </div>
        <div className="metric-card">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
              <CheckCircle className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-2xl font-semibold">{reports.filter(r => r.status === "approved").length}</p>
              <p className="text-sm text-muted-foreground">Approved</p>
            </div>
          </div>
        </div>
      </div>

      {/* Actions Bar */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search reports..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2">
            <Calendar className="h-4 w-4" />
            Week: Jan 26
          </Button>
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            New Report
          </Button>
        </div>
      </div>

      {/* Reports Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {filteredReports.map((report, index) => (
          <Card 
            key={report.id} 
            className="animate-slide-up"
            style={{ animationDelay: `${index * 0.1}s` }}
          >
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <div className={cn("h-3 w-3 rounded-full", healthConfig[report.overallHealth])} />
                    <CardTitle className="text-lg">{report.programme}</CardTitle>
                  </div>
                  <CardDescription>Week ending {report.weekEnding}</CardDescription>
                </div>
                <Badge variant="secondary" className={cn("text-xs", statusConfig[report.status].className)}>
                  {statusConfig[report.status].label}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="text-sm font-medium text-foreground mb-2">Highlights</h4>
                <ul className="space-y-1">
                  {report.highlights.map((highlight, i) => (
                    <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                      <span className="text-success mt-1">•</span>
                      {highlight}
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h4 className="text-sm font-medium text-foreground mb-2">Risks & Issues</h4>
                <ul className="space-y-1">
                  {report.risksIssues.map((item, i) => (
                    <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                      <span className="text-warning mt-1">•</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h4 className="text-sm font-medium text-foreground mb-2">Next Week</h4>
                <ul className="space-y-1">
                  {report.nextWeek.map((item, i) => (
                    <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                      <span className="text-primary mt-1">•</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="pt-4 border-t border-border flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  {report.submittedAt ? (
                    <>Submitted by {report.submittedBy} on {report.submittedAt}</>
                  ) : (
                    <>Draft by {report.submittedBy}</>
                  )}
                </div>
                <div className="flex gap-2">
                  {report.status === "draft" && (
                    <Button size="sm" className="gap-1">
                      <Send className="h-3 w-3" />
                      Submit
                    </Button>
                  )}
                  <Button variant="outline" size="sm">
                    View Details
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </AppLayout>
  );
}
