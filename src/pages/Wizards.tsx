import { useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Sparkles, Wand2 } from "lucide-react";
import { TemplateWizard, TemplateType } from "@/components/templates/TemplateWizard";
import { AIDraftLauncher } from "@/components/ai/AIDraftLauncher";
import type { WizardField, WizardKind } from "@/components/ai/AIDraftWizardDialog";
import {
  FileText, Briefcase, Target, TrendingUp, GitBranch, AlertOctagon,
  MessageSquare, ListChecks, Megaphone, ShieldCheck, Flame, Users,
  ScrollText, RotateCcw, CheckCircle2, Eye,
  GitMerge, Zap, RefreshCw, ClipboardCheck, Activity, BookOpen,
  LifeBuoy, AlertTriangle, Wrench, Smile, Clock,
  HardHat, FileCheck, ClipboardList, BadgeAlert, KeyRound, Power,
  PenTool, FileSignature, CalendarRange, FileEdit,
} from "lucide-react";

// ---------- CREATE wizards (template-driven entity creation) ----------
const createTemplates = [
  { type: "programme_mandate" as TemplateType, name: "Programme Mandate", category: "MSP", icon: "🏗️", description: "Define a new programme with strategic objectives, scope, timeline, and initial risk assessment.", creates: "Programme" },
  { type: "business_case" as TemplateType, name: "Business Case", category: "PRINCE2", icon: "💼", description: "Build a compelling business case with options analysis, benefits quantification, and ROI.", creates: "Programme" },
  { type: "project_brief" as TemplateType, name: "Project Brief", category: "PRINCE2", icon: "📋", description: "Set up a project with SMART objectives, methodology selection, and key parameters.", creates: "Project" },
  { type: "product_vision" as TemplateType, name: "Product Vision Canvas", category: "Product", icon: "🎯", description: "Articulate product vision, value proposition, target market, and success metrics.", creates: "Product" },
  { type: "risk_register" as TemplateType, name: "Risk Register Entry", category: "PRINCE2", icon: "⚠️", description: "Identify and assess a risk with probability, impact scoring, and response planning.", creates: "Risk" },
  { type: "issue_register" as TemplateType, name: "Issue Log Entry", category: "PRINCE2", icon: "🚨", description: "Raise an issue with type, priority and target resolution date — linked to its parent.", creates: "Issue" },
  { type: "benefit_definition" as TemplateType, name: "Benefit Profile", category: "MSP", icon: "💎", description: "Define a benefit with category, baseline, target and realisation timeline.", creates: "Benefit" },
  { type: "stakeholder_engagement" as TemplateType, name: "Stakeholder Engagement", category: "MSP", icon: "🤝", description: "Add a stakeholder with influence/interest scoring and engagement strategy.", creates: "Stakeholder" },
  { type: "change_request_form" as TemplateType, name: "Change Request", category: "PRINCE2", icon: "🔄", description: "Raise a structured change request with full impact analysis for the change board.", creates: "Change Request" },
  { type: "lessons_learned" as TemplateType, name: "Lessons Learned", category: "PRINCE2", icon: "📝", description: "Capture lessons with root cause analysis, outcomes, and actionable recommendations.", creates: "Lesson" },
  { type: "user_story" as TemplateType, name: "User Story", category: "Agile", icon: "📖", description: "Write a user story with persona, acceptance criteria, story points, and MoSCoW priority.", creates: "Feature" },
  { type: "rice_worksheet" as TemplateType, name: "RICE Prioritization", category: "Product", icon: "📊", description: "Score a feature using Reach, Impact, Confidence, and Effort to calculate priority.", creates: "Feature" },
  { type: "sprint_planning" as TemplateType, name: "Sprint Planning Guide", category: "Agile", icon: "🏃", description: "Plan a sprint with goals, capacity, carry-over items, and risk identification.", creates: null },
  { type: "sprint_retro" as TemplateType, name: "Sprint Retrospective", category: "Agile", icon: "🔁", description: "Capture went-well / didn't-go-well / ideas and commit to 1-3 concrete actions.", creates: null },
  { type: "definition_of_done" as TemplateType, name: "Definition of Done", category: "Agile", icon: "✅", description: "Define code quality, testing, deployment, and acceptance criteria for your team.", creates: null },
  { type: "compliance_health_check" as TemplateType, name: "Compliance Health Check", category: "Governance", icon: "🛡️", description: "Walk through cadence, hygiene and linkage signals to gauge governance health for any scope.", creates: null },
  // ─── Construction & Engineering ──────────────────────────────────────────
  { type: "con_rfi_form" as TemplateType, name: "Raise an RFI", category: "Construction", icon: "📨", description: "Open a Request for Information against a project — discipline, spec/drawing refs, question, response SLA.", creates: "RFI" },
  { type: "con_submittal_form" as TemplateType, name: "Log a Submittal", category: "Construction", icon: "📑", description: "Add a submittal to the register: spec section, type (product data / shop drawing / sample / mock-up), reviewer due date.", creates: "Submittal" },
  { type: "con_daily_log_form" as TemplateType, name: "Daily Site Log", category: "Construction", icon: "📝", description: "Capture the superintendent's daily log: weather, manpower, hours, work performed, delays, safety, visitors.", creates: "Daily Log" },
  { type: "con_punch_item_form" as TemplateType, name: "Add Punch / Snag Item", category: "Construction", icon: "✅", description: "Raise a defect / snag with location, trade, priority and target close date.", creates: "Punch Item" },
  { type: "con_change_order_form" as TemplateType, name: "Raise Change Order / Variation", category: "Construction", icon: "🔀", description: "NEC4 CE / JCT VO / AIA G701 — cost & time impact with contractual mechanism for the change board.", creates: "Change Order" },
  { type: "con_permit_to_work_form" as TemplateType, name: "Issue Permit to Work", category: "Construction", icon: "🪪", description: "Hot work / confined space / WAH / excavation / electrical isolation / lifting — controls, validity, rescue plan.", creates: "Permit" },
  { type: "con_toolbox_talk_form" as TemplateType, name: "Record Toolbox Talk", category: "Construction", icon: "📣", description: "Capture topic, audience, key messages and attendees for the safety record.", creates: "Toolbox Talk" },
  { type: "con_ncr_form" as TemplateType, name: "Open Non-Conformance (NCR)", category: "Construction", icon: "🛑", description: "ISO 9001 NCR with severity, root cause (5 Whys), proposed disposition and CAPA.", creates: "NCR" },
  { type: "con_handover_checklist" as TemplateType, name: "PC Handover Checklist", category: "Construction", icon: "🏁", description: "Verify the standard PC deliverables: O&Ms, as-builts, certs, warranties, training, H&S file.", creates: "Handover" },
  // ─── Professional Services & Consulting ─────────────────────────────────
  { type: "ps_engagement_setup" as TemplateType, name: "Set Up Client Engagement", category: "Pro Services", icon: "🤝", description: "Create a client engagement: type (T&M / Fixed / Retainer / Milestone), value, dates, account manager.", creates: "Engagement" },
  { type: "ps_sow_form" as TemplateType, name: "Statement of Work (SOW)", category: "Pro Services", icon: "📄", description: "Draft a SOW: objectives, in/out scope, deliverables with acceptance criteria, fees and payment terms.", creates: "SOW" },
  { type: "ps_msa_summary" as TemplateType, name: "MSA Summary", category: "Pro Services", icon: "📜", description: "Capture the key MSA terms PMs need at a glance — liability cap, IP, confidentiality, notice period.", creates: "MSA" },
  { type: "ps_change_order_form" as TemplateType, name: "Engagement Change Order", category: "Pro Services", icon: "🔄", description: "Scope / fee / schedule change against an SOW with client decision deadline.", creates: "Change Order" },
  { type: "ps_deliverable_form" as TemplateType, name: "Define a Deliverable", category: "Pro Services", icon: "📦", description: "Create a deliverable with explicit acceptance criteria — stored as a work package on the engagement.", creates: "Deliverable" },
  { type: "ps_retainer_setup" as TemplateType, name: "Set Up Retainer Period", category: "Pro Services", icon: "🗓️", description: "Allocate hours, monthly value and rollover rules for a retainer period.", creates: "Retainer" },
  { type: "ps_timesheet_entry" as TemplateType, name: "Log Timesheet Entry", category: "Pro Services", icon: "⏱️", description: "Record billable / non-billable hours against an engagement with rate-card reference.", creates: "Timesheet" },
  { type: "ps_csat_capture" as TemplateType, name: "Capture CSAT / NPS", category: "Pro Services", icon: "😊", description: "Record CSAT (1-5) + NPS (0-10) plus what-went-well / what-to-improve from the client.", creates: "CSAT Response" },
  { type: "ps_bid_no_bid" as TemplateType, name: "Bid / No-Bid Decision", category: "Pro Services", icon: "⚖️", description: "Score strategic fit, win probability, delivery risk and team availability — recommend Bid / No-Bid.", creates: "Decision" },
];

// ---------- DRAFT wizards (AI-generated documents) ----------
interface AIWizardSpec {
  kind: WizardKind;
  title: string;
  description: string;
  icon: React.ElementType;
  category: "Document" | "Helper" | "Governance" | "Strategy" | "Change Mgmt" | "Helpdesk" | "Construction";
  fields: WizardField[];
}

const aiWizards: AIWizardSpec[] = [
  { kind: "project_brief", title: "Project Brief", description: "Generate a PRINCE2-aligned Project Brief from a few inputs.", icon: FileText, category: "Document", fields: [
    { key: "name", label: "Project name", required: true, placeholder: "e.g. Customer Portal Modernisation" },
    { key: "objective", label: "Primary objective", type: "textarea", required: true, placeholder: "What outcome must this project deliver?" },
    { key: "scope", label: "In scope (high-level)", type: "textarea", placeholder: "Key deliverables, products, areas covered" },
    { key: "out_of_scope", label: "Out of scope", type: "textarea" },
    { key: "constraints", label: "Constraints", type: "textarea", placeholder: "Budget, deadlines, regulatory" },
    { key: "stakeholders", label: "Key stakeholders", placeholder: "Sponsor, SRO, key users" },
  ]},
  { kind: "pid", title: "Project Initiation Document (PID)", description: "Full PRINCE2 PID with all standard sections.", icon: Briefcase, category: "Document", fields: [
    { key: "project_name", label: "Project name", required: true },
    { key: "background", label: "Background", type: "textarea", required: true },
    { key: "objectives", label: "Objectives & success criteria", type: "textarea", required: true },
    { key: "approach", label: "Project approach", type: "textarea", placeholder: "Build vs buy, methodology, phasing" },
    { key: "tolerances", label: "Tolerances", placeholder: "Time / cost / quality / scope / risk / benefits" },
  ]},
  { kind: "programme_mandate", title: "Programme Mandate", description: "MSP-aligned Programme Mandate to kick off a new programme.", icon: Target, category: "Document", fields: [
    { key: "programme_name", label: "Programme name", required: true },
    { key: "strategic_driver", label: "Strategic driver", type: "textarea", required: true, placeholder: "Why now? What strategy does this serve?" },
    { key: "vision_seed", label: "Vision seed", type: "textarea", placeholder: "One paragraph describing the future state" },
    { key: "expected_benefits", label: "Expected benefits", type: "textarea" },
  ]},
  { kind: "benefit_profile", title: "Benefit Profile", description: "MSP Benefit Profile with measurement plan.", icon: TrendingUp, category: "Document", fields: [
    { key: "benefit", label: "Benefit name", required: true },
    { key: "description", label: "Description", type: "textarea", required: true },
    { key: "type", label: "Cashable or non-cashable", placeholder: "cashable / non-cashable" },
    { key: "owner", label: "Suggested owner role" },
    { key: "horizon", label: "Realisation horizon", placeholder: "e.g. 12 months post-go-live" },
  ]},
  { kind: "change_request", title: "Change Request", description: "Structured change request with full impact analysis.", icon: GitBranch, category: "Document", fields: [
    { key: "summary", label: "Change summary", required: true },
    { key: "reason", label: "Reason for the change", type: "textarea", required: true },
    { key: "current_state", label: "Current state", type: "textarea" },
    { key: "proposed_state", label: "Proposed state", type: "textarea", required: true },
    { key: "urgency", label: "Urgency", placeholder: "low / medium / high" },
  ]},
  { kind: "exception_report", title: "Exception Report", description: "PRINCE2 Exception Report when tolerances are forecast to be breached.", icon: AlertOctagon, category: "Document", fields: [
    { key: "title", label: "Exception title", required: true },
    { key: "tolerance_breached", label: "Tolerance breached", required: true, placeholder: "Time / cost / scope / quality / risk / benefits" },
    { key: "cause", label: "Cause", type: "textarea", required: true },
    { key: "consequences", label: "Consequences if no action taken", type: "textarea", required: true },
    { key: "options", label: "Options to consider", type: "textarea", placeholder: "List 2-4 candidate options" },
  ]},
  { kind: "user_story", title: "User Story Generator", description: "One-line idea → full story with acceptance criteria, MoSCoW & RICE.", icon: ListChecks, category: "Helper", fields: [
    { key: "idea", label: "Your idea (one line)", required: true, placeholder: "e.g. Let users export risks to CSV" },
    { key: "persona", label: "Primary persona", placeholder: "e.g. Project Manager" },
  ]},
  { kind: "status_update", title: "Status Update Auto-Draft", description: "Synthesise a status update from recent activity bullets.", icon: MessageSquare, category: "Helper", fields: [
    { key: "scope", label: "Scope", required: true, placeholder: "Project / programme / product name" },
    { key: "recent_activity", label: "Recent activity", type: "textarea", required: true, placeholder: "Paste raw notes / bullets / commits / completed tasks" },
    { key: "audience", label: "Audience tone", placeholder: "exec / sponsor / team" },
  ]},
  { kind: "vision_statement", title: "Vision Statement", description: "One-paragraph vision + why-it-matters + candidate north-star metrics.", icon: Eye, category: "Strategy", fields: [
    { key: "scope", label: "Programme / Product name", required: true },
    { key: "context", label: "Context (one paragraph)", type: "textarea", required: true, placeholder: "Strategic driver, audience, ambition" },
    { key: "horizon", label: "Time horizon", placeholder: "e.g. 3 years" },
  ]},
  { kind: "comms_pack_draft", title: "Comms Pack Draft", description: "Coordinated exec email + Slack post + stakeholder PDF summary.", icon: Megaphone, category: "Governance", fields: [
    { key: "scope", label: "Scope", required: true, placeholder: "Programme / project / sprint" },
    { key: "headline", label: "Headline message", type: "textarea", required: true },
    { key: "highlights", label: "Highlights (bullets)", type: "textarea" },
    { key: "risks", label: "Risks / asks", type: "textarea" },
  ]},
  { kind: "governance_narrative", title: "Governance Narrative", description: "Board-ready narrative from your governance scorecard.", icon: ShieldCheck, category: "Governance", fields: [
    { key: "scope", label: "Scope", required: true },
    { key: "rag", label: "Overall RAG", placeholder: "green / amber / red" },
    { key: "scores", label: "Cadence / Hygiene / Controls scores", type: "textarea", placeholder: "e.g. Cadence 82, Hygiene 71, Controls 90" },
    { key: "issues", label: "Notable issues", type: "textarea" },
  ]},
  { kind: "risk_heatmap_narrative", title: "Risk Heat-Map Narrative", description: "Narrate the heat-map and propose mitigations for top risks.", icon: Flame, category: "Governance", fields: [
    { key: "scope", label: "Scope", required: true },
    { key: "distribution", label: "Distribution (counts by quadrant)", type: "textarea", placeholder: "e.g. High×High: 3, High×Med: 5, ..." },
    { key: "top_risks", label: "Top risks (titles)", type: "textarea" },
  ]},
  { kind: "stakeholder_map", title: "Stakeholder Map", description: "Influence × Interest grid with engagement strategy per quadrant.", icon: Users, category: "Governance", fields: [
    { key: "scope", label: "Scope", required: true },
    { key: "stakeholders", label: "Stakeholder list", type: "textarea", required: true, placeholder: "Name — role — known position" },
  ]},
  { kind: "lessons_digest", title: "Lessons Digest", description: "Synthesise multiple lessons into themes and recommended actions.", icon: ScrollText, category: "Helper", fields: [
    { key: "scope", label: "Scope", required: true },
    { key: "lessons", label: "Lessons (paste raw entries)", type: "textarea", required: true },
  ]},
  { kind: "sprint_retro_summary", title: "Sprint Retro Summary", description: "Polish raw retro notes into highlights, root causes and experiments.", icon: RotateCcw, category: "Helper", fields: [
    { key: "sprint", label: "Sprint name", required: true },
    { key: "went_well", label: "Went well", type: "textarea" },
    { key: "didnt_go_well", label: "Didn't go well", type: "textarea" },
    { key: "ideas", label: "Ideas", type: "textarea" },
  ]},
  { kind: "definition_of_ready", title: "Definition of Ready", description: "Tailored DoR checklist for your team's user stories.", icon: CheckCircle2, category: "Helper", fields: [
    { key: "team_context", label: "Team context", type: "textarea", required: true, placeholder: "Stack, story shape, dependencies" },
  ]},

  // ─── Change Management (ITIL 4) ─────────────────────────────────────────
  { kind: "cm_normal_change", title: "Normal Change Record", description: "Full ITIL 4 normal change record ready for CAB review — with risk score, plan, rollback and approvals.", icon: GitMerge, category: "Change Mgmt", fields: [
    { key: "title", label: "Change title", required: true, placeholder: "e.g. Upgrade payment gateway to v3" },
    { key: "reason", label: "Business reason", type: "textarea", required: true },
    { key: "scope", label: "Scope & affected services / CIs", type: "textarea", required: true },
    { key: "implementer", label: "Implementer / team", placeholder: "e.g. Platform Ops" },
    { key: "downtime", label: "Expected downtime", placeholder: "e.g. 30 min off-peak" },
    { key: "window", label: "Preferred change window", placeholder: "e.g. Sat 02:00-04:00 UTC" },
  ]},
  { kind: "cm_standard_change", title: "Standard Change Template", description: "Pre-authorised, repeatable standard-change template for the change catalog.", icon: Zap, category: "Change Mgmt", fields: [
    { key: "title", label: "Standard change title", required: true, placeholder: "e.g. Add user to Okta group" },
    { key: "trigger", label: "Trigger / when used", type: "textarea", required: true },
    { key: "frequency", label: "Expected frequency", placeholder: "e.g. ~10/week" },
    { key: "tooling", label: "Tooling involved", placeholder: "e.g. Okta admin console, Terraform" },
  ]},
  { kind: "cm_emergency_change", title: "Emergency Change", description: "Fast-track E-CAB change to restore service or prevent imminent harm.", icon: AlertTriangle, category: "Change Mgmt", fields: [
    { key: "title", label: "Emergency change title", required: true },
    { key: "trigger_incident", label: "Trigger incident reference", placeholder: "e.g. INC-1234" },
    { key: "impact", label: "Current business impact", type: "textarea", required: true },
    { key: "proposed_action", label: "Proposed action", type: "textarea", required: true },
  ]},
  { kind: "cm_rollback_plan", title: "Rollback Plan", description: "Tested rollback plan with detection criteria and recovery time objective.", icon: RefreshCw, category: "Change Mgmt", fields: [
    { key: "change_summary", label: "Change being rolled back from", type: "textarea", required: true },
    { key: "deploy_steps", label: "Deploy steps (so we can reverse them)", type: "textarea", required: true },
    { key: "data_changes", label: "Data / schema changes involved", type: "textarea", placeholder: "e.g. migration adds column X" },
    { key: "rto", label: "Target RTO", placeholder: "e.g. 15 minutes" },
  ]},
  { kind: "cm_cab_pack", title: "CAB Meeting Pack", description: "Forward schedule of change + per-change one-pagers + recommendations.", icon: ClipboardCheck, category: "Change Mgmt", fields: [
    { key: "period", label: "CAB period covered", required: true, placeholder: "e.g. week of 28 Apr 2026" },
    { key: "changes", label: "Changes on the agenda (one per line: ref — title — type — owner)", type: "textarea", required: true },
    { key: "carryovers", label: "Carry-overs / open PIRs", type: "textarea" },
  ]},
  { kind: "cm_post_implementation_review", title: "Post-Implementation Review", description: "ITIL PIR capturing outcome, variance, lessons and CMDB updates.", icon: Activity, category: "Change Mgmt", fields: [
    { key: "change_ref", label: "Change reference", required: true },
    { key: "outcome", label: "Outcome", placeholder: "Successful / Successful-with-issues / Failed / Backed-out" },
    { key: "what_happened", label: "What actually happened", type: "textarea", required: true },
    { key: "incidents", label: "Incidents caused (if any)", type: "textarea" },
  ]},
  { kind: "cm_impact_assessment", title: "Impact Assessment", description: "Score affected services, downtime exposure, dependencies and recommended classification.", icon: ShieldCheck, category: "Change Mgmt", fields: [
    { key: "title", label: "Proposed change title", required: true },
    { key: "description", label: "Description", type: "textarea", required: true },
    { key: "services", label: "Services / systems touched", type: "textarea", required: true },
    { key: "user_population", label: "Users affected", placeholder: "e.g. all internal staff (~3,000)" },
  ]},

  // ─── Helpdesk / Service Management ──────────────────────────────────────
  { kind: "hd_incident_writeup", title: "Incident Ticket Write-up", description: "Turn raw user input into a clean, prioritised incident ticket.", icon: LifeBuoy, category: "Helpdesk", fields: [
    { key: "raw_report", label: "Raw user report", type: "textarea", required: true, placeholder: "Paste what the user said (email, chat, call notes)" },
    { key: "service", label: "Affected service / app", placeholder: "e.g. Salesforce, VPN" },
    { key: "user_count", label: "How many users affected", placeholder: "e.g. 1, team of 12, all of finance" },
  ]},
  { kind: "hd_problem_record", title: "Problem Record", description: "Open a problem record from a cluster of related incidents (root-cause investigation).", icon: Wrench, category: "Helpdesk", fields: [
    { key: "title", label: "Problem title", required: true },
    { key: "incident_refs", label: "Linked incident references", type: "textarea", required: true },
    { key: "pattern", label: "Observed pattern / frequency", type: "textarea", required: true },
    { key: "current_workaround", label: "Current workaround (if any)", type: "textarea" },
  ]},
  { kind: "hd_service_request", title: "Service Request", description: "Standardised service request that can become a catalog item.", icon: ListChecks, category: "Helpdesk", fields: [
    { key: "title", label: "Request title", required: true, placeholder: "e.g. New laptop for joiner" },
    { key: "requester", label: "Requester / beneficiary", placeholder: "name + role" },
    { key: "justification", label: "Business justification", type: "textarea", required: true },
    { key: "required_by", label: "Required by", placeholder: "YYYY-MM-DD" },
  ]},
  { kind: "hd_kb_article", title: "Knowledge-Base Article (KCS)", description: "Capture a resolved ticket as a reusable KB article in KCS format.", icon: BookOpen, category: "Helpdesk", fields: [
    { key: "problem", label: "Problem (as the user types it)", required: true },
    { key: "environment", label: "Environment / applies to", placeholder: "e.g. Windows 11, Outlook desktop" },
    { key: "resolution_notes", label: "How it was resolved", type: "textarea", required: true },
    { key: "audience", label: "Audience", placeholder: "internal / customer-facing" },
  ]},
  { kind: "hd_major_incident_comms", title: "Major Incident Comms", description: "Coordinated status-page + internal + executive comms for a P1.", icon: Megaphone, category: "Helpdesk", fields: [
    { key: "service", label: "Affected service", required: true },
    { key: "impact", label: "Customer impact", type: "textarea", required: true },
    { key: "what_we_know", label: "What we currently know", type: "textarea", required: true },
    { key: "next_update", label: "Next update at", placeholder: "e.g. in 30 minutes" },
  ]},
  { kind: "hd_csat_followup", title: "Low CSAT Follow-up", description: "Empathetic customer email + agent coaching note + process candidate.", icon: Smile, category: "Helpdesk", fields: [
    { key: "ticket_ref", label: "Ticket reference", required: true },
    { key: "ticket_summary", label: "Ticket summary", type: "textarea", required: true },
    { key: "csat_comment", label: "Customer's CSAT comment", type: "textarea" },
    { key: "agent", label: "Agent name (for coaching note)" },
  ]},
  { kind: "hd_sla_policy_draft", title: "SLA Policy Draft", description: "Recommend response/resolution targets per ticket type and priority.", icon: Clock, category: "Helpdesk", fields: [
    { key: "service_context", label: "Service desk context", type: "textarea", required: true, placeholder: "Coverage hours, team size, ticket volume, customer expectations" },
    { key: "ticket_types", label: "Ticket types in use", placeholder: "e.g. Incident, Service Request, Question, Problem" },
    { key: "constraints", label: "Constraints", type: "textarea", placeholder: "Vendor SLAs, contractual commitments, business hours" },
  ]},

  // ─── Construction & Engineering ─────────────────────────────────────────
  { kind: "con_rfi", title: "RFI (Request for Information)", description: "Draft a contractually defensible RFI with discipline, refs and impact analysis.", icon: MessageSquare, category: "Construction", fields: [
    { key: "subject", label: "Subject", required: true, placeholder: "e.g. Clash between Level 2 ductwork and structural beam B-12" },
    { key: "discipline", label: "Discipline", placeholder: "architectural / structural / mechanical / electrical / plumbing / civil / fire / facade" },
    { key: "spec_section", label: "Spec Section", placeholder: "e.g. 23 31 13" },
    { key: "drawing_ref", label: "Drawing Reference(s)", placeholder: "e.g. M-202 Rev C, S-105 Rev B" },
    { key: "background", label: "Background / Context", type: "textarea", required: true, placeholder: "What was found, when, by whom" },
    { key: "question", label: "Question(s)", type: "textarea", required: true, placeholder: "Single, specific question(s)" },
    { key: "proposed_solution", label: "Proposed Solution (optional)", type: "textarea" },
    { key: "response_due_days", label: "Response required (working days)", placeholder: "e.g. 5" },
  ]},
  { kind: "con_submittal_log", title: "Submittal Register Entry", description: "Submittal log entry + transmittal cover note with review codes and lead-time.", icon: FileCheck, category: "Construction", fields: [
    { key: "spec_section", label: "Spec Section", required: true, placeholder: "e.g. 09 51 13 Acoustical Panel Ceilings" },
    { key: "submittal_type", label: "Type", placeholder: "product_data / shop_drawing / sample / mock_up / calculation / cert" },
    { key: "description", label: "Description", type: "textarea", required: true },
    { key: "submitted_by", label: "Submitted By", placeholder: "Subcontractor / vendor" },
    { key: "reviewer", label: "Reviewer (Ball-in-Court)", placeholder: "e.g. Architect, MEP Consultant" },
    { key: "lead_time_weeks", label: "Procurement lead time (weeks)", placeholder: "e.g. 8" },
    { key: "required_on_site", label: "Required On Site", placeholder: "YYYY-MM-DD" },
  ]},
  { kind: "con_method_statement", title: "Method Statement (RAMS)", description: "CDM 2015 / ISO 45001 RAMS with hazard table, controls and emergency arrangements.", icon: ScrollText, category: "Construction", fields: [
    { key: "activity", label: "Activity", required: true, placeholder: "e.g. Erection of tower crane TC1" },
    { key: "location", label: "Location / Area", placeholder: "e.g. North-east corner, Block A" },
    { key: "duration", label: "Planned duration", placeholder: "e.g. 2 days" },
    { key: "key_hazards", label: "Known hazards / context", type: "textarea", placeholder: "Adjacent live operations, public, overhead lines, etc." },
    { key: "permits_required", label: "Permits anticipated", placeholder: "e.g. lifting operation, working at height" },
    { key: "competency", label: "Competency requirements", placeholder: "e.g. CPCS slinger/signaller, appointed person" },
  ]},
  { kind: "con_ncr", title: "Non-Conformance Report (NCR)", description: "ISO 9001 NCR with 5-Whys root cause, disposition and CAPA.", icon: BadgeAlert, category: "Construction", fields: [
    { key: "spec_ref", label: "Specification / Standard ref", required: true, placeholder: "e.g. BS EN 13670 §8.4" },
    { key: "trade_party", label: "Trade / Party responsible", placeholder: "e.g. Concrete subcontractor" },
    { key: "location", label: "Location", placeholder: "Grid / level / room" },
    { key: "description", label: "Description of non-conformance", type: "textarea", required: true },
    { key: "evidence", label: "Evidence (photos, tests, witnesses)", type: "textarea" },
    { key: "severity_hint", label: "Suspected severity", placeholder: "minor / major / critical" },
  ]},
  { kind: "con_toolbox_talk", title: "Toolbox Talk", description: "10-minute site safety brief with hazards, controls and check questions.", icon: Megaphone, category: "Construction", fields: [
    { key: "topic", label: "Topic", required: true, placeholder: "e.g. Working safely around mobile plant" },
    { key: "site_context", label: "Site context (optional)", type: "textarea", placeholder: "Recent near-miss, current high-risk activities" },
    { key: "audience", label: "Audience", placeholder: "e.g. all trades, ground works only" },
  ]},
  { kind: "con_daily_log", title: "Daily Site Log Narrative", description: "Polished daily log from raw superintendent notes — manpower, deliveries, delays.", icon: ClipboardList, category: "Construction", fields: [
    { key: "log_date", label: "Date", required: true, placeholder: "YYYY-MM-DD" },
    { key: "weather", label: "Weather AM / PM / temp", placeholder: "e.g. cloudy AM, rain PM, 12°C" },
    { key: "raw_notes", label: "Raw notes (anything goes)", type: "textarea", required: true, placeholder: "Trades on site, deliveries, inspections, delays, permits, events..." },
  ]},
  { kind: "con_change_order", title: "Change Order / Variation", description: "NEC4 CE / JCT VO / AIA G701 with cost build-up and programme impact.", icon: FileEdit, category: "Construction", fields: [
    { key: "title", label: "Change title", required: true, placeholder: "e.g. Additional fire-rated partition to Level 3 plant room" },
    { key: "originator", label: "Originator", placeholder: "client / designer / contractor / site_condition" },
    { key: "contract_form", label: "Contract form", placeholder: "NEC4 / JCT D&B / FIDIC Red / AIA A201" },
    { key: "description", label: "Description of change", type: "textarea", required: true },
    { key: "reason", label: "Reason / justification", type: "textarea", required: true },
    { key: "cost_breakdown", label: "Known costs (rough)", type: "textarea", placeholder: "Labour, plant, materials, sub-contract, prelims, OH&P" },
    { key: "time_impact", label: "Time impact (days)", placeholder: "e.g. 7 working days on critical path" },
  ]},
  { kind: "con_commissioning_pack", title: "Commissioning Test Pack", description: "Cx pack: pre-commissioning checks, static & dynamic tests, witnessing & sign-off.", icon: Power, category: "Construction", fields: [
    { key: "system", label: "System", required: true, placeholder: "e.g. Chilled water system CHW-01" },
    { key: "boundaries", label: "System boundaries", type: "textarea", placeholder: "Where does this system start/end" },
    { key: "drawings_specs", label: "Reference drawings & specs", type: "textarea" },
    { key: "performance_criteria", label: "Performance / acceptance criteria", type: "textarea", required: true },
    { key: "witnessing", label: "Witnessing required", placeholder: "Contractor / Consultant / Client" },
  ]},
  { kind: "con_handover_register", title: "Handover / O&M Register", description: "PC handover deliverables: O&Ms, as-builts, certs, warranties, training, H&S file.", icon: KeyRound, category: "Construction", fields: [
    { key: "project_type", label: "Project type", required: true, placeholder: "e.g. Commercial office fit-out, residential new-build" },
    { key: "systems", label: "Key systems / disciplines", type: "textarea", placeholder: "List the building systems requiring handover" },
    { key: "client_requirements", label: "Client-specific requirements", type: "textarea", placeholder: "e.g. Soft Landings BG 6, BIM COBie drop, CAFM upload" },
    { key: "pc_date", label: "Target Practical Completion", placeholder: "YYYY-MM-DD" },
  ]},
  { kind: "con_subcontractor_scope", title: "Subcontractor Scope of Works", description: "Tender scope: inclusions, exclusions, interfaces, programme & commercial terms.", icon: FileSignature, category: "Construction", fields: [
    { key: "package_title", label: "Package title", required: true, placeholder: "e.g. P-205 Mechanical Services" },
    { key: "trade", label: "Trade", placeholder: "e.g. MEP, structural steel, fitout joinery" },
    { key: "inclusions", label: "Known inclusions", type: "textarea", required: true },
    { key: "exclusions", label: "Known exclusions", type: "textarea" },
    { key: "key_milestones", label: "Key milestones / dates", type: "textarea" },
    { key: "contract_form", label: "Sub-contract form", placeholder: "NEC4 sub / JCT sub / DOM-A / bespoke" },
  ]},
  { kind: "con_lookahead_plan", title: "3-Week Look-Ahead", description: "Weekly look-ahead by area: activities, constraints, resources, risks, milestones.", icon: CalendarRange, category: "Construction", fields: [
    { key: "project_status", label: "Where the project is now", type: "textarea", required: true, placeholder: "Current phase, areas active, behind/ahead vs baseline" },
    { key: "active_areas", label: "Active areas / work faces", type: "textarea", placeholder: "e.g. Level 2 partitions, basement waterproofing, roof plant" },
    { key: "known_constraints", label: "Known constraints", type: "textarea", placeholder: "Late info, material lead-times, permits, inspections" },
    { key: "milestones_in_window", label: "Milestones in window", type: "textarea" },
  ]},
  { kind: "con_permit_to_work", title: "Permit to Work", description: "Issue a complete Permit to Work with controls, isolations and rescue plan.", icon: ShieldCheck, category: "Construction", fields: [
    { key: "permit_type", label: "Permit type", required: true, placeholder: "hot_work / confined_space / working_at_height / excavation / electrical_isolation / lifting_operation / live_traffic" },
    { key: "activity", label: "Activity description", type: "textarea", required: true },
    { key: "location", label: "Location (with grid ref)", placeholder: "e.g. Level 4, Grid C-7 to D-9" },
    { key: "valid_from", label: "Valid from", placeholder: "YYYY-MM-DD HH:MM" },
    { key: "valid_to", label: "Valid to", placeholder: "YYYY-MM-DD HH:MM" },
    { key: "issued_to", label: "Issued to", placeholder: "Person / company in charge" },
    { key: "adjacent_works", label: "Adjacent works / interactions", type: "textarea" },
  ]},

  // ─── Construction: Bid / RFP / Pursuit Lifecycle ───────────────────────
  { kind: "con_bid_no_bid", title: "Bid / No-Bid Decision Pack", description: "Defensible go/no-go: scoring matrix, Pwin, pursuit cost vs expected value, recommendation.", icon: Scale, category: "Construction", fields: [
    { key: "client_name", label: "Client", required: true },
    { key: "opportunity_name", label: "Opportunity", required: true },
    { key: "estimated_value", label: "Estimated value", placeholder: "e.g. £45M" },
    { key: "delivery_method", label: "Delivery method", placeholder: "design_build / cm_at_risk / framework / etc." },
    { key: "context", label: "What we know — client, competition, complexity, capacity", type: "textarea", required: true },
  ]},
  { kind: "con_rfp_response_plan", title: "RFP Response Plan", description: "Decode the RFP, build compliance matrix, response outline, win strategy and pursuit schedule.", icon: ClipboardCheck, category: "Construction", fields: [
    { key: "rfp_reference", label: "RFP / Tender ref", required: true },
    { key: "submission_deadline", label: "Submission deadline", placeholder: "YYYY-MM-DD" },
    { key: "evaluation_criteria", label: "Evaluation criteria & weightings", type: "textarea", required: true },
    { key: "submission_requirements", label: "Submission requirements (page limits, format, portal)", type: "textarea" },
    { key: "team_available", label: "Team available", type: "textarea" },
  ]},
  { kind: "con_executive_summary", title: "Bid Executive Summary", description: "Client-centric 1–2 page exec summary with win themes, proof points and commercial confidence.", icon: FileText, category: "Construction", fields: [
    { key: "client_name", label: "Client", required: true },
    { key: "project_name", label: "Project", required: true },
    { key: "client_drivers", label: "Client drivers (in their words)", type: "textarea", required: true },
    { key: "win_themes", label: "Win themes (3)", type: "textarea", required: true },
    { key: "proof_points", label: "Proof points (past projects, KPIs)", type: "textarea" },
  ]},
  { kind: "con_technical_proposal_section", title: "Technical Proposal Section", description: "Draft a single proposal section that lands win themes, with proof points and risk mitigation.", icon: FileEdit, category: "Construction", fields: [
    { key: "section_title", label: "Section title", required: true, placeholder: "e.g. Methodology" },
    { key: "weighting_pct", label: "Evaluation weighting %", placeholder: "e.g. 25" },
    { key: "page_limit", label: "Page limit", placeholder: "e.g. 4" },
    { key: "win_themes", label: "Win themes to land", type: "textarea", required: true },
    { key: "client_hot_buttons", label: "Client hot buttons", type: "textarea" },
  ]},
  { kind: "con_clarification_log", title: "Tender Clarifications Log", description: "Numbered clarifications to send to the client, with working assumptions and impact.", icon: MessageSquare, category: "Construction", fields: [
    { key: "rfp_reference", label: "RFP ref", required: true },
    { key: "questions", label: "Ambiguities / questions to raise", type: "textarea", required: true },
    { key: "submission_deadline", label: "Submission deadline" },
  ]},
  { kind: "con_estimate_basis", title: "Basis of Estimate (BoE)", description: "Defensible BoE: pricing approach, assumptions, exclusions, contingency, cash-flow profile.", icon: ClipboardList, category: "Construction", fields: [
    { key: "estimate_ref", label: "Estimate reference", required: true },
    { key: "total_bid_price", label: "Total bid price" },
    { key: "pricing_approach", label: "Pricing approach", placeholder: "lump_sum / target_cost / unit_rate" },
    { key: "key_assumptions", label: "Key assumptions", type: "textarea", required: true },
    { key: "key_risks", label: "Key risks priced", type: "textarea" },
  ]},
  { kind: "con_pqq_response", title: "PQQ / SQ Response", description: "PAS 91 / Selection Questionnaire response: financials, insurances, HSE, quality, case studies.", icon: BadgeCheck, category: "Construction", fields: [
    { key: "client_name", label: "Issuing client / framework", required: true },
    { key: "lots_applying_for", label: "Lots / categories", type: "textarea" },
    { key: "company_strengths", label: "Strengths & accreditations to highlight", type: "textarea", required: true },
  ]},
  { kind: "con_cover_letter_bid", title: "Bid Cover Letter", description: "One-page director-signed cover letter with offer, validity, qualifications, win-theme.", icon: FileSignature, category: "Construction", fields: [
    { key: "tender_ref", label: "Tender reference", required: true },
    { key: "client_contact", label: "Client contact (named)", required: true },
    { key: "headline_offer", label: "Headline commercial offer", required: true, placeholder: "e.g. £42.6M lump sum, 78 weeks" },
    { key: "qualifications", label: "Bid qualifications / alternatives (optional)", type: "textarea" },
    { key: "win_theme", label: "Win theme to land", type: "textarea" },
  ]},
  { kind: "con_post_tender_clarifications", title: "Post-Tender Clarifications", description: "Responsive but scope-protecting answers to client clarifications during evaluation.", icon: MessageSquare, category: "Construction", fields: [
    { key: "tender_ref", label: "Tender ref", required: true },
    { key: "client_questions", label: "Client questions (paste)", type: "textarea", required: true },
    { key: "bid_summary", label: "Brief bid summary for context", type: "textarea" },
  ]},
  { kind: "con_win_loss_review", title: "Win / Loss Review", description: "Post-decision debrief: client feedback, root causes, lessons, process improvements.", icon: TrendingUp, category: "Construction", fields: [
    { key: "bid_reference", label: "Bid reference", required: true },
    { key: "outcome", label: "Outcome", required: true, placeholder: "won / lost / no_decision" },
    { key: "client_feedback", label: "Client feedback (if obtained)", type: "textarea" },
    { key: "winner_and_price", label: "Winner & price (if known)" },
    { key: "our_perspective", label: "Our team's perspective", type: "textarea", required: true },
  ]},

  // ─── Construction: Project Lifecycle ───────────────────────────────────
  { kind: "con_preconstruction_plan", title: "Preconstruction Plan", description: "Bridge from contract award to start-on-site: design, permits, long-leads, mobilisation.", icon: HardHat, category: "Construction", fields: [
    { key: "project_name", label: "Project", required: true },
    { key: "contract_form", label: "Contract form", placeholder: "NEC4 / JCT D&B / FIDIC / AIA A102" },
    { key: "start_on_site_target", label: "Target start on site" },
    { key: "key_long_leads", label: "Known long-lead items", type: "textarea" },
    { key: "key_approvals", label: "Outstanding approvals/permits", type: "textarea" },
  ]},
  { kind: "con_mobilisation_plan", title: "4-Week Mobilisation Plan", description: "Week-by-week mobilisation: kickoff, site setup, F10, RAMS, Day-1 readiness checklist.", icon: CalendarRange, category: "Construction", fields: [
    { key: "project_name", label: "Project", required: true },
    { key: "site_possession_date", label: "Site possession date", required: true },
    { key: "key_team", label: "Key team appointments", type: "textarea" },
    { key: "first_activities", label: "First on-site activities", type: "textarea" },
  ]},
  { kind: "con_project_execution_plan", title: "Project Execution Plan (PEP)", description: "Authoritative PEP: scope, programme, cost, quality, HSE, design, info management, closeout.", icon: Briefcase, category: "Construction", fields: [
    { key: "project_name", label: "Project", required: true },
    { key: "client_name", label: "Client", required: true },
    { key: "contract_value", label: "Contract value" },
    { key: "contract_form", label: "Contract form" },
    { key: "key_dates", label: "Key dates (start, milestones, PC)", type: "textarea" },
    { key: "project_objectives", label: "Project objectives & success criteria", type: "textarea", required: true },
  ]},
  { kind: "con_stage_gate_review", title: "Stage-Gate Review Pack", description: "Phase-boundary review: outcomes vs plan, exit criteria, risks, recommendation Pass/Defer/Stop.", icon: GitBranch, category: "Construction", fields: [
    { key: "gate_identity", label: "Which gate", required: true, placeholder: "e.g. RIBA 3→4 / GMP set / start on site / weather-tight" },
    { key: "phase_outcomes", label: "Phase outcomes vs plan", type: "textarea", required: true },
    { key: "exit_criteria_status", label: "Exit criteria status", type: "textarea", required: true },
    { key: "outstanding_risks", label: "Outstanding risks", type: "textarea" },
  ]},
  { kind: "con_closeout_report", title: "Project Closeout Report", description: "Post-PC + DLP review: commercial, schedule, HSE, quality, lessons, asset handover.", icon: KeyRound, category: "Construction", fields: [
    { key: "project_name", label: "Project", required: true },
    { key: "final_account_value", label: "Final account value" },
    { key: "pc_date", label: "Practical Completion date" },
    { key: "dlp_end_date", label: "DLP end date" },
    { key: "key_outcomes", label: "Key outcomes & metrics", type: "textarea", required: true },
    { key: "lessons", label: "Lessons learned (themes)", type: "textarea" },
  ]},

  // ─── Professional Services & Consulting ─────────────────────────────────
  { kind: "ps_sow_draft" as WizardKind, title: "SOW Draft", description: "Statement of Work with objectives, in/out scope, deliverables, acceptance criteria, fees, payment terms.", icon: FileSignature, category: "Pro Services" as any, fields: [
    { key: "client_name", label: "Client", required: true },
    { key: "engagement_name", label: "Engagement / project name", required: true, placeholder: "e.g. ERP Discovery Phase" },
    { key: "pricing_model", label: "Pricing model", placeholder: "fixed_price / time_and_materials / milestone_based / retainer" },
    { key: "objectives", label: "Engagement objectives", type: "textarea", required: true },
    { key: "scope_summary", label: "Scope summary", type: "textarea", required: true },
    { key: "constraints", label: "Constraints / assumptions", type: "textarea" },
    { key: "fees", label: "Fees / budget envelope", placeholder: "e.g. $120k fixed; or $250/hr capped at $200k" },
  ]},
  { kind: "ps_msa_summary_draft" as WizardKind, title: "MSA Summary", description: "Plain-English summary of an MSA — liability cap, IP, confidentiality, notice, change control.", icon: ScrollText, category: "Pro Services" as any, fields: [
    { key: "client_name", label: "Client", required: true },
    { key: "msa_terms", label: "Paste key MSA clauses or talking points", type: "textarea", required: true },
  ]},
  { kind: "ps_change_order_draft" as WizardKind, title: "Engagement Change Order", description: "Client-ready change order: scope delta, fee impact, schedule impact, recommendation.", icon: FileEdit, category: "Pro Services" as any, fields: [
    { key: "engagement", label: "Engagement / SOW reference", required: true },
    { key: "change_summary", label: "What's changing", type: "textarea", required: true },
    { key: "reason", label: "Why", type: "textarea", required: true },
    { key: "fee_impact", label: "Fee impact", placeholder: "e.g. +$25k" },
    { key: "time_impact", label: "Time impact", placeholder: "e.g. +2 weeks" },
  ]},
  { kind: "ps_proposal_exec_summary" as WizardKind, title: "Proposal Executive Summary", description: "Open a proposal with a sharp 1-page exec summary — problem, approach, why us, outcomes.", icon: Briefcase, category: "Pro Services" as any, fields: [
    { key: "client_name", label: "Client", required: true },
    { key: "client_problem", label: "Client's problem (in their words)", type: "textarea", required: true },
    { key: "our_approach", label: "Our approach (one paragraph)", type: "textarea", required: true },
    { key: "differentiators", label: "Why us — 3 bullets", type: "textarea" },
    { key: "outcomes", label: "Outcomes the client will get", type: "textarea" },
  ]},
  { kind: "ps_engagement_kickoff" as WizardKind, title: "Engagement Kick-off Pack", description: "Kick-off agenda + RACI + governance cadence + risk pre-mortem for a new client engagement.", icon: Target, category: "Pro Services" as any, fields: [
    { key: "engagement_name", label: "Engagement", required: true },
    { key: "client_team", label: "Client team (names + roles)", type: "textarea", required: true },
    { key: "our_team", label: "Our team (names + roles)", type: "textarea", required: true },
    { key: "duration_weeks", label: "Duration (weeks)", placeholder: "e.g. 12" },
  ]},
  { kind: "ps_status_report" as WizardKind, title: "Client Status Report", description: "Weekly client-facing status: progress, decisions needed, risks, next week, hours used.", icon: Activity, category: "Pro Services" as any, fields: [
    { key: "engagement_name", label: "Engagement", required: true },
    { key: "week_of", label: "Week of (YYYY-MM-DD)", required: true },
    { key: "raw_notes", label: "Raw notes from the team", type: "textarea", required: true },
    { key: "hours_used_pct", label: "Hours used vs budget (%)", placeholder: "e.g. 42" },
  ]},
  { kind: "ps_qbr_pack" as WizardKind, title: "QBR Pack", description: "Quarterly Business Review pack — value delivered, KPIs, risks, roadmap, expansion ideas.", icon: TrendingUp, category: "Pro Services" as any, fields: [
    { key: "client_name", label: "Client", required: true },
    { key: "quarter", label: "Quarter (e.g. Q2 2026)", required: true },
    { key: "outcomes_delivered", label: "Outcomes delivered this quarter", type: "textarea", required: true },
    { key: "kpis", label: "KPIs (numbers)", type: "textarea" },
    { key: "next_quarter_focus", label: "Next quarter focus", type: "textarea" },
  ]},
  { kind: "ps_wip_writeoff" as WizardKind, title: "WIP Write-off Memo", description: "Internal memo justifying a Work-in-Progress write-off — root cause, financial impact, controls.", icon: AlertOctagon, category: "Pro Services" as any, fields: [
    { key: "engagement", label: "Engagement", required: true },
    { key: "amount", label: "Amount to write off", required: true, placeholder: "e.g. $18,500" },
    { key: "reason", label: "Root cause", type: "textarea", required: true },
    { key: "prevention", label: "What we'll change to prevent recurrence", type: "textarea" },
  ]},
  { kind: "ps_case_study_draft" as WizardKind, title: "Case Study Draft", description: "Sales-ready case study: client context, challenge, approach, results, quote.", icon: BookOpen, category: "Pro Services" as any, fields: [
    { key: "client_name", label: "Client (or pseudonym)", required: true },
    { key: "client_industry", label: "Industry", placeholder: "e.g. retail banking" },
    { key: "challenge", label: "Challenge", type: "textarea", required: true },
    { key: "approach", label: "Approach", type: "textarea", required: true },
    { key: "results", label: "Results (with numbers)", type: "textarea", required: true },
  ]},
  { kind: "ps_csat_followup" as WizardKind, title: "CSAT Follow-up", description: "Empathetic follow-up email + internal action note from a low CSAT/NPS score.", icon: Smile, category: "Pro Services" as any, fields: [
    { key: "client_contact", label: "Client contact name", required: true },
    { key: "engagement", label: "Engagement", required: true },
    { key: "score", label: "Score given", placeholder: "e.g. CSAT 2/5, NPS 4" },
    { key: "comment", label: "Their verbatim comment", type: "textarea" },
  ]},
];

const CREATE_CATEGORIES = ["all", "MSP", "PRINCE2", "Agile", "Product", "Governance", "Construction", "Pro Services"] as const;
const AI_CATEGORIES = ["all", "Document", "Strategy", "Governance", "Helper", "Change Mgmt", "Helpdesk", "Construction", "Pro Services"] as const;

export default function Wizards() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get("tab") === "ai" ? "ai" : "create";
  const [tab, setTabState] = useState<"create" | "ai">(initialTab);
  const setTab = (v: "create" | "ai") => {
    setTabState(v);
    const next = new URLSearchParams(searchParams);
    if (v === "ai") next.set("tab", "ai"); else next.delete("tab");
    setSearchParams(next, { replace: true });
  };
  const [searchQuery, setSearchQuery] = useState("");
  const [createCategory, setCreateCategory] = useState<string>("all");
  const [aiCategory, setAiCategory] = useState<string>("all");

  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardType, setWizardType] = useState<TemplateType>("programme_mandate");
  const [wizardName, setWizardName] = useState("");

  const filteredCreate = useMemo(() => createTemplates
    .filter(t => createCategory === "all" || t.category === createCategory)
    .filter(t => !searchQuery || t.name.toLowerCase().includes(searchQuery.toLowerCase()) || t.description.toLowerCase().includes(searchQuery.toLowerCase())),
    [createCategory, searchQuery]);

  const filteredAi = useMemo(() => aiWizards
    .filter(w => aiCategory === "all" || w.category === aiCategory)
    .filter(w => !searchQuery || w.title.toLowerCase().includes(searchQuery.toLowerCase()) || w.description.toLowerCase().includes(searchQuery.toLowerCase())),
    [aiCategory, searchQuery]);

  return (
    <AppLayout title="Wizards" subtitle="Create entities from templates or draft documents with AI — every AI draft is reviewed in AI Approvals before publishing.">
      <Tabs value={tab} onValueChange={(v) => setTab(v as "create" | "ai")} className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <TabsList>
            <TabsTrigger value="create" className="gap-1.5">
              <Wand2 className="h-4 w-4" />
              Create from Template
            </TabsTrigger>
            <TabsTrigger value="ai" className="gap-1.5">
              <Sparkles className="h-4 w-4" />
              Draft with AI
            </TabsTrigger>
          </TabsList>
          <div className="relative flex-1 sm:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search wizards..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <TabsContent value="create" className="space-y-4 mt-0">
          <div className="flex flex-wrap gap-2">
            {CREATE_CATEGORIES.map((cat) => (
              <Button
                key={cat}
                variant={createCategory === cat ? "default" : "outline"}
                size="sm"
                onClick={() => setCreateCategory(cat)}
                className="rounded-full"
              >
                {cat === "all" ? "All" : cat}
              </Button>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredCreate.map((template) => (
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

          {filteredCreate.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <p>No wizards match your search.</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="ai" className="space-y-4 mt-0">
          <div className="flex flex-wrap items-center gap-2">
            {AI_CATEGORIES.map((cat) => (
              <Button
                key={cat}
                variant={aiCategory === cat ? "default" : "outline"}
                size="sm"
                onClick={() => setAiCategory(cat)}
                className="rounded-full"
              >
                {cat === "all" ? "All" : cat}
              </Button>
            ))}
            <Badge variant="outline" className="text-xs ml-auto">Powered by gemini-2.5-pro</Badge>
          </div>

          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {filteredAi.map((w) => {
              const Icon = w.icon;
              return (
                <Card key={w.kind} className="flex flex-col">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <div className="p-2 rounded-md bg-primary/10 w-fit">
                        <Icon className="h-4 w-4 text-primary" />
                      </div>
                      <Badge variant="outline" className="text-xs">{w.category}</Badge>
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

          {filteredAi.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <p>No AI wizards match your search.</p>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <TemplateWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        templateType={wizardType}
        templateName={wizardName}
      />
    </AppLayout>
  );
}
