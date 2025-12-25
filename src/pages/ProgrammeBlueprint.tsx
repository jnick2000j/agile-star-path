import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
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
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";

interface Programme {
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
  const [programmes, setProgrammes] = useState<Programme[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [benefits, setBenefits] = useState<Benefit[]>([]);
  const [risks, setRisks] = useState<Risk[]>([]);
  const [selectedProgramme, setSelectedProgramme] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const { currentOrganization } = useOrganization();

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

  useEffect(() => {
    fetchData();
  }, [currentOrganization]);

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

  return (
    <AppLayout title="Programme Blueprint" subtitle="PRINCE2 MSP Programme Definition Document">
      <div className="space-y-6">
        {/* Programme Selector */}
        <div className="flex items-center gap-4">
          <Select value={selectedProgramme} onValueChange={setSelectedProgramme}>
            <SelectTrigger className="w-[300px]">
              <Building2 className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Select programme" />
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
            <p className="text-muted-foreground">No programmes found</p>
            <p className="text-sm text-muted-foreground">Create a programme to view its blueprint</p>
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
                  <div className="flex items-center gap-2 mb-4">
                    <Target className="h-5 w-5 text-primary" />
                    <h3 className="font-semibold">Programme Vision</h3>
                  </div>
                  <p className="text-muted-foreground mb-4">
                    {currentProgramme.description || "No vision statement defined. The Programme Vision should describe the desired end state and strategic intent."}
                  </p>
                  <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                    <h4 className="font-medium text-sm mb-2">PRINCE2 MSP Blueprint Elements</h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• Vision Statement defining desired future state</li>
                      <li>• Strategic alignment with organizational goals</li>
                      <li>• Scope boundaries and exclusions</li>
                      <li>• Success criteria and KPIs</li>
                    </ul>
                  </div>
                </div>

                <div className="metric-card">
                  <div className="flex items-center gap-2 mb-4">
                    <FileText className="h-5 w-5 text-primary" />
                    <h3 className="font-semibold">Programme Brief</h3>
                  </div>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center p-3 rounded-lg bg-secondary/50">
                      <span className="text-sm">Programme Sponsor</span>
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
                </div>
              </div>

              {/* Progress Summary */}
              <div className="metric-card">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold">Programme Progress</h3>
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
                  <p className="text-muted-foreground text-center py-8">No benefits defined for this programme</p>
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
                  <p className="text-muted-foreground text-center py-8">No projects in this programme</p>
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
                    <h3 className="font-semibold">Programme Governance Structure</h3>
                  </div>
                  <div className="space-y-4">
                    <div className="p-4 rounded-lg border border-primary/30 bg-primary/5">
                      <h4 className="font-medium mb-2">Sponsoring Group</h4>
                      <p className="text-sm text-muted-foreground">Owns the business case, provides strategic direction</p>
                    </div>
                    <div className="p-4 rounded-lg border">
                      <h4 className="font-medium mb-2">Programme Board</h4>
                      <p className="text-sm text-muted-foreground">Decision-making body for programme-level issues</p>
                    </div>
                    <div className="p-4 rounded-lg border">
                      <h4 className="font-medium mb-2">Programme Manager</h4>
                      <p className="text-sm text-muted-foreground">Day-to-day management of the programme</p>
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
                        <p className="font-medium text-sm">Risk & Issue Management</p>
                        <p className="text-xs text-muted-foreground">Escalation paths and tolerance levels</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50">
                      <CheckCircle2 className="h-5 w-5 text-success" />
                      <div>
                        <p className="font-medium text-sm">Quality Assurance</p>
                        <p className="text-xs text-muted-foreground">Programme-level quality standards</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50">
                      <CheckCircle2 className="h-5 w-5 text-success" />
                      <div>
                        <p className="font-medium text-sm">Stakeholder Engagement</p>
                        <p className="text-xs text-muted-foreground">Communication and engagement strategy</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </AppLayout>
  );
}
