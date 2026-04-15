import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus,
  FileText,
  Target,
  Users,
  DollarSign,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Building2,
  TrendingUp,
  Shield,
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

interface Project {
  id: string;
  name: string;
  description: string | null;
  stage: string;
  priority: string;
  health: string;
  methodology: string;
  start_date: string | null;
  end_date: string | null;
  programme_id: string | null;
}

interface Program {
  id: string;
  name: string;
}

// Simulated project briefs - in production, this would be a separate table
interface ProjectBrief {
  id: string;
  project_id: string;
  background: string;
  objectives: string;
  scope: string;
  constraints: string;
  assumptions: string;
  business_case_summary: string;
  cost_estimate: string;
  timeline_estimate: string;
  risk_summary: string;
  status: "draft" | "submitted" | "approved";
}

export default function ProjectBriefs() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [programmes, setProgrammes] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const { currentOrganization } = useOrganization();

  // Simulated briefs data
  const [briefs, setBriefs] = useState<ProjectBrief[]>([]);

  const [newBrief, setNewBrief] = useState({
    project_id: "",
    background: "",
    objectives: "",
    scope: "",
    constraints: "",
    assumptions: "",
    business_case_summary: "",
    cost_estimate: "",
    timeline_estimate: "",
    risk_summary: "",
  });

  const fetchData = async () => {
    setLoading(true);

    let projectQuery = supabase.from("projects").select("*").order("name");
    let programmeQuery = supabase.from("programmes").select("id, name");
    
    if (currentOrganization) {
      projectQuery = projectQuery.eq("organization_id", currentOrganization.id);
      programmeQuery = programmeQuery.eq("organization_id", currentOrganization.id);
    }

    const [projectsRes, programmesRes] = await Promise.all([
      projectQuery,
      programmeQuery,
    ]);

    setProjects(projectsRes.data || []);
    setProgrammes(programmesRes.data || []);

    if (projectsRes.data && projectsRes.data.length > 0 && !selectedProject) {
      setSelectedProject(projectsRes.data[0].id);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [currentOrganization]);

  const handleCreateBrief = () => {
    if (!newBrief.project_id) {
      toast.error("Please select a project");
      return;
    }

    const brief: ProjectBrief = {
      id: String(Date.now()),
      project_id: newBrief.project_id,
      background: newBrief.background,
      objectives: newBrief.objectives,
      scope: newBrief.scope,
      constraints: newBrief.constraints,
      assumptions: newBrief.assumptions,
      business_case_summary: newBrief.business_case_summary,
      cost_estimate: newBrief.cost_estimate,
      timeline_estimate: newBrief.timeline_estimate,
      risk_summary: newBrief.risk_summary,
      status: "draft",
    };

    setBriefs([...briefs, brief]);
    setSelectedProject(newBrief.project_id);
    toast.success("Project Brief created");
    setIsCreateOpen(false);
    setNewBrief({
      project_id: "",
      background: "",
      objectives: "",
      scope: "",
      constraints: "",
      assumptions: "",
      business_case_summary: "",
      cost_estimate: "",
      timeline_estimate: "",
      risk_summary: "",
    });
  };

  const currentProject = projects.find(p => p.id === selectedProject);
  const currentBrief = briefs.find(b => b.project_id === selectedProject);
  const programme = currentProject?.programme_id 
    ? programmes.find(p => p.id === currentProject.programme_id)
    : null;

  const statusConfig = {
    draft: { label: "Draft", color: "bg-muted text-muted-foreground" },
    submitted: { label: "Submitted", color: "bg-warning/10 text-warning" },
    approved: { label: "Approved", color: "bg-success/10 text-success" },
  };

  return (
    <AppLayout title="Project Briefs" subtitle="PRINCE2 Project Initiation Documents">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <div className="flex items-center gap-4">
            <Select value={selectedProject} onValueChange={setSelectedProject}>
              <SelectTrigger className="w-[300px]">
                <Building2 className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Select project" />
              </SelectTrigger>
              <SelectContent>
                {projects.map(p => (
                  <SelectItem key={p.id} value={p.id}>
                    <div className="flex items-center gap-2">
                      <div className={`h-2 w-2 rounded-full ${
                        p.health === "green" ? "bg-success" :
                        p.health === "amber" ? "bg-warning" : "bg-destructive"
                      }`} />
                      {p.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {currentBrief && (
              <Badge className={statusConfig[currentBrief.status].color}>
                {statusConfig[currentBrief.status].label}
              </Badge>
            )}
          </div>

          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Project Brief
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create PRINCE2 Project Brief</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Project *</Label>
                  <Select
                    value={newBrief.project_id}
                    onValueChange={(v) => setNewBrief({ ...newBrief, project_id: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select project" />
                    </SelectTrigger>
                    <SelectContent>
                      {projects.filter(p => !briefs.find(b => b.project_id === p.id)).map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Project Background</Label>
                  <Textarea
                    value={newBrief.background}
                    onChange={(e) => setNewBrief({ ...newBrief, background: e.target.value })}
                    placeholder="Why is this project needed? What is the business context?"
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Project Objectives</Label>
                  <Textarea
                    value={newBrief.objectives}
                    onChange={(e) => setNewBrief({ ...newBrief, objectives: e.target.value })}
                    placeholder="What will the project achieve? (SMART objectives)"
                    rows={3}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Cost Estimate</Label>
                    <Input
                      value={newBrief.cost_estimate}
                      onChange={(e) => setNewBrief({ ...newBrief, cost_estimate: e.target.value })}
                      placeholder="e.g., £500,000"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Timeline Estimate</Label>
                    <Input
                      value={newBrief.timeline_estimate}
                      onChange={(e) => setNewBrief({ ...newBrief, timeline_estimate: e.target.value })}
                      placeholder="e.g., 6 months"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Scope</Label>
                  <Textarea
                    value={newBrief.scope}
                    onChange={(e) => setNewBrief({ ...newBrief, scope: e.target.value })}
                    placeholder="What is in scope? What is explicitly out of scope?"
                    rows={2}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Business Case Summary</Label>
                  <Textarea
                    value={newBrief.business_case_summary}
                    onChange={(e) => setNewBrief({ ...newBrief, business_case_summary: e.target.value })}
                    placeholder="Summarize the business justification and expected benefits"
                    rows={2}
                  />
                </div>
                <Button onClick={handleCreateBrief} className="w-full">
                  Create Project Brief
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* PRINCE2 Info */}
        <div className="p-4 rounded-lg bg-info/5 border border-info/20">
          <h4 className="font-medium text-sm mb-2 text-info">PRINCE2 Project Brief</h4>
          <p className="text-sm text-muted-foreground">
            The Project Brief is developed during the Starting Up a Project (SU) process. It provides 
            sufficient information to decide whether the project is viable and should proceed to initiation.
          </p>
        </div>

        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        ) : !currentProject ? (
          <div className="metric-card text-center py-12">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No projects found</p>
            <p className="text-sm text-muted-foreground">Create a project to add a project brief</p>
          </div>
        ) : !currentBrief ? (
          <div className="metric-card text-center py-12">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No Project Brief for {currentProject.name}</p>
            <Button className="mt-4" onClick={() => {
              setNewBrief({ ...newBrief, project_id: currentProject.id });
              setIsCreateOpen(true);
            }}>
              <Plus className="h-4 w-4 mr-2" />
              Create Project Brief
            </Button>
          </div>
        ) : (
          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList className="bg-secondary">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="business-case">Business Case</TabsTrigger>
              <TabsTrigger value="scope">Scope & Approach</TabsTrigger>
              <TabsTrigger value="risks">Risks & Constraints</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              <div className="grid gap-6 lg:grid-cols-2">
                <div className="metric-card">
                  <div className="flex items-center gap-2 mb-4">
                    <FileText className="h-5 w-5 text-primary" />
                    <h3 className="font-semibold">Project Information</h3>
                  </div>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center p-3 rounded-lg bg-secondary/50">
                      <span className="text-sm">Project Name</span>
                      <span className="font-medium">{currentProject.name}</span>
                    </div>
                    {programme && (
                      <div className="flex justify-between items-center p-3 rounded-lg bg-secondary/50">
                        <span className="text-sm">Program</span>
                        <Badge variant="outline">{programme.name}</Badge>
                      </div>
                    )}
                    <div className="flex justify-between items-center p-3 rounded-lg bg-secondary/50">
                      <span className="text-sm">Methodology</span>
                      <Badge variant="outline">{currentProject.methodology}</Badge>
                    </div>
                    <div className="flex justify-between items-center p-3 rounded-lg bg-secondary/50">
                      <span className="text-sm">Stage</span>
                      <Badge className="capitalize">{currentProject.stage}</Badge>
                    </div>
                  </div>
                </div>

                <div className="metric-card">
                  <div className="flex items-center gap-2 mb-4">
                    <Target className="h-5 w-5 text-primary" />
                    <h3 className="font-semibold">Project Background</h3>
                  </div>
                  <p className="text-muted-foreground">
                    {currentBrief.background || "Background not yet defined. The project background should explain why this project is needed and the business context."}
                  </p>
                </div>
              </div>

              <div className="metric-card">
                <div className="flex items-center gap-2 mb-4">
                  <CheckCircle2 className="h-5 w-5 text-success" />
                  <h3 className="font-semibold">Project Objectives</h3>
                </div>
                <p className="text-muted-foreground mb-4">
                  {currentBrief.objectives || "Objectives not yet defined. Define SMART objectives for this project."}
                </p>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="p-4 rounded-lg bg-secondary/50 text-center">
                    <DollarSign className="h-6 w-6 mx-auto mb-2 text-primary" />
                    <p className="font-medium">{currentBrief.cost_estimate || "TBD"}</p>
                    <p className="text-sm text-muted-foreground">Estimated Cost</p>
                  </div>
                  <div className="p-4 rounded-lg bg-secondary/50 text-center">
                    <Calendar className="h-6 w-6 mx-auto mb-2 text-primary" />
                    <p className="font-medium">{currentBrief.timeline_estimate || "TBD"}</p>
                    <p className="text-sm text-muted-foreground">Estimated Duration</p>
                  </div>
                  <div className="p-4 rounded-lg bg-secondary/50 text-center">
                    <Users className="h-6 w-6 mx-auto mb-2 text-primary" />
                    <p className="font-medium">TBD</p>
                    <p className="text-sm text-muted-foreground">Team Size</p>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="business-case" className="space-y-6">
              <div className="metric-card">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="h-5 w-5 text-success" />
                  <h3 className="font-semibold">Business Case Summary</h3>
                </div>
                <p className="text-muted-foreground mb-6">
                  {currentBrief.business_case_summary || "Business case not yet defined. The business case justifies the project investment."}
                </p>

                <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                  <h4 className="font-medium text-sm mb-2">PRINCE2 Business Case Elements</h4>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CheckCircle2 className="h-4 w-4 text-success" />
                      <span>Reasons for the project</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CheckCircle2 className="h-4 w-4 text-success" />
                      <span>Options considered</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CheckCircle2 className="h-4 w-4 text-success" />
                      <span>Expected benefits</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CheckCircle2 className="h-4 w-4 text-success" />
                      <span>Expected dis-benefits</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CheckCircle2 className="h-4 w-4 text-success" />
                      <span>Timescales</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CheckCircle2 className="h-4 w-4 text-success" />
                      <span>Investment appraisal</span>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="scope" className="space-y-6">
              <div className="grid gap-6 lg:grid-cols-2">
                <div className="metric-card">
                  <div className="flex items-center gap-2 mb-4">
                    <Target className="h-5 w-5 text-primary" />
                    <h3 className="font-semibold">Project Scope</h3>
                  </div>
                  <p className="text-muted-foreground">
                    {currentBrief.scope || "Scope not yet defined. Define what is included and excluded from the project."}
                  </p>
                </div>

                <div className="metric-card">
                  <div className="flex items-center gap-2 mb-4">
                    <Shield className="h-5 w-5 text-primary" />
                    <h3 className="font-semibold">Project Approach</h3>
                  </div>
                  <div className="space-y-3">
                    <div className="p-3 rounded-lg bg-secondary/50">
                      <p className="font-medium text-sm">Methodology</p>
                      <p className="text-sm text-muted-foreground">{currentProject.methodology}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-secondary/50">
                      <p className="font-medium text-sm">Delivery Approach</p>
                      <p className="text-sm text-muted-foreground">Stage-gated delivery with defined products</p>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="risks" className="space-y-6">
              <div className="grid gap-6 lg:grid-cols-2">
                <div className="metric-card">
                  <div className="flex items-center gap-2 mb-4">
                    <AlertCircle className="h-5 w-5 text-warning" />
                    <h3 className="font-semibold">Constraints</h3>
                  </div>
                  <p className="text-muted-foreground">
                    {currentBrief.constraints || "Constraints not yet defined. List any limitations that the project must work within."}
                  </p>
                </div>

                <div className="metric-card">
                  <div className="flex items-center gap-2 mb-4">
                    <CheckCircle2 className="h-5 w-5 text-info" />
                    <h3 className="font-semibold">Assumptions</h3>
                  </div>
                  <p className="text-muted-foreground">
                    {currentBrief.assumptions || "Assumptions not yet defined. Document assumptions that the project is based on."}
                  </p>
                </div>
              </div>

              <div className="metric-card">
                <div className="flex items-center gap-2 mb-4">
                  <AlertCircle className="h-5 w-5 text-destructive" />
                  <h3 className="font-semibold">Initial Risk Summary</h3>
                </div>
                <p className="text-muted-foreground">
                  {currentBrief.risk_summary || "Risk summary not yet defined. Identify major risks that could affect project success."}
                </p>
              </div>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </AppLayout>
  );
}
