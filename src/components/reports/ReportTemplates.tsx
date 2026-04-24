import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  FileText, Shield, BarChart3, Users, Layers,
  CheckCircle2, AlertTriangle, TrendingUp, Calendar,
  Target, Zap, Clock, ListChecks, Milestone,
  LifeBuoy, Headphones, GitBranch, ShieldAlert, Gauge, Workflow,
} from "lucide-react";

export interface ReportTemplate {
  key: string;
  title: string;
  description: string;
  query: string;
  category: "prince2" | "msp" | "agile" | "product" | "general" | "change" | "helpdesk";
  icon: React.ElementType;
}

export const reportTemplates: ReportTemplate[] = [
  // PRINCE2 Reports
  {
    key: "prince2-highlight",
    title: "Highlight Report",
    description: "Periodic status report from Project Manager to Project Board on project progress.",
    query: "Generate a PRINCE2 Highlight Report covering: overall project status, achievements this period, planned activities next period, budget status, schedule status, key risks and issues, tolerance status, and recommendations for the Project Board.",
    category: "prince2",
    icon: BarChart3,
  },
  {
    key: "prince2-checkpoint",
    title: "Checkpoint Report",
    description: "Team-level progress report on work package status and team activities.",
    query: "Generate a PRINCE2 Checkpoint Report showing: work packages in progress, tasks completed vs planned, team member assignments, issues encountered, upcoming deliverables, and any slippages or early warnings.",
    category: "prince2",
    icon: CheckCircle2,
  },
  {
    key: "prince2-end-stage",
    title: "End Stage Report",
    description: "Review of stage performance with lessons and recommendations for the next stage.",
    query: "Generate a PRINCE2 End Stage Report covering: stage objectives vs achievements, cost and schedule performance, quality results, risk and issue summary, lessons learned during this stage, and recommendations for the next stage.",
    category: "prince2",
    icon: Milestone,
  },
  {
    key: "prince2-end-project",
    title: "End Project Report",
    description: "Final report on project performance, benefits achieved, and lessons learned.",
    query: "Generate a PRINCE2 End Project Report covering: original objectives vs outcomes, overall cost and schedule performance, quality assessment, benefits delivered vs planned, outstanding risks and issues, follow-on actions, and comprehensive lessons learned.",
    category: "prince2",
    icon: FileText,
  },
  {
    key: "prince2-lessons",
    title: "Lessons Report",
    description: "Compilation of lessons learned for future project reference.",
    query: "Generate a PRINCE2 Lessons Report compiling all lessons learned: what went well, what could be improved, root causes of issues, recommended process changes, and applicable lessons for future projects.",
    category: "prince2",
    icon: ListChecks,
  },
  {
    key: "prince2-exception",
    title: "Exception Report",
    description: "Report on tolerance breaches with options and recommendations.",
    query: "Generate a PRINCE2 Exception Report covering: all tolerance breaches (time, cost, scope, quality, risk, benefits), cause of each exception, impact analysis, available options with pros and cons, and recommended course of action.",
    category: "prince2",
    icon: AlertTriangle,
  },
  {
    key: "prince2-product-status",
    title: "Product Status Account",
    description: "Status of all products within specified parameters.",
    query: "Generate a PRINCE2 Product Status Account listing: all products and their current status, quality check results, approval status, outstanding quality activities, and any product-related issues.",
    category: "prince2",
    icon: Target,
  },

  // MSP Programme Reports
  {
    key: "msp-programme-status",
    title: "Programme Status Report",
    description: "Overall programme health, progress, and governance summary.",
    query: "Generate an MSP Programme Status Report covering: programme vision alignment, tranche progress, project portfolio status, benefits realization progress, stakeholder engagement summary, key risks and issues at programme level, budget and resource utilization, and governance decisions needed.",
    category: "msp",
    icon: Layers,
  },
  {
    key: "msp-benefits-realization",
    title: "Benefits Realization Report",
    description: "Progress on benefits delivery against the benefits map.",
    query: "Generate an MSP Benefits Realization Report covering: benefits identified vs realized, realization percentages, measurement metrics, benefits at risk, upcoming benefit milestones, and recommendations for improving benefits delivery.",
    category: "msp",
    icon: TrendingUp,
  },
  {
    key: "msp-tranche-review",
    title: "Tranche Review Report",
    description: "Assessment of tranche completion and readiness for the next tranche.",
    query: "Generate an MSP Tranche Review Report covering: tranche objectives vs outcomes, projects delivered in this tranche, capability changes achieved, benefits enabled, transition readiness, lessons from this tranche, and recommendations for the next tranche.",
    category: "msp",
    icon: Calendar,
  },
  {
    key: "msp-blueprint",
    title: "Blueprint Assessment",
    description: "Assessment of the programme blueprint and future state design.",
    query: "Generate an MSP Blueprint Assessment covering: current state vs target state progress, capability gaps remaining, organizational readiness, technology changes delivered, process improvements implemented, and blueprint refinement recommendations.",
    category: "msp",
    icon: FileText,
  },
  {
    key: "msp-stakeholder",
    title: "Stakeholder Engagement Report",
    description: "Analysis of stakeholder engagement and communication effectiveness.",
    query: "Generate an MSP Stakeholder Engagement Report covering: stakeholder map summary, engagement activities completed, communication effectiveness, stakeholder sentiment analysis, resistance areas, and recommended engagement actions.",
    category: "msp",
    icon: Users,
  },

  // Agile Reports
  {
    key: "agile-sprint-review",
    title: "Sprint Review Report",
    description: "Summary of sprint deliverables, demo outcomes, and stakeholder feedback.",
    query: "Generate an Agile Sprint Review Report covering: sprint goal achievement, user stories completed vs planned, story points delivered, demo outcomes, stakeholder feedback summary, items not completed and reasons, and product backlog adjustments.",
    category: "agile",
    icon: Zap,
  },
  {
    key: "agile-retrospective",
    title: "Sprint Retrospective Summary",
    description: "Team reflection on what went well, improvements, and action items.",
    query: "Generate an Agile Sprint Retrospective Report covering: what went well this sprint, what didn't go well, improvement opportunities, action items with owners, follow-up on previous retrospective actions, and team morale indicators.",
    category: "agile",
    icon: ListChecks,
  },
  {
    key: "agile-velocity",
    title: "Velocity Report",
    description: "Team velocity trends and delivery predictability analysis.",
    query: "Generate an Agile Velocity Report covering: velocity by sprint (story points completed), rolling average velocity, velocity trends, delivery predictability, capacity utilization, and forecasted completion dates based on current velocity.",
    category: "agile",
    icon: TrendingUp,
  },
  {
    key: "agile-burndown",
    title: "Burndown Report",
    description: "Sprint and release burndown analysis with projections.",
    query: "Generate an Agile Burndown Report covering: current sprint progress vs ideal burndown, work remaining, scope changes during sprint, projected sprint completion, release burndown status, and any risks to delivery commitments.",
    category: "agile",
    icon: BarChart3,
  },
  {
    key: "agile-release",
    title: "Release Planning Report",
    description: "Release readiness, scope, and timeline assessment.",
    query: "Generate an Agile Release Planning Report covering: release scope (features and stories), completed vs remaining work, release burndown, quality metrics (defects, test coverage), deployment readiness checklist, risks to release date, and go/no-go recommendation.",
    category: "agile",
    icon: Calendar,
  },
  {
    key: "agile-capacity",
    title: "Team Capacity Report",
    description: "Team capacity planning and allocation analysis.",
    query: "Generate an Agile Team Capacity Report covering: team member availability, capacity allocation by project/product, utilization rates, upcoming capacity constraints (holidays, training), recommendations for capacity optimization, and hiring needs.",
    category: "agile",
    icon: Users,
  },

  // Product Reports
  {
    key: "product-roadmap",
    title: "Product Roadmap Status",
    description: "Progress against the product roadmap with feature delivery status.",
    query: "Generate a Product Roadmap Status Report covering: features delivered vs planned, roadmap timeline adherence, feature prioritization changes, customer impact of delivered features, upcoming features in the pipeline, and strategic alignment assessment.",
    category: "product",
    icon: Target,
  },
  {
    key: "product-backlog",
    title: "Feature Backlog Analysis",
    description: "Backlog health, prioritization, and grooming status.",
    query: "Generate a Product Feature Backlog Analysis covering: total backlog size, items by status, items by priority, aging analysis (oldest unaddressed items), RICE score distribution, grooming status, and recommendations for backlog management.",
    category: "product",
    icon: ListChecks,
  },
  {
    key: "product-rice",
    title: "RICE Score Analysis",
    description: "Feature prioritization using RICE scoring methodology.",
    query: "Generate a RICE Score Analysis Report covering: all features with their Reach, Impact, Confidence, and Effort scores, RICE rankings, comparison of current priority vs RICE-recommended priority, quick wins identified, and prioritization recommendations.",
    category: "product",
    icon: BarChart3,
  },
  {
    key: "product-health",
    title: "Product Health Report",
    description: "Comprehensive product health metrics and KPI tracking.",
    query: "Generate a Product Health Report covering: key product metrics (primary and secondary), feature delivery velocity, quality metrics, customer satisfaction indicators, product stage assessment, competitive positioning, and strategic recommendations.",
    category: "product",
    icon: Shield,
  },

  // General / Cross-cutting
  {
    key: "general-executive",
    title: "Executive Summary",
    description: "High-level portfolio overview for senior leadership.",
    query: "Generate an Executive Summary Report covering: portfolio overview (programmes, projects, products), overall health status, key achievements, critical risks and issues, budget summary, resource highlights, decisions needed, and strategic recommendations.",
    category: "general",
    icon: FileText,
  },
  {
    key: "general-risk",
    title: "Risk & Issue Dashboard",
    description: "Consolidated risk and issue analysis across the portfolio.",
    query: "Generate a Risk & Issue Dashboard Report covering: total risks by status and priority, risk heat map data, top 10 risks with mitigation status, open issues by severity, overdue issue resolutions, risk trends, and escalation recommendations.",
    category: "general",
    icon: AlertTriangle,
  },
  {
    key: "general-change",
    title: "Change Control Report",
    description: "Summary of all change requests and their impact.",
    query: "Generate a Change Control Report covering: change requests by status, impact analysis (cost, time, quality), approved changes and their implementation status, pending decisions, rejected changes with rationale, and change trend analysis.",
    category: "general",
    icon: Clock,
  },
];

const categoryLabels: Record<string, { label: string; color: string }> = {
  prince2: { label: "PRINCE2", color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" },
  msp: { label: "MSP", color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200" },
  agile: { label: "Agile", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" },
  product: { label: "Product", color: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200" },
  general: { label: "General", color: "bg-muted text-muted-foreground" },
};

interface ReportTemplatesProps {
  onSelectTemplate: (template: ReportTemplate) => void;
  filterCategory?: string;
}

export function ReportTemplates({ onSelectTemplate, filterCategory }: ReportTemplatesProps) {
  const filtered = filterCategory && filterCategory !== "all"
    ? reportTemplates.filter(t => t.category === filterCategory)
    : reportTemplates;

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {filtered.map((template) => {
        const catInfo = categoryLabels[template.category];
        return (
          <Card
            key={template.key}
            className="cursor-pointer hover:border-primary/50 hover:shadow-md transition-all group"
            onClick={() => onSelectTemplate(template)}
          >
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <template.icon className="h-4 w-4 text-primary" />
                </div>
                <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 ${catInfo.color}`}>
                  {catInfo.label}
                </Badge>
              </div>
              <CardTitle className="text-sm mt-2">{template.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground leading-relaxed">{template.description}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
