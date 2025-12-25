import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Plus, 
  Search, 
  Filter,
  LayoutGrid,
  List,
  Calendar,
  User,
  Clock,
  ArrowUpRight
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Project {
  id: string;
  name: string;
  programme: string;
  stage: "initiating" | "planning" | "executing" | "closing" | "completed";
  priority: "high" | "medium" | "low";
  manager: string;
  startDate: string;
  endDate: string;
  health: "green" | "amber" | "red";
  methodology: "PRINCE2" | "Agile" | "Hybrid";
}

const projects: Project[] = [
  { id: "PRJ001", name: "Mobile App Redesign", programme: "Digital Transformation", stage: "executing", priority: "high", manager: "Alex Turner", startDate: "Feb 2024", endDate: "Jul 2024", health: "green", methodology: "Agile" },
  { id: "PRJ002", name: "API Gateway Implementation", programme: "Digital Transformation", stage: "planning", priority: "high", manager: "Rachel Green", startDate: "Mar 2024", endDate: "Sep 2024", health: "amber", methodology: "Hybrid" },
  { id: "PRJ003", name: "Customer Portal V2", programme: "Customer Experience", stage: "executing", priority: "medium", manager: "Chris Martin", startDate: "Jan 2024", endDate: "Jun 2024", health: "red", methodology: "PRINCE2" },
  { id: "PRJ004", name: "Data Warehouse Migration", programme: "Infrastructure Modernization", stage: "executing", priority: "high", manager: "Diana Ross", startDate: "Nov 2023", endDate: "May 2024", health: "green", methodology: "PRINCE2" },
  { id: "PRJ005", name: "Identity Management System", programme: "Security Enhancement", stage: "closing", priority: "high", manager: "Frank Castle", startDate: "Jun 2023", endDate: "Feb 2024", health: "green", methodology: "Hybrid" },
  { id: "PRJ006", name: "Chatbot Integration", programme: "Customer Experience", stage: "initiating", priority: "low", manager: "Grace Hopper", startDate: "Apr 2024", endDate: "Aug 2024", health: "green", methodology: "Agile" },
  { id: "PRJ007", name: "Cloud Cost Optimization", programme: "Infrastructure Modernization", stage: "executing", priority: "medium", manager: "Henry Ford", startDate: "Feb 2024", endDate: "Jul 2024", health: "amber", methodology: "Agile" },
  { id: "PRJ008", name: "Reporting Dashboard", programme: "Data Analytics Platform", stage: "planning", priority: "medium", manager: "Irene Adler", startDate: "May 2024", endDate: "Oct 2024", health: "green", methodology: "PRINCE2" },
];

const stageConfig = {
  initiating: { label: "Initiating", className: "bg-info/10 text-info" },
  planning: { label: "Planning", className: "bg-primary/10 text-primary" },
  executing: { label: "Executing", className: "bg-success/10 text-success" },
  closing: { label: "Closing", className: "bg-warning/10 text-warning" },
  completed: { label: "Completed", className: "bg-muted text-muted-foreground" },
};

const healthConfig = {
  green: "bg-success",
  amber: "bg-warning",
  red: "bg-destructive",
};

const priorityConfig = {
  high: { label: "High", className: "bg-destructive/10 text-destructive" },
  medium: { label: "Medium", className: "bg-warning/10 text-warning" },
  low: { label: "Low", className: "bg-success/10 text-success" },
};

export default function Projects() {
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");

  const filteredProjects = projects.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.programme.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <AppLayout title="Projects" subtitle="Manage all projects across programmes">
      {/* Actions Bar */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search projects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          <div className="flex border border-border rounded-lg p-1">
            <Button
              variant={viewMode === "list" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setViewMode("list")}
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "grid" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setViewMode("grid")}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
          </div>
          <Button variant="outline" className="gap-2">
            <Filter className="h-4 w-4" />
            Filter
          </Button>
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            New Project
          </Button>
        </div>
      </div>

      {/* Projects Table */}
      <div className="metric-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[80px]">ID</TableHead>
              <TableHead>Project Name</TableHead>
              <TableHead>Programme</TableHead>
              <TableHead>Stage</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Health</TableHead>
              <TableHead>Methodology</TableHead>
              <TableHead>Manager</TableHead>
              <TableHead>Timeline</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredProjects.map((project, index) => (
              <TableRow 
                key={project.id} 
                className="animate-fade-in cursor-pointer hover:bg-muted/50"
                style={{ animationDelay: `${index * 0.03}s` }}
              >
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {project.id}
                </TableCell>
                <TableCell className="font-medium">{project.name}</TableCell>
                <TableCell className="text-muted-foreground">{project.programme}</TableCell>
                <TableCell>
                  <Badge variant="secondary" className={cn("text-xs", stageConfig[project.stage].className)}>
                    {stageConfig[project.stage].label}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary" className={cn("text-xs", priorityConfig[project.priority].className)}>
                    {priorityConfig[project.priority].label}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className={cn("h-2.5 w-2.5 rounded-full", healthConfig[project.health])} />
                    <span className="text-sm capitalize">{project.health}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs">
                    {project.methodology}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">{project.manager}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {project.startDate} - {project.endDate}
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
