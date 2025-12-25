import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Plus,
  Package,
  CheckCircle2,
  Clock,
  AlertTriangle,
  User,
  Calendar,
  Target,
  FileText,
  ChevronRight,
  Filter,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { toast } from "sonner";

interface Project {
  id: string;
  name: string;
  stage: string;
  health: string;
}

// Simulated work packages - in production, this would be a database table
interface WorkPackage {
  id: string;
  project_id: string;
  name: string;
  description: string;
  status: "pending" | "authorized" | "in_progress" | "completed" | "closed";
  assigned_to: string;
  work_description: string;
  deliverables: string;
  constraints: string;
  tolerances: string;
  reporting_requirements: string;
  target_start: string | null;
  target_end: string | null;
  progress: number;
}

const statusConfig = {
  pending: { label: "Pending", color: "bg-muted text-muted-foreground", icon: Clock },
  authorized: { label: "Authorized", color: "bg-info/10 text-info", icon: CheckCircle2 },
  in_progress: { label: "In Progress", color: "bg-warning/10 text-warning", icon: Clock },
  completed: { label: "Completed", color: "bg-success/10 text-success", icon: CheckCircle2 },
  closed: { label: "Closed", color: "bg-muted text-muted-foreground", icon: CheckCircle2 },
};

export default function WorkPackages() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedWorkPackage, setSelectedWorkPackage] = useState<WorkPackage | null>(null);
  const { currentOrganization } = useOrganization();

  // Simulated work packages
  const [workPackages, setWorkPackages] = useState<WorkPackage[]>([
    {
      id: "1",
      project_id: "",
      name: "WP001: Requirements Analysis",
      description: "Gather and document all business requirements",
      status: "completed",
      assigned_to: "Business Analyst",
      work_description: "Interview stakeholders, document requirements, create user stories",
      deliverables: "Requirements Document, User Stories, Acceptance Criteria",
      constraints: "Must align with enterprise architecture standards",
      tolerances: "Time: +5 days, Cost: +10%",
      reporting_requirements: "Weekly checkpoint report to Project Manager",
      target_start: "2024-01-01",
      target_end: "2024-01-31",
      progress: 100,
    },
    {
      id: "2",
      project_id: "",
      name: "WP002: Solution Design",
      description: "Design the technical solution architecture",
      status: "in_progress",
      assigned_to: "Solution Architect",
      work_description: "Create solution design, review with technical leads, document decisions",
      deliverables: "Solution Design Document, Architecture Diagrams, Technical Specifications",
      constraints: "Must use approved technology stack",
      tolerances: "Time: +3 days, Cost: +5%",
      reporting_requirements: "Bi-weekly design review meetings",
      target_start: "2024-02-01",
      target_end: "2024-02-28",
      progress: 65,
    },
    {
      id: "3",
      project_id: "",
      name: "WP003: Development Phase 1",
      description: "Develop core functionality",
      status: "authorized",
      assigned_to: "Development Team Lead",
      work_description: "Implement core features according to specifications",
      deliverables: "Working software, Unit tests, Code documentation",
      constraints: "Follow coding standards, 80% test coverage required",
      tolerances: "Time: +7 days, Cost: +15%",
      reporting_requirements: "Daily standups, Sprint reviews every 2 weeks",
      target_start: "2024-03-01",
      target_end: "2024-04-30",
      progress: 0,
    },
  ]);

  const [newWorkPackage, setNewWorkPackage] = useState({
    project_id: "",
    name: "",
    description: "",
    assigned_to: "",
    work_description: "",
    deliverables: "",
    constraints: "",
    tolerances: "",
    reporting_requirements: "",
    target_start: "",
    target_end: "",
  });

  const fetchData = async () => {
    setLoading(true);

    let projectQuery = supabase.from("projects").select("id, name, stage, health").order("name");
    if (currentOrganization) {
      projectQuery = projectQuery.eq("organization_id", currentOrganization.id);
    }

    const { data } = await projectQuery;
    setProjects(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [currentOrganization]);

  const handleCreateWorkPackage = () => {
    if (!newWorkPackage.name || !newWorkPackage.project_id) {
      toast.error("Please fill in required fields");
      return;
    }

    const wp: WorkPackage = {
      id: String(Date.now()),
      project_id: newWorkPackage.project_id,
      name: newWorkPackage.name,
      description: newWorkPackage.description,
      status: "pending",
      assigned_to: newWorkPackage.assigned_to,
      work_description: newWorkPackage.work_description,
      deliverables: newWorkPackage.deliverables,
      constraints: newWorkPackage.constraints,
      tolerances: newWorkPackage.tolerances,
      reporting_requirements: newWorkPackage.reporting_requirements,
      target_start: newWorkPackage.target_start || null,
      target_end: newWorkPackage.target_end || null,
      progress: 0,
    };

    setWorkPackages([...workPackages, wp]);
    toast.success("Work Package created");
    setIsCreateOpen(false);
    setNewWorkPackage({
      project_id: "",
      name: "",
      description: "",
      assigned_to: "",
      work_description: "",
      deliverables: "",
      constraints: "",
      tolerances: "",
      reporting_requirements: "",
      target_start: "",
      target_end: "",
    });
  };

  const handleUpdateStatus = (wpId: string, newStatus: WorkPackage["status"]) => {
    setWorkPackages(prev =>
      prev.map(wp => wp.id === wpId ? { ...wp, status: newStatus } : wp)
    );
    toast.success("Status updated");
  };

  const filteredWorkPackages = workPackages.filter(wp => {
    const matchesProject = projectFilter === "all" || wp.project_id === projectFilter;
    const matchesStatus = statusFilter === "all" || wp.status === statusFilter;
    return matchesProject && matchesStatus;
  });

  const getProjectName = (projectId: string) => {
    return projects.find(p => p.id === projectId)?.name || "Unassigned";
  };

  const statusCounts = {
    pending: workPackages.filter(wp => wp.status === "pending").length,
    authorized: workPackages.filter(wp => wp.status === "authorized").length,
    in_progress: workPackages.filter(wp => wp.status === "in_progress").length,
    completed: workPackages.filter(wp => wp.status === "completed").length,
  };

  return (
    <AppLayout title="Work Packages" subtitle="PRINCE2 Work Package Authorization and Tracking">
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <div className="metric-card text-center">
            <Clock className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
            <p className="text-2xl font-bold">{statusCounts.pending}</p>
            <p className="text-sm text-muted-foreground">Pending</p>
          </div>
          <div className="metric-card text-center">
            <CheckCircle2 className="h-6 w-6 mx-auto mb-2 text-info" />
            <p className="text-2xl font-bold text-info">{statusCounts.authorized}</p>
            <p className="text-sm text-muted-foreground">Authorized</p>
          </div>
          <div className="metric-card text-center">
            <Clock className="h-6 w-6 mx-auto mb-2 text-warning" />
            <p className="text-2xl font-bold text-warning">{statusCounts.in_progress}</p>
            <p className="text-sm text-muted-foreground">In Progress</p>
          </div>
          <div className="metric-card text-center">
            <CheckCircle2 className="h-6 w-6 mx-auto mb-2 text-success" />
            <p className="text-2xl font-bold text-success">{statusCounts.completed}</p>
            <p className="text-sm text-muted-foreground">Completed</p>
          </div>
        </div>

        {/* PRINCE2 Info */}
        <div className="p-4 rounded-lg bg-info/5 border border-info/20">
          <h4 className="font-medium text-sm mb-2 text-info">PRINCE2 Work Packages</h4>
          <p className="text-sm text-muted-foreground">
            Work Packages authorize team managers to deliver specific products. They define the work, 
            constraints, tolerances, and reporting requirements. Work is formally authorized before starting.
          </p>
        </div>

        {/* Filters and Actions */}
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <div className="flex gap-4">
            <Select value={projectFilter} onValueChange={setProjectFilter}>
              <SelectTrigger className="w-[200px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter by project" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Projects</SelectItem>
                {projects.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {Object.entries(statusConfig).map(([key, conf]) => (
                  <SelectItem key={key} value={key}>{conf.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Work Package
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create PRINCE2 Work Package</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Work Package Name *</Label>
                    <Input
                      value={newWorkPackage.name}
                      onChange={(e) => setNewWorkPackage({ ...newWorkPackage, name: e.target.value })}
                      placeholder="e.g., WP004: Testing"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Project *</Label>
                    <Select
                      value={newWorkPackage.project_id}
                      onValueChange={(v) => setNewWorkPackage({ ...newWorkPackage, project_id: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select project" />
                      </SelectTrigger>
                      <SelectContent>
                        {projects.map(p => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    value={newWorkPackage.description}
                    onChange={(e) => setNewWorkPackage({ ...newWorkPackage, description: e.target.value })}
                    placeholder="Brief description of the work package"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Assigned To</Label>
                    <Input
                      value={newWorkPackage.assigned_to}
                      onChange={(e) => setNewWorkPackage({ ...newWorkPackage, assigned_to: e.target.value })}
                      placeholder="Team or individual"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-2">
                      <Label>Target Start</Label>
                      <Input
                        type="date"
                        value={newWorkPackage.target_start}
                        onChange={(e) => setNewWorkPackage({ ...newWorkPackage, target_start: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Target End</Label>
                      <Input
                        type="date"
                        value={newWorkPackage.target_end}
                        onChange={(e) => setNewWorkPackage({ ...newWorkPackage, target_end: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Work Description</Label>
                  <Textarea
                    value={newWorkPackage.work_description}
                    onChange={(e) => setNewWorkPackage({ ...newWorkPackage, work_description: e.target.value })}
                    placeholder="Detailed description of work to be done"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Deliverables</Label>
                  <Textarea
                    value={newWorkPackage.deliverables}
                    onChange={(e) => setNewWorkPackage({ ...newWorkPackage, deliverables: e.target.value })}
                    placeholder="Products/deliverables expected"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Constraints</Label>
                    <Textarea
                      value={newWorkPackage.constraints}
                      onChange={(e) => setNewWorkPackage({ ...newWorkPackage, constraints: e.target.value })}
                      placeholder="Limitations to work within"
                      rows={2}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Tolerances</Label>
                    <Textarea
                      value={newWorkPackage.tolerances}
                      onChange={(e) => setNewWorkPackage({ ...newWorkPackage, tolerances: e.target.value })}
                      placeholder="e.g., Time: +5 days, Cost: +10%"
                      rows={2}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Reporting Requirements</Label>
                  <Input
                    value={newWorkPackage.reporting_requirements}
                    onChange={(e) => setNewWorkPackage({ ...newWorkPackage, reporting_requirements: e.target.value })}
                    placeholder="How and when to report progress"
                  />
                </div>
                <Button onClick={handleCreateWorkPackage} className="w-full">
                  Create Work Package
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Work Packages Table */}
        <div className="metric-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Work Package</TableHead>
                <TableHead>Assigned To</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Timeline</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">Loading...</TableCell>
                </TableRow>
              ) : filteredWorkPackages.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    <Package className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-muted-foreground">No work packages found</p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredWorkPackages.map(wp => {
                  const statusConf = statusConfig[wp.status];
                  const StatusIcon = statusConf.icon;

                  return (
                    <TableRow
                      key={wp.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setSelectedWorkPackage(wp)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Package className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium">{wp.name}</p>
                            <p className="text-xs text-muted-foreground line-clamp-1">{wp.description}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span>{wp.assigned_to || "Unassigned"}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={wp.status}
                          onValueChange={(v) => handleUpdateStatus(wp.id, v as WorkPackage["status"])}
                        >
                          <SelectTrigger className="w-[140px]" onClick={(e) => e.stopPropagation()}>
                            <Badge className={statusConf.color}>
                              <StatusIcon className="h-3 w-3 mr-1" />
                              {statusConf.label}
                            </Badge>
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(statusConfig).map(([key, conf]) => (
                              <SelectItem key={key} value={key}>{conf.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Calendar className="h-4 w-4" />
                          {wp.target_start ? new Date(wp.target_start).toLocaleDateString() : "TBD"} - {wp.target_end ? new Date(wp.target_end).toLocaleDateString() : "TBD"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 min-w-[100px]">
                          <Progress value={wp.progress} className="flex-1" />
                          <span className="text-sm font-medium w-10">{wp.progress}%</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon">
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Work Package Detail Dialog */}
        <Dialog open={!!selectedWorkPackage} onOpenChange={() => setSelectedWorkPackage(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{selectedWorkPackage?.name}</DialogTitle>
            </DialogHeader>
            {selectedWorkPackage && (
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 rounded-lg bg-secondary/50">
                    <p className="text-sm text-muted-foreground">Assigned To</p>
                    <p className="font-medium">{selectedWorkPackage.assigned_to || "Unassigned"}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-secondary/50">
                    <p className="text-sm text-muted-foreground">Status</p>
                    <Badge className={statusConfig[selectedWorkPackage.status].color}>
                      {statusConfig[selectedWorkPackage.status].label}
                    </Badge>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-secondary/50">
                  <p className="text-sm text-muted-foreground mb-1">Work Description</p>
                  <p className="text-sm">{selectedWorkPackage.work_description}</p>
                </div>

                <div className="p-3 rounded-lg bg-secondary/50">
                  <p className="text-sm text-muted-foreground mb-1">Deliverables</p>
                  <p className="text-sm">{selectedWorkPackage.deliverables}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 rounded-lg bg-secondary/50">
                    <p className="text-sm text-muted-foreground mb-1">Constraints</p>
                    <p className="text-sm">{selectedWorkPackage.constraints}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-warning/5 border border-warning/20">
                    <p className="text-sm text-muted-foreground mb-1">Tolerances</p>
                    <p className="text-sm font-medium">{selectedWorkPackage.tolerances}</p>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-secondary/50">
                  <p className="text-sm text-muted-foreground mb-1">Reporting Requirements</p>
                  <p className="text-sm">{selectedWorkPackage.reporting_requirements}</p>
                </div>

                <div className="flex justify-between items-center pt-4 border-t">
                  <div className="text-sm text-muted-foreground">
                    Progress: {selectedWorkPackage.progress}%
                  </div>
                  <Button variant="outline" onClick={() => setSelectedWorkPackage(null)}>
                    Close
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
