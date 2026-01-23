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
  User,
  Calendar,
  FileText,
  ChevronRight,
  ChevronDown,
  Filter,
  Edit,
  Trash2,
  ListTodo,
  Target,
} from "lucide-react";
import { WorkPackageDetails } from "@/components/workpackages/WorkPackageDetails";
import { DocumentUpload } from "@/components/DocumentUpload";
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
import { Slider } from "@/components/ui/slider";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { toast } from "sonner";

interface Project {
  id: string;
  name: string;
  stage: string;
  health: string;
}

interface WorkPackage {
  id: string;
  project_id: string | null;
  organization_id: string | null;
  name: string;
  description: string | null;
  status: "pending" | "authorized" | "in_progress" | "completed" | "closed";
  assigned_to: string | null;
  work_description: string | null;
  deliverables: string | null;
  constraints: string | null;
  tolerances: string | null;
  reporting_requirements: string | null;
  target_start: string | null;
  target_end: string | null;
  progress: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

const statusConfig = {
  pending: { label: "Pending", color: "bg-muted text-muted-foreground", icon: Clock },
  authorized: { label: "Authorized", color: "bg-info/10 text-info", icon: CheckCircle2 },
  in_progress: { label: "In Progress", color: "bg-warning/10 text-warning", icon: Clock },
  completed: { label: "Completed", color: "bg-success/10 text-success", icon: CheckCircle2 },
  closed: { label: "Closed", color: "bg-muted text-muted-foreground", icon: CheckCircle2 },
};

type WorkPackageStatus = "pending" | "authorized" | "in_progress" | "completed" | "closed";

const defaultFormState: {
  project_id: string;
  name: string;
  description: string;
  assigned_to: string;
  work_description: string;
  deliverables: string;
  constraints: string;
  tolerances: string;
  reporting_requirements: string;
  target_start: string;
  target_end: string;
  progress: number;
  status: WorkPackageStatus;
} = {
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
  progress: 0,
  status: "pending",
};

export default function WorkPackages() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [workPackages, setWorkPackages] = useState<WorkPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedWorkPackage, setSelectedWorkPackage] = useState<WorkPackage | null>(null);
  const [formData, setFormData] = useState(defaultFormState);
  const [expandedWorkPackage, setExpandedWorkPackage] = useState<string | null>(null);
  const { currentOrganization } = useOrganization();

  const fetchData = async () => {
    setLoading(true);

    let projectQuery = supabase.from("projects").select("id, name, stage, health").order("name");
    if (currentOrganization) {
      projectQuery = projectQuery.eq("organization_id", currentOrganization.id);
    }

    let wpQuery = supabase.from("work_packages").select("*").order("created_at", { ascending: false });
    if (currentOrganization) {
      wpQuery = wpQuery.eq("organization_id", currentOrganization.id);
    }

    const [projectsRes, wpRes] = await Promise.all([projectQuery, wpQuery]);
    
    setProjects(projectsRes.data || []);
    setWorkPackages((wpRes.data as WorkPackage[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [currentOrganization]);

  const handleCreate = async () => {
    if (!formData.name || !formData.project_id) {
      toast.error("Please fill in required fields");
      return;
    }

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      toast.error("You must be logged in");
      return;
    }

    const { error } = await supabase.from("work_packages").insert({
      project_id: formData.project_id,
      organization_id: currentOrganization?.id || null,
      name: formData.name,
      description: formData.description || null,
      assigned_to: formData.assigned_to || null,
      work_description: formData.work_description || null,
      deliverables: formData.deliverables || null,
      constraints: formData.constraints || null,
      tolerances: formData.tolerances || null,
      reporting_requirements: formData.reporting_requirements || null,
      target_start: formData.target_start || null,
      target_end: formData.target_end || null,
      progress: formData.progress,
      status: formData.status,
      created_by: userData.user.id,
    });

    if (error) {
      toast.error("Failed to create work package");
      return;
    }

    toast.success("Work Package created");
    setIsCreateOpen(false);
    setFormData(defaultFormState);
    fetchData();
  };

  const handleUpdate = async () => {
    if (!selectedWorkPackage || !formData.name) {
      toast.error("Please fill in required fields");
      return;
    }

    const { error } = await supabase
      .from("work_packages")
      .update({
        project_id: formData.project_id || null,
        name: formData.name,
        description: formData.description || null,
        assigned_to: formData.assigned_to || null,
        work_description: formData.work_description || null,
        deliverables: formData.deliverables || null,
        constraints: formData.constraints || null,
        tolerances: formData.tolerances || null,
        reporting_requirements: formData.reporting_requirements || null,
        target_start: formData.target_start || null,
        target_end: formData.target_end || null,
        progress: formData.progress,
        status: formData.status,
      })
      .eq("id", selectedWorkPackage.id);

    if (error) {
      toast.error("Failed to update work package");
      return;
    }

    toast.success("Work Package updated");
    setIsEditOpen(false);
    setSelectedWorkPackage(null);
    setFormData(defaultFormState);
    fetchData();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("work_packages").delete().eq("id", id);
    if (error) {
      toast.error("Failed to delete work package");
      return;
    }
    toast.success("Work Package deleted");
    fetchData();
  };

  const openEditDialog = (wp: WorkPackage) => {
    setSelectedWorkPackage(wp);
    setFormData({
      project_id: wp.project_id || "",
      name: wp.name,
      description: wp.description || "",
      assigned_to: wp.assigned_to || "",
      work_description: wp.work_description || "",
      deliverables: wp.deliverables || "",
      constraints: wp.constraints || "",
      tolerances: wp.tolerances || "",
      reporting_requirements: wp.reporting_requirements || "",
      target_start: wp.target_start || "",
      target_end: wp.target_end || "",
      progress: wp.progress,
      status: wp.status,
    });
    setIsEditOpen(true);
  };

  const handleQuickProgressUpdate = async (id: string, progress: number) => {
    const { error } = await supabase
      .from("work_packages")
      .update({ progress })
      .eq("id", id);
    
    if (error) {
      toast.error("Failed to update progress");
      return;
    }
    
    setWorkPackages(prev => prev.map(wp => wp.id === id ? { ...wp, progress } : wp));
  };

  const handleQuickStatusUpdate = async (id: string, status: WorkPackage["status"]) => {
    const { error } = await supabase
      .from("work_packages")
      .update({ status })
      .eq("id", id);
    
    if (error) {
      toast.error("Failed to update status");
      return;
    }
    
    setWorkPackages(prev => prev.map(wp => wp.id === id ? { ...wp, status } : wp));
    toast.success("Status updated");
  };

  const filteredWorkPackages = workPackages.filter(wp => {
    const matchesProject = projectFilter === "all" || wp.project_id === projectFilter;
    const matchesStatus = statusFilter === "all" || wp.status === statusFilter;
    return matchesProject && matchesStatus;
  });

  const getProjectName = (projectId: string | null) => {
    return projects.find(p => p.id === projectId)?.name || "Unassigned";
  };

  const statusCounts = {
    pending: workPackages.filter(wp => wp.status === "pending").length,
    authorized: workPackages.filter(wp => wp.status === "authorized").length,
    in_progress: workPackages.filter(wp => wp.status === "in_progress").length,
    completed: workPackages.filter(wp => wp.status === "completed").length,
  };

  const WorkPackageForm = ({ isEdit = false }: { isEdit?: boolean }) => (
    <div className="space-y-4 py-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Work Package Name *</Label>
          <Input
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g., WP004: Testing"
          />
        </div>
        <div className="space-y-2">
          <Label>Project *</Label>
          <Select
            value={formData.project_id}
            onValueChange={(v) => setFormData({ ...formData, project_id: v })}
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
      
      {isEdit && (
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Status</Label>
            <Select
              value={formData.status}
              onValueChange={(v) => setFormData({ ...formData, status: v as WorkPackage["status"] })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(statusConfig).map(([key, conf]) => (
                  <SelectItem key={key} value={key}>{conf.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Progress: {formData.progress}%</Label>
            <Slider
              value={[formData.progress]}
              onValueChange={([v]) => setFormData({ ...formData, progress: v })}
              max={100}
              step={5}
              className="mt-2"
            />
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Label>Description</Label>
        <Textarea
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Brief description of the work package"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Assigned To</Label>
          <Input
            value={formData.assigned_to}
            onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value })}
            placeholder="Team or individual"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-2">
            <Label>Target Start</Label>
            <Input
              type="date"
              value={formData.target_start}
              onChange={(e) => setFormData({ ...formData, target_start: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Target End</Label>
            <Input
              type="date"
              value={formData.target_end}
              onChange={(e) => setFormData({ ...formData, target_end: e.target.value })}
            />
          </div>
        </div>
      </div>
      <div className="space-y-2">
        <Label>Work Description</Label>
        <Textarea
          value={formData.work_description}
          onChange={(e) => setFormData({ ...formData, work_description: e.target.value })}
          placeholder="Detailed description of work to be done"
        />
      </div>
      <div className="space-y-2">
        <Label>Deliverables</Label>
        <Textarea
          value={formData.deliverables}
          onChange={(e) => setFormData({ ...formData, deliverables: e.target.value })}
          placeholder="Products/deliverables expected"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Constraints</Label>
          <Textarea
            value={formData.constraints}
            onChange={(e) => setFormData({ ...formData, constraints: e.target.value })}
            placeholder="Limitations to work within"
            rows={2}
          />
        </div>
        <div className="space-y-2">
          <Label>Tolerances</Label>
          <Textarea
            value={formData.tolerances}
            onChange={(e) => setFormData({ ...formData, tolerances: e.target.value })}
            placeholder="e.g., Time: +5 days, Cost: +10%"
            rows={2}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Reporting Requirements</Label>
        <Input
          value={formData.reporting_requirements}
          onChange={(e) => setFormData({ ...formData, reporting_requirements: e.target.value })}
          placeholder="How and when to report progress"
        />
      </div>
      <Button onClick={isEdit ? handleUpdate : handleCreate} className="w-full">
        {isEdit ? "Update Work Package" : "Create Work Package"}
      </Button>
    </div>
  );

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

          <Dialog open={isCreateOpen} onOpenChange={(open) => {
            setIsCreateOpen(open);
            if (!open) setFormData(defaultFormState);
          }}>
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
              <WorkPackageForm />
            </DialogContent>
          </Dialog>
        </div>

        {/* Edit Dialog */}
        <Dialog open={isEditOpen} onOpenChange={(open) => {
          setIsEditOpen(open);
          if (!open) {
            setSelectedWorkPackage(null);
            setFormData(defaultFormState);
          }
        }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Work Package</DialogTitle>
            </DialogHeader>
            <WorkPackageForm isEdit />
          </DialogContent>
        </Dialog>

        {/* Work Packages Table */}
        <div className="metric-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10"></TableHead>
                <TableHead>Work Package</TableHead>
                <TableHead>Assigned To</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Timeline</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead className="w-[120px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">Loading...</TableCell>
                </TableRow>
              ) : filteredWorkPackages.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    <Package className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-muted-foreground">No work packages found</p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredWorkPackages.map(wp => {
                  const StatusIcon = statusConfig[wp.status].icon;
                  const isExpanded = expandedWorkPackage === wp.id;
                  return (
                    <>
                      <TableRow key={wp.id} className={isExpanded ? "border-b-0" : ""}>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => setExpandedWorkPackage(isExpanded ? null : wp.id)}
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </Button>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{wp.name}</p>
                            <p className="text-sm text-muted-foreground">{getProjectName(wp.project_id)}</p>
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
                            onValueChange={(v) => handleQuickStatusUpdate(wp.id, v as WorkPackage["status"])}
                          >
                            <SelectTrigger className="w-[140px] h-8">
                              <Badge className={statusConfig[wp.status].color}>
                                <StatusIcon className="h-3 w-3 mr-1" />
                                {statusConfig[wp.status].label}
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
                          <div className="flex items-center gap-2 text-sm">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <span>
                              {wp.target_start && wp.target_end
                                ? `${new Date(wp.target_start).toLocaleDateString()} - ${new Date(wp.target_end).toLocaleDateString()}`
                                : wp.target_start
                                  ? `From ${new Date(wp.target_start).toLocaleDateString()}`
                                  : wp.target_end
                                    ? `Until ${new Date(wp.target_end).toLocaleDateString()}`
                                    : "No dates set"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1 min-w-[120px]">
                            <div className="flex justify-between text-xs">
                              <span>Progress</span>
                              <span>{wp.progress}%</span>
                            </div>
                            <Slider
                              value={[wp.progress]}
                              onValueCommit={([v]) => handleQuickProgressUpdate(wp.id, v)}
                              max={100}
                              step={5}
                              className="cursor-pointer"
                            />
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <DocumentUpload
                              entityType="work_package"
                              entityId={wp.id}
                              entityName={wp.name}
                              variant="icon"
                            />
                            <Button variant="ghost" size="icon" onClick={() => openEditDialog(wp)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDelete(wp.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                      {isExpanded && (
                        <TableRow key={`${wp.id}-details`}>
                          <TableCell colSpan={7} className="p-0">
                            <WorkPackageDetails
                              workPackageId={wp.id}
                              projectId={wp.project_id}
                              organizationId={wp.organization_id}
                            />
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </AppLayout>
  );
}
