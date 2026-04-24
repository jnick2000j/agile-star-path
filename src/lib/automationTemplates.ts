import type { AutomationModule, AutomationTriggerEvent } from "./automations";

export interface AutomationTemplate {
  key: string;
  name: string;
  description: string;
  module: AutomationModule;
  trigger_event: AutomationTriggerEvent;
  match_conditions?: any[];
  steps: { type: string; label?: string; config?: Record<string, any> }[];
  priority?: number;
  category?: string;
}

export const AUTOMATION_TEMPLATES: AutomationTemplate[] = [
  {
    key: "auto-triage-new-risks",
    name: "Auto-triage new risks",
    description:
      "When a risk is created, AI scores it, suggests a response, and notifies the risk owner.",
    module: "risk",
    trigger_event: "created",
    category: "Risk Management",
    steps: [
      { type: "ai_score", label: "AI risk score", config: { criteria: "probability, impact, urgency" } },
      { type: "ai_suggest", label: "Suggest response strategy", config: { focus: "PRINCE2 risk responses" } },
      { type: "log_note", label: "Log AI assessment", config: { note: "AI triage completed: {{ai_suggest.output}}" } },
      { type: "notify", label: "Notify owner", config: { recipients: "owner", subject: "New risk needs review" } },
    ],
  },
  {
    key: "escalate-stale-issues",
    name: "Escalate stale issues",
    description: "When an issue stays open past its target date, AI summarizes status and escalates to the project manager.",
    module: "issue",
    trigger_event: "overdue",
    category: "Issue Management",
    steps: [
      { type: "ai_summarize", label: "Summarize issue history", config: { scope: "comments, status changes" } },
      { type: "set_field", label: "Mark high priority", config: { field: "priority", value: "high" } },
      { type: "request_approval", label: "Escalate to PM", config: { role: "project_manager", message: "Stale issue requires attention" } },
    ],
  },
  {
    key: "summarize-closed-projects",
    name: "Summarize closed projects",
    description: "When a project is closed, AI generates a lessons-learned summary and creates a KB article.",
    module: "project",
    trigger_event: "status_changed",
    match_conditions: [{ field: "stage", op: "eq", value: "closing" }],
    category: "Knowledge Management",
    steps: [
      { type: "ai_summarize", label: "Summarize project outcomes", config: { include: "milestones, risks, issues, benefits" } },
      { type: "ai_draft", label: "Draft lessons learned", config: { tone: "professional", format: "markdown" } },
      { type: "create_task", label: "Create KB review task", config: { assignee: "project_manager", title: "Review AI lessons-learned draft" } },
      { type: "notify", label: "Notify sponsor", config: { recipients: "sponsor" } },
    ],
  },
  {
    key: "auto-categorize-helpdesk-tickets",
    name: "Auto-categorize helpdesk tickets",
    description: "Classifies new tickets, sets priority based on sentiment, and suggests KB articles.",
    module: "helpdesk",
    trigger_event: "created",
    category: "Helpdesk",
    steps: [
      { type: "ai_triage", label: "Categorize ticket", config: { categories: "incident, request, question, complaint" } },
      { type: "ai_sentiment", label: "Detect sentiment" },
      { type: "ai_suggest", label: "Suggest KB articles", config: { source: "knowledgebase" } },
      { type: "assign", label: "Auto-assign to queue", config: { strategy: "category_match" } },
    ],
  },
  {
    key: "high-impact-change-approval",
    name: "High-impact change approval",
    description: "When a change request is created with high or critical impact, request CAB approval before progressing.",
    module: "change",
    trigger_event: "created",
    match_conditions: [{ field: "impact", op: "in", value: ["high", "critical"] }],
    category: "Change Management",
    steps: [
      { type: "ai_analyze", label: "Analyze risk profile", config: { focus: "downtime, blast radius, rollback complexity" } },
      { type: "log_note", label: "Attach AI risk analysis" },
      { type: "request_approval", label: "Request CAB approval", config: { role: "change_advisory_board", description: "High-impact change needs CAB sign-off" } },
      { type: "notify", label: "Notify stakeholders", config: { recipients: "owner,implementer,sponsor" } },
    ],
  },
  {
    key: "benefit-realization-tracker",
    name: "Benefit realization tracker",
    description: "Weekly check on benefit progress; AI flags benefits at risk of missing targets.",
    module: "benefit",
    trigger_event: "due_date_approaching",
    category: "Benefits",
    steps: [
      { type: "ai_analyze", label: "Analyze trajectory vs target" },
      { type: "condition", label: "If at risk", config: { field: "ai_analyze.at_risk", op: "eq", value: true } },
      { type: "notify", label: "Alert benefit owner", config: { recipients: "owner", subject: "Benefit at risk" } },
      { type: "create_task", label: "Create remediation task", config: { assignee: "owner" } },
    ],
  },
  {
    key: "milestone-overdue-escalation",
    name: "Milestone overdue escalation",
    description: "When a milestone passes its due date, summarize blockers and escalate to programme sponsor.",
    module: "milestone",
    trigger_event: "overdue",
    category: "Delivery",
    steps: [
      { type: "ai_summarize", label: "Summarize linked tasks & blockers" },
      { type: "log_note", label: "Record overdue status" },
      { type: "notify", label: "Notify sponsor", config: { recipients: "sponsor,manager" } },
      { type: "request_approval", label: "Sponsor decision: re-baseline?" },
    ],
  },
  {
    key: "stakeholder-engagement-alert",
    name: "Stakeholder engagement alert",
    description: "Detects negative sentiment in stakeholder updates and suggests communication actions.",
    module: "stakeholder",
    trigger_event: "comment_added",
    category: "Engagement",
    steps: [
      { type: "ai_sentiment", label: "Score sentiment" },
      { type: "condition", label: "If negative", config: { field: "ai_sentiment.score", op: "lt", value: 0 } },
      { type: "ai_draft", label: "Draft response message" },
      { type: "notify", label: "Alert engagement lead", config: { recipients: "manager" } },
    ],
  },
];
