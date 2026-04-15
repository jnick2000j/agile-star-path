import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Plus, Calendar, CheckCircle2, Clock, PlayCircle, PauseCircle,
  Target, AlertTriangle, Edit, Trash2,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { toast } from "sonner";
import { format } from "date-fns";

interface TranchesTabContentProps {
  programmeId: string;
}

interface Tranche {
  id: string;
  name: string;
  programme_id: string;
  sequence_number: number;
  status: string;
  progress: number;
  planned_start: string | null;
  planned_end: string | null;
  description: string | null;
  objectives: string[] | null;
  organization_id: string | null;
}

const trancheStatuses = [
  { value: "planned", label: "Planned", icon: Clock, color: "bg-muted text-muted-foreground" },
  { value: "active", label: "Active", icon: PlayCircle, color: "bg-success/10 text-success" },
  { value: "paused", label: "Paused", icon: PauseCircle, color: "bg-warning/10 text-warning" },
  { value: "completed", label: "Completed", icon: CheckCircle2, color: "bg-primary/10 text-primary" },
];

const defaultFormState = {
  name: "", description: "", objectives: "", planned_start: "", planned_end: "",
  status: "planned", progress: 0,
};

export function TranchesTabContent({ programmeId }: TranchesTabContentProps) {
  const [tranches, setTranches] = useState<Tranche[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedTranche, setSelectedTranche] = useState<Tranche | null>(null);
  const [formData, setFormData] = useState(defaultFormState);
  const { currentOrganization } = useOrganization();

  const fetchTranches = async () => {
    setLoading(true);
    const { data } = await supabase.from("tranches").select("*")
      .eq("programme_id", programmeId).order("sequence_number");
    setTranches((data as Tranche[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchTranches(); }, [programmeId]);

  const handleCreate = async () => {
    if (!formData.name) { toast.error("Please enter a name"); return; }
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) { toast.error("You must be logged in"); return; }

    const { error } = await supabase.from("tranches").insert({
      name: formData.name, programme_id: programmeId,
      organization_id: currentOrganization?.id || null,
      planned_start: formData.planned_start || null, planned_end: formData.planned_end || null,
      description: formData.description || null,
      objectives: formData.objectives ? formData.objectives.split("\n").filter(o => o.trim()) : null,
      sequence_number: tranches.length + 1, status: "planned", progress: 0,
      created_by: userData.user.id,
    });
    if (error) { toast.error("Failed to create tranche"); return; }
    toast.success("Tranche created");
    setIsCreateOpen(false);
    setFormData(defaultFormState);
    fetchTranches();
  };

  const handleUpdate = async () => {
    if (!selectedTranche || !formData.name) { toast.error("Please fill in required fields"); return; }
    const { error } = await supabase.from("tranches").update({
      name: formData.name, planned_start: formData.planned_start || null,
      planned_end: formData.planned_end || null, description: formData.description || null,
      objectives: formData.objectives ? formData.objectives.split("\n").filter(o => o.trim()) : null,
      status: formData.status, progress: formData.progress,
    }).eq("id", selectedTranche.id);
    if (error) { toast.error("Failed to update"); return; }
    toast.success("Tranche updated");
    setIsEditOpen(false);
    setSelectedTranche(null);
    setFormData(defaultFormState);
    fetchTranches();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("tranches").delete().eq("id", id);
    if (error) { toast.error("Failed to delete"); return; }
    toast.success("Tranche deleted");
    fetchTranches();
  };

  const openEdit = (tranche: Tranche) => {
    setSelectedTranche(tranche);
    setFormData({
      name: tranche.name, description: tranche.description || "",
      objectives: tranche.objectives?.join("\n") || "",
      planned_start: tranche.planned_start || "", planned_end: tranche.planned_end || "",
      status: tranche.status, progress: tranche.progress,
    });
    setIsEditOpen(true);
  };

  const TrancheForm = ({ isEdit = false }: { isEdit?: boolean }) => (
    <div className="space-y-4">
      <div><Label>Name *</Label><Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} /></div>
      <div><Label>Description</Label><Textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} rows={3} /></div>
      <div><Label>Objectives (one per line)</Label><Textarea value={formData.objectives} onChange={(e) => setFormData({ ...formData, objectives: e.target.value })} rows={3} /></div>
      {isEdit && (
        <div className="space-y-2">
          <Label>Progress: {formData.progress}%</Label>
          <Slider value={[formData.progress]} onValueChange={([v]) => setFormData({ ...formData, progress: v })} max={100} step={5} />
        </div>
      )}
      <div className="grid grid-cols-2 gap-4">
        <div><Label>Planned Start</Label><Input type="date" value={formData.planned_start} onChange={(e) => setFormData({ ...formData, planned_start: e.target.value })} /></div>
        <div><Label>Planned End</Label><Input type="date" value={formData.planned_end} onChange={(e) => setFormData({ ...formData, planned_end: e.target.value })} /></div>
      </div>
      <div className="flex gap-2 justify-end">
        <Button variant="outline" onClick={() => { isEdit ? setIsEditOpen(false) : setIsCreateOpen(false); setFormData(defaultFormState); }}>Cancel</Button>
        <Button onClick={isEdit ? handleUpdate : handleCreate}>{isEdit ? "Update" : "Create"} Tranche</Button>
      </div>
    </div>
  );

  if (loading) return <div className="text-center py-8 text-muted-foreground">Loading tranches...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="p-4 rounded-lg bg-info/5 border border-info/20 flex-1 mr-4">
          <h4 className="font-medium text-sm mb-1 text-info">MSP Tranche Management</h4>
          <p className="text-sm text-muted-foreground">
            Tranches are discrete periods where specific outcomes are delivered, ending with a gate review.
          </p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Add Tranche</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Tranche</DialogTitle></DialogHeader>
            <TrancheForm />
          </DialogContent>
        </Dialog>
      </div>

      <Dialog open={isEditOpen} onOpenChange={(open) => { setIsEditOpen(open); if (!open) { setSelectedTranche(null); setFormData(defaultFormState); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Tranche</DialogTitle></DialogHeader>
          <TrancheForm isEdit />
        </DialogContent>
      </Dialog>

      {tranches.length === 0 ? (
        <div className="metric-card text-center py-12">
          <Target className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No tranches found</p>
          <p className="text-sm text-muted-foreground">Create a tranche to start planning</p>
        </div>
      ) : (
        <div className="relative">
          {tranches.map((tranche, index) => {
            const statusConf = trancheStatuses.find(s => s.value === tranche.status) || trancheStatuses[0];
            const StatusIcon = statusConf.icon;
            return (
              <div key={tranche.id} className="relative pb-8">
                {index < tranches.length - 1 && <div className="absolute left-6 top-12 w-0.5 h-full bg-border" />}
                <div className="flex gap-4">
                  <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${statusConf.color}`}>
                    <StatusIcon className="h-6 w-6" />
                  </div>
                  <div className="flex-1 metric-card">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-semibold text-lg">{tranche.name}</h3>
                        <Badge variant="outline" className={`mt-1 ${statusConf.color}`}>{statusConf.label}</Badge>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(tranche)}><Edit className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(tranche.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </div>
                    </div>
                    {tranche.description && <p className="text-sm text-muted-foreground mb-3">{tranche.description}</p>}
                    <div className="space-y-2 mb-3">
                      <div className="flex justify-between text-sm"><span className="text-muted-foreground">Progress</span><span className="font-medium">{tranche.progress}%</span></div>
                      <Progress value={tranche.progress} className="h-2" />
                    </div>
                    {(tranche.planned_start || tranche.planned_end) && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        {tranche.planned_start && format(new Date(tranche.planned_start), "MMM d, yyyy")}
                        {tranche.planned_start && tranche.planned_end && " → "}
                        {tranche.planned_end && format(new Date(tranche.planned_end), "MMM d, yyyy")}
                      </div>
                    )}
                    {tranche.objectives && tranche.objectives.length > 0 && (
                      <div className="mt-3">
                        <p className="text-sm font-medium mb-2">Objectives:</p>
                        <ul className="space-y-1">
                          {tranche.objectives.map((obj, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-success" />
                              {obj}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
