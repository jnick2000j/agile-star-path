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
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import {
  Plus,
  ClipboardCheck,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Calendar,
  FileCheck,
  ThumbsUp,
  Bug,
} from "lucide-react";
import { format, parseISO } from "date-fns";

type QualityStatus = "planned" | "in_progress" | "passed" | "failed" | "conditional";

interface QualityRecord {
  id: string;
  reference_number: string;
  title: string;
  description: string | null;
  quality_type: string;
  project_id: string | null;
  programme_id: string | null;
  product_id: string | null;
  deliverable_name: string | null;
  deliverable_version: string | null;
  status: QualityStatus;
  review_method: string | null;
  planned_date: string | null;
  actual_date: string | null;
  quality_criteria: string[] | null;
  acceptance_criteria: string | null;
  results: string | null;
  defects_found: number;
  approved: boolean;
  approved_by: string | null;
  approval_date: string | null;
  approval_comments: string | null;
  reviewer_id: string | null;
  reviewers: string[] | null;
  organization_id: string | null;
  owner_id: string | null;
  created_by: string | null;
  created_at: string;
}

const statusConfig: Record<QualityStatus, { label: string; icon: React.ElementType; color: string }> = {
  planned: { label: "Planned", icon: Clock, color: "bg-muted text-muted-foreground" },
  in_progress: { label: "In Progress", icon: ClipboardCheck, color: "bg-primary/20 text-primary" },
  passed: { label: "Passed", icon: CheckCircle2, color: "bg-success/20 text-success" },
  failed: { label: "Failed", icon: XCircle, color: "bg-destructive/20 text-destructive" },
  conditional: { label: "Conditional", icon: AlertTriangle, color: "bg-warning/20 text-warning" },
};

export default function QualityManagement() {
  const { currentOrganization } = useOrganization();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<QualityRecord | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    quality_type: "review",
    entity_type: "project",
    entity_id: "",
    deliverable_name: "",
    deliverable_version: "",
    planned_date: "",
    review_method: "",
    quality_criteria: "",
    acceptance_criteria: "",
  });

  // Fetch quality records
  const { data: qualityRecords = [], isLoading } = useQuery({
    queryKey: ["quality-records", currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization?.id) return [];
      const { data, error } = await supabase
        .from("quality_records")
        .select("*")
        .eq("organization_id", currentOrganization.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as QualityRecord[];
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
    const count = qualityRecords.length + 1;
    return `QR-${year}-${count.toString().padStart(4, "0")}`;
  };

  // Create quality record mutation
  const createQualityRecord = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase.from("quality_records").insert({
        reference_number: generateRefNumber(),
        title: data.title,
        description: data.description || null,
        quality_type: data.quality_type,
        deliverable_name: data.deliverable_name || null,
        deliverable_version: data.deliverable_version || null,
        planned_date: data.planned_date || null,
        review_method: data.review_method || null,
        quality_criteria: data.quality_criteria ? data.quality_criteria.split("\n").filter(Boolean) : null,
        acceptance_criteria: data.acceptance_criteria || null,
        organization_id: currentOrganization?.id,
        created_by: user?.id,
        owner_id: user?.id,
        reviewer_id: user?.id,
        project_id: data.entity_type === "project" && data.entity_id ? data.entity_id : null,
        programme_id: data.entity_type === "programme" && data.entity_id ? data.entity_id : null,
        product_id: data.entity_type === "product" && data.entity_id ? data.entity_id : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quality-records"] });
      toast.success("Quality record created");
      setDialogOpen(false);
      setFormData({
        title: "",
        description: "",
        quality_type: "review",
        entity_type: "project",
        entity_id: "",
        deliverable_name: "",
        deliverable_version: "",
        planned_date: "",
        review_method: "",
        quality_criteria: "",
        acceptance_criteria: "",
      });
    },
    onError: (error) => {
      toast.error("Failed to create quality record: " + error.message);
    },
  });

  // Update status/result mutation
  const updateRecord = useMutation({
    mutationFn: async ({ 
      id, 
      status, 
      results, 
      defects_found,
      approved 
    }: { 
      id: string; 
      status?: QualityStatus; 
      results?: string;
      defects_found?: number;
      approved?: boolean;
    }) => {
      const updateData: Record<string, unknown> = {};
      if (status) {
        updateData.status = status;
        if (status === "passed" || status === "failed" || status === "conditional") {
          updateData.actual_date = new Date().toISOString().split("T")[0];
        }
      }
      if (results !== undefined) updateData.results = results;
      if (defects_found !== undefined) updateData.defects_found = defects_found;
      if (approved !== undefined) {
        updateData.approved = approved;
        updateData.approved_by = user?.id;
        updateData.approval_date = new Date().toISOString().split("T")[0];
      }
      const { error } = await supabase.from("quality_records").update(updateData).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quality-records"] });
      toast.success("Record updated");
      setSelectedRecord(null);
    },
  });

  const getEntityName = (qr: QualityRecord) => {
    if (qr.project_id) {
      return projects.find((p) => p.id === qr.project_id)?.name || "Project";
    }
    if (qr.programme_id) {
      return programmes.find((p) => p.id === qr.programme_id)?.name || "Programme";
    }
    if (qr.product_id) {
      return products.find((p) => p.id === qr.product_id)?.name || "Product";
    }
    return "—";
  };

  const getEntityOptions = () => {
    if (formData.entity_type === "project") return projects;
    if (formData.entity_type === "programme") return programmes;
    if (formData.entity_type === "product") return products;
    return [];
  };

  // Filter
  const filteredRecords = qualityRecords.filter((qr) => {
    if (statusFilter !== "all" && qr.status !== statusFilter) return false;
    return true;
  });

  // Stats
  const stats = {
    total: qualityRecords.length,
    pending: qualityRecords.filter((qr) => qr.status === "planned" || qr.status === "in_progress").length,
    passed: qualityRecords.filter((qr) => qr.status === "passed").length,
    failed: qualityRecords.filter((qr) => qr.status === "failed").length,
    totalDefects: qualityRecords.reduce((sum, qr) => sum + (qr.defects_found || 0), 0),
  };

  return (
    <AppLayout
      title="Quality Management"
      subtitle="PRINCE2 quality reviews, acceptance criteria, and sign-off tracking"
    >
      {/* PRINCE2 Info */}
      <Card className="mb-6 bg-primary/5 border-primary/20">
        <CardContent className="pt-4">
          <div className="flex items-start gap-3">
            <ClipboardCheck className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <h4 className="font-semibold text-primary">PRINCE2 Quality Management</h4>
              <p className="text-sm text-muted-foreground">
                Quality records track product reviews against defined quality criteria.
                Each deliverable must meet acceptance criteria before sign-off.
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
                <p className="text-sm text-muted-foreground">Total Reviews</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <ClipboardCheck className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending</p>
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
                <p className="text-sm text-muted-foreground">Passed</p>
                <p className="text-2xl font-bold">{stats.passed}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-success" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Failed</p>
                <p className="text-2xl font-bold">{stats.failed}</p>
              </div>
              <XCircle className="h-8 w-8 text-destructive" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Defects Found</p>
                <p className="text-2xl font-bold">{stats.totalDefects}</p>
              </div>
              <Bug className="h-8 w-8 text-warning" />
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
            <SelectItem value="planned">Planned</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="passed">Passed</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="conditional">Conditional</SelectItem>
          </SelectContent>
        </Select>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Quality Review
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Quality Review</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <label className="text-sm font-medium">Review Title</label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g., Design Document Review"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Description</label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Review description"
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium">Review Type</label>
                  <Select
                    value={formData.quality_type}
                    onValueChange={(v) => setFormData({ ...formData, quality_type: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="review">Document Review</SelectItem>
                      <SelectItem value="inspection">Inspection</SelectItem>
                      <SelectItem value="test">Test</SelectItem>
                      <SelectItem value="audit">Audit</SelectItem>
                      <SelectItem value="walkthrough">Walkthrough</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Review Method</label>
                  <Input
                    value={formData.review_method}
                    onChange={(e) => setFormData({ ...formData, review_method: e.target.value })}
                    placeholder="e.g., Peer Review"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Planned Date</label>
                  <Input
                    type="date"
                    value={formData.planned_date}
                    onChange={(e) => setFormData({ ...formData, planned_date: e.target.value })}
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
                      <SelectItem value="programme">Programme</SelectItem>
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
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Deliverable Name</label>
                  <Input
                    value={formData.deliverable_name}
                    onChange={(e) => setFormData({ ...formData, deliverable_name: e.target.value })}
                    placeholder="e.g., Project Plan"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Version</label>
                  <Input
                    value={formData.deliverable_version}
                    onChange={(e) => setFormData({ ...formData, deliverable_version: e.target.value })}
                    placeholder="e.g., 1.0"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Quality Criteria (one per line)</label>
                <Textarea
                  value={formData.quality_criteria}
                  onChange={(e) => setFormData({ ...formData, quality_criteria: e.target.value })}
                  placeholder="Complete and accurate content&#10;Follows template standards&#10;No grammatical errors"
                  rows={3}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Acceptance Criteria</label>
                <Textarea
                  value={formData.acceptance_criteria}
                  onChange={(e) => setFormData({ ...formData, acceptance_criteria: e.target.value })}
                  placeholder="Define what constitutes acceptance"
                />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => createQualityRecord.mutate(formData)}
                  disabled={!formData.title || !formData.entity_id || createQualityRecord.isPending}
                >
                  Create Review
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Quality Records Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reference</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Deliverable</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Defects</TableHead>
                <TableHead>Approved</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    Loading quality records...
                  </TableCell>
                </TableRow>
              ) : filteredRecords.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    No quality records found.
                  </TableCell>
                </TableRow>
              ) : (
                filteredRecords.map((qr) => {
                  const config = statusConfig[qr.status];
                  const StatusIcon = config.icon;
                  return (
                    <TableRow key={qr.id} className="cursor-pointer" onClick={() => setSelectedRecord(qr)}>
                      <TableCell className="font-mono text-sm">{qr.reference_number}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{qr.title}</p>
                          {qr.planned_date && (
                            <p className="text-xs text-muted-foreground">
                              Planned: {format(parseISO(qr.planned_date), "MMM d, yyyy")}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {qr.deliverable_name ? (
                          <div>
                            <p className="text-sm">{qr.deliverable_name}</p>
                            {qr.deliverable_version && (
                              <p className="text-xs text-muted-foreground">v{qr.deliverable_version}</p>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{getEntityName(qr)}</Badge>
                      </TableCell>
                      <TableCell className="capitalize">{qr.quality_type}</TableCell>
                      <TableCell>
                        <Badge className={config.color}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {config.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {qr.defects_found > 0 ? (
                          <Badge variant="outline" className="border-warning text-warning">
                            <Bug className="h-3 w-3 mr-1" />
                            {qr.defects_found}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {qr.approved ? (
                          <Badge className="bg-success/20 text-success">
                            <ThumbsUp className="h-3 w-3 mr-1" />
                            Approved
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setSelectedRecord(qr); }}>
                          View
                        </Button>
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
      <Dialog open={!!selectedRecord} onOpenChange={() => setSelectedRecord(null)}>
        <DialogContent className="max-w-2xl">
          {selectedRecord && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <ClipboardCheck className="h-5 w-5" />
                  <span className="font-mono text-sm text-muted-foreground">
                    {selectedRecord.reference_number}
                  </span>
                  {selectedRecord.title}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Type</p>
                    <p className="font-medium capitalize">{selectedRecord.quality_type}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Status</p>
                    <Badge className={statusConfig[selectedRecord.status].color}>
                      {statusConfig[selectedRecord.status].label}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Defects Found</p>
                    <p className="font-medium">{selectedRecord.defects_found}</p>
                  </div>
                </div>

                {selectedRecord.deliverable_name && (
                  <div className="flex gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Deliverable</p>
                      <p className="font-medium">{selectedRecord.deliverable_name}</p>
                    </div>
                    {selectedRecord.deliverable_version && (
                      <div>
                        <p className="text-sm text-muted-foreground">Version</p>
                        <p className="font-medium">{selectedRecord.deliverable_version}</p>
                      </div>
                    )}
                  </div>
                )}

                {selectedRecord.quality_criteria && selectedRecord.quality_criteria.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-2">Quality Criteria</p>
                    <ul className="space-y-1">
                      {selectedRecord.quality_criteria.map((criteria, i) => (
                        <li key={i} className="flex items-center gap-2 text-sm">
                          <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                          {criteria}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {selectedRecord.acceptance_criteria && (
                  <div>
                    <p className="text-sm text-muted-foreground">Acceptance Criteria</p>
                    <p>{selectedRecord.acceptance_criteria}</p>
                  </div>
                )}

                {selectedRecord.results && (
                  <div>
                    <p className="text-sm text-muted-foreground">Results</p>
                    <p className="bg-muted p-3 rounded">{selectedRecord.results}</p>
                  </div>
                )}

                <div className="border-t pt-4">
                  <p className="text-sm font-medium mb-3">Update Status</p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => updateRecord.mutate({ id: selectedRecord.id, status: "in_progress" })}
                    >
                      <Clock className="h-4 w-4 mr-1" />
                      In Progress
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-success text-success hover:bg-success/10"
                      onClick={() => updateRecord.mutate({ id: selectedRecord.id, status: "passed" })}
                    >
                      <CheckCircle2 className="h-4 w-4 mr-1" />
                      Pass
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-warning text-warning hover:bg-warning/10"
                      onClick={() => updateRecord.mutate({ id: selectedRecord.id, status: "conditional" })}
                    >
                      <AlertTriangle className="h-4 w-4 mr-1" />
                      Conditional
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-destructive text-destructive hover:bg-destructive/10"
                      onClick={() => updateRecord.mutate({ id: selectedRecord.id, status: "failed" })}
                    >
                      <XCircle className="h-4 w-4 mr-1" />
                      Fail
                    </Button>
                  </div>

                  {(selectedRecord.status === "passed" || selectedRecord.status === "conditional") && !selectedRecord.approved && (
                    <div className="mt-4">
                      <Button
                        className="bg-success hover:bg-success/90"
                        onClick={() => updateRecord.mutate({ id: selectedRecord.id, approved: true })}
                      >
                        <ThumbsUp className="h-4 w-4 mr-2" />
                        Approve & Sign Off
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
