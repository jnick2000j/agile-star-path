import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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

interface Programme {
  id: string;
  name: string;
  status: string;
  tranche: string | null;
}

interface Project {
  id: string;
  name: string;
  stage: string;
  health: string;
  programme_id: string | null;
  start_date: string | null;
  end_date: string | null;
}

interface Benefit {
  id: string;
  name: string;
  status: string;
  realization: number;
  programme_id: string | null;
}

const trancheStatuses = [
  { value: "planned", label: "Planned", icon: Clock, color: "bg-muted text-muted-foreground" },
  { value: "active", label: "Active", icon: PlayCircle, color: "bg-primary/10 text-primary" },
  { value: "paused", label: "Paused", icon: PauseCircle, color: "bg-warning/10 text-warning" },
  { value: "completed", label: "Completed", icon: CheckCircle2, color: "bg-success/10 text-success" },
];

// Simulated tranches data structure (would typically be in database)
interface Tranche {
  id: string;
  name: string;
  programme_id: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
  objectives: string;
  gate_criteria: string;
}

export default function ProgrammeTranches() {
  const [programmes, setProgrammes] = useState<Programme[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [benefits, setBenefits] = useState<Benefit[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const { currentOrganization } = useOrganization();

  // Simulated tranches - in production, this would come from a tranches table
  const [tranches, setTranches] = useState<Tranche[]>([
    {
      id: "1",
      name: "Tranche 1: Foundation",
      programme_id: "",
      status: "completed",
      start_date: "2024-01-01",
      end_date: "2024-06-30",
      objectives: "Establish programme infrastructure, governance, and initial project delivery",
      gate_criteria: "All foundation projects delivered, governance established, benefits tracking in place",
    },
    {
      id: "2",
      name: "Tranche 2: Implementation",
      programme_id: "",
      status: "active",
      start_date: "2024-07-01",
      end_date: "2024-12-31",
      objectives: "Deliver core capabilities and begin benefits realization",
      gate_criteria: "Core systems operational, 50% of target benefits identified, change management active",
    },
    {
      id: "3",
      name: "Tranche 3: Optimization",
      programme_id: "",
      status: "planned",
      start_date: "2025-01-01",
      end_date: "2025-06-30",
      objectives: "Optimize delivered capabilities and maximize benefits",
      gate_criteria: "All benefits realized, lessons learned captured, transition to BAU complete",
    },
  ]);

  const [newTranche, setNewTranche] = useState({
    name: "",
    programme_id: "",
    start_date: "",
    end_date: "",
    objectives: "",
    gate_criteria: "",
  });

  const fetchData = async () => {
    setLoading(true);

    let programmeQuery = supabase.from("programmes").select("*").order("name");
    if (currentOrganization) {
      programmeQuery = programmeQuery.eq("organization_id", currentOrganization.id);
    }

    const [programmesRes, projectsRes, benefitsRes] = await Promise.all([
      programmeQuery,
      supabase.from("projects").select("*"),
      supabase.from("benefits").select("*"),
    ]);

    setProgrammes(programmesRes.data || []);
    setProjects(projectsRes.data || []);
    setBenefits(benefitsRes.data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [currentOrganization]);

  const handleCreateTranche = () => {
    if (!newTranche.name || !newTranche.programme_id) {
      toast.error("Please fill in required fields");
      return;
    }

    const newId = String(tranches.length + 1);
    setTranches([...tranches, {
      id: newId,
      name: newTranche.name,
      programme_id: newTranche.programme_id,
      status: "planned",
      start_date: newTranche.start_date || null,
      end_date: newTranche.end_date || null,
      objectives: newTranche.objectives,
      gate_criteria: newTranche.gate_criteria,
    }]);

    toast.success("Tranche created successfully");
    setIsCreateOpen(false);
    setNewTranche({
      name: "",
      programme_id: "",
      start_date: "",
      end_date: "",
      objectives: "",
      gate_criteria: "",
    });
  };

  const getProjectsForTranche = (trancheId: string) => {
    // In production, projects would be linked to tranches
    return projects.slice(0, 3);
  };

  const getTrancheProgress = (tranche: Tranche) => {
    if (tranche.status === "completed") return 100;
    if (tranche.status === "planned") return 0;
    return 60; // Simulated progress
  };

  return (
    <AppLayout title="Programme Tranches" subtitle="PRINCE2 MSP Tranche Management and Gate Reviews">
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

          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
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
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Tranche Name *</Label>
                  <Input
                    value={newTranche.name}
                    onChange={(e) => setNewTranche({ ...newTranche, name: e.target.value })}
                    placeholder="e.g., Tranche 4: Transition"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Programme *</Label>
                  <Select
                    value={newTranche.programme_id}
                    onValueChange={(v) => setNewTranche({ ...newTranche, programme_id: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select programme" />
                    </SelectTrigger>
                    <SelectContent>
                      {programmes.map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Start Date</Label>
                    <Input
                      type="date"
                      value={newTranche.start_date}
                      onChange={(e) => setNewTranche({ ...newTranche, start_date: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>End Date</Label>
                    <Input
                      type="date"
                      value={newTranche.end_date}
                      onChange={(e) => setNewTranche({ ...newTranche, end_date: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Tranche Objectives</Label>
                  <Textarea
                    value={newTranche.objectives}
                    onChange={(e) => setNewTranche({ ...newTranche, objectives: e.target.value })}
                    placeholder="Define the key objectives for this tranche"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Gate Review Criteria</Label>
                  <Textarea
                    value={newTranche.gate_criteria}
                    onChange={(e) => setNewTranche({ ...newTranche, gate_criteria: e.target.value })}
                    placeholder="Define the criteria for the end-of-tranche gate review"
                  />
                </div>
                <Button onClick={handleCreateTranche} className="w-full">
                  Create Tranche
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* PRINCE2 Tranche Info */}
        <div className="p-4 rounded-lg bg-info/5 border border-info/20">
          <h4 className="font-medium text-sm mb-2 text-info">PRINCE2 MSP Tranche Management</h4>
          <p className="text-sm text-muted-foreground">
            Tranches are discrete periods within a programme where specific outcomes are delivered. 
            Each tranche ends with a gate review to assess progress, validate benefits, and authorize the next tranche.
          </p>
        </div>

        {/* Timeline View */}
        <div className="relative">
          {tranches.map((tranche, index) => {
            const statusConf = trancheStatuses.find(s => s.value === tranche.status) || trancheStatuses[0];
            const StatusIcon = statusConf.icon;
            const progress = getTrancheProgress(tranche);
            const trancheProjects = getProjectsForTranche(tranche.id);

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
                          <Badge className={statusConf.color}>
                            {statusConf.label}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            {tranche.start_date ? new Date(tranche.start_date).toLocaleDateString() : "TBD"} - {tranche.end_date ? new Date(tranche.end_date).toLocaleDateString() : "TBD"}
                          </span>
                        </div>
                      </div>
                      <Button variant="outline" size="sm">
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* Progress */}
                    <div className="mb-4">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-muted-foreground">Tranche Progress</span>
                        <span className="font-medium">{progress}%</span>
                      </div>
                      <Progress value={progress} />
                    </div>

                    {/* Objectives & Gate Criteria */}
                    <div className="grid gap-4 md:grid-cols-2 mb-4">
                      <div className="p-3 rounded-lg bg-secondary/50">
                        <div className="flex items-center gap-2 mb-2">
                          <Target className="h-4 w-4 text-primary" />
                          <span className="font-medium text-sm">Objectives</span>
                        </div>
                        <p className="text-sm text-muted-foreground">{tranche.objectives}</p>
                      </div>
                      <div className="p-3 rounded-lg bg-secondary/50">
                        <div className="flex items-center gap-2 mb-2">
                          <CheckCircle2 className="h-4 w-4 text-success" />
                          <span className="font-medium text-sm">Gate Criteria</span>
                        </div>
                        <p className="text-sm text-muted-foreground">{tranche.gate_criteria}</p>
                      </div>
                    </div>

                    {/* Projects in Tranche */}
                    {trancheProjects.length > 0 && (
                      <div>
                        <h4 className="font-medium text-sm mb-2">Projects in Tranche</h4>
                        <div className="flex flex-wrap gap-2">
                          {trancheProjects.map(project => (
                            <Badge key={project.id} variant="outline" className="flex items-center gap-1">
                              <div className={`h-2 w-2 rounded-full ${
                                project.health === "green" ? "bg-success" :
                                project.health === "amber" ? "bg-warning" : "bg-destructive"
                              }`} />
                              {project.name}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
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
                    <Button variant="outline" size="sm" className="mt-2">
                      Prepare Gate Review
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
}
