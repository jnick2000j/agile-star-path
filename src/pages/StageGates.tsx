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
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import {
  Plus,
  Flag,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Calendar,
  Users,
  ClipboardCheck,
  ArrowRight,
} from "lucide-react";
import { format, parseISO } from "date-fns";

type GateDecision = "pending" | "approved" | "conditional" | "rejected" | "deferred";

interface StageGate {
  id: string;
  name: string;
  stage_number: number;
  description: string | null;
  project_id: string | null;
  programme_id: string | null;
  gate_decision: GateDecision;
  decision_date: string | null;
  decision_notes: string | null;
  entry_criteria: string[] | null;
  exit_criteria: string[] | null;
  criteria_met: Record<string, boolean>;
  review_date: string | null;
  reviewed_by: string | null;
  planned_date: string | null;
  actual_date: string | null;
  organization_id: string | null;
  created_by: string | null;
  created_at: string;
}

const decisionConfig: Record<GateDecision, { label: string; icon: React.ElementType; color: string }> = {
  pending: { label: "Pending Review", icon: Clock, color: "bg-muted text-muted-foreground" },
  approved: { label: "Approved", icon: CheckCircle2, color: "bg-success/20 text-success" },
  conditional: { label: "Conditional", icon: AlertTriangle, color: "bg-warning/20 text-warning" },
  rejected: { label: "Rejected", icon: XCircle, color: "bg-destructive/20 text-destructive" },
  deferred: { label: "Deferred", icon: Clock, color: "bg-muted text-muted-foreground" },
};

export default function StageGates() {
  const { currentOrganization } = useOrganization();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedGate, setSelectedGate] = useState<StageGate | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    stage_number: 1,
    description: "",
    entity_type: "project",
    entity_id: "",
    planned_date: "",
    entry_criteria: "",
    exit_criteria: "",
  });

  // Fetch stage gates
  const { data: stageGates = [], isLoading } = useQuery({
    queryKey: ["stage-gates", currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization?.id) return [];
      const { data, error } = await supabase
        .from("stage_gates")
        .select("*")
        .eq("organization_id", currentOrganization.id)
        .order("stage_number", { ascending: true });
      if (error) throw error;
      return data as StageGate[];
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

  // Create stage gate mutation
  const createStageGate = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase.from("stage_gates").insert({
        name: data.name,
        stage_number: data.stage_number,
        description: data.description || null,
        planned_date: data.planned_date || null,
        entry_criteria: data.entry_criteria ? data.entry_criteria.split("\n").filter(Boolean) : null,
        exit_criteria: data.exit_criteria ? data.exit_criteria.split("\n").filter(Boolean) : null,
        organization_id: currentOrganization?.id,
        created_by: user?.id,
        project_id: data.entity_type === "project" && data.entity_id ? data.entity_id : null,
        programme_id: data.entity_type === "program" && data.entity_id ? data.entity_id : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stage-gates"] });
      toast.success("Stage gate created successfully");
      setDialogOpen(false);
      setFormData({
        name: "",
        stage_number: 1,
        description: "",
        entity_type: "project",
        entity_id: "",
        planned_date: "",
        entry_criteria: "",
        exit_criteria: "",
      });
    },
    onError: (error) => {
      toast.error("Failed to create stage gate: " + error.message);
    },
  });

  // Update gate decision
  const updateGateDecision = useMutation({
    mutationFn: async ({ id, decision, notes }: { id: string; decision: GateDecision; notes?: string }) => {
      const updateData: Record<string, unknown> = {
        gate_decision: decision,
        decision_date: new Date().toISOString().split("T")[0],
        reviewed_by: user?.id,
      };
      if (notes) updateData.decision_notes = notes;
      if (decision === "approved") {
        updateData.actual_date = new Date().toISOString().split("T")[0];
      }
      const { error } = await supabase.from("stage_gates").update(updateData).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stage-gates"] });
      toast.success("Gate decision updated");
      setSelectedGate(null);
    },
  });

  const getEntityName = (gate: StageGate) => {
    if (gate.project_id) {
      return projects.find((p) => p.id === gate.project_id)?.name || "Project";
    }
    if (gate.programme_id) {
      return programmes.find((p) => p.id === gate.programme_id)?.name || "Program";
    }
    return "—";
  };

  const getEntityOptions = () => {
    if (formData.entity_type === "project") return projects;
    if (formData.entity_type === "program") return programmes;
    return [];
  };

  // Stats
  const stats = {
    total: stageGates.length,
    pending: stageGates.filter((g) => g.gate_decision === "pending").length,
    approved: stageGates.filter((g) => g.gate_decision === "approved").length,
    conditional: stageGates.filter((g) => g.gate_decision === "conditional").length,
    rejected: stageGates.filter((g) => g.gate_decision === "rejected").length,
  };

  // Group by entity
  const groupedGates = stageGates.reduce((acc, gate) => {
    const entityName = getEntityName(gate);
    if (!acc[entityName]) acc[entityName] = [];
    acc[entityName].push(gate);
    return acc;
  }, {} as Record<string, StageGate[]>);

  return (
    <AppLayout
      title="Stage Gates"
      subtitle="PRINCE2 stage boundary reviews and go/no-go decision points"
    >
      {/* PRINCE2 Info Card */}
      <Card className="mb-6 bg-primary/5 border-primary/20">
        <CardContent className="pt-4">
          <div className="flex items-start gap-3">
            <Flag className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <h4 className="font-semibold text-primary">PRINCE2 Stage Gate Reviews</h4>
              <p className="text-sm text-muted-foreground">
                Stage gates are formal decision points where projects are reviewed before proceeding.
                Each gate evaluates entry/exit criteria and results in an approve, conditional, or reject decision.
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
                <p className="text-sm text-muted-foreground">Total Gates</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <Flag className="h-8 w-8 text-muted-foreground" />
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
              <Clock className="h-8 w-8 text-muted-foreground" />
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
                <p className="text-sm text-muted-foreground">Conditional</p>
                <p className="text-2xl font-bold">{stats.conditional}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-warning" />
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

      {/* Actions */}
      <div className="flex justify-end mb-6">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Stage Gate
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Create Stage Gate</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Gate Name</label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Stage 1 Gate"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Stage Number</label>
                  <Input
                    type="number"
                    min="1"
                    value={formData.stage_number}
                    onChange={(e) => setFormData({ ...formData, stage_number: parseInt(e.target.value) || 1 })}
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Description</label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Stage gate description"
                />
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
                      <SelectItem value="program">Programme</SelectItem>
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
                <label className="text-sm font-medium">Planned Review Date</label>
                <Input
                  type="date"
                  value={formData.planned_date}
                  onChange={(e) => setFormData({ ...formData, planned_date: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Entry Criteria (one per line)</label>
                <Textarea
                  value={formData.entry_criteria}
                  onChange={(e) => setFormData({ ...formData, entry_criteria: e.target.value })}
                  placeholder="All deliverables completed&#10;Budget within tolerance&#10;Risks assessed"
                  rows={3}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Exit Criteria (one per line)</label>
                <Textarea
                  value={formData.exit_criteria}
                  onChange={(e) => setFormData({ ...formData, exit_criteria: e.target.value })}
                  placeholder="Stage plan approved&#10;Resources confirmed&#10;Next stage authorized"
                  rows={3}
                />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => createStageGate.mutate(formData)}
                  disabled={!formData.name || !formData.entity_id || createStageGate.isPending}
                >
                  Create Gate
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stage Gates by Entity */}
      {isLoading ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Loading stage gates...
          </CardContent>
        </Card>
      ) : Object.keys(groupedGates).length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No stage gates defined. Create your first stage gate to start managing project stages.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {Object.entries(groupedGates).map(([entityName, gates]) => (
            <div key={entityName}>
              <h3 className="text-lg font-semibold mb-4">{entityName}</h3>
              <div className="flex items-center gap-4 overflow-x-auto pb-4">
                {gates
                  .sort((a, b) => a.stage_number - b.stage_number)
                  .map((gate, index) => {
                    const config = decisionConfig[gate.gate_decision];
                    const DecisionIcon = config.icon;

                    return (
                      <div key={gate.id} className="flex items-center gap-4">
                        <Card
                          className={`min-w-[280px] cursor-pointer hover:shadow-md transition-shadow ${
                            gate.gate_decision === "approved"
                              ? "border-success"
                              : gate.gate_decision === "rejected"
                              ? "border-destructive"
                              : gate.gate_decision === "conditional"
                              ? "border-warning"
                              : ""
                          }`}
                          onClick={() => setSelectedGate(gate)}
                        >
                          <CardHeader className="pb-2">
                            <div className="flex items-center justify-between">
                              <Badge variant="outline">Stage {gate.stage_number}</Badge>
                              <Badge className={config.color}>
                                <DecisionIcon className="h-3 w-3 mr-1" />
                                {config.label}
                              </Badge>
                            </div>
                            <CardTitle className="text-base">{gate.name}</CardTitle>
                          </CardHeader>
                          <CardContent>
                            {gate.description && (
                              <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                                {gate.description}
                              </p>
                            )}
                            <div className="space-y-1 text-xs text-muted-foreground">
                              {gate.planned_date && (
                                <div className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  Planned: {format(parseISO(gate.planned_date), "MMM d, yyyy")}
                                </div>
                              )}
                              {gate.entry_criteria && (
                                <div className="flex items-center gap-1">
                                  <ClipboardCheck className="h-3 w-3" />
                                  {gate.entry_criteria.length} entry criteria
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                        {index < gates.length - 1 && (
                          <ArrowRight className="h-6 w-6 text-muted-foreground flex-shrink-0" />
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Gate Detail Dialog */}
      <Dialog open={!!selectedGate} onOpenChange={() => setSelectedGate(null)}>
        <DialogContent className="max-w-2xl">
          {selectedGate && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Flag className="h-5 w-5" />
                  {selectedGate.name}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Stage Number</p>
                    <p className="font-medium">Stage {selectedGate.stage_number}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Current Decision</p>
                    <Badge className={decisionConfig[selectedGate.gate_decision].color}>
                      {decisionConfig[selectedGate.gate_decision].label}
                    </Badge>
                  </div>
                </div>

                {selectedGate.description && (
                  <div>
                    <p className="text-sm text-muted-foreground">Description</p>
                    <p>{selectedGate.description}</p>
                  </div>
                )}

                {selectedGate.entry_criteria && selectedGate.entry_criteria.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-2">Entry Criteria</p>
                    <ul className="space-y-1">
                      {selectedGate.entry_criteria.map((criteria, i) => (
                        <li key={i} className="flex items-center gap-2 text-sm">
                          <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                          {criteria}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {selectedGate.exit_criteria && selectedGate.exit_criteria.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-2">Exit Criteria</p>
                    <ul className="space-y-1">
                      {selectedGate.exit_criteria.map((criteria, i) => (
                        <li key={i} className="flex items-center gap-2 text-sm">
                          <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                          {criteria}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {selectedGate.decision_notes && (
                  <div>
                    <p className="text-sm text-muted-foreground">Decision Notes</p>
                    <p className="text-sm bg-muted p-3 rounded">{selectedGate.decision_notes}</p>
                  </div>
                )}

                <div className="border-t pt-4">
                  <p className="text-sm font-medium mb-3">Make Decision</p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="border-success text-success hover:bg-success/10"
                      onClick={() => updateGateDecision.mutate({ id: selectedGate.id, decision: "approved" })}
                    >
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Approve
                    </Button>
                    <Button
                      variant="outline"
                      className="border-warning text-warning hover:bg-warning/10"
                      onClick={() => updateGateDecision.mutate({ id: selectedGate.id, decision: "conditional" })}
                    >
                      <AlertTriangle className="h-4 w-4 mr-2" />
                      Conditional
                    </Button>
                    <Button
                      variant="outline"
                      className="border-destructive text-destructive hover:bg-destructive/10"
                      onClick={() => updateGateDecision.mutate({ id: selectedGate.id, decision: "rejected" })}
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Reject
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => updateGateDecision.mutate({ id: selectedGate.id, decision: "deferred" })}
                    >
                      <Clock className="h-4 w-4 mr-2" />
                      Defer
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
