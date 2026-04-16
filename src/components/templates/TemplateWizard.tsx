import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { ChevronLeft, ChevronRight, Check, Sparkles, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

export type TemplateType = 
  | "programme_mandate" 
  | "project_brief" 
  | "business_case" 
  | "product_vision"
  | "risk_register"
  | "lessons_learned"
  | "sprint_planning"
  | "user_story"
  | "rice_worksheet"
  | "definition_of_done";

interface WizardStep {
  title: string;
  description: string;
  fields: WizardField[];
}

interface WizardField {
  key: string;
  label: string;
  type: "text" | "textarea" | "select" | "date" | "number";
  placeholder?: string;
  helpText?: string;
  required?: boolean;
  options?: { value: string; label: string }[];
  fullWidth?: boolean;
}

interface TemplateWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templateType: TemplateType;
  templateName: string;
}

interface Organization {
  id: string;
  name: string;
}

const getWizardSteps = (templateType: TemplateType, orgs: Organization[], programmes: any[], projects: any[]): WizardStep[] => {
  const orgField: WizardField = {
    key: "organization_id",
    label: "Organization",
    type: "select",
    placeholder: "Select organization",
    helpText: "Which organization does this belong to?",
    options: orgs.map(o => ({ value: o.id, label: o.name })),
  };

  switch (templateType) {
    case "programme_mandate":
      return [
        {
          title: "Programme Overview",
          description: "Let's start with the basics of your programme.",
          fields: [
            orgField,
            { key: "name", label: "Programme Name", type: "text", placeholder: "e.g. Digital Transformation Programme", required: true, helpText: "A clear, descriptive name for the programme" },
            { key: "description", label: "Programme Background", type: "textarea", placeholder: "Describe the strategic context and drivers for this programme...", helpText: "What business need or opportunity is this programme addressing?", fullWidth: true },
          ],
        },
        {
          title: "Strategic Objectives",
          description: "Define what this programme aims to achieve.",
          fields: [
            { key: "vision", label: "Vision Statement", type: "textarea", placeholder: "Describe the desired future state...", helpText: "What does success look like when this programme is complete?", fullWidth: true },
            { key: "benefits_target", label: "Expected Benefits", type: "textarea", placeholder: "List the key benefits this programme will deliver...", helpText: "Quantify where possible (e.g. 20% cost reduction, 15% revenue increase)", fullWidth: true },
          ],
        },
        {
          title: "Scope & Timeline",
          description: "Define the boundaries and timeframe.",
          fields: [
            { key: "sponsor", label: "Programme Sponsor", type: "text", placeholder: "Name of the executive sponsor" },
            { key: "budget", label: "Estimated Budget", type: "text", placeholder: "e.g. £500,000" },
            { key: "start_date", label: "Start Date", type: "date" },
            { key: "end_date", label: "End Date", type: "date" },
          ],
        },
        {
          title: "Constraints & Dependencies",
          description: "Identify any known constraints, dependencies, or initial risks.",
          fields: [
            { key: "constraints", label: "Key Constraints", type: "textarea", placeholder: "List time, budget, resource, or regulatory constraints...", fullWidth: true },
            { key: "dependencies", label: "Dependencies", type: "textarea", placeholder: "List internal or external dependencies...", fullWidth: true },
            { key: "initial_risks", label: "Initial Risks", type: "textarea", placeholder: "Identify high-level risks to be aware of...", fullWidth: true },
          ],
        },
      ];

    case "project_brief":
      return [
        {
          title: "Project Fundamentals",
          description: "Start with the essential project details.",
          fields: [
            orgField,
            { key: "name", label: "Project Name", type: "text", placeholder: "e.g. Website Redesign", required: true },
            { key: "programme_id", label: "Parent Programme", type: "select", placeholder: "Link to a programme (optional)", options: programmes.map(p => ({ value: p.id, label: p.name })) },
            { key: "methodology", label: "Methodology", type: "select", required: true, options: [
              { value: "PRINCE2", label: "PRINCE2" },
              { value: "Agile", label: "Agile" },
              { value: "Hybrid", label: "Hybrid" },
              { value: "Waterfall", label: "Waterfall" },
            ]},
          ],
        },
        {
          title: "Objectives & Outcomes",
          description: "Define what the project will achieve.",
          fields: [
            { key: "description", label: "Project Description", type: "textarea", placeholder: "Provide context for the project...", helpText: "Include background, purpose, and desired outcomes", fullWidth: true },
            { key: "objectives", label: "SMART Objectives", type: "textarea", placeholder: "1. Specific objective...\n2. Measurable objective...\n3. Achievable objective...", helpText: "List Specific, Measurable, Achievable, Relevant, Time-bound objectives", fullWidth: true },
          ],
        },
        {
          title: "Project Setup",
          description: "Configure the project parameters.",
          fields: [
            { key: "priority", label: "Priority", type: "select", options: [
              { value: "critical", label: "Critical" },
              { value: "high", label: "High" },
              { value: "medium", label: "Medium" },
              { value: "low", label: "Low" },
            ]},
            { key: "health", label: "Initial Health", type: "select", options: [
              { value: "green", label: "🟢 Green - On Track" },
              { value: "amber", label: "🟡 Amber - At Risk" },
              { value: "red", label: "🔴 Red - Off Track" },
            ]},
            { key: "start_date", label: "Start Date", type: "date" },
            { key: "end_date", label: "End Date", type: "date" },
          ],
        },
      ];

    case "business_case":
      return [
        {
          title: "Strategic Fit",
          description: "Explain why this investment is needed.",
          fields: [
            orgField,
            { key: "name", label: "Business Case Title", type: "text", placeholder: "e.g. CRM System Implementation", required: true },
            { key: "description", label: "Executive Summary", type: "textarea", placeholder: "Brief overview of the business case...", fullWidth: true },
            { key: "strategic_fit", label: "Strategic Alignment", type: "textarea", placeholder: "How does this align with organizational strategy?", fullWidth: true },
          ],
        },
        {
          title: "Options Analysis",
          description: "Compare different approaches.",
          fields: [
            { key: "option_do_nothing", label: "Option 1: Do Nothing", type: "textarea", placeholder: "Pros, cons, and cost of doing nothing...", fullWidth: true },
            { key: "option_minimum", label: "Option 2: Do Minimum", type: "textarea", placeholder: "Pros, cons, and cost of minimum viable approach...", fullWidth: true },
            { key: "option_recommended", label: "Option 3: Recommended", type: "textarea", placeholder: "Pros, cons, and cost of recommended approach...", fullWidth: true },
          ],
        },
        {
          title: "Benefits & Costs",
          description: "Quantify the value and investment.",
          fields: [
            { key: "benefits_target", label: "Expected Benefits", type: "textarea", placeholder: "List benefits with measurements and targets...", fullWidth: true },
            { key: "budget", label: "Total Investment Required", type: "text", placeholder: "e.g. £250,000" },
            { key: "roi", label: "Expected ROI", type: "text", placeholder: "e.g. 150% over 3 years" },
            { key: "payback_period", label: "Payback Period", type: "text", placeholder: "e.g. 18 months" },
          ],
        },
        {
          title: "Timeline & Risks",
          description: "When and what could go wrong.",
          fields: [
            { key: "start_date", label: "Proposed Start", type: "date" },
            { key: "end_date", label: "Proposed End", type: "date" },
            { key: "initial_risks", label: "Major Risks", type: "textarea", placeholder: "List key risks with probability, impact, and response...", fullWidth: true },
            { key: "recommendation", label: "Recommendation", type: "textarea", placeholder: "Clear recommendation with justification...", fullWidth: true },
          ],
        },
      ];

    case "product_vision":
      return [
        {
          title: "Product Identity",
          description: "Define what your product is and who it's for.",
          fields: [
            orgField,
            { key: "name", label: "Product Name", type: "text", placeholder: "e.g. Customer Portal", required: true },
            { key: "product_type", label: "Product Type", type: "select", options: [
              { value: "digital", label: "Digital" },
              { value: "physical", label: "Physical" },
              { value: "service", label: "Service" },
              { value: "platform", label: "Platform" },
              { value: "hybrid", label: "Hybrid" },
            ]},
            { key: "programme_id", label: "Parent Programme", type: "select", placeholder: "Optional", options: programmes.map(p => ({ value: p.id, label: p.name })) },
          ],
        },
        {
          title: "Vision & Value",
          description: "Articulate the vision and value proposition.",
          fields: [
            { key: "vision", label: "Vision Statement", type: "textarea", placeholder: "One sentence describing the ultimate purpose and inspiration...", helpText: "What future does this product create?", fullWidth: true },
            { key: "value_proposition", label: "Value Proposition", type: "textarea", placeholder: "What makes this product uniquely valuable to customers?", fullWidth: true },
            { key: "target_market", label: "Target Market", type: "textarea", placeholder: "Describe your primary customer personas and segments...", fullWidth: true },
          ],
        },
        {
          title: "Metrics & Goals",
          description: "How will you measure success?",
          fields: [
            { key: "primary_metric", label: "North Star Metric", type: "text", placeholder: "e.g. Monthly Active Users, Revenue per User", helpText: "The single most important metric" },
            { key: "revenue_target", label: "Revenue Target", type: "text", placeholder: "e.g. £1M ARR by Q4 2025" },
            { key: "launch_date", label: "Target Launch Date", type: "date" },
            { key: "description", label: "Product Description", type: "textarea", placeholder: "Detailed description of the product...", fullWidth: true },
          ],
        },
      ];

    default:
      return [
        {
          title: "Template Preview",
          description: "This template is available as a reference guide.",
          fields: [
            { key: "info", label: "Note", type: "text", placeholder: "This template is for reference only - use Copy or Download to use it" },
          ],
        },
      ];
  }
};

const getCreatesEntity = (templateType: TemplateType): string | null => {
  switch (templateType) {
    case "programme_mandate":
    case "business_case":
      return "programme";
    case "project_brief":
      return "project";
    case "product_vision":
      return "product";
    default:
      return null;
  }
};

export function TemplateWizard({ open, onOpenChange, templateType, templateName }: TemplateWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [programmes, setProgrammes] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (open) {
      setCurrentStep(0);
      setFormData({});
      const fetchData = async () => {
        const [orgsRes, progsRes, projsRes] = await Promise.all([
          supabase.from("organizations").select("id, name").order("name"),
          supabase.from("programmes").select("id, name").order("name"),
          supabase.from("projects").select("id, name").order("name"),
        ]);
        if (orgsRes.data) setOrganizations(orgsRes.data);
        if (progsRes.data) setProgrammes(progsRes.data);
        if (projsRes.data) setProjects(projsRes.data);
      };
      fetchData();
    }
  }, [open]);

  const steps = getWizardSteps(templateType, organizations, programmes, projects);
  const entityType = getCreatesEntity(templateType);
  const totalSteps = steps.length;
  const progress = ((currentStep + 1) / totalSteps) * 100;

  const handleFieldChange = (key: string, value: string) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const handleNext = () => {
    if (currentStep < totalSteps - 1) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleSubmit = async () => {
    if (!user || !entityType) return;
    setLoading(true);

    try {
      if (entityType === "programme") {
        const { data, error } = await supabase.from("programmes").insert({
          name: formData.name,
          description: formData.description || formData.vision || null,
          sponsor: formData.sponsor || null,
          budget: formData.budget || null,
          benefits_target: formData.benefits_target || null,
          start_date: formData.start_date || null,
          end_date: formData.end_date || null,
          organization_id: formData.organization_id || null,
          created_by: user.id,
          manager_id: user.id,
          status: "active",
          progress: 0,
        }).select("id").single();

        if (error) throw error;

        // Also create programme definition if we have extra fields
        if (formData.constraints || formData.dependencies || formData.vision || formData.strategic_fit) {
          await supabase.from("programme_definitions").insert({
            programme_id: data.id,
            organization_id: formData.organization_id || null,
            vision_statement: formData.vision || null,
            strategic_objectives: formData.strategic_fit || null,
            constraints: formData.constraints || null,
            dependencies: formData.dependencies || null,
            key_assumptions: formData.initial_risks || null,
            created_by: user.id,
          });
        }

        toast.success("Programme created from template!");
        navigate(`/programmes/${data.id}`);
      } else if (entityType === "project") {
        const { data, error } = await supabase.from("projects").insert({
          name: formData.name,
          description: formData.description || null,
          programme_id: formData.programme_id || null,
          organization_id: formData.organization_id || null,
          methodology: formData.methodology || "PRINCE2",
          priority: formData.priority || "medium",
          health: formData.health || "green",
          stage: "initiating",
          start_date: formData.start_date || null,
          end_date: formData.end_date || null,
          created_by: user.id,
          manager_id: user.id,
        }).select("id").single();

        if (error) throw error;
        toast.success("Project created from template!");
        navigate(`/projects/${data.id}`);
      } else if (entityType === "product") {
        const { data, error } = await supabase.from("products").insert({
          name: formData.name,
          description: formData.description || null,
          organization_id: formData.organization_id || null,
          programme_id: formData.programme_id || null,
          product_type: formData.product_type || "digital",
          stage: "discovery",
          status: "concept",
          vision: formData.vision || null,
          value_proposition: formData.value_proposition || null,
          target_market: formData.target_market || null,
          primary_metric: formData.primary_metric || null,
          revenue_target: formData.revenue_target || null,
          launch_date: formData.launch_date || null,
          created_by: user.id,
          product_owner_id: user.id,
        }).select("id").single();

        if (error) throw error;
        toast.success("Product created from template!");
        navigate(`/products/${data.id}`);
      }

      onOpenChange(false);
    } catch (error: any) {
      console.error("Error creating from template:", error);
      toast.error(error.message || "Failed to create from template");
    } finally {
      setLoading(false);
    }
  };

  const currentStepData = steps[currentStep];
  const isLastStep = currentStep === totalSteps - 1;
  const canCreate = !!entityType;
  const hasRequiredFields = !currentStepData?.fields.some(
    f => f.required && !formData[f.key]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-lg">{templateName}</DialogTitle>
              <DialogDescription className="text-sm">
                Step {currentStep + 1} of {totalSteps}
                {entityType && <span className="ml-2 text-primary">• Creates a {entityType}</span>}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Progress Bar */}
        <div className="space-y-2">
          <Progress value={progress} className="h-2" />
          <div className="flex justify-between">
            {steps.map((step, i) => (
              <button
                key={i}
                onClick={() => i <= currentStep && setCurrentStep(i)}
                className={`text-xs font-medium transition-colors ${
                  i === currentStep ? "text-primary" : 
                  i < currentStep ? "text-muted-foreground cursor-pointer hover:text-foreground" : 
                  "text-muted-foreground/50"
                }`}
              >
                {step.title}
              </button>
            ))}
          </div>
        </div>

        <Separator />

        {/* Step Content */}
        <div className="flex-1 overflow-y-auto space-y-1 py-2">
          <div className="mb-4">
            <h3 className="text-base font-semibold">{currentStepData?.title}</h3>
            <p className="text-sm text-muted-foreground">{currentStepData?.description}</p>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            {currentStepData?.fields.map((field) => (
              <div key={field.key} className={field.fullWidth || field.type === "textarea" ? "col-span-2" : ""}>
                <Label htmlFor={field.key} className="text-sm font-medium">
                  {field.label}
                  {field.required && <span className="text-destructive ml-1">*</span>}
                </Label>
                {field.helpText && (
                  <p className="text-xs text-muted-foreground mb-1.5">{field.helpText}</p>
                )}
                {field.type === "textarea" ? (
                  <Textarea
                    id={field.key}
                    value={formData[field.key] || ""}
                    onChange={(e) => handleFieldChange(field.key, e.target.value)}
                    placeholder={field.placeholder}
                    rows={4}
                    className="mt-1"
                  />
                ) : field.type === "select" ? (
                  <Select
                    value={formData[field.key] || ""}
                    onValueChange={(val) => handleFieldChange(field.key, val)}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder={field.placeholder || `Select ${field.label}`} />
                    </SelectTrigger>
                    <SelectContent>
                      {field.options?.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    id={field.key}
                    type={field.type}
                    value={formData[field.key] || ""}
                    onChange={(e) => handleFieldChange(field.key, e.target.value)}
                    placeholder={field.placeholder}
                    className="mt-1"
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        <Separator />

        {/* Navigation */}
        <div className="flex justify-between items-center pt-2">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={currentStep === 0}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          
          <div className="flex gap-1">
            {steps.map((_, i) => (
              <div
                key={i}
                className={`h-2 w-2 rounded-full transition-colors ${
                  i === currentStep ? "bg-primary" : 
                  i < currentStep ? "bg-primary/40" : 
                  "bg-muted"
                }`}
              />
            ))}
          </div>

          {isLastStep && canCreate ? (
            <Button onClick={handleSubmit} disabled={loading || !hasRequiredFields}>
              {loading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Check className="h-4 w-4 mr-1" />}
              Create {entityType && entityType.charAt(0).toUpperCase() + entityType.slice(1)}
            </Button>
          ) : (
            <Button onClick={handleNext} disabled={!hasRequiredFields}>
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
