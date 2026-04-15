import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { DocumentUpload } from "@/components/DocumentUpload";
import {
  Plus,
  FileEdit,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  DollarSign,
  Calendar,
  Target,
  ArrowUpRight,
} from "lucide-react";
import { format, parseISO } from "date-fns";

type ChangeStatus = "pending" | "under_review" | "approved" | "rejected" | "implemented" | "withdrawn";

interface ChangeRequest {
  id: string;
  reference_number: string;
  title: string;
  description: string | null;
  change_type: string;
  project_id: string | null;
  programme_id: string | null;
  product_id: string | null;
  status: ChangeStatus;
  priority: string;
  impact_summary: string | null;
  cost_impact: number | null;
  time_impact_days: number | null;
  risk_impact: string | null;
  quality_impact: string | null;
  reason: string | null;
  benefits: string | null;
  date_raised: string;
  date_required: string | null;
  date_decided: string | null;
  date_implemented: string | null;
  decided_by: string | null;
  decision_notes: string | null;
  organization_id: string | null;
  raised_by: string | null;
  owner_id: string | null;
  created_by: string | null;
  created_at: string;
}

const statusConfig: Record<ChangeStatus, { label: string; icon: React.ElementType; color: string }> = {
  pending: { label: "Pending", icon: Clock, color: "bg-muted text-muted-foreground" },
  under_review: { label: "Under Review", icon: FileEdit, color: "bg-primary/20 text-primary" },
  approved: { label: "Approved", icon: CheckCircle2, color: "bg-success/20 text-success" },
  rejected: { label: "Rejected", icon: XCircle, color: "bg-destructive/20 text-destructive" },
  implemented: { label: "Implemented", icon: CheckCircle2, color: "bg-success/20 text-success" },
  withdrawn: { label: "Withdrawn", icon: XCircle, color: "bg-muted text-muted-foreground" },
};

export default function ChangeControl() {
  const { currentOrganization } = useOrganization();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<ChangeRequest | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    change_type: "scope",
    priority: "medium",
    entity_type: "project",
    entity_id: "",
    date_required: "",
    reason: "",
    benefits: "",
    impact_summary: "",
    cost_impact: "",
    time_impact_days: "",
  });

  // Fetch change requests
  const { data: changeRequests = [], isLoading } = useQuery({
    queryKey: ["change-requests", currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization?.id) return [];
      const { data, error } = await supabase
        .from("change_requests")
        .select("*")
        .eq("organization_id", currentOrganization.id)
        .order("date_raised", { ascending: false });
      if (error) throw error;
      return data as ChangeRequest[];
    },
    enabled: !!currentOrganization?.id,
  });

  // Fetch entities
  const { data: projects = [] } = useQuery({
    queryKey: ["projects-list", currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization?.id) return [];
      const { data, error } = await supabase
        .from("projects")
        .select("id, name")
        .eq("organization_id", currentOrganization.id);
      if (error) throw error;
      return data;
    },
    enabled: !!currentOrganization?.id,
  });

  const { data: programmes = [] } = useQuery({
    queryKey: ["programmes-list", currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization?.id) return [];
      const { data, error } = await supabase
        .from("programmes")
        .select("id, name")
        .eq("organization_id", currentOrganization.id);
      if (error) throw error;
      return data;
    },
    enabled: !!currentOrganization?.id,
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products-list", currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization?.id) return [];
      const { data, error } = await supabase
        .from("products")
        .select("id, name")
        .eq("organization_id", currentOrganization.id);
      if (error) throw error;
      return data;
    },
    enabled: !!currentOrganization?.id,
  });

  // Generate reference number
  const generateRefNumber = () => {
    const year = new Date().getFullYear();
    const count = changeRequests.length + 1;
    return `CR-${year}-${count.toString().padStart(4, "0")}`;
  };

  // Create change request mutation
  const createChangeRequest = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase.from("change_requests").insert({
        reference_number: generateRefNumber(),
        title: data.title,
        description: data.description || null,
        change_type: data.change_type,
        priority: data.priority,
        date_required: data.date_required || null,
        reason: data.reason || null,
        benefits: data.benefits || null,
        impact_summary: data.impact_summary || null,
        cost_impact: data.cost_impact ? parseFloat(data.cost_impact) : null,
        time_impact_days: data.time_impact_days ? parseInt(data.time_impact_days) : null,
        organization_id: currentOrganization?.id,
        created_by: user?.id,
        raised_by: user?.id,
        owner_id: user?.id,
        project_id: data.entity_type === "project" && data.entity_id ? data.entity_id : null,
        programme_id: data.entity_type === "program" && data.entity_id ? data.entity_id : null,
        product_id: data.entity_type === "product" && data.entity_id ? data.entity_id : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["change-requests"] });
      toast.success("Change request submitted");
      setDialogOpen(false);
      setFormData({
        title: "",
        description: "",
        change_type: "scope",
        priority: "medium",
        entity_type: "project",
        entity_id: "",
        date_required: "",
        reason: "",
        benefits: "",
        impact_summary: "",
        cost_impact: "",
        time_impact_days: "",
      });
    },
    onError: (error) => {
      toast.error("Failed to create change request: " + error.message);
    },
  });

  // Update status mutation
  const updateStatus = useMutation({
    mutationFn: async ({ id, status, notes }: { id: string; status: ChangeStatus; notes?: string }) => {
      const updateData: Record<string, unknown> = { status };
      if (status === "approved" || status === "rejected") {
        updateData.date_decided = new Date().toISOString().split("T")[0];
        updateData.decided_by = user?.id;
        if (notes) updateData.decision_notes = notes;
      }
      if (status === "implemented") {
        updateData.date_implemented = new Date().toISOString().split("T")[0];
      }
      const { error } = await supabase.from("change_requests").update(updateData).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["change-requests"] });
      toast.success("Status updated");
      setSelectedRequest(null);
    },
  });

  const getEntityName = (cr: ChangeRequest) => {
    if (cr.project_id) {
      return projects.find((p) => p.id === cr.project_id)?.name || "Project";
    }
    if (cr.programme_id) {
      return programmes.find((p) => p.id === cr.programme_id)?.name || "Program";
    }
    if (cr.product_id) {
      return products.find((p) => p.id === cr.product_id)?.name || "Product";
    }
    return "—";
  };

  const getEntityOptions = () => {
    if (formData.entity_type === "project") return projects;
    if (formData.entity_type === "program") return programmes;
    if (formData.entity_type === "product") return products;
    return [];
  };

  // Filter
  const filteredRequests = changeRequests.filter((cr) => {
    if (statusFilter !== "all" && cr.status !== statusFilter) return false;
    return true;
  });

  // Stats
  const stats = {
    total: changeRequests.length,
    pending: changeRequests.filter((cr) => cr.status === "pending" || cr.status === "under_review").length,
    approved: changeRequests.filter((cr) => cr.status === "approved").length,
    implemented: changeRequests.filter((cr) => cr.status === "implemented").length,
    rejected: changeRequests.filter((cr) => cr.status === "rejected").length,
  };

  return (
    <AppLayout
      title="Change Control"
      subtitle="PRINCE2 change request management with impact assessment"
    >
      {/* PRINCE2 Info */}
      <Card className="mb-6 bg-primary/5 border-primary/20">
        <CardContent className="pt-4">
          <div className="flex items-start gap-3">
            <FileEdit className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <h4 className="font-semibold text-primary">PRINCE2 Change Control</h4>
              <p className="text-sm text-muted-foreground">
                All changes to project scope, schedule, or budget must go through formal change control.
                Each request is assessed for impact on time, cost, quality, and risk before approval.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Requests</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <FileEdit className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending Review</p>
                <p className="text-2xl font-bold">{stats.pending}</p>
              </div>
              <Clock className="h-8 w-8 text-warning" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Approved</p>
                <p className="text-2xl font-bold">{stats.approved}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-success" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Implemented</p>
                <p className="text-2xl font-bold">{stats.implemented}</p>
              </div>
              <ArrowUpRight className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Rejected</p>
                <p className="text-2xl font-bold">{stats.rejected}</p>
              </div>
              <XCircle className="h-8 w-8 text-destructive" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Actions */}
      <div className="flex flex-wrap gap-4 mb-6 items-center justify-between">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="under_review">Under Review</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="implemented">Implemented</SelectItem>
          </SelectContent>
        </Select>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Change Request
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Submit Change Request</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <label className="text-sm font-medium">Title</label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Brief description of the change"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Description</label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Detailed description of the proposed change"
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium">Change Type</label>
                  <Select
                    value={formData.change_type}
                    onValueChange={(v) => setFormData({ ...formData, change_type: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="scope">Scope</SelectItem>
                      <SelectItem value="schedule">Schedule</SelectItem>
                      <SelectItem value="budget">Budget</SelectItem>
                      <SelectItem value="quality">Quality</SelectItem>
                      <SelectItem value="resource">Resource</SelectItem>
                      <SelectItem value="requirement">Requirement</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Priority</label>
                  <Select
                    value={formData.priority}
                    onValueChange={(v) => setFormData({ ...formData, priority: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Required By</label>
                  <Input
                    type="date"
                    value={formData.date_required}
                    onChange={(e) => setFormData({ ...formData, date_required: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Link To</label>
                  <Select
                    value={formData.entity_type}
                    onValueChange={(v) => setFormData({ ...formData, entity_type: v, entity_id: "" })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="project">Project</SelectItem>
                      <SelectItem value="program">Program</SelectItem>
                      <SelectItem value="product">Product</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Select {formData.entity_type}</label>
                  <Select
                    value={formData.entity_id}
                    onValueChange={(v) => setFormData({ ...formData, entity_id: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={`Select ${formData.entity_type}`} />
                    </SelectTrigger>
                    <SelectContent>
                      {getEntityOptions().map((entity) => (
                        <SelectItem key={entity.id} value={entity.id}>
                          {entity.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Reason for Change</label>
                <Textarea
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  placeholder="Why is this change needed?"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Expected Benefits</label>
                <Textarea
                  value={formData.benefits}
                  onChange={(e) => setFormData({ ...formData, benefits: e.target.value })}
                  placeholder="What benefits will this change deliver?"
                />
              </div>
              <div className="border-t pt-4">
                <h4 className="font-medium mb-3">Impact Assessment</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Cost Impact ($)</label>
                    <Input
                      type="number"
                      value={formData.cost_impact}
                      onChange={(e) => setFormData({ ...formData, cost_impact: e.target.value })}
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Time Impact (days)</label>
                    <Input
                      type="number"
                      value={formData.time_impact_days}
                      onChange={(e) => setFormData({ ...formData, time_impact_days: e.target.value })}
                      placeholder="0"
                    />
                  </div>
                </div>
                <div className="mt-4">
                  <label className="text-sm font-medium">Impact Summary</label>
                  <Textarea
                    value={formData.impact_summary}
                    onChange={(e) => setFormData({ ...formData, impact_summary: e.target.value })}
                    placeholder="Describe overall impact on project/program"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => createChangeRequest.mutate(formData)}
                  disabled={!formData.title || !formData.entity_id || createChangeRequest.isPending}
                >
                  Submit Request
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Change Requests Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reference</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Impact</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    Loading change requests...
                  </TableCell>
                </TableRow>
              ) : filteredRequests.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No change requests found.
                  </TableCell>
                </TableRow>
              ) : (
                filteredRequests.map((cr) => {
                  const config = statusConfig[cr.status];
                  const StatusIcon = config.icon;
                  return (
                    <TableRow key={cr.id} className="cursor-pointer" onClick={() => setSelectedRequest(cr)}>
                      <TableCell className="font-mono text-sm">{cr.reference_number}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{cr.title}</p>
                          <p className="text-xs text-muted-foreground">
                            Raised: {format(parseISO(cr.date_raised), "MMM d, yyyy")}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{getEntityName(cr)}</Badge>
                      </TableCell>
                      <TableCell className="capitalize">{cr.change_type}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            cr.priority === "critical"
                              ? "border-destructive text-destructive"
                              : cr.priority === "high"
                              ? "border-warning text-warning"
                              : ""
                          }
                        >
                          {cr.priority}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={config.color}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {config.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-xs">
                          {cr.cost_impact && (
                            <div className="flex items-center gap-1">
                              <DollarSign className="h-3 w-3" />
                              ${cr.cost_impact.toLocaleString()}
                            </div>
                          )}
                          {cr.time_impact_days && (
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {cr.time_impact_days} days
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <DocumentUpload
                            entityType="change_request"
                            entityId={cr.id}
                            entityName={cr.title}
                            variant="icon"
                          />
                          <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setSelectedRequest(cr); }}>
                            View
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={!!selectedRequest} onOpenChange={() => setSelectedRequest(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedRequest && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <span className="font-mono text-sm text-muted-foreground">
                    {selectedRequest.reference_number}
                  </span>
                  {selectedRequest.title}
                </DialogTitle>
              </DialogHeader>
              <Tabs defaultValue="details" className="mt-4">
                <TabsList>
                  <TabsTrigger value="details">Details</TabsTrigger>
                  <TabsTrigger value="impact">Impact</TabsTrigger>
                  <TabsTrigger value="decision">Decision</TabsTrigger>
                </TabsList>
                <TabsContent value="details" className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Type</p>
                      <p className="font-medium capitalize">{selectedRequest.change_type}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Priority</p>
                      <Badge
                        variant="outline"
                        className={
                          selectedRequest.priority === "critical"
                            ? "border-destructive text-destructive"
                            : selectedRequest.priority === "high"
                            ? "border-warning text-warning"
                            : ""
                        }
                      >
                        {selectedRequest.priority}
                      </Badge>
                    </div>
                  </div>
                  {selectedRequest.description && (
                    <div>
                      <p className="text-sm text-muted-foreground">Description</p>
                      <p>{selectedRequest.description}</p>
                    </div>
                  )}
                  {selectedRequest.reason && (
                    <div>
                      <p className="text-sm text-muted-foreground">Reason</p>
                      <p>{selectedRequest.reason}</p>
                    </div>
                  )}
                  {selectedRequest.benefits && (
                    <div>
                      <p className="text-sm text-muted-foreground">Expected Benefits</p>
                      <p>{selectedRequest.benefits}</p>
                    </div>
                  )}
                </TabsContent>
                <TabsContent value="impact" className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    {selectedRequest.cost_impact && (
                      <Card>
                        <CardContent className="pt-4">
                          <div className="flex items-center gap-2">
                            <DollarSign className="h-5 w-5 text-muted-foreground" />
                            <div>
                              <p className="text-sm text-muted-foreground">Cost Impact</p>
                              <p className="text-lg font-bold">${selectedRequest.cost_impact.toLocaleString()}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                    {selectedRequest.time_impact_days && (
                      <Card>
                        <CardContent className="pt-4">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-5 w-5 text-muted-foreground" />
                            <div>
                              <p className="text-sm text-muted-foreground">Time Impact</p>
                              <p className="text-lg font-bold">{selectedRequest.time_impact_days} days</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                  {selectedRequest.impact_summary && (
                    <div>
                      <p className="text-sm text-muted-foreground">Impact Summary</p>
                      <p className="bg-muted p-3 rounded">{selectedRequest.impact_summary}</p>
                    </div>
                  )}
                </TabsContent>
                <TabsContent value="decision" className="space-y-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Current Status:</span>
                    <Badge className={statusConfig[selectedRequest.status].color}>
                      {statusConfig[selectedRequest.status].label}
                    </Badge>
                  </div>
                  {selectedRequest.decision_notes && (
                    <div>
                      <p className="text-sm text-muted-foreground">Decision Notes</p>
                      <p className="bg-muted p-3 rounded">{selectedRequest.decision_notes}</p>
                    </div>
                  )}
                  <div className="border-t pt-4">
                    <p className="text-sm font-medium mb-3">Update Status</p>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => updateStatus.mutate({ id: selectedRequest.id, status: "under_review" })}
                      >
                        <Clock className="h-4 w-4 mr-1" />
                        Under Review
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-success text-success hover:bg-success/10"
                        onClick={() => updateStatus.mutate({ id: selectedRequest.id, status: "approved" })}
                      >
                        <CheckCircle2 className="h-4 w-4 mr-1" />
                        Approve
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-destructive text-destructive hover:bg-destructive/10"
                        onClick={() => updateStatus.mutate({ id: selectedRequest.id, status: "rejected" })}
                      >
                        <XCircle className="h-4 w-4 mr-1" />
                        Reject
                      </Button>
                      {selectedRequest.status === "approved" && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-primary text-primary hover:bg-primary/10"
                          onClick={() => updateStatus.mutate({ id: selectedRequest.id, status: "implemented" })}
                        >
                          <ArrowUpRight className="h-4 w-4 mr-1" />
                          Mark Implemented
                        </Button>
                      )}
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
