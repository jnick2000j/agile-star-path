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
  AlertTriangle,
  ArrowUpCircle,
  CheckCircle2,
  Clock,
  XCircle,
  TrendingUp,
  TrendingDown,
  Target,
} from "lucide-react";
import { format, parseISO } from "date-fns";

type ExceptionStatus = "raised" | "under_review" | "escalated" | "resolved" | "closed";

interface Exception {
  id: string;
  reference_number: string;
  title: string;
  description: string | null;
  exception_type: string;
  project_id: string | null;
  programme_id: string | null;
  status: ExceptionStatus;
  severity: string;
  tolerance_type: string | null;
  original_tolerance: string | null;
  current_forecast: string | null;
  variance: string | null;
  cause: string | null;
  impact: string | null;
  options: string[] | null;
  recommendation: string | null;
  escalated_to: string | null;
  escalation_date: string | null;
  escalation_notes: string | null;
  resolution: string | null;
  resolution_date: string | null;
  resolved_by: string | null;
  date_raised: string;
  organization_id: string | null;
  raised_by: string | null;
  owner_id: string | null;
  created_by: string | null;
}

const statusConfig: Record<ExceptionStatus, { label: string; icon: React.ElementType; color: string }> = {
  raised: { label: "Raised", icon: AlertTriangle, color: "bg-warning/20 text-warning" },
  under_review: { label: "Under Review", icon: Clock, color: "bg-primary/20 text-primary" },
  escalated: { label: "Escalated", icon: ArrowUpCircle, color: "bg-destructive/20 text-destructive" },
  resolved: { label: "Resolved", icon: CheckCircle2, color: "bg-success/20 text-success" },
  closed: { label: "Closed", icon: XCircle, color: "bg-muted text-muted-foreground" },
};

export default function ExceptionManagement() {
  const { currentOrganization } = useOrganization();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedException, setSelectedException] = useState<Exception | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    exception_type: "time",
    severity: "medium",
    entity_type: "project",
    entity_id: "",
    tolerance_type: "",
    original_tolerance: "",
    current_forecast: "",
    cause: "",
    impact: "",
    recommendation: "",
  });

  // Fetch exceptions
  const { data: exceptions = [], isLoading } = useQuery({
    queryKey: ["exceptions", currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization?.id) return [];
      const { data, error } = await supabase
        .from("exceptions")
        .select("*")
        .eq("organization_id", currentOrganization.id)
        .order("date_raised", { ascending: false });
      if (error) throw error;
      return data as Exception[];
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

  // Generate reference number
  const generateRefNumber = () => {
    const year = new Date().getFullYear();
    const count = exceptions.length + 1;
    return `EX-${year}-${count.toString().padStart(4, "0")}`;
  };

  // Calculate variance
  const calculateVariance = () => {
    if (!formData.original_tolerance || !formData.current_forecast) return "";
    const original = parseFloat(formData.original_tolerance);
    const forecast = parseFloat(formData.current_forecast);
    if (isNaN(original) || isNaN(forecast)) return "";
    const variance = forecast - original;
    const percentage = ((variance / original) * 100).toFixed(1);
    return `${variance >= 0 ? "+" : ""}${variance} (${percentage}%)`;
  };

  // Create exception mutation
  const createException = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase.from("exceptions").insert({
        reference_number: generateRefNumber(),
        title: data.title,
        description: data.description || null,
        exception_type: data.exception_type,
        severity: data.severity,
        tolerance_type: data.tolerance_type || null,
        original_tolerance: data.original_tolerance || null,
        current_forecast: data.current_forecast || null,
        variance: calculateVariance() || null,
        cause: data.cause || null,
        impact: data.impact || null,
        recommendation: data.recommendation || null,
        organization_id: currentOrganization?.id,
        created_by: user?.id,
        raised_by: user?.id,
        owner_id: user?.id,
        project_id: data.entity_type === "project" && data.entity_id ? data.entity_id : null,
        programme_id: data.entity_type === "programme" && data.entity_id ? data.entity_id : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exceptions"] });
      toast.success("Exception raised");
      setDialogOpen(false);
      setFormData({
        title: "",
        description: "",
        exception_type: "time",
        severity: "medium",
        entity_type: "project",
        entity_id: "",
        tolerance_type: "",
        original_tolerance: "",
        current_forecast: "",
        cause: "",
        impact: "",
        recommendation: "",
      });
    },
    onError: (error) => {
      toast.error("Failed to raise exception: " + error.message);
    },
  });

  // Update status mutation
  const updateStatus = useMutation({
    mutationFn: async ({ id, status, resolution }: { id: string; status: ExceptionStatus; resolution?: string }) => {
      const updateData: Record<string, unknown> = { status };
      if (status === "escalated") {
        updateData.escalation_date = new Date().toISOString().split("T")[0];
        updateData.escalated_to = user?.id;
      }
      if (status === "resolved" || status === "closed") {
        updateData.resolution_date = new Date().toISOString().split("T")[0];
        updateData.resolved_by = user?.id;
        if (resolution) updateData.resolution = resolution;
      }
      const { error } = await supabase.from("exceptions").update(updateData).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exceptions"] });
      toast.success("Status updated");
      setSelectedException(null);
    },
  });

  const getEntityName = (ex: Exception) => {
    if (ex.project_id) {
      return projects.find((p) => p.id === ex.project_id)?.name || "Project";
    }
    if (ex.programme_id) {
      return programmes.find((p) => p.id === ex.programme_id)?.name || "Programme";
    }
    return "—";
  };

  const getEntityOptions = () => {
    if (formData.entity_type === "project") return projects;
    if (formData.entity_type === "programme") return programmes;
    return [];
  };

  // Filter
  const filteredExceptions = exceptions.filter((ex) => {
    if (statusFilter !== "all" && ex.status !== statusFilter) return false;
    return true;
  });

  // Stats
  const stats = {
    total: exceptions.length,
    open: exceptions.filter((ex) => ex.status === "raised" || ex.status === "under_review").length,
    escalated: exceptions.filter((ex) => ex.status === "escalated").length,
    resolved: exceptions.filter((ex) => ex.status === "resolved" || ex.status === "closed").length,
  };

  return (
    <AppLayout
      title="Exception Management"
      subtitle="PRINCE2 tolerance breaches and escalation management"
    >
      {/* PRINCE2 Info */}
      <Card className="mb-6 bg-warning/5 border-warning/20">
        <CardContent className="pt-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-warning mt-0.5" />
            <div>
              <h4 className="font-semibold text-warning">PRINCE2 Exception Management</h4>
              <p className="text-sm text-muted-foreground">
                Exceptions are raised when project tolerances (time, cost, scope, quality, risk, benefit) 
                are forecast to be exceeded. They require escalation to the Project Board for a decision.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Exceptions</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Open</p>
                <p className="text-2xl font-bold">{stats.open}</p>
              </div>
              <Clock className="h-8 w-8 text-warning" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Escalated</p>
                <p className="text-2xl font-bold">{stats.escalated}</p>
              </div>
              <ArrowUpCircle className="h-8 w-8 text-destructive" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Resolved</p>
                <p className="text-2xl font-bold">{stats.resolved}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-success" />
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
            <SelectItem value="raised">Raised</SelectItem>
            <SelectItem value="under_review">Under Review</SelectItem>
            <SelectItem value="escalated">Escalated</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
          </SelectContent>
        </Select>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-warning text-warning-foreground hover:bg-warning/90">
              <AlertTriangle className="h-4 w-4 mr-2" />
              Raise Exception
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Raise Exception</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <label className="text-sm font-medium">Exception Title</label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Brief description of the tolerance breach"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Description</label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Detailed description"
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium">Exception Type</label>
                  <Select
                    value={formData.exception_type}
                    onValueChange={(v) => setFormData({ ...formData, exception_type: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="time">Time</SelectItem>
                      <SelectItem value="cost">Cost</SelectItem>
                      <SelectItem value="scope">Scope</SelectItem>
                      <SelectItem value="quality">Quality</SelectItem>
                      <SelectItem value="risk">Risk</SelectItem>
                      <SelectItem value="benefit">Benefit</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Severity</label>
                  <Select
                    value={formData.severity}
                    onValueChange={(v) => setFormData({ ...formData, severity: v })}
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
                  <label className="text-sm font-medium">Tolerance Type</label>
                  <Input
                    value={formData.tolerance_type}
                    onChange={(e) => setFormData({ ...formData, tolerance_type: e.target.value })}
                    placeholder="e.g., Budget, Schedule"
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
              <div className="border-t pt-4">
                <h4 className="font-medium mb-3">Tolerance Details</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Original Tolerance</label>
                    <Input
                      value={formData.original_tolerance}
                      onChange={(e) => setFormData({ ...formData, original_tolerance: e.target.value })}
                      placeholder="e.g., $100,000 or 30 days"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Current Forecast</label>
                    <Input
                      value={formData.current_forecast}
                      onChange={(e) => setFormData({ ...formData, current_forecast: e.target.value })}
                      placeholder="e.g., $120,000 or 40 days"
                    />
                  </div>
                </div>
                {calculateVariance() && (
                  <div className="mt-2 p-2 bg-destructive/10 rounded flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-destructive" />
                    <span className="text-sm font-medium text-destructive">
                      Variance: {calculateVariance()}
                    </span>
                  </div>
                )}
              </div>
              <div>
                <label className="text-sm font-medium">Cause</label>
                <Textarea
                  value={formData.cause}
                  onChange={(e) => setFormData({ ...formData, cause: e.target.value })}
                  placeholder="What caused this tolerance breach?"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Impact</label>
                <Textarea
                  value={formData.impact}
                  onChange={(e) => setFormData({ ...formData, impact: e.target.value })}
                  placeholder="What is the impact on the project/programme?"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Recommendation</label>
                <Textarea
                  value={formData.recommendation}
                  onChange={(e) => setFormData({ ...formData, recommendation: e.target.value })}
                  placeholder="Recommended course of action"
                />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => createException.mutate(formData)}
                  disabled={!formData.title || !formData.entity_id || createException.isPending}
                  className="bg-warning text-warning-foreground hover:bg-warning/90"
                >
                  Raise Exception
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Exceptions Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reference</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Variance</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    Loading exceptions...
                  </TableCell>
                </TableRow>
              ) : filteredExceptions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No exceptions found.
                  </TableCell>
                </TableRow>
              ) : (
                filteredExceptions.map((ex) => {
                  const config = statusConfig[ex.status];
                  const StatusIcon = config.icon;
                  return (
                    <TableRow key={ex.id} className="cursor-pointer" onClick={() => setSelectedException(ex)}>
                      <TableCell className="font-mono text-sm">{ex.reference_number}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{ex.title}</p>
                          <p className="text-xs text-muted-foreground">
                            Raised: {format(parseISO(ex.date_raised), "MMM d, yyyy")}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{getEntityName(ex)}</Badge>
                      </TableCell>
                      <TableCell className="capitalize">{ex.exception_type}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            ex.severity === "critical"
                              ? "border-destructive text-destructive"
                              : ex.severity === "high"
                              ? "border-warning text-warning"
                              : ""
                          }
                        >
                          {ex.severity}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {ex.variance ? (
                          <span className="text-destructive font-medium text-sm">{ex.variance}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge className={config.color}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {config.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setSelectedException(ex); }}>
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
      <Dialog open={!!selectedException} onOpenChange={() => setSelectedException(null)}>
        <DialogContent className="max-w-2xl">
          {selectedException && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-warning" />
                  <span className="font-mono text-sm text-muted-foreground">
                    {selectedException.reference_number}
                  </span>
                  {selectedException.title}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Type</p>
                    <p className="font-medium capitalize">{selectedException.exception_type}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Severity</p>
                    <Badge
                      variant="outline"
                      className={
                        selectedException.severity === "critical"
                          ? "border-destructive text-destructive"
                          : selectedException.severity === "high"
                          ? "border-warning text-warning"
                          : ""
                      }
                    >
                      {selectedException.severity}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Status</p>
                    <Badge className={statusConfig[selectedException.status].color}>
                      {statusConfig[selectedException.status].label}
                    </Badge>
                  </div>
                </div>

                {(selectedException.original_tolerance || selectedException.current_forecast) && (
                  <Card className="bg-destructive/5 border-destructive/20">
                    <CardContent className="pt-4">
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <p className="text-sm text-muted-foreground">Original Tolerance</p>
                          <p className="font-medium">{selectedException.original_tolerance || "—"}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Current Forecast</p>
                          <p className="font-medium">{selectedException.current_forecast || "—"}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Variance</p>
                          <p className="font-medium text-destructive">{selectedException.variance || "—"}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {selectedException.cause && (
                  <div>
                    <p className="text-sm text-muted-foreground">Cause</p>
                    <p>{selectedException.cause}</p>
                  </div>
                )}

                {selectedException.impact && (
                  <div>
                    <p className="text-sm text-muted-foreground">Impact</p>
                    <p>{selectedException.impact}</p>
                  </div>
                )}

                {selectedException.recommendation && (
                  <div>
                    <p className="text-sm text-muted-foreground">Recommendation</p>
                    <p className="bg-muted p-3 rounded">{selectedException.recommendation}</p>
                  </div>
                )}

                {selectedException.resolution && (
                  <div>
                    <p className="text-sm text-muted-foreground">Resolution</p>
                    <p className="bg-success/10 p-3 rounded border border-success/20">{selectedException.resolution}</p>
                  </div>
                )}

                <div className="border-t pt-4">
                  <p className="text-sm font-medium mb-3">Update Status</p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => updateStatus.mutate({ id: selectedException.id, status: "under_review" })}
                    >
                      <Clock className="h-4 w-4 mr-1" />
                      Under Review
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-destructive text-destructive hover:bg-destructive/10"
                      onClick={() => updateStatus.mutate({ id: selectedException.id, status: "escalated" })}
                    >
                      <ArrowUpCircle className="h-4 w-4 mr-1" />
                      Escalate
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-success text-success hover:bg-success/10"
                      onClick={() => updateStatus.mutate({ id: selectedException.id, status: "resolved" })}
                    >
                      <CheckCircle2 className="h-4 w-4 mr-1" />
                      Resolve
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => updateStatus.mutate({ id: selectedException.id, status: "closed" })}
                    >
                      <XCircle className="h-4 w-4 mr-1" />
                      Close
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
