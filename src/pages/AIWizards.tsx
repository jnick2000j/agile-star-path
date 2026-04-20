import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AIDraftLauncher } from "@/components/ai/AIDraftLauncher";
import type { WizardField, WizardKind } from "@/components/ai/AIDraftWizardDialog";
import {
  FileText,
  Briefcase,
  Target,
  TrendingUp,
  GitBranch,
  AlertOctagon,
  Sparkles,
  MessageSquare,
  ListChecks,
  Megaphone,
  ShieldCheck,
  Flame,
  Users,
  ScrollText,
  RotateCcw,
  CheckCircle2,
  Eye,
} from "lucide-react";

interface WizardSpec {
  kind: WizardKind;
  title: string;
  description: string;
  icon: React.ElementType;
  category: "Document" | "Helper" | "Governance" | "Strategy";
  fields: WizardField[];
}

const WIZARDS: WizardSpec[] = [
  {
    kind: "project_brief",
    title: "Project Brief",
    description: "Generate a PRINCE2-aligned Project Brief from a few inputs.",
    icon: FileText,
    category: "Document",
    fields: [
      { key: "name", label: "Project name", required: true, placeholder: "e.g. Customer Portal Modernisation" },
      { key: "objective", label: "Primary objective", type: "textarea", required: true, placeholder: "What outcome must this project deliver?" },
      { key: "scope", label: "In scope (high-level)", type: "textarea", placeholder: "Key deliverables, products, areas covered" },
      { key: "out_of_scope", label: "Out of scope", type: "textarea" },
      { key: "constraints", label: "Constraints", type: "textarea", placeholder: "Budget, deadlines, regulatory" },
      { key: "stakeholders", label: "Key stakeholders", placeholder: "Sponsor, SRO, key users" },
    ],
  },
  {
    kind: "pid",
    title: "Project Initiation Document (PID)",
    description: "Full PRINCE2 PID with all standard sections.",
    icon: Briefcase,
    category: "Document",
    fields: [
      { key: "project_name", label: "Project name", required: true },
      { key: "background", label: "Background", type: "textarea", required: true },
      { key: "objectives", label: "Objectives & success criteria", type: "textarea", required: true },
      { key: "approach", label: "Project approach", type: "textarea", placeholder: "Build vs buy, methodology, phasing" },
      { key: "tolerances", label: "Tolerances", placeholder: "Time / cost / quality / scope / risk / benefits" },
    ],
  },
  {
    kind: "programme_mandate",
    title: "Programme Mandate",
    description: "MSP-aligned Programme Mandate to kick off a new programme.",
    icon: Target,
    category: "Document",
    fields: [
      { key: "programme_name", label: "Programme name", required: true },
      { key: "strategic_driver", label: "Strategic driver", type: "textarea", required: true, placeholder: "Why now? What strategy does this serve?" },
      { key: "vision_seed", label: "Vision seed", type: "textarea", placeholder: "One paragraph describing the future state" },
      { key: "expected_benefits", label: "Expected benefits", type: "textarea" },
    ],
  },
  {
    kind: "benefit_profile",
    title: "Benefit Profile",
    description: "MSP Benefit Profile with measurement plan.",
    icon: TrendingUp,
    category: "Document",
    fields: [
      { key: "benefit", label: "Benefit name", required: true },
      { key: "description", label: "Description", type: "textarea", required: true },
      { key: "type", label: "Cashable or non-cashable", placeholder: "cashable / non-cashable" },
      { key: "owner", label: "Suggested owner role" },
      { key: "horizon", label: "Realisation horizon", placeholder: "e.g. 12 months post-go-live" },
    ],
  },
  {
    kind: "change_request",
    title: "Change Request",
    description: "Structured change request with full impact analysis.",
    icon: GitBranch,
    category: "Document",
    fields: [
      { key: "summary", label: "Change summary", required: true },
      { key: "reason", label: "Reason for the change", type: "textarea", required: true },
      { key: "current_state", label: "Current state", type: "textarea" },
      { key: "proposed_state", label: "Proposed state", type: "textarea", required: true },
      { key: "urgency", label: "Urgency", placeholder: "low / medium / high" },
    ],
  },
  {
    kind: "exception_report",
    title: "Exception Report",
    description: "PRINCE2 Exception Report when tolerances are forecast to be breached.",
    icon: AlertOctagon,
    category: "Document",
    fields: [
      { key: "title", label: "Exception title", required: true },
      { key: "tolerance_breached", label: "Tolerance breached", required: true, placeholder: "Time / cost / scope / quality / risk / benefits" },
      { key: "cause", label: "Cause", type: "textarea", required: true },
      { key: "consequences", label: "Consequences if no action taken", type: "textarea", required: true },
      { key: "options", label: "Options to consider", type: "textarea", placeholder: "List 2-4 candidate options" },
    ],
  },
  {
    kind: "user_story",
    title: "User Story Generator",
    description: "One-line idea → full story with acceptance criteria, MoSCoW & RICE.",
    icon: ListChecks,
    category: "Helper",
    fields: [
      { key: "idea", label: "Your idea (one line)", required: true, placeholder: "e.g. Let users export risks to CSV" },
      { key: "persona", label: "Primary persona", placeholder: "e.g. Project Manager" },
    ],
  },
  {
    kind: "status_update",
    title: "Status Update Auto-Draft",
    description: "Synthesise a status update from recent activity bullets.",
    icon: MessageSquare,
    category: "Helper",
    fields: [
      { key: "scope", label: "Scope", required: true, placeholder: "Project / programme / product name" },
      { key: "recent_activity", label: "Recent activity", type: "textarea", required: true, placeholder: "Paste raw notes / bullets / commits / completed tasks" },
      { key: "audience", label: "Audience tone", placeholder: "exec / sponsor / team" },
    ],
  },
  {
    kind: "vision_statement",
    title: "Vision Statement",
    description: "One-paragraph vision + why-it-matters + candidate north-star metrics.",
    icon: Eye,
    category: "Strategy",
    fields: [
      { key: "scope", label: "Programme / Product name", required: true },
      { key: "context", label: "Context (one paragraph)", type: "textarea", required: true, placeholder: "Strategic driver, audience, ambition" },
      { key: "horizon", label: "Time horizon", placeholder: "e.g. 3 years" },
    ],
  },
  {
    kind: "comms_pack_draft",
    title: "Comms Pack Draft",
    description: "Coordinated exec email + Slack post + stakeholder PDF summary.",
    icon: Megaphone,
    category: "Governance",
    fields: [
      { key: "scope", label: "Scope", required: true, placeholder: "Programme / project / sprint" },
      { key: "headline", label: "Headline message", type: "textarea", required: true },
      { key: "highlights", label: "Highlights (bullets)", type: "textarea" },
      { key: "risks", label: "Risks / asks", type: "textarea" },
    ],
  },
  {
    kind: "governance_narrative",
    title: "Governance Narrative",
    description: "Board-ready narrative from your governance scorecard.",
    icon: ShieldCheck,
    category: "Governance",
    fields: [
      { key: "scope", label: "Scope", required: true },
      { key: "rag", label: "Overall RAG", placeholder: "green / amber / red" },
      { key: "scores", label: "Cadence / Hygiene / Controls scores", type: "textarea", placeholder: "e.g. Cadence 82, Hygiene 71, Controls 90" },
      { key: "issues", label: "Notable issues", type: "textarea" },
    ],
  },
  {
    kind: "risk_heatmap_narrative",
    title: "Risk Heat-Map Narrative",
    description: "Narrate the heat-map and propose mitigations for top risks.",
    icon: Flame,
    category: "Governance",
    fields: [
      { key: "scope", label: "Scope", required: true },
      { key: "distribution", label: "Distribution (counts by quadrant)", type: "textarea", placeholder: "e.g. High×High: 3, High×Med: 5, ..." },
      { key: "top_risks", label: "Top risks (titles)", type: "textarea" },
    ],
  },
  {
    kind: "stakeholder_map",
    title: "Stakeholder Map",
    description: "Influence × Interest grid with engagement strategy per quadrant.",
    icon: Users,
    category: "Governance",
    fields: [
      { key: "scope", label: "Scope", required: true },
      { key: "stakeholders", label: "Stakeholder list", type: "textarea", required: true, placeholder: "Name — role — known position" },
    ],
  },
  {
    kind: "lessons_digest",
    title: "Lessons Digest",
    description: "Synthesise multiple lessons into themes and recommended actions.",
    icon: ScrollText,
    category: "Helper",
    fields: [
      { key: "scope", label: "Scope", required: true },
      { key: "lessons", label: "Lessons (paste raw entries)", type: "textarea", required: true },
    ],
  },
  {
    kind: "sprint_retro_summary",
    title: "Sprint Retro Summary",
    description: "Polish raw retro notes into highlights, root causes and experiments.",
    icon: RotateCcw,
    category: "Helper",
    fields: [
      { key: "sprint", label: "Sprint name", required: true },
      { key: "went_well", label: "Went well", type: "textarea" },
      { key: "didnt_go_well", label: "Didn't go well", type: "textarea" },
      { key: "ideas", label: "Ideas", type: "textarea" },
    ],
  },
  {
    kind: "definition_of_ready",
    title: "Definition of Ready",
    description: "Tailored DoR checklist for your team's user stories.",
    icon: CheckCircle2,
    category: "Helper",
    fields: [
      { key: "team_context", label: "Team context", type: "textarea", required: true, placeholder: "Stack, story shape, dependencies" },
    ],
  },
];

export default function AIWizards() {
  const documents = WIZARDS.filter((w) => w.category === "Document");
  const strategy = WIZARDS.filter((w) => w.category === "Strategy");
  const governance = WIZARDS.filter((w) => w.category === "Governance");
  const helpers = WIZARDS.filter((w) => w.category === "Helper");

  return (
    <AppLayout
      title="AI Drafting Wizards"
      subtitle="Generate PRINCE2 / MSP documents and helper artefacts. Every draft goes to AI Approvals for review before publishing."
    >
      <div className="space-y-8">
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="h-4 w-4 text-primary" />
            <h2 className="text-lg font-semibold">Document Wizards</h2>
            <Badge variant="outline" className="text-xs">Powered by gemini-2.5-pro</Badge>
          </div>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {documents.map((w) => {
              const Icon = w.icon;
              return (
                <Card key={w.kind} className="flex flex-col">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <div className="p-2 rounded-md bg-primary/10">
                        <Icon className="h-4 w-4 text-primary" />
                      </div>
                    </div>
                    <CardTitle className="text-base">{w.title}</CardTitle>
                    <CardDescription className="text-xs">{w.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="mt-auto">
                    <AIDraftLauncher
                      wizard={w.kind}
                      title={w.title}
                      description={w.description}
                      fields={w.fields}
                      buttonLabel="Draft with AI"
                      variant="default"
                    />
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        <section>
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="h-4 w-4 text-primary" />
            <h2 className="text-lg font-semibold">Quick Helpers</h2>
          </div>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {helpers.map((w) => {
              const Icon = w.icon;
              return (
                <Card key={w.kind} className="flex flex-col">
                  <CardHeader>
                    <div className="p-2 rounded-md bg-primary/10 w-fit">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                    <CardTitle className="text-base">{w.title}</CardTitle>
                    <CardDescription className="text-xs">{w.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="mt-auto">
                    <AIDraftLauncher
                      wizard={w.kind}
                      title={w.title}
                      description={w.description}
                      fields={w.fields}
                      buttonLabel="Generate"
                      variant="default"
                    />
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      </div>
    </AppLayout>
  );
}
