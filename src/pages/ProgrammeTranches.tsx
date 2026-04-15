import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import {
  Plus,
  ChevronRight,
  Calendar,
  CheckCircle2,
  Clock,
  PlayCircle,
  PauseCircle,
  Target,
  AlertTriangle,
  Edit,
  Trash2,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { toast } from "sonner";

interface Program {
  id: string;
  name: string;
  status: string;
}

interface Tranche {
  id: string;
  name: string;
  programme_id: string;
  organization_id: string | null;
  status: string;
  planned_start: string | null;
  planned_end: string | null;
  actual_start: string | null;
  actual_end: string | null;
  description: string | null;
  objectives: string[] | null;
  sequence_number: number;
  progress: number | null;
  gate_decision: string | null;
  gate_notes: string | null;
  gate_review_date: string | null;
}

const trancheStatuses = [
  { value: "planned", label: "Planned", icon: Clock, color: "bg-muted text-muted-foreground" },
  { value: "active", label: "Active", icon: PlayCircle, color: "bg-primary/10 text-primary" },
  { value: "paused", label: "Paused", icon: PauseCircle, color: "bg-warning/10 text-warning" },
  { value: "completed", label: "Completed", icon: CheckCircle2, color: "bg-success/10 text-success" },
];

const defaultFormState = {
  name: "",
  programme_id: "",
  planned_start: "",
  planned_end: "",
  description: "",
  objectives: "",
  status: "planned",
  progress: 0,
};

export default function ProgrammeTranches() {
  const [programmes, setProgrammes] = useState<Program[]>([]);
  const [tranches, setTranches] = useState<Tranche[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedTranche, setSelectedTranche] = useState<Tranche | null>(null);
  const [formData, setFormData] = useState(defaultFormState);
  const { currentOrganization } = useOrganization();

  const fetchData = async () => {
    setLoading(true);

    let programmeQuery = supabase.from("programmes").select("id, name, status").order("name");
    if (currentOrganization) {
      programmeQuery = programmeQuery.eq("organization_id", currentOrganization.id);
    }

    let trancheQuery = supabase.from("tranches").select("*").order("sequence_number");
    if (currentOrganization) {
      trancheQuery = trancheQuery.eq("organization_id", currentOrganization.id);
    }

    const [programmesRes, tranchesRes] = await Promise.all([programmeQuery, trancheQuery]);

    setProgrammes(programmesRes.data || []);
    setTranches((tranchesRes.data as Tranche[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [currentOrganization]);

  const getNextSequenceNumber = (programmeId: string) => {
    const programmeTranches = tranches.filter(t => t.programme_id === programmeId);
    return programmeTranches.length + 1;
  };

  const handleCreate = async () => {
    if (!formData.name || !formData.programme_id) {
      toast.error("Please fill in required fields");
      return;
    }

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      toast.error("You must be logged in");
      return;
    }

    const { error } = await supabase.from("tranches").insert({
      name: formData.name,
      programme_id: formData.programme_id,
      organization_id: currentOrganization?.id || null,
      planned_start: formData.planned_start || null,
      planned_end: formData.planned_end || null,
      description: formData.description || null,
      objectives: formData.objectives ? formData.objectives.split("\n").filter(o => o.trim()) : null,
      sequence_number: getNextSequenceNumber(formData.programme_id),
      status: "planned",
      progress: 0,
      created_by: userData.user.id,
    });

    if (error) {
      toast.error("Failed to create tranche");
      return;
    }

    toast.success("Tranche created");
    setIsCreateOpen(false);
    setFormData(defaultFormState);
    fetchData();
  };

  const handleUpdate = async () => {
    if (!selectedTranche || !formData.name) {
      toast.error("Please fill in required fields");
      return;
    }

    const { error } = await supabase
      .from("tranches")
      .update({
        name: formData.name,
        programme_id: formData.programme_id || null,
        planned_start: formData.planned_start || null,
        planned_end: formData.planned_end || null,
        description: formData.description || null,
        objectives: formData.objectives ? formData.objectives.split("\n").filter(o => o.trim()) : null,
        status: formData.status,
        progress: formData.progress,
      })
      .eq("id", selectedTranche.id);

    if (error) {
      toast.error("Failed to update tranche");
      return;
    }

    toast.success("Tranche updated");
    setIsEditOpen(false);
    setSelectedTranche(null);
    setFormData(defaultFormState);
    fetchData();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("tranches").delete().eq("id", id);
    if (error) {
      toast.error("Failed to delete tranche");
      return;
    }
    toast.success("Tranche deleted");
    fetchData();
  };

  const openEditDialog = (tranche: Tranche) => {
    setSelectedTranche(tranche);
    setFormData({
      name: tranche.name,
      programme_id: tranche.programme_id,
      planned_start: tranche.planned_start || "",
      planned_end: tranche.planned_end || "",
      description: tranche.description || "",
      objectives: tranche.objectives?.join("\n") || "",
      status: tranche.status,
      progress: tranche.progress || 0,
    });
    setIsEditOpen(true);
  };

  const handleQuickStatusUpdate = async (id: string, status: string) => {
    const { error } = await supabase.from("tranches").update({ status }).eq("id", id);
    if (error) {
      toast.error("Failed to update status");
      return;
    }
    setTranches(prev => prev.map(t => t.id === id ? { ...t, status } : t));
    toast.success("Status updated");
  };

  const handleQuickProgressUpdate = async (id: string, progress: number) => {
    const { error } = await supabase.from("tranches").update({ progress }).eq("id", id);
    if (error) {
      toast.error("Failed to update progress");
      return;
    }
    setTranches(prev => prev.map(t => t.id === id ? { ...t, progress } : t));
  };

  const getProgrammeName = (id: string) => programmes.find(p => p.id === id)?.name || "Unknown";

  const TrancheForm = ({ isEdit = false }: { isEdit?: boolean }) => (
    <div className="space-y-4 py-4">
      <div className="space-y-2">
        <Label>Tranche Name *</Label>
        <Input
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="e.g., Tranche 1: Foundation"
        />
      </div>
      <div className="space-y-2">
        <Label>Program *</Label>
        <Select
          value={formData.programme_id}
          onValueChange={(v) => setFormData({ ...formData, programme_id: v })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select program" />
          </SelectTrigger>
          <SelectContent>
            {programmes.map(p => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      
      {isEdit && (
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Status</Label>
            <Select
              value={formData.status}
              onValueChange={(v) => setFormData({ ...formData, status: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {trancheStatuses.map(s => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
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

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Planned Start</Label>
          <Input
            type="date"
            value={formData.planned_start}
            onChange={(e) => setFormData({ ...formData, planned_start: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label>Planned End</Label>
          <Input
            type="date"
            value={formData.planned_end}
            onChange={(e) => setFormData({ ...formData, planned_end: e.target.value })}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Description</Label>
        <Textarea
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Brief description of the tranche"
        />
      </div>
      <div className="space-y-2">
        <Label>Objectives (one per line)</Label>
        <Textarea
          value={formData.objectives}
          onChange={(e) => setFormData({ ...formData, objectives: e.target.value })}
          placeholder="Objective 1&#10;Objective 2&#10;Objective 3"
          rows={4}
        />
      </div>
      <Button onClick={isEdit ? handleUpdate : handleCreate} className="w-full">
        {isEdit ? "Update Tranche" : "Create Tranche"}
      </Button>
    </div>
  );

  return (
    <AppLayout title="Program Tranches" subtitle="MSP Tranche Management and Gate Reviews">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              {trancheStatuses.map(status => (
                <Badge key={status.value} className={status.color}>
                  <status.icon className="h-3 w-3 mr-1" />
                  {tranches.filter(t => t.status === status.value).length} {status.label}
                </Badge>
              ))}
            </div>
          </div>

          <Dialog open={isCreateOpen} onOpenChange={(open) => {
            setIsCreateOpen(open);
            if (!open) setFormData(defaultFormState);
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Tranche
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Tranche</DialogTitle>
              </DialogHeader>
              <TrancheForm />
            </DialogContent>
          </Dialog>
        </div>

        {/* Edit Dialog */}
        <Dialog open={isEditOpen} onOpenChange={(open) => {
          setIsEditOpen(open);
          if (!open) {
            setSelectedTranche(null);
            setFormData(defaultFormState);
          }
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Tranche</DialogTitle>
            </DialogHeader>
            <TrancheForm isEdit />
          </DialogContent>
        </Dialog>

        {/* PRINCE2 Tranche Info */}
        <div className="p-4 rounded-lg bg-info/5 border border-info/20">
          <h4 className="font-medium text-sm mb-2 text-info">MSP Tranche Management</h4>
          <p className="text-sm text-muted-foreground">
            Tranches are discrete periods within a program where specific outcomes are delivered. 
            Each tranche ends with a gate review to assess progress, validate benefits, and authorize the next tranche.
          </p>
        </div>

        {/* Timeline View */}
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Loading tranches...</div>
        ) : tranches.length === 0 ? (
          <div className="metric-card text-center py-12">
            <Target className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No tranches found</p>
            <p className="text-sm text-muted-foreground">Create a tranche to start planning your programme</p>
          </div>
        ) : (
          <div className="relative">
            {tranches.map((tranche, index) => {
              const statusConf = trancheStatuses.find(s => s.value === tranche.status) || trancheStatuses[0];
              const StatusIcon = statusConf.icon;
              const progress = tranche.progress || 0;

              return (
                <div key={tranche.id} className="relative pb-8">
                  {/* Timeline connector */}
                  {index < tranches.length - 1 && (
                    <div className="absolute left-6 top-12 w-0.5 h-full bg-border" />
                  )}

                  <div className="flex gap-4">
                    {/* Timeline node */}
                    <div className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${
                      tranche.status === "completed" ? "bg-success text-success-foreground" :
                      tranche.status === "active" ? "bg-primary text-primary-foreground" :
                      "bg-muted text-muted-foreground"
                    }`}>
                      <StatusIcon className="h-6 w-6" />
                    </div>

                    {/* Tranche Card */}
                    <div className="flex-1 metric-card">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-lg">{tranche.name}</h3>
                            <Select
                              value={tranche.status}
                              onValueChange={(v) => handleQuickStatusUpdate(tranche.id, v)}
                            >
                              <SelectTrigger className="w-auto h-7 px-2">
                                <Badge className={statusConf.color}>
                                  {statusConf.label}
                                </Badge>
                              </SelectTrigger>
                              <SelectContent>
                                {trancheStatuses.map(s => (
                                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span className="font-medium">{getProgrammeName(tranche.programme_id)}</span>
                            <span className="flex items-center gap-1">
                              <Calendar className="h-4 w-4" />
                              {tranche.planned_start ? new Date(tranche.planned_start).toLocaleDateString() : "TBD"} - {tranche.planned_end ? new Date(tranche.planned_end).toLocaleDateString() : "TBD"}
                            </span>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEditDialog(tranche)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(tranche.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>

                      {/* Progress */}
                      <div className="mb-4">
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-muted-foreground">Tranche Progress</span>
                          <span className="font-medium">{progress}%</span>
                        </div>
                        <Slider
                          value={[progress]}
                          onValueCommit={([v]) => handleQuickProgressUpdate(tranche.id, v)}
                          max={100}
                          step={5}
                          className="cursor-pointer"
                        />
                      </div>

                      {/* Description & Objectives */}
                      <div className="grid gap-4 md:grid-cols-2">
                        {tranche.description && (
                          <div className="p-3 rounded-lg bg-secondary/50">
                            <div className="flex items-center gap-2 mb-2">
                              <Target className="h-4 w-4 text-primary" />
                              <span className="font-medium text-sm">Description</span>
                            </div>
                            <p className="text-sm text-muted-foreground">{tranche.description}</p>
                          </div>
                        )}
                        {tranche.objectives && tranche.objectives.length > 0 && (
                          <div className="p-3 rounded-lg bg-secondary/50">
                            <div className="flex items-center gap-2 mb-2">
                              <CheckCircle2 className="h-4 w-4 text-success" />
                              <span className="font-medium text-sm">Objectives</span>
                            </div>
                            <ul className="text-sm text-muted-foreground space-y-1">
                              {tranche.objectives.map((obj, i) => (
                                <li key={i}>• {obj}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Gate Review */}
                  {tranche.status === "active" && (
                    <div className="ml-16 mt-4 p-4 rounded-lg border-2 border-dashed border-warning/50 bg-warning/5">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle className="h-5 w-5 text-warning" />
                        <span className="font-medium">Upcoming Gate Review</span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        End-of-tranche gate review scheduled. Ensure all deliverables are ready for assessment.
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
