import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Search, 
  Filter, 
  MoreVertical, 
  Calendar,
  Users,
  Target,
  ArrowUpRight
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CreateProgrammeDialog } from "@/components/dialogs/CreateProgrammeDialog";
import { supabase } from "@/integrations/supabase/client";

interface Programme {
  id: string;
  name: string;
  description: string;
  status: "active" | "on-hold" | "completed" | "at-risk";
  progress: number;
  startDate: string;
  endDate: string;
  sponsor: string;
  manager: string;
  tranche: string;
  projectCount: number;
  budget: string;
  benefitsTarget: string;
}

const programmes: Programme[] = [
  {
    id: "PRG001",
    name: "Digital Transformation Initiative",
    description: "Enterprise-wide digital transformation programme focusing on customer experience and operational efficiency",
    status: "active",
    progress: 72,
    startDate: "Jan 2024",
    endDate: "Dec 2025",
    sponsor: "Jane Smith",
    manager: "Michael Chen",
    tranche: "Tranche 2",
    projectCount: 8,
    budget: "£2.5M",
    benefitsTarget: "£4.2M",
  },
  {
    id: "PRG002",
    name: "Customer Experience Programme",
    description: "Enhancing customer journey across all touchpoints with focus on digital channels",
    status: "at-risk",
    progress: 45,
    startDate: "Mar 2024",
    endDate: "Sep 2025",
    sponsor: "Robert Johnson",
    manager: "Sarah Wilson",
    tranche: "Tranche 1",
    projectCount: 5,
    budget: "£1.8M",
    benefitsTarget: "£2.9M",
  },
  {
    id: "PRG003",
    name: "Infrastructure Modernization",
    description: "Cloud migration and infrastructure modernization programme",
    status: "active",
    progress: 88,
    startDate: "Jun 2023",
    endDate: "Mar 2025",
    sponsor: "Emily Davis",
    manager: "James Taylor",
    tranche: "Tranche 3",
    projectCount: 6,
    budget: "£3.2M",
    benefitsTarget: "£5.1M",
  },
  {
    id: "PRG004",
    name: "Data Analytics Platform",
    description: "Building enterprise data analytics and business intelligence capabilities",
    status: "on-hold",
    progress: 23,
    startDate: "Sep 2024",
    endDate: "Jun 2026",
    sponsor: "David Brown",
    manager: "Lisa Anderson",
    tranche: "Tranche 1",
    projectCount: 4,
    budget: "£1.2M",
    benefitsTarget: "£2.0M",
  },
  {
    id: "PRG005",
    name: "Security Enhancement Programme",
    description: "Comprehensive security improvement across all systems and processes",
    status: "completed",
    progress: 100,
    startDate: "Jan 2023",
    endDate: "Dec 2024",
    sponsor: "Patricia Miller",
    manager: "Thomas White",
    tranche: "Complete",
    projectCount: 7,
    budget: "£1.5M",
    benefitsTarget: "£2.3M",
  },
];

const statusConfig = {
  active: { label: "Active", className: "bg-success/10 text-success border-success/20" },
  "at-risk": { label: "At Risk", className: "bg-destructive/10 text-destructive border-destructive/20" },
  "on-hold": { label: "On Hold", className: "bg-warning/10 text-warning border-warning/20" },
  completed: { label: "Completed", className: "bg-primary/10 text-primary border-primary/20" },
};

export default function Programmes() {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredProgrammes = programmes.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <AppLayout title="Programmes" subtitle="Manage programme portfolio">
      {/* Actions Bar */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search programmes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2">
            <Filter className="h-4 w-4" />
            Filter
          </Button>
          <CreateProgrammeDialog />
        </div>
      </div>

      {/* Programme Cards */}
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {filteredProgrammes.map((programme, index) => (
          <div
            key={programme.id}
            className="metric-card group animate-slide-up"
            style={{ animationDelay: `${index * 0.05}s` }}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-mono text-muted-foreground">{programme.id}</span>
                  <Badge variant="outline" className={cn("text-xs", statusConfig[programme.status].className)}>
                    {statusConfig[programme.status].label}
                  </Badge>
                </div>
                <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                  {programme.name}
                </h3>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </div>

            <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
              {programme.description}
            </p>

            <div className="space-y-3 mb-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Progress</span>
                <span className="font-medium">{programme.progress}%</span>
              </div>
              <Progress value={programme.progress} className="h-2" />
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span>{programme.tranche}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Users className="h-4 w-4" />
                <span>{programme.projectCount} Projects</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Target className="h-4 w-4" />
                <span>{programme.benefitsTarget}</span>
              </div>
              <div className="text-muted-foreground">
                Budget: {programme.budget}
              </div>
            </div>

            <div className="pt-4 border-t border-border flex items-center justify-between">
              <div className="text-sm">
                <span className="text-muted-foreground">Manager: </span>
                <span className="font-medium">{programme.manager}</span>
              </div>
              <Button variant="ghost" size="sm" className="gap-1">
                View Details
                <ArrowUpRight className="h-3 w-3" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </AppLayout>
  );
}
