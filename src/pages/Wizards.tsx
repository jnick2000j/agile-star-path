import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search } from "lucide-react";
import { TemplateWizard, TemplateType } from "@/components/templates/TemplateWizard";

const wizardTemplates = [
  { type: "programme_mandate" as TemplateType, name: "Programme Mandate", category: "MSP", icon: "🏗️", description: "Define a new programme with strategic objectives, scope, timeline, and initial risk assessment.", creates: "Programme" },
  { type: "business_case" as TemplateType, name: "Business Case", category: "PRINCE2", icon: "💼", description: "Build a compelling business case with options analysis, benefits quantification, and ROI.", creates: "Programme" },
  { type: "project_brief" as TemplateType, name: "Project Brief", category: "PRINCE2", icon: "📋", description: "Set up a project with SMART objectives, methodology selection, and key parameters.", creates: "Project" },
  { type: "product_vision" as TemplateType, name: "Product Vision Canvas", category: "Product", icon: "🎯", description: "Articulate product vision, value proposition, target market, and success metrics.", creates: "Product" },
  { type: "risk_register" as TemplateType, name: "Risk Register Entry", category: "PRINCE2", icon: "⚠️", description: "Identify and assess a risk with probability, impact scoring, and response planning.", creates: "Risk" },
  { type: "lessons_learned" as TemplateType, name: "Lessons Learned", category: "PRINCE2", icon: "📝", description: "Capture lessons with root cause analysis, outcomes, and actionable recommendations.", creates: "Lesson" },
  { type: "user_story" as TemplateType, name: "User Story", category: "Agile", icon: "📖", description: "Write a user story with persona, acceptance criteria, story points, and MoSCoW priority.", creates: "Feature" },
  { type: "rice_worksheet" as TemplateType, name: "RICE Prioritization", category: "Product", icon: "📊", description: "Score a feature using Reach, Impact, Confidence, and Effort to calculate priority.", creates: "Feature" },
  { type: "sprint_planning" as TemplateType, name: "Sprint Planning Guide", category: "Agile", icon: "🏃", description: "Plan a sprint with goals, capacity, carry-over items, and risk identification.", creates: null },
  { type: "definition_of_done" as TemplateType, name: "Definition of Done", category: "Agile", icon: "✅", description: "Define code quality, testing, deployment, and acceptance criteria for your team.", creates: null },
];

export default function Wizards() {
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardType, setWizardType] = useState<TemplateType>("programme_mandate");
  const [wizardName, setWizardName] = useState("");

  const filtered = wizardTemplates
    .filter(t => categoryFilter === "all" || t.category === categoryFilter)
    .filter(t => !searchQuery || t.name.toLowerCase().includes(searchQuery.toLowerCase()) || t.description.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <AppLayout title="Wizards" subtitle="Guided forms to create programmes, projects, products, and more">
      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search wizards..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {["all", "MSP", "PRINCE2", "Agile", "Product"].map((cat) => (
            <Button
              key={cat}
              variant={categoryFilter === cat ? "default" : "outline"}
              size="sm"
              onClick={() => setCategoryFilter(cat)}
              className="rounded-full"
            >
              {cat === "all" ? "All" : cat}
            </Button>
          ))}
        </div>
      </div>

      {/* Wizard Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((template) => (
          <div
            key={template.type}
            className="group relative overflow-hidden rounded-xl border border-border bg-card p-6 hover:border-primary/50 hover:shadow-lg transition-all cursor-pointer"
            onClick={() => { setWizardType(template.type); setWizardName(template.name); setWizardOpen(true); }}
          >
            <div className="flex items-start justify-between mb-4">
              <span className="text-3xl">{template.icon}</span>
              {template.creates ? (
                <Badge className="bg-primary/10 text-primary border-0 text-xs">Creates {template.creates}</Badge>
              ) : (
                <Badge variant="outline" className="text-xs">Guide</Badge>
              )}
            </div>
            <h4 className="text-base font-semibold mb-1.5">{template.name}</h4>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">{template.description}</p>
            <div className="flex items-center justify-between">
              <Badge variant="outline" className="text-xs">{template.category}</Badge>
              <span className="text-xs text-primary font-medium opacity-0 group-hover:opacity-100 transition-opacity">Start Wizard →</span>
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <p>No wizards match your search.</p>
        </div>
      )}

      <TemplateWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        templateType={wizardType}
        templateName={wizardName}
      />
    </AppLayout>
  );
}
