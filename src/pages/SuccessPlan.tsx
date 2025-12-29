import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Target,
  TrendingUp,
  Building2,
  Save,
  Edit,
  CheckCircle2,
  Calendar,
  Shield,
  Users,
  Clock,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { toast } from "sonner";

interface Programme {
  id: string;
  name: string;
  status: string;
}

interface SuccessPlan {
  id: string;
  programme_id: string;
  target_outcomes: string | null;
  success_measures: string | null;
  key_milestones: string | null;
  critical_success_factors: string | null;
  risk_mitigation: string | null;
  resource_requirements: string | null;
  timeline_summary: string | null;
  review_schedule: string | null;
}

export default function SuccessPlanPage() {
  const [programmes, setProgrammes] = useState<Programme[]>([]);
  const [selectedProgramme, setSelectedProgramme] = useState<string>("");
  const [successPlan, setSuccessPlan] = useState<SuccessPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    target_outcomes: "",
    success_measures: "",
    key_milestones: "",
    critical_success_factors: "",
    risk_mitigation: "",
    resource_requirements: "",
    timeline_summary: "",
    review_schedule: "",
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

  const fetchSuccessPlan = async (programmeId: string) => {
    const { data } = await supabase
      .from("success_plans")
      .select("*")
      .eq("programme_id", programmeId)
      .maybeSingle();
    
    setSuccessPlan(data as SuccessPlan | null);
    if (data) {
      setFormData({
        target_outcomes: data.target_outcomes || "",
        success_measures: data.success_measures || "",
        key_milestones: data.key_milestones || "",
        critical_success_factors: data.critical_success_factors || "",
        risk_mitigation: data.risk_mitigation || "",
        resource_requirements: data.resource_requirements || "",
        timeline_summary: data.timeline_summary || "",
        review_schedule: data.review_schedule || "",
      });
    } else {
      setFormData({
        target_outcomes: "",
        success_measures: "",
        key_milestones: "",
        critical_success_factors: "",
        risk_mitigation: "",
        resource_requirements: "",
        timeline_summary: "",
        review_schedule: "",
      });
    }
  };

  useEffect(() => {
    fetchProgrammes();
  }, [currentOrganization]);

  useEffect(() => {
    if (selectedProgramme) {
      fetchSuccessPlan(selectedProgramme);
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

    if (successPlan) {
      const { error } = await supabase
        .from("success_plans")
        .update({ ...formData })
        .eq("id", successPlan.id);

      if (error) {
        toast.error("Failed to update success plan");
      } else {
        toast.success("Success plan updated");
        setIsEditing(false);
        fetchSuccessPlan(selectedProgramme);
      }
    } else {
      const { error } = await supabase
        .from("success_plans")
        .insert({
          programme_id: selectedProgramme,
          organization_id: currentOrganization?.id || null,
          ...formData,
          created_by: userData.user.id,
        });

      if (error) {
        toast.error("Failed to create success plan");
      } else {
        toast.success("Success plan created");
        setIsEditing(false);
        fetchSuccessPlan(selectedProgramme);
      }
    }
    setSaving(false);
  };

  const sections = [
    { key: "target_outcomes", label: "Target Outcomes", icon: Target, description: "The specific outcomes the programme aims to achieve" },
    { key: "success_measures", label: "Success Measures", icon: TrendingUp, description: "How success will be measured and tracked" },
    { key: "key_milestones", label: "Key Milestones", icon: Calendar, description: "Major milestones and decision points" },
    { key: "critical_success_factors", label: "Critical Success Factors", icon: CheckCircle2, description: "Factors essential for programme success" },
    { key: "risk_mitigation", label: "Risk Mitigation", icon: Shield, description: "Key risks and mitigation strategies" },
    { key: "resource_requirements", label: "Resource Requirements", icon: Users, description: "Resources needed for successful delivery" },
    { key: "timeline_summary", label: "Timeline Summary", icon: Clock, description: "High-level timeline and key dates" },
    { key: "review_schedule", label: "Review Schedule", icon: Calendar, description: "Schedule for progress reviews and assessments" },
  ];

  return (
    <AppLayout title="Success Plan" subtitle="MSP Programme Success Plan">
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
            {successPlan && (
              <Badge variant="outline" className="text-success">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Plan Exists
              </Badge>
            )}
          </div>
          
          {!isEditing ? (
            <Button onClick={() => setIsEditing(true)}>
              <Edit className="h-4 w-4 mr-2" />
              Edit Plan
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => {
                setIsEditing(false);
                if (successPlan) fetchSuccessPlan(selectedProgramme);
              }}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                <Save className="h-4 w-4 mr-2" />
                {saving ? "Saving..." : "Save Plan"}
              </Button>
            </div>
          )}
        </div>

        {/* MSP Info */}
        <div className="p-4 rounded-lg bg-info/5 border border-info/20">
          <h4 className="font-medium text-sm mb-2 text-info">MSP Success Plan</h4>
          <p className="text-sm text-muted-foreground">
            The Success Plan defines how the programme will achieve its objectives, including target outcomes,
            success measures, critical success factors, and the approach to risk mitigation.
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
