import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Target,
  Users,
  Shield,
  TrendingUp,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Building2,
  Layers,
  Edit,
  Save,
  X,
} from "lucide-react";
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
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { useToast } from "@/hooks/use-toast";

interface Program {
  id: string;
  name: string;
  description: string | null;
  status: string;
  progress: number;
  start_date: string | null;
  end_date: string | null;
  sponsor: string | null;
  tranche: string | null;
  budget: string | null;
  benefits_target: string | null;
}

interface ProgrammeDefinition {
  id: string;
  programme_id: string;
  vision_statement: string | null;
  strategic_objectives: string | null;
  scope_statement: string | null;
  out_of_scope: string | null;
  success_criteria: string | null;
  key_assumptions: string | null;
  constraints: string | null;
  dependencies: string | null;
}

interface Project {
  id: string;
  name: string;
  stage: string;
  health: string;
  programme_id: string | null;
}

interface Benefit {
  id: string;
  name: string;
  status: string;
  realization: number;
  programme_id: string | null;
}

interface Risk {
  id: string;
  title: string;
  score: number;
  status: string;
  programme_id: string | null;
}

export default function ProgrammeBlueprint() {
  const [programmes, setProgrammes] = useState<Program[]>([]);
  const [programmeDefinition, setProgrammeDefinition] = useState<ProgrammeDefinition | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [benefits, setBenefits] = useState<Benefit[]>([]);
  const [risks, setRisks] = useState<Risk[]>([]);
  const [selectedProgramme, setSelectedProgramme] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<ProgrammeDefinition & Program>>({});
  const { currentOrganization } = useOrganization();
  const { toast } = useToast();

  const fetchData = async () => {
    setLoading(true);

    let programmeQuery = supabase.from("programmes").select("*").order("name");
    if (currentOrganization) {
      programmeQuery = programmeQuery.eq("organization_id", currentOrganization.id);
    }

    const [programmesRes, projectsRes, benefitsRes, risksRes] = await Promise.all([
      programmeQuery,
      supabase.from("projects").select("*"),
      supabase.from("benefits").select("*"),
      supabase.from("risks").select("*"),
    ]);

    setProgrammes(programmesRes.data || []);
    setProjects(projectsRes.data || []);
    setBenefits(benefitsRes.data || []);
    setRisks(risksRes.data || []);

    if (programmesRes.data && programmesRes.data.length > 0 && !selectedProgramme) {
      setSelectedProgramme(programmesRes.data[0].id);
    }

    setLoading(false);
  };

  const fetchDefinition = async (programmeId: string) => {
    const { data } = await supabase
      .from("programme_definitions")
      .select("*")
      .eq("programme_id", programmeId)
      .maybeSingle();
    
    setProgrammeDefinition(data);
  };

  useEffect(() => {
    fetchData();
  }, [currentOrganization]);

  useEffect(() => {
    if (selectedProgramme) {
      fetchDefinition(selectedProgramme);
    }
  }, [selectedProgramme]);

  const currentProgramme = programmes.find(p => p.id === selectedProgramme);
  const programmeProjects = projects.filter(p => p.programme_id === selectedProgramme);
  const programmeBenefits = benefits.filter(b => b.programme_id === selectedProgramme);
  const programmeRisks = risks.filter(r => r.programme_id === selectedProgramme);

  const healthCounts = {
    green: programmeProjects.filter(p => p.health === "green").length,
    amber: programmeProjects.filter(p => p.health === "amber").length,
    red: programmeProjects.filter(p => p.health === "red").length,
  };

  const avgBenefitRealization = programmeBenefits.length > 0
    ? Math.round(programmeBenefits.reduce((sum, b) => sum + b.realization, 0) / programmeBenefits.length)
    : 0;

  const highRisks = programmeRisks.filter(r => r.score >= 15 && r.status === "open").length;

  const handleEditVision = () => {
    setEditForm({
      vision_statement: programmeDefinition?.vision_statement || "",
      strategic_objectives: programmeDefinition?.strategic_objectives || "",
      scope_statement: programmeDefinition?.scope_statement || "",
      out_of_scope: programmeDefinition?.out_of_scope || "",
      success_criteria: programmeDefinition?.success_criteria || "",
      key_assumptions: programmeDefinition?.key_assumptions || "",
      constraints: programmeDefinition?.constraints || "",
      dependencies: programmeDefinition?.dependencies || "",
    });
    setEditingSection("vision");
  };

  const handleEditBrief = () => {
    setEditForm({
      sponsor: currentProgramme?.sponsor || "",
      tranche: currentProgramme?.tranche || "",
      budget: currentProgramme?.budget || "",
      benefits_target: currentProgramme?.benefits_target || "",
      description: currentProgramme?.description || "",
    });
    setEditingSection("brief");
  };

  const handleSaveVision = async () => {
    if (!selectedProgramme || !currentOrganization) return;

    const definitionData = {
      programme_id: selectedProgramme,
      organization_id: currentOrganization.id,
      vision_statement: editForm.vision_statement || null,
      strategic_objectives: editForm.strategic_objectives || null,
      scope_statement: editForm.scope_statement || null,
      out_of_scope: editForm.out_of_scope || null,
      success_criteria: editForm.success_criteria || null,
      key_assumptions: editForm.key_assumptions || null,
      constraints: editForm.constraints || null,
      dependencies: editForm.dependencies || null,
    };

    if (programmeDefinition) {
      const { error } = await supabase
        .from("programme_definitions")
        .update(definitionData)
        .eq("id", programmeDefinition.id);
      
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
        return;
      }
    } else {
      const { error } = await supabase
        .from("programme_definitions")
        .insert(definitionData);
      
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
        return;
      }
    }

    toast({ title: "Saved", description: "Vision & objectives updated successfully" });
    fetchDefinition(selectedProgramme);
    setEditingSection(null);
  };

  const handleSaveBrief = async () => {
    if (!selectedProgramme) return;

    const { error } = await supabase
      .from("programmes")
      .update({
        sponsor: editForm.sponsor || null,
        tranche: editForm.tranche || null,
        budget: editForm.budget || null,
        benefits_target: editForm.benefits_target || null,
        description: editForm.description || null,
      })
      .eq("id", selectedProgramme);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "Saved", description: "Program brief updated successfully" });
    fetchData();
    setEditingSection(null);
  };

  return (
    <AppLayout title="Program Blueprint" subtitle="PRINCE2 MSP Program Definition Document">
      <div className="space-y-6">
        {/* Program Selector */}
        <div className="flex items-center gap-4">
          <Select value={selectedProgramme} onValueChange={setSelectedProgramme}>
            <SelectTrigger className="w-[300px]">
              <Building2 className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Select program" />
            </SelectTrigger>
            <SelectContent>
              {programmes.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {currentProgramme && (
            <Badge variant="outline" className="capitalize">{currentProgramme.status}</Badge>
          )}
        </div>

        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Loading blueprint...</div>
        ) : !currentProgramme ? (
          <div className="metric-card text-center py-12">
            <Layers className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No programs found</p>
            <p className="text-sm text-muted-foreground">Create a program to view its blueprint</p>
          </div>
        ) : (
          <Tabs defaultValue="vision" className="space-y-6">
            <TabsList className="bg-secondary">
              <TabsTrigger value="vision">Vision & Objectives</TabsTrigger>
              <TabsTrigger value="benefits">Benefits Profile</TabsTrigger>
              <TabsTrigger value="projects">Projects Dossier</TabsTrigger>
              <TabsTrigger value="governance">Governance</TabsTrigger>
            </TabsList>

            {/* Vision & Objectives Tab */}
            <TabsContent value="vision" className="space-y-6">
              <div className="grid gap-6 lg:grid-cols-2">
                <div className="metric-card">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Target className="h-5 w-5 text-primary" />
                      <h3 className="font-semibold">Program Vision</h3>
                    </div>
                    <Button variant="outline" size="sm" onClick={handleEditVision}>
                      <Edit className="h-4 w-4 mr-1" /> Edit
                    </Button>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <Label className="text-xs text-muted-foreground">Vision Statement</Label>
                      <p className="text-sm mt-1">
                        {programmeDefinition?.vision_statement || currentProgramme.description || "Click Edit to define the program vision statement."}
                      </p>
                    </div>
                    
                    <div>
                      <Label className="text-xs text-muted-foreground">Strategic Objectives</Label>
                      <p className="text-sm mt-1 whitespace-pre-wrap">
                        {programmeDefinition?.strategic_objectives || "Not yet defined."}
                      </p>
                    </div>
                    
                    <div>
                      <Label className="text-xs text-muted-foreground">Scope Statement</Label>
                      <p className="text-sm mt-1 whitespace-pre-wrap">
                        {programmeDefinition?.scope_statement || "Not yet defined."}
                      </p>
                    </div>
                    
                    <div>
                      <Label className="text-xs text-muted-foreground">Success Criteria</Label>
                      <p className="text-sm mt-1 whitespace-pre-wrap">
                        {programmeDefinition?.success_criteria || "Not yet defined."}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="metric-card">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <FileText className="h-5 w-5 text-primary" />
                      <h3 className="font-semibold">Program Brief</h3>
                    </div>
                    <Button variant="outline" size="sm" onClick={handleEditBrief}>
                      <Edit className="h-4 w-4 mr-1" /> Edit
                    </Button>
                  </div>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center p-3 rounded-lg bg-secondary/50">
                      <span className="text-sm">Program Sponsor</span>
                      <span className="font-medium">{currentProgramme.sponsor || "Not assigned"}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 rounded-lg bg-secondary/50">
                      <span className="text-sm">Current Tranche</span>
                      <Badge variant="outline">{currentProgramme.tranche || "Not defined"}</Badge>
                    </div>
                    <div className="flex justify-between items-center p-3 rounded-lg bg-secondary/50">
                      <span className="text-sm">Budget Allocation</span>
                      <span className="font-medium">{currentProgramme.budget || "TBD"}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 rounded-lg bg-secondary/50">
                      <span className="text-sm">Benefits Target</span>
                      <span className="font-medium">{currentProgramme.benefits_target || "TBD"}</span>
                    </div>
                  </div>
                  
                  <div className="mt-4 space-y-3">
                    <div>
                      <Label className="text-xs text-muted-foreground">Key Assumptions</Label>
                      <p className="text-sm mt-1 whitespace-pre-wrap">
                        {programmeDefinition?.key_assumptions || "Not yet defined."}
                      </p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Constraints</Label>
                      <p className="text-sm mt-1 whitespace-pre-wrap">
                        {programmeDefinition?.constraints || "Not yet defined."}
                      </p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Dependencies</Label>
                      <p className="text-sm mt-1 whitespace-pre-wrap">
                        {programmeDefinition?.dependencies || "Not yet defined."}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Progress Summary */}
              <div className="metric-card">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold">Program Progress</h3>
                </div>
                <div className="grid gap-4 md:grid-cols-4">
                  <div className="p-4 rounded-lg bg-secondary/50 text-center">
                    <p className="text-3xl font-bold text-primary">{currentProgramme.progress}%</p>
                    <p className="text-sm text-muted-foreground">Overall Progress</p>
                    <Progress value={currentProgramme.progress} className="mt-2" />
                  </div>
                  <div className="p-4 rounded-lg bg-secondary/50 text-center">
                    <p className="text-3xl font-bold">{programmeProjects.length}</p>
                    <p className="text-sm text-muted-foreground">Active Projects</p>
                  </div>
                  <div className="p-4 rounded-lg bg-secondary/50 text-center">
                    <p className="text-3xl font-bold">{avgBenefitRealization}%</p>
                    <p className="text-sm text-muted-foreground">Benefits Realized</p>
                  </div>
                  <div className="p-4 rounded-lg bg-secondary/50 text-center">
                    <p className="text-3xl font-bold text-destructive">{highRisks}</p>
                    <p className="text-sm text-muted-foreground">High Risks</p>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Benefits Profile Tab */}
            <TabsContent value="benefits" className="space-y-6">
              <div className="metric-card">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-success" />
                    <h3 className="font-semibold">Benefits Realization Map</h3>
                  </div>
                  <Badge variant="outline">{programmeBenefits.length} Benefits</Badge>
                </div>
                
                {programmeBenefits.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No benefits defined for this program</p>
                ) : (
                  <div className="space-y-4">
                    {programmeBenefits.map(benefit => (
                      <div key={benefit.id} className="p-4 rounded-lg border">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium">{benefit.name}</h4>
                          <Badge variant={benefit.status === "realized" ? "default" : "secondary"} className="capitalize">
                            {benefit.status}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4">
                          <Progress value={benefit.realization} className="flex-1" />
                          <span className="text-sm font-medium w-12">{benefit.realization}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-6 p-4 rounded-lg bg-info/5 border border-info/20">
                  <h4 className="font-medium text-sm mb-2 text-info">PRINCE2 Benefits Management</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Benefits are tracked from identification through realization</li>
                    <li>• Each benefit should have a measurable target and owner</li>
                    <li>• Benefits reviews occur at tranche boundaries</li>
                  </ul>
                </div>
              </div>
            </TabsContent>

            {/* Projects Dossier Tab */}
            <TabsContent value="projects" className="space-y-6">
              <div className="grid gap-4 md:grid-cols-3 mb-6">
                <div className="metric-card text-center">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <CheckCircle2 className="h-5 w-5 text-success" />
                    <span className="text-2xl font-bold text-success">{healthCounts.green}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">Green Projects</p>
                </div>
                <div className="metric-card text-center">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <Clock className="h-5 w-5 text-warning" />
                    <span className="text-2xl font-bold text-warning">{healthCounts.amber}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">Amber Projects</p>
                </div>
                <div className="metric-card text-center">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                    <span className="text-2xl font-bold text-destructive">{healthCounts.red}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">Red Projects</p>
                </div>
              </div>

              <div className="metric-card">
                <div className="flex items-center gap-2 mb-4">
                  <Layers className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold">Projects Dossier</h3>
                </div>

                {programmeProjects.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No projects in this program</p>
                ) : (
                  <div className="space-y-3">
                    {programmeProjects.map(project => (
                      <div key={project.id} className="flex items-center justify-between p-4 rounded-lg border hover:bg-secondary/50 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className={`h-3 w-3 rounded-full ${
                            project.health === "green" ? "bg-success" :
                            project.health === "amber" ? "bg-warning" : "bg-destructive"
                          }`} />
                          <span className="font-medium">{project.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="capitalize">{project.stage}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Governance Tab */}
            <TabsContent value="governance" className="space-y-6">
              <div className="grid gap-6 lg:grid-cols-2">
                <div className="metric-card">
                  <div className="flex items-center gap-2 mb-4">
                    <Shield className="h-5 w-5 text-primary" />
                    <h3 className="font-semibold">Program Governance Structure</h3>
                  </div>
                  <div className="space-y-4">
                    <div className="p-4 rounded-lg border border-primary/30 bg-primary/5">
                      <h4 className="font-medium mb-2">Sponsoring Group</h4>
                      <p className="text-sm text-muted-foreground">Owns the business case, provides strategic direction</p>
                    </div>
                    <div className="p-4 rounded-lg border">
                      <h4 className="font-medium mb-2">Program Board</h4>
                      <p className="text-sm text-muted-foreground">Decision-making body for programme-level issues</p>
                    </div>
                    <div className="p-4 rounded-lg border">
                      <h4 className="font-medium mb-2">Program Manager</h4>
                      <p className="text-sm text-muted-foreground">Day-to-day management of the program</p>
                    </div>
                    <div className="p-4 rounded-lg border">
                      <h4 className="font-medium mb-2">Business Change Managers</h4>
                      <p className="text-sm text-muted-foreground">Responsible for benefits realization in business areas</p>
                    </div>
                  </div>
                </div>

                <div className="metric-card">
                  <div className="flex items-center gap-2 mb-4">
                    <Users className="h-5 w-5 text-primary" />
                    <h3 className="font-semibold">PRINCE2 MSP Controls</h3>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50">
                      <CheckCircle2 className="h-5 w-5 text-success" />
                      <div>
                        <p className="font-medium text-sm">Tranche Reviews</p>
                        <p className="text-xs text-muted-foreground">Gate reviews between programme tranches</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50">
                      <CheckCircle2 className="h-5 w-5 text-success" />
                      <div>
                        <p className="font-medium text-sm">Benefits Reviews</p>
                        <p className="text-xs text-muted-foreground">Periodic assessment of benefits realization</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50">
                      <CheckCircle2 className="h-5 w-5 text-success" />
                      <div>
                        <p className="font-medium text-sm">Project Assurance</p>
                        <p className="text-xs text-muted-foreground">Independent review of project performance</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50">
                      <CheckCircle2 className="h-5 w-5 text-success" />
                      <div>
                        <p className="font-medium text-sm">Exception Reporting</p>
                        <p className="text-xs text-muted-foreground">Escalation when tolerances exceeded</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Out of Scope */}
              <div className="metric-card">
                <div className="flex items-center gap-2 mb-4">
                  <X className="h-5 w-5 text-muted-foreground" />
                  <h3 className="font-semibold">Out of Scope</h3>
                </div>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {programmeDefinition?.out_of_scope || "Not yet defined. Click Edit on the Vision section to define scope exclusions."}
                </p>
              </div>
            </TabsContent>
          </Tabs>
        )}

        {/* Edit Vision Dialog */}
        <Dialog open={editingSection === "vision"} onOpenChange={() => setEditingSection(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Vision & Objectives</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Vision Statement</Label>
                <Textarea
                  value={editForm.vision_statement || ""}
                  onChange={(e) => setEditForm({ ...editForm, vision_statement: e.target.value })}
                  placeholder="Describe the desired end state and strategic intent..."
                  rows={3}
                />
              </div>
              <div>
                <Label>Strategic Objectives</Label>
                <Textarea
                  value={editForm.strategic_objectives || ""}
                  onChange={(e) => setEditForm({ ...editForm, strategic_objectives: e.target.value })}
                  placeholder="List the key strategic objectives..."
                  rows={4}
                />
              </div>
              <div>
                <Label>Scope Statement</Label>
                <Textarea
                  value={editForm.scope_statement || ""}
                  onChange={(e) => setEditForm({ ...editForm, scope_statement: e.target.value })}
                  placeholder="Define what is included in scope..."
                  rows={3}
                />
              </div>
              <div>
                <Label>Out of Scope</Label>
                <Textarea
                  value={editForm.out_of_scope || ""}
                  onChange={(e) => setEditForm({ ...editForm, out_of_scope: e.target.value })}
                  placeholder="Define what is explicitly excluded..."
                  rows={3}
                />
              </div>
              <div>
                <Label>Success Criteria</Label>
                <Textarea
                  value={editForm.success_criteria || ""}
                  onChange={(e) => setEditForm({ ...editForm, success_criteria: e.target.value })}
                  placeholder="Define measurable success criteria..."
                  rows={3}
                />
              </div>
              <div>
                <Label>Key Assumptions</Label>
                <Textarea
                  value={editForm.key_assumptions || ""}
                  onChange={(e) => setEditForm({ ...editForm, key_assumptions: e.target.value })}
                  placeholder="List key assumptions..."
                  rows={3}
                />
              </div>
              <div>
                <Label>Constraints</Label>
                <Textarea
                  value={editForm.constraints || ""}
                  onChange={(e) => setEditForm({ ...editForm, constraints: e.target.value })}
                  placeholder="List known constraints..."
                  rows={3}
                />
              </div>
              <div>
                <Label>Dependencies</Label>
                <Textarea
                  value={editForm.dependencies || ""}
                  onChange={(e) => setEditForm({ ...editForm, dependencies: e.target.value })}
                  placeholder="List external dependencies..."
                  rows={3}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setEditingSection(null)}>Cancel</Button>
                <Button onClick={handleSaveVision}>
                  <Save className="h-4 w-4 mr-1" /> Save
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Brief Dialog */}
        <Dialog open={editingSection === "brief"} onOpenChange={() => setEditingSection(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Program Brief</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Program Description</Label>
                <Textarea
                  value={editForm.description || ""}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  placeholder="Brief description of the program..."
                  rows={3}
                />
              </div>
              <div>
                <Label>Program Sponsor</Label>
                <Input
                  value={editForm.sponsor || ""}
                  onChange={(e) => setEditForm({ ...editForm, sponsor: e.target.value })}
                  placeholder="Enter sponsor name..."
                />
              </div>
              <div>
                <Label>Current Tranche</Label>
                <Input
                  value={editForm.tranche || ""}
                  onChange={(e) => setEditForm({ ...editForm, tranche: e.target.value })}
                  placeholder="e.g., Tranche 1, Tranche 2..."
                />
              </div>
              <div>
                <Label>Budget Allocation</Label>
                <Input
                  value={editForm.budget || ""}
                  onChange={(e) => setEditForm({ ...editForm, budget: e.target.value })}
                  placeholder="e.g., $5,000,000..."
                />
              </div>
              <div>
                <Label>Benefits Target</Label>
                <Input
                  value={editForm.benefits_target || ""}
                  onChange={(e) => setEditForm({ ...editForm, benefits_target: e.target.value })}
                  placeholder="e.g., $10,000,000 annual savings..."
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setEditingSection(null)}>Cancel</Button>
                <Button onClick={handleSaveBrief}>
                  <Save className="h-4 w-4 mr-1" /> Save
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}