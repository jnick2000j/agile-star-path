import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Target,
  FileText,
  Building2,
  Save,
  Edit,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { toast } from "sonner";

interface Programme {
  id: string;
  name: string;
  status: string;
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

export default function ProgrammeDefinition() {
  const [programmes, setProgrammes] = useState<Programme[]>([]);
  const [selectedProgramme, setSelectedProgramme] = useState<string>("");
  const [definition, setDefinition] = useState<ProgrammeDefinition | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    vision_statement: "",
    strategic_objectives: "",
    scope_statement: "",
    out_of_scope: "",
    success_criteria: "",
    key_assumptions: "",
    constraints: "",
    dependencies: "",
  });
  const { currentOrganization } = useOrganization();

  const fetchProgrammes = async () => {
    let query = supabase.from("programmes").select("id, name, status").order("name");
    if (currentOrganization) {
      query = query.eq("organization_id", currentOrganization.id);
    }
    const { data } = await query;
    setProgrammes(data || []);
    if (data && data.length > 0 && !selectedProgramme) {
      setSelectedProgramme(data[0].id);
    }
    setLoading(false);
  };

  const fetchDefinition = async (programmeId: string) => {
    const { data } = await supabase
      .from("programme_definitions")
      .select("*")
      .eq("programme_id", programmeId)
      .maybeSingle();
    
    setDefinition(data as ProgrammeDefinition | null);
    if (data) {
      setFormData({
        vision_statement: data.vision_statement || "",
        strategic_objectives: data.strategic_objectives || "",
        scope_statement: data.scope_statement || "",
        out_of_scope: data.out_of_scope || "",
        success_criteria: data.success_criteria || "",
        key_assumptions: data.key_assumptions || "",
        constraints: data.constraints || "",
        dependencies: data.dependencies || "",
      });
    } else {
      setFormData({
        vision_statement: "",
        strategic_objectives: "",
        scope_statement: "",
        out_of_scope: "",
        success_criteria: "",
        key_assumptions: "",
        constraints: "",
        dependencies: "",
      });
    }
  };

  useEffect(() => {
    fetchProgrammes();
  }, [currentOrganization]);

  useEffect(() => {
    if (selectedProgramme) {
      fetchDefinition(selectedProgramme);
    }
  }, [selectedProgramme]);

  const handleSave = async () => {
    if (!selectedProgramme) return;
    
    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      toast.error("You must be logged in");
      setSaving(false);
      return;
    }

    if (definition) {
      const { error } = await supabase
        .from("programme_definitions")
        .update({
          ...formData,
        })
        .eq("id", definition.id);

      if (error) {
        toast.error("Failed to update definition");
      } else {
        toast.success("Definition updated");
        setIsEditing(false);
        fetchDefinition(selectedProgramme);
      }
    } else {
      const { error } = await supabase
        .from("programme_definitions")
        .insert({
          programme_id: selectedProgramme,
          organization_id: currentOrganization?.id || null,
          ...formData,
          created_by: userData.user.id,
        });

      if (error) {
        toast.error("Failed to create definition");
      } else {
        toast.success("Definition created");
        setIsEditing(false);
        fetchDefinition(selectedProgramme);
      }
    }
    setSaving(false);
  };

  const sections = [
    { key: "vision_statement", label: "Vision Statement", icon: Target, description: "The desired future state the programme will deliver" },
    { key: "strategic_objectives", label: "Strategic Objectives", icon: Target, description: "Key objectives aligned with organizational strategy" },
    { key: "scope_statement", label: "Scope Statement", icon: FileText, description: "What is included within the programme boundaries" },
    { key: "out_of_scope", label: "Out of Scope", icon: AlertCircle, description: "What is explicitly excluded from the programme" },
    { key: "success_criteria", label: "Success Criteria", icon: CheckCircle2, description: "Measurable criteria to determine programme success" },
    { key: "key_assumptions", label: "Key Assumptions", icon: FileText, description: "Assumptions that underpin the programme approach" },
    { key: "constraints", label: "Constraints", icon: AlertCircle, description: "Limitations that affect programme delivery" },
    { key: "dependencies", label: "Dependencies", icon: FileText, description: "External factors the programme depends on" },
  ];

  return (
    <AppLayout title="Programme Definition" subtitle="MSP Programme Definition Document">
      <div className="space-y-6">
        {/* Programme Selector */}
        <div className="flex items-center justify-between">
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
            {definition && (
              <Badge variant="outline" className="text-success">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Definition Exists
              </Badge>
            )}
          </div>
          
          {!isEditing ? (
            <Button onClick={() => setIsEditing(true)}>
              <Edit className="h-4 w-4 mr-2" />
              Edit Definition
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => {
                setIsEditing(false);
                if (definition) {
                  setFormData({
                    vision_statement: definition.vision_statement || "",
                    strategic_objectives: definition.strategic_objectives || "",
                    scope_statement: definition.scope_statement || "",
                    out_of_scope: definition.out_of_scope || "",
                    success_criteria: definition.success_criteria || "",
                    key_assumptions: definition.key_assumptions || "",
                    constraints: definition.constraints || "",
                    dependencies: definition.dependencies || "",
                  });
                }
              }}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                <Save className="h-4 w-4 mr-2" />
                {saving ? "Saving..." : "Save Definition"}
              </Button>
            </div>
          )}
        </div>

        {/* MSP Info */}
        <div className="p-4 rounded-lg bg-info/5 border border-info/20">
          <h4 className="font-medium text-sm mb-2 text-info">MSP Programme Definition</h4>
          <p className="text-sm text-muted-foreground">
            The Programme Definition Document captures the vision, scope, and strategic objectives. 
            It provides a clear picture of what the programme will deliver and the boundaries within which it operates.
          </p>
        </div>

        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        ) : !selectedProgramme ? (
          <div className="metric-card text-center py-12">
            <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No programmes found</p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {sections.map(section => {
              const Icon = section.icon;
              const value = formData[section.key as keyof typeof formData];
              
              return (
                <div key={section.key} className="metric-card">
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className="h-5 w-5 text-primary" />
                    <h3 className="font-semibold">{section.label}</h3>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">{section.description}</p>
                  
                  {isEditing ? (
                    <Textarea
                      value={value}
                      onChange={(e) => setFormData({ ...formData, [section.key]: e.target.value })}
                      placeholder={`Enter ${section.label.toLowerCase()}...`}
                      rows={4}
                    />
                  ) : (
                    <div className="p-3 rounded-lg bg-secondary/50 min-h-[100px]">
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {value || "Not defined"}
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
