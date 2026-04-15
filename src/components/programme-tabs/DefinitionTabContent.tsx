import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Target, FileText, Save, Edit, CheckCircle2, AlertCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { toast } from "sonner";

interface DefinitionTabContentProps {
  programmeId: string;
}

interface ProgrammeDefinition {
  id: string;
  vision_statement: string | null;
  strategic_objectives: string | null;
  scope_statement: string | null;
  out_of_scope: string | null;
  success_criteria: string | null;
  key_assumptions: string | null;
  constraints: string | null;
  dependencies: string | null;
}

export function DefinitionTabContent({ programmeId }: DefinitionTabContentProps) {
  const [definition, setDefinition] = useState<ProgrammeDefinition | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    vision_statement: "", strategic_objectives: "", scope_statement: "",
    out_of_scope: "", success_criteria: "", key_assumptions: "",
    constraints: "", dependencies: "",
  });
  const { currentOrganization } = useOrganization();

  const fetchDefinition = async () => {
    setLoading(true);
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
    }
    setLoading(false);
  };

  useEffect(() => { fetchDefinition(); }, [programmeId]);

  const handleSave = async () => {
    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) { toast.error("You must be logged in"); setSaving(false); return; }

    if (definition) {
      const { error } = await supabase.from("programme_definitions").update({ ...formData }).eq("id", definition.id);
      if (error) toast.error("Failed to update"); else { toast.success("Definition updated"); setIsEditing(false); fetchDefinition(); }
    } else {
      const { error } = await supabase.from("programme_definitions").insert({
        programme_id: programmeId, organization_id: currentOrganization?.id || null, ...formData, created_by: userData.user.id,
      });
      if (error) toast.error("Failed to create"); else { toast.success("Definition created"); setIsEditing(false); fetchDefinition(); }
    }
    setSaving(false);
  };

  const sections = [
    { key: "vision_statement", label: "Vision Statement", icon: Target, description: "The desired future state the program will deliver" },
    { key: "strategic_objectives", label: "Strategic Objectives", icon: Target, description: "Key objectives aligned with organizational strategy" },
    { key: "scope_statement", label: "Scope Statement", icon: FileText, description: "What is included within the program boundaries" },
    { key: "out_of_scope", label: "Out of Scope", icon: AlertCircle, description: "What is explicitly excluded from the program" },
    { key: "success_criteria", label: "Success Criteria", icon: CheckCircle2, description: "Measurable criteria to determine program success" },
    { key: "key_assumptions", label: "Key Assumptions", icon: FileText, description: "Assumptions that underpin the program approach" },
    { key: "constraints", label: "Constraints", icon: AlertCircle, description: "Limitations that affect programme delivery" },
    { key: "dependencies", label: "Dependencies", icon: FileText, description: "External factors the program depends on" },
  ];

  if (loading) return <div className="text-center py-8 text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {definition && (
            <Badge variant="outline" className="text-success">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Definition Exists
            </Badge>
          )}
        </div>
        {!isEditing ? (
          <Button onClick={() => setIsEditing(true)}><Edit className="h-4 w-4 mr-2" />Edit Definition</Button>
        ) : (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => { setIsEditing(false); if (definition) fetchDefinition(); }}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}><Save className="h-4 w-4 mr-2" />{saving ? "Saving..." : "Save Definition"}</Button>
          </div>
        )}
      </div>

      <div className="p-4 rounded-lg bg-info/5 border border-info/20">
        <h4 className="font-medium text-sm mb-2 text-info">MSP Program Definition</h4>
        <p className="text-sm text-muted-foreground">
          The Program Definition Document captures the vision, scope, and strategic objectives.
        </p>
      </div>

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
                <Textarea value={value} onChange={(e) => setFormData({ ...formData, [section.key]: e.target.value })} placeholder={`Enter ${section.label.toLowerCase()}...`} rows={4} />
              ) : (
                <div className="p-3 rounded-lg bg-secondary/50 min-h-[100px]">
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{value || "Not defined"}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
