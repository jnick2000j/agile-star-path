import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Target, Users, Shield, TrendingUp, FileText, CheckCircle2,
  AlertTriangle, Clock, Layers, Edit, Save, X,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { useToast } from "@/hooks/use-toast";

interface BlueprintTabContentProps {
  programmeId: string;
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

export function BlueprintTabContent({ programmeId }: BlueprintTabContentProps) {
  const [programme, setProgramme] = useState<any>(null);
  const [definition, setDefinition] = useState<ProgrammeDefinition | null>(null);
  const [projects, setProjects] = useState<any[]>([]);
  const [benefits, setBenefits] = useState<any[]>([]);
  const [risks, setRisks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const { currentOrganization } = useOrganization();
  const { toast } = useToast();

  const fetchData = async () => {
    setLoading(true);
    const [progRes, projRes, benRes, riskRes, defRes] = await Promise.all([
      supabase.from("programmes").select("*").eq("id", programmeId).single(),
      supabase.from("projects").select("*").eq("programme_id", programmeId),
      supabase.from("benefits").select("*").eq("programme_id", programmeId),
      supabase.from("risks").select("*").eq("programme_id", programmeId),
      supabase.from("programme_definitions").select("*").eq("programme_id", programmeId).maybeSingle(),
    ]);
    setProgramme(progRes.data);
    setProjects(projRes.data || []);
    setBenefits(benRes.data || []);
    setRisks(riskRes.data || []);
    setDefinition(defRes.data);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [programmeId]);

  const healthCounts = {
    green: projects.filter(p => p.health === "green").length,
    amber: projects.filter(p => p.health === "amber").length,
    red: projects.filter(p => p.health === "red").length,
  };
  const avgBenefitRealization = benefits.length > 0
    ? Math.round(benefits.reduce((s, b) => s + b.realization, 0) / benefits.length) : 0;
  const highRisks = risks.filter(r => r.score >= 15 && r.status === "open").length;

  const handleEditVision = () => {
    setEditForm({
      vision_statement: definition?.vision_statement || "",
      strategic_objectives: definition?.strategic_objectives || "",
      scope_statement: definition?.scope_statement || "",
      out_of_scope: definition?.out_of_scope || "",
      success_criteria: definition?.success_criteria || "",
      key_assumptions: definition?.key_assumptions || "",
      constraints: definition?.constraints || "",
      dependencies: definition?.dependencies || "",
    });
    setEditingSection("vision");
  };

  const handleEditBrief = () => {
    setEditForm({
      sponsor: programme?.sponsor || "",
      tranche: programme?.tranche || "",
      budget: programme?.budget || "",
      benefits_target: programme?.benefits_target || "",
      description: programme?.description || "",
    });
    setEditingSection("brief");
  };

  const handleSaveVision = async () => {
    if (!currentOrganization) return;
    const data = {
      programme_id: programmeId,
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
    const { error } = definition
      ? await supabase.from("programme_definitions").update(data).eq("id", definition.id)
      : await supabase.from("programme_definitions").insert(data);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Saved", description: "Vision & objectives updated" });
    fetchData();
    setEditingSection(null);
  };

  const handleSaveBrief = async () => {
    const { error } = await supabase.from("programmes").update({
      sponsor: editForm.sponsor || null,
      tranche: editForm.tranche || null,
      budget: editForm.budget || null,
      benefits_target: editForm.benefits_target || null,
      description: editForm.description || null,
    }).eq("id", programmeId);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Saved", description: "Program brief updated" });
    fetchData();
    setEditingSection(null);
  };

  if (loading) return <div className="text-center py-8 text-muted-foreground">Loading blueprint...</div>;
  if (!programme) return <div className="text-center py-8 text-muted-foreground">Program not found</div>;

  return (
    <div className="space-y-6">
      <Tabs defaultValue="vision" className="space-y-6">
        <TabsList className="bg-secondary">
          <TabsTrigger value="vision">Vision & Objectives</TabsTrigger>
          <TabsTrigger value="benefits">Benefits Profile</TabsTrigger>
          <TabsTrigger value="projects">Projects Dossier</TabsTrigger>
          <TabsTrigger value="governance">Governance</TabsTrigger>
        </TabsList>

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
                {["vision_statement", "strategic_objectives", "scope_statement", "success_criteria"].map(key => (
                  <div key={key}>
                    <Label className="text-xs text-muted-foreground capitalize">{key.replace(/_/g, " ")}</Label>
                    <p className="text-sm mt-1 whitespace-pre-wrap">
                      {(definition as any)?.[key] || (key === "vision_statement" ? programme.description : "Not yet defined.")}
                    </p>
                  </div>
                ))}
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
                {[
                  { label: "Program Sponsor", value: programme.sponsor },
                  { label: "Current Tranche", value: programme.tranche, badge: true },
                  { label: "Budget Allocation", value: programme.budget },
                  { label: "Benefits Target", value: programme.benefits_target },
                ].map(item => (
                  <div key={item.label} className="flex justify-between items-center p-3 rounded-lg bg-secondary/50">
                    <span className="text-sm">{item.label}</span>
                    {item.badge ? <Badge variant="outline">{item.value || "Not defined"}</Badge> : <span className="font-medium">{item.value || "Not set"}</span>}
                  </div>
                ))}
              </div>
              <div className="mt-4 space-y-3">
                {["key_assumptions", "constraints", "dependencies"].map(key => (
                  <div key={key}>
                    <Label className="text-xs text-muted-foreground capitalize">{key.replace(/_/g, " ")}</Label>
                    <p className="text-sm mt-1 whitespace-pre-wrap">{(definition as any)?.[key] || "Not yet defined."}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="metric-card">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">Program Progress</h3>
            </div>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="p-4 rounded-lg bg-secondary/50 text-center">
                <p className="text-3xl font-bold text-primary">{programme.progress}%</p>
                <p className="text-sm text-muted-foreground">Overall Progress</p>
                <Progress value={programme.progress} className="mt-2" />
              </div>
              <div className="p-4 rounded-lg bg-secondary/50 text-center">
                <p className="text-3xl font-bold">{projects.length}</p>
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

        <TabsContent value="benefits" className="space-y-6">
          <div className="metric-card">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-success" />
                <h3 className="font-semibold">Benefits Realization Map</h3>
              </div>
              <Badge variant="outline">{benefits.length} Benefits</Badge>
            </div>
            {benefits.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No benefits defined for this program</p>
            ) : (
              <div className="space-y-4">
                {benefits.map(benefit => (
                  <div key={benefit.id} className="p-4 rounded-lg border">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium">{benefit.name}</h4>
                      <Badge variant={benefit.status === "realized" ? "default" : "secondary"} className="capitalize">{benefit.status}</Badge>
                    </div>
                    <div className="flex items-center gap-4">
                      <Progress value={benefit.realization} className="flex-1" />
                      <span className="text-sm font-medium w-12">{benefit.realization}%</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="projects" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3 mb-6">
            {[
              { icon: CheckCircle2, color: "text-success", count: healthCounts.green, label: "Green Projects" },
              { icon: Clock, color: "text-warning", count: healthCounts.amber, label: "Amber Projects" },
              { icon: AlertTriangle, color: "text-destructive", count: healthCounts.red, label: "Red Projects" },
            ].map(({ icon: Icon, color, count, label }) => (
              <div key={label} className="metric-card text-center">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Icon className={`h-5 w-5 ${color}`} />
                  <span className={`text-2xl font-bold ${color}`}>{count}</span>
                </div>
                <p className="text-sm text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>
          <div className="metric-card">
            <div className="flex items-center gap-2 mb-4">
              <Layers className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">Projects Dossier</h3>
            </div>
            {projects.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No projects in this program</p>
            ) : (
              <div className="space-y-3">
                {projects.map(project => (
                  <div key={project.id} className="flex items-center justify-between p-4 rounded-lg border hover:bg-secondary/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`h-3 w-3 rounded-full ${
                        project.health === "green" ? "bg-success" : project.health === "amber" ? "bg-warning" : "bg-destructive"
                      }`} />
                      <span className="font-medium">{project.name}</span>
                    </div>
                    <Badge variant="outline" className="capitalize">{project.stage}</Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="governance" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="metric-card">
              <div className="flex items-center gap-2 mb-4">
                <Shield className="h-5 w-5 text-primary" />
                <h3 className="font-semibold">Program Governance Structure</h3>
              </div>
              <div className="space-y-4">
                {[
                  { title: "Sponsoring Group", desc: "Owns the business case, provides strategic direction", highlight: true },
                  { title: "Program Board", desc: "Decision-making body for programme-level issues" },
                  { title: "Program Manager", desc: "Day-to-day management of the program" },
                  { title: "Business Change Managers", desc: "Responsible for benefits realization in business areas" },
                ].map(item => (
                  <div key={item.title} className={`p-4 rounded-lg border ${item.highlight ? "border-primary/30 bg-primary/5" : ""}`}>
                    <h4 className="font-medium mb-2">{item.title}</h4>
                    <p className="text-sm text-muted-foreground">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="metric-card">
              <div className="flex items-center gap-2 mb-4">
                <Users className="h-5 w-5 text-primary" />
                <h3 className="font-semibold">PRINCE2 MSP Controls</h3>
              </div>
              <div className="space-y-3">
                {["Tranche Reviews", "Benefits Reviews", "Project Assurance", "Exception Reporting"].map(title => (
                  <div key={title} className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50">
                    <CheckCircle2 className="h-5 w-5 text-success" />
                    <div>
                      <p className="font-medium text-sm">{title}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="metric-card">
            <div className="flex items-center gap-2 mb-4">
              <X className="h-5 w-5 text-muted-foreground" />
              <h3 className="font-semibold">Out of Scope</h3>
            </div>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {definition?.out_of_scope || "Not yet defined."}
            </p>
          </div>
        </TabsContent>
      </Tabs>

      {/* Edit Vision Dialog */}
      <Dialog open={editingSection === "vision"} onOpenChange={() => setEditingSection(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Vision & Objectives</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {["vision_statement", "strategic_objectives", "scope_statement", "out_of_scope", "success_criteria", "key_assumptions", "constraints", "dependencies"].map(key => (
              <div key={key}>
                <Label className="capitalize">{key.replace(/_/g, " ")}</Label>
                <Textarea
                  value={editForm[key] || ""}
                  onChange={(e) => setEditForm({ ...editForm, [key]: e.target.value })}
                  rows={3}
                />
              </div>
            ))}
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setEditingSection(null)}>Cancel</Button>
              <Button onClick={handleSaveVision}><Save className="h-4 w-4 mr-1" /> Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Brief Dialog */}
      <Dialog open={editingSection === "brief"} onOpenChange={() => setEditingSection(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Program Brief</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Description</Label><Textarea value={editForm.description || ""} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} rows={3} /></div>
            <div><Label>Sponsor</Label><Input value={editForm.sponsor || ""} onChange={(e) => setEditForm({ ...editForm, sponsor: e.target.value })} /></div>
            <div><Label>Tranche</Label><Input value={editForm.tranche || ""} onChange={(e) => setEditForm({ ...editForm, tranche: e.target.value })} /></div>
            <div><Label>Budget</Label><Input value={editForm.budget || ""} onChange={(e) => setEditForm({ ...editForm, budget: e.target.value })} /></div>
            <div><Label>Benefits Target</Label><Input value={editForm.benefits_target || ""} onChange={(e) => setEditForm({ ...editForm, benefits_target: e.target.value })} /></div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setEditingSection(null)}>Cancel</Button>
              <Button onClick={handleSaveBrief}><Save className="h-4 w-4 mr-1" /> Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
