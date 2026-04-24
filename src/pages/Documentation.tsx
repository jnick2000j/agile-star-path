import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  Search, 
  BookOpen,
  FileText,
  ExternalLink,
  Download,
  Copy,
  Check,
  ChevronRight,
  Edit2,
  Eye,
  Users,
  FileEdit,
  Shield,
  Building2,
  Clock,
  UserPlus,
  Package,
  FolderKanban,
  ListChecks,
  BarChart3,
  Bell,
  MessageSquare,
  Upload,
  Target,
  Milestone,
  GitBranch,
  AlertTriangle,
  Layers,
  CalendarCheck,
  Sparkles,
  Brain,
  Wand2,
  CheckCircle2,
  Globe2,
  CreditCard,
  Coins,
  ShieldCheck,
  Activity,
  Lock,
  Megaphone,
  GitMerge,
  Lightbulb,
  Database,
  KeyRound,
  Workflow,
  ScrollText,
  TrendingUp,
  Zap
} from "lucide-react";
import { toast } from "sonner";

// Phase 1-6 platform feature documentation
const platformFeatureGroups = [
  {
    group: "AI & Intelligence",
    icon: Sparkles,
    color: "primary",
    features: [
      {
        name: "AI Field Assist",
        icon: Wand2,
        summary: "Inline AI helper on text fields to improve, shorten, expand, translate or formalize copy with one click.",
        capabilities: [
          "Available on description, rationale and notes fields across registers",
          "Suggestions are diff-previewed before apply",
          "Sensitive fields can require approval before publishing",
          "Every action logged to the AI audit trail",
        ],
        permission: "can_draft_with_ai",
      },
      {
        name: "AI Draft Wizards",
        icon: Wand2,
        summary: "Multi-step generators for Project Briefs, Risk entries, Benefit profiles, Programme Visions and more.",
        capabilities: [
          "Context-aware: pulls from linked programme/project data",
          "Outputs structured drafts mapped to register fields",
          "Save as draft for human review before publishing",
        ],
        permission: "can_draft_with_ai",
      },
      {
        name: "AI Summary Panels",
        icon: ScrollText,
        summary: "On-demand executive summaries for programmes, projects and weekly reports with stale-detection.",
        capabilities: [
          "Auto-flags stale summaries when underlying data changes",
          "Multi-language translations cached per scope",
          "Approval workflow for published summaries",
        ],
        permission: "can_view_ai_advisor",
      },
      {
        name: "AI Advisor (Ask the Task Master)",
        icon: Brain,
        summary: "Conversational PRINCE2/MSP/Agile expert that can read and act on your data via tool-calls.",
        capabilities: [
          "Conversation history per user/org",
          "Tool-calls audited as agent actions, revertible by admins",
          "Methodology guidance grounded in your live registers",
        ],
        permission: "can_view_ai_advisor",
      },
      {
        name: "AI Insights Scanner",
        icon: Lightbulb,
        summary: "Background scans surface stale risks, orphan issues, missing benefit owners and overdue updates.",
        capabilities: [
          "Severity-tagged insights (info / warn / critical)",
          "Dismiss / resolve workflow with audit trail",
          "Scoped per programme, project or product",
        ],
        permission: "can_view_ai_insights",
      },
      {
        name: "Risk Insights & Heat-Map Narratives",
        icon: TrendingUp,
        summary: "AI generates narrative explanations of the risk heat-map plus tailored mitigation suggestions.",
        capabilities: [
          "Reads probability×impact distribution",
          "Suggests treatment (avoid / reduce / transfer / accept)",
          "Highlights risks trending into the red zone",
        ],
        permission: "can_view_ai_insights",
      },
    ],
  },
  {
    group: "Governance & Compliance",
    icon: ShieldCheck,
    color: "success",
    features: [
      {
        name: "Compliance Scoring",
        icon: ShieldCheck,
        summary: "Per-scope health scores across cadence, hygiene and controls with configurable thresholds.",
        capabilities: [
          "Org-level rule editor: weights, windows, pass/warn thresholds",
          "Scores recomputed on demand or on data change",
          "Detailed breakdown of failed checks",
        ],
        permission: "can_manage_compliance",
      },
      {
        name: "Governance Reports",
        icon: FileText,
        summary: "Automated period-bounded reports rolling up registers, status changes and compliance for any scope.",
        capabilities: [
          "Programme, project or org-wide scope",
          "PDF download + scheduled email delivery",
          "Includes evidence references for audits",
        ],
        permission: "can_view_reports",
      },
      {
        name: "Audit Log Export & Retention",
        icon: ScrollText,
        summary: "Full auth and data audit trail with org-configurable retention and platform-admin viewer.",
        capabilities: [
          "Per-org retention policy with optional auto-purge",
          "CSV/JSON export via edge function",
          "Platform admins can query across all orgs",
        ],
        permission: "can_view_audit_log",
      },
      {
        name: "Approval Workflows",
        icon: CheckCircle2,
        summary: "Triad approval matrices for stage gates, exceptions and benefit profiles with evidence checklists.",
        capabilities: [
          "Configurable approver roles per workflow",
          "Evidence attestation with document linking",
          "Decision comments preserved in audit trail",
        ],
        permission: "can_manage_stage_gates",
      },
      {
        name: "Comms Pack Generator",
        icon: Megaphone,
        summary: "Publish governance reports as email, Slack and PDF-ready stakeholder updates in one click.",
        capabilities: [
          "Generates email HTML, Slack markdown and PDF summary",
          "Period-bounded with publish/draft workflow",
          "Linked back to the source governance report",
        ],
        permission: "can_publish_comms",
      },
    ],
  },
  {
    group: "Multi-Tenancy & Security",
    icon: Lock,
    color: "info",
    features: [
      {
        name: "Organization & Hybrid Deployment",
        icon: Building2,
        summary: "Org-level data siloing with optional hybrid (on-prem-style) regional deployment metadata.",
        capabilities: [
          "Every record scoped by organization_id via RLS",
          "Users can belong to multiple organizations",
          "Region badges show data residency at a glance",
        ],
        permission: "platform-default",
      },
      {
        name: "Data Residency Policies",
        icon: Globe2,
        summary: "Per-org region pinning with warn/block enforcement for cross-region AI processing.",
        capabilities: [
          "Allow / warn / block decisions logged to residency_audit_log",
          "Lovable AI gateway flagged as us-east processing",
          "Returns HTTP 451 when blocked, evidence retained for audits",
        ],
        permission: "can_manage_regions",
      },
      {
        name: "SSO Setup & Platform Queue",
        icon: KeyRound,
        summary: "SAML SSO request workflow with platform-admin provisioning queue.",
        capabilities: [
          "Self-service config request from org admins",
          "Platform admins approve and configure IdP metadata",
          "Email notifications via dedicated edge function",
        ],
        permission: "can_manage_integrations",
      },
      {
        name: "Stakeholder Portal",
        icon: Users,
        summary: "Read-only external view for stakeholders with granular access settings per programme/project.",
        capabilities: [
          "Per-entity stakeholder access list",
          "Hides internal status changes and audit detail",
          "Configurable from Admin → Stakeholder Access",
        ],
        permission: "can_manage_stakeholder_portal",
      },
      {
        name: "Dynamic RBAC",
        icon: Shield,
        summary: "Custom roles with 30+ capability flags including all Phase 6 modules.",
        capabilities: [
          "Locked Administrator role plus unlimited custom roles",
          "Per-module flags for AI, compliance, comms, integrations, platform",
          "Role builder matrix exposes every capability",
        ],
        permission: "can_manage_users",
      },
    ],
  },
  {
    group: "Billing & Plans",
    icon: CreditCard,
    color: "warning",
    features: [
      {
        name: "Plan Catalog & Stripe Sync",
        icon: CreditCard,
        summary: "Admin-managed plan catalog with feature limits, synced to Stripe products/prices.",
        capabilities: [
          "Per-feature limits (programmes, projects, users, AI credits)",
          "Org-level overrides for enterprise deals",
          "Embedded Stripe checkout + customer portal",
        ],
        permission: "can_manage_platform",
      },
      {
        name: "AI Credits & Usage Meter",
        icon: Coins,
        summary: "Per-plan monthly AI credit allowance with atomic check-and-increment and transparent usage UI.",
        capabilities: [
          "Free 25 / Pro 500 / Enterprise unlimited (configurable)",
          "Itemized ledger of every AI call (action, model, decision)",
          "HTTP 402 returned when quota exhausted, with upgrade prompt",
          "Compact meter in header, full meter on Billing page",
        ],
        permission: "can_manage_ai_credits",
      },
      {
        name: "Trial & Upgrade Prompts",
        icon: Zap,
        summary: "Trial countdown banner and contextual upgrade prompts when feature limits are reached.",
        capabilities: [
          "Plan usage bars on registers approaching limits",
          "Feature-gated components with friendly upgrade CTAs",
          "Test-mode banner for sandbox Stripe keys",
        ],
        permission: "platform-default",
      },
    ],
  },
  {
    group: "Delivery & Lifecycle",
    icon: Workflow,
    color: "primary",
    features: [
      {
        name: "Programme Lifecycle (Blueprint, Vision, Tranches)",
        icon: GitMerge,
        summary: "Full MSP lifecycle: Programme Definition, Blueprint, Success Plan and integrated Tranches view.",
        capabilities: [
          "Editable vision and objectives with audit trail",
          "Tranche planner linked to projects and benefits",
          "Cross-tab summaries powered by AI",
        ],
        permission: "can_manage_programmes",
      },
      {
        name: "Unified Backlog & Sprints",
        icon: ListChecks,
        summary: "Single backlog across products, projects and programmes with entity-specific sprint cycles.",
        capabilities: [
          "Drag-prioritized backlog with RICE/MoSCoW scoring",
          "Sprint board per entity with capacity tracking",
          "Story-point and LOE roll-ups",
        ],
        permission: "can_manage_work_packages",
      },
      {
        name: "Work Packages",
        icon: Package,
        summary: "PRINCE2-style work packages linking tasks, milestones and deliverables to specific stages.",
        capabilities: [
          "Task and milestone linking with progress roll-up",
          "Story-point / LOE tracking",
          "Document attachments via private storage",
        ],
        permission: "can_manage_work_packages",
      },
      {
        name: "Status Management & Audit Trail",
        icon: Activity,
        summary: "Lifecycle actions (start, pause, complete, cancel) with full status_history per entity.",
        capabilities: [
          "Every transition records actor, reason and timestamp",
          "Status history dialog on every entity",
          "Used by compliance scoring as a cadence signal",
        ],
        permission: "platform-default",
      },
      {
        name: "Cross-Entity Traceability",
        icon: GitMerge,
        summary: "Risks, Issues, Benefits, Exceptions and Lessons all link back to programmes, projects or products.",
        capabilities: [
          "Filter registers by parent entity",
          "Reverse lookup from any entity to its registers",
          "Powers governance reports and AI insights",
        ],
        permission: "platform-default",
      },
    ],
  },
  {
    group: "Branding & Localization",
    icon: Database,
    color: "info",
    features: [
      {
        name: "Branding Customization",
        icon: Database,
        summary: "Global and per-org branding: logos, colors, hero copy, login layout and PNG transparency support.",
        capabilities: [
          "Color presets plus custom HSL palette",
          "Login page customization (layout, hero, features)",
          "Org logo overrides global branding when set",
        ],
        permission: "can_manage_platform",
      },
      {
        name: "Language Preferences & AI Translation",
        icon: Globe2,
        summary: "Per-user language preference; AI drafts and summaries returned in chosen language.",
        capabilities: [
          "EN / ES / FR / PT / DE bundled",
          "AI translate edge function for on-the-fly content",
          "Translations cached on summaries to save credits",
        ],
        permission: "platform-default",
      },
    ],
  },
];

const prince2Principles = [
  { title: "Continued Business Justification", description: "A valid business reason must exist throughout the project lifecycle. The project should remain viable and the expected benefits should justify the investment." },
  { title: "Learn from Experience", description: "Teams should seek and use lessons from previous projects. New lessons are recorded for future use." },
  { title: "Defined Roles and Responsibilities", description: "Clear roles and responsibilities within an organizational structure that engages business, user, and supplier stakeholder interests." },
  { title: "Manage by Stages", description: "Projects are planned, monitored, and controlled on a stage-by-stage basis. Stages provide senior management with control points for decision-making." },
  { title: "Manage by Exception", description: "Establishing tolerances for each project objective and delegating authority to the appropriate level. Escalation only when tolerances are forecast to be exceeded." },
  { title: "Focus on Products", description: "Projects focus on the definition and delivery of products, particularly their quality requirements." },
  { title: "Tailor to Suit the Project Environment", description: "PRINCE2 is tailored to suit the project's environment, size, complexity, importance, capability, and risk." },
];

const mspPrinciples = [
  { title: "Remaining Aligned with Corporate Strategy", description: "The programme must remain aligned with the organization's strategic objectives throughout its lifecycle." },
  { title: "Leading Change", description: "Transformation requires active leadership to drive change across the organization and overcome resistance." },
  { title: "Envisioning and Communicating a Better Future", description: "A compelling vision must be developed and communicated to stakeholders to generate support and commitment." },
  { title: "Focusing on Benefits and Threats to Them", description: "Benefits realization is the primary measure of program success. Threats must be actively managed." },
  { title: "Adding Value", description: "The programme must deliver more value than the sum of its component projects." },
  { title: "Designing and Delivering a Coherent Capability", description: "Projects must be coordinated to deliver capabilities that enable benefit realization." },
  { title: "Learning from Experience", description: "Continuous improvement through capturing and applying lessons learned." },
];

const agilePrinciples = [
  { title: "Customer Satisfaction", description: "Our highest priority is to satisfy the customer through early and continuous delivery of valuable software." },
  { title: "Welcome Change", description: "Welcome changing requirements, even late in development. Agile processes harness change for the customer's competitive advantage." },
  { title: "Frequent Delivery", description: "Deliver working software frequently, from a couple of weeks to a couple of months, with a preference to the shorter timescale." },
  { title: "Collaboration", description: "Business people and developers must work together daily throughout the project." },
  { title: "Motivated Individuals", description: "Build projects around motivated individuals. Give them the environment and support they need, and trust them to get the job done." },
  { title: "Face-to-Face Communication", description: "The most efficient and effective method of conveying information is face-to-face conversation." },
  { title: "Working Software", description: "Working software is the primary measure of progress." },
  { title: "Sustainable Development", description: "Agile processes promote sustainable development. The sponsors, developers, and users should be able to maintain a constant pace indefinitely." },
  { title: "Technical Excellence", description: "Continuous attention to technical excellence and good design enhances agility." },
  { title: "Simplicity", description: "Simplicity—the art of maximizing the amount of work not done—is essential." },
  { title: "Self-Organizing Teams", description: "The best architectures, requirements, and designs emerge from self-organizing teams." },
  { title: "Reflect and Adjust", description: "At regular intervals, the team reflects on how to become more effective, then tunes and adjusts its behavior accordingly." },
];

const productManagementPrinciples = [
  { title: "Customer-Centric Development", description: "All product decisions should be grounded in deep customer understanding. Use customer research, feedback, and data to validate assumptions and guide development priorities." },
  { title: "Outcome Over Output", description: "Focus on achieving meaningful outcomes (customer value, business results) rather than just shipping features. Measure success by impact, not velocity." },
  { title: "Continuous Discovery", description: "Product discovery is an ongoing process. Continuously explore customer problems, validate solutions, and reduce risk before committing to full development." },
  { title: "Cross-Functional Collaboration", description: "Great products are built by empowered, cross-functional teams including product, design, engineering, and business stakeholders working together." },
  { title: "Data-Informed Decisions", description: "Use quantitative metrics alongside qualitative insights to make decisions. Define clear success metrics (North Star) and track leading indicators." },
  { title: "Iterate and Learn", description: "Embrace experimentation and rapid iteration. Learn quickly from failures, validate hypotheses, and adapt based on evidence." },
  { title: "Strategic Alignment", description: "Product work must align with company vision and strategy. Ensure every initiative connects to broader business objectives and creates strategic value." },
];

// ITIL 4 / industry-standard Change Enablement principles
const changeManagementPrinciples = [
  { title: "Focus on Value (ITIL 4)", description: "Every change must be assessed against the value it delivers to customers, users and the business. Reject or rework changes that cannot articulate a clear benefit." },
  { title: "Start Where You Are", description: "Reuse existing tooling, processes and CAB structures wherever possible. Don't replace what works — instrument and improve it incrementally." },
  { title: "Progress Iteratively With Feedback", description: "Break large transformations into small, reversible changes. Each release feeds back into risk scoring, success-rate metrics and CAB decisions." },
  { title: "Collaborate and Promote Visibility", description: "Changes touch many teams. Maintain a transparent forward-schedule of change (FSC), publish CAB outcomes, and make blackout windows visible to everyone." },
  { title: "Risk-Based Authorisation", description: "Standard, Normal and Emergency changes have different approval paths. Pre-authorise low-risk standard changes; route high-impact ones to CAB or ECAB." },
  { title: "Plan for Reversal", description: "No change is approved without a tested rollback plan. Document recovery time objective (RTO) and the criteria that trigger a rollback." },
  { title: "Separation of Duties", description: "The requester, implementer, approver and verifier should not be the same person. Enforce this in workflow to satisfy audit (SOX, ISO 20000, ISO 27001)." },
  { title: "Post-Implementation Review (PIR)", description: "Every significant or failed change is reviewed for outcome, lessons and CMDB accuracy. Feed findings back into the standard-change catalog." },
  { title: "Measure and Improve", description: "Track change success rate, lead time to authorise, % emergency changes, and incidents caused by change. Use trends to drive continual improvement." },
];

// ITIL 4 / HDI / ISO 20000 service-management principles for the helpdesk
const helpdeskPrinciples = [
  { title: "Single Point of Contact (SPOC)", description: "The service desk is the one channel users contact for incidents, requests, questions and problems — across web portal, email, chat and phone." },
  { title: "Shift-Left & Self-Service", description: "Resolve as many issues as possible at the lowest tier. Surface knowledge-base articles in the ticket form, deflect via portal, and only escalate when needed." },
  { title: "Categorise Tickets by Type", description: "Use standard ITIL types — Incident (unplanned outage), Service Request (something new), Problem (root cause behind incidents), and Question — each with its own SLA." },
  { title: "SLA & OLA Discipline", description: "Set explicit response and resolution targets per priority and ticket type. Pause the clock on customer-pending states. Track breach trends and at-risk tickets." },
  { title: "Priority = Impact × Urgency", description: "Use a 4×4 priority matrix. P1 outages bypass standard queueing; low-impact requests follow normal flow. Re-prioritise as new information arrives." },
  { title: "Incident vs Problem vs Change", description: "Restore service first (Incident), find the root cause separately (Problem), and only then raise a controlled fix (Change). Never blur the three workflows." },
  { title: "Knowledge-Centred Service (KCS)", description: "Every resolved ticket is a knowledge candidate. Capture the fix in the KB at point of resolution, link it back, and reuse it on future tickets." },
  { title: "Customer Satisfaction (CSAT)", description: "Survey at resolution. A ticket isn't truly closed until the customer confirms — and CSAT trends drive coaching, staffing and process changes." },
  { title: "Continual Service Improvement", description: "Review MTTR, first-contact resolution, backlog age, top categories and CSAT every cycle. Convert recurring incidents into Problems and standard requests into the catalog." },
  { title: "Audit Trail & Accountability", description: "Every state change, comment, attachment, escalation and SLA pause is logged with actor and timestamp — required for ISO 20000, SOC 2 and internal audit." },
];

interface Template {
  name: string;
  category: string;
  type: string;
  content: string;
}

const templates: Template[] = [
  { 
    name: "Program Mandate Template", 
    category: "MSP", 
    type: "Template",
    content: `# Program Mandate

## 1. Program Background
[Describe the strategic context and drivers for this program]

## 2. Program Objectives
- Objective 1: [Description]
- Objective 2: [Description]
- Objective 3: [Description]

## 3. Scope Overview
### In Scope:
- [Item 1]
- [Item 2]

### Out of Scope:
- [Item 1]
- [Item 2]

## 4. Expected Benefits
| Benefit | Measurement | Target |
|---------|-------------|--------|
| [Benefit 1] | [How measured] | [Target value] |
| [Benefit 2] | [How measured] | [Target value] |

## 5. Key Stakeholders
- Sponsor: [Name]
- Program Manager: [Name]
- Key Stakeholders: [List]

## 6. Initial Estimates
- Timeline: [Duration]
- Budget: [Estimate]
- Resources: [High-level requirements]

## 7. Constraints and Dependencies
[List known constraints and dependencies]

## 8. Risks and Issues
[Initial high-level risks]

## 9. Approval
| Role | Name | Signature | Date |
|------|------|-----------|------|
| Sponsor | | | |
| Program Board | | | |`
  },
  { 
    name: "Project Brief Template", 
    category: "PRINCE2", 
    type: "Template",
    content: `# Project Brief

## 1. Project Definition
### 1.1 Background
[Provide context for the project]

### 1.2 Project Objectives
[SMART objectives for the project]

### 1.3 Desired Outcomes
[What success looks like]

## 2. Business Case Summary
### 2.1 Reasons
[Why this project is needed]

### 2.2 Expected Benefits
[List of benefits with measurement criteria]

### 2.3 Expected Dis-benefits
[Any negative consequences]

### 2.4 Costs
[High-level cost estimates]

## 3. Project Product Description
### 3.1 Purpose
[What the project will deliver]

### 3.2 Composition
[Major deliverables]

### 3.3 Quality Expectations
[Quality criteria and standards]

## 4. Project Approach
[How the project will be delivered]

## 5. Project Management Team Structure
[Roles and responsibilities]

## 6. Role Descriptions
- Executive: [Name and responsibilities]
- Senior User: [Name and responsibilities]
- Senior Supplier: [Name and responsibilities]
- Project Manager: [Name and responsibilities]

## 7. Constraints
[Time, cost, scope, quality constraints]

## 8. Tolerances
[Agreed tolerances for time, cost, scope]

## 9. Dependencies
[Internal and external dependencies]

## 10. Risks
[Initial risk assessment]`
  },
  { 
    name: "Business Case Template", 
    category: "PRINCE2", 
    type: "Template",
    content: `# Business Case

## Executive Summary
[Brief overview of the business case]

## 1. Reasons
### 1.1 Strategic Fit
[How this aligns with organizational strategy]

### 1.2 Drivers
[What is driving this investment]

## 2. Business Options
### Option 1: Do Nothing
- Pros:
- Cons:
- Cost:

### Option 2: Do Minimum
- Pros:
- Cons:
- Cost:

### Option 3: Recommended Option
- Pros:
- Cons:
- Cost:

## 3. Expected Benefits
| Benefit | Owner | Measurement | Baseline | Target | Timeframe |
|---------|-------|-------------|----------|--------|-----------|
| | | | | | |

## 4. Expected Dis-benefits
| Dis-benefit | Impact | Mitigation |
|-------------|--------|------------|
| | | |

## 5. Timescales
- Start Date:
- End Date:
- Key Milestones:

## 6. Costs
### Development Costs
| Item | Cost |
|------|------|
| | |

### Ongoing Costs
| Item | Annual Cost |
|------|-------------|
| | |

## 7. Investment Appraisal
- NPV:
- ROI:
- Payback Period:

## 8. Major Risks
| Risk | Probability | Impact | Response |
|------|-------------|--------|----------|
| | | | |

## 9. Recommendation
[Clear recommendation with justification]`
  },
  { 
    name: "Risk Register Template", 
    category: "PRINCE2", 
    type: "Template",
    content: `# Risk Register

## Project/Program: [Name]
## Last Updated: [Date]

| ID | Risk Description | Category | Probability | Impact | Score | Owner | Response Strategy | Response Actions | Status | Date Identified | Review Date |
|----|------------------|----------|-------------|--------|-------|-------|-------------------|------------------|--------|-----------------|-------------|
| R001 | [Description] | [Category] | [H/M/L] | [H/M/L] | [1-25] | [Name] | [Avoid/Reduce/Transfer/Accept] | [Actions] | [Open/Closed] | [Date] | [Date] |
| R002 | | | | | | | | | | | |
| R003 | | | | | | | | | | | |

## Probability Scale
- High (H): >70% likely to occur
- Medium (M): 30-70% likely to occur  
- Low (L): <30% likely to occur

## Impact Scale
- High (H): Significant impact on objectives
- Medium (M): Moderate impact on objectives
- Low (L): Minor impact on objectives

## Risk Score Matrix
|              | Low Impact | Medium Impact | High Impact |
|--------------|------------|---------------|-------------|
| High Prob    | 6          | 12            | 18          |
| Medium Prob  | 4          | 8             | 12          |
| Low Prob     | 2          | 4             | 6           |`
  },
  { 
    name: "Sprint Planning Guide", 
    category: "Agile", 
    type: "Guide",
    content: `# Sprint Planning Guide

## Purpose
Sprint Planning establishes the work to be performed during the Sprint. The entire Scrum Team collaborates to create this plan.

## Preparation (Before Sprint Planning)
1. Product Backlog is refined and prioritized
2. Team capacity is calculated
3. Previous Sprint velocity is reviewed
4. Definition of Done is confirmed

## Sprint Planning Agenda

### Part 1: What can be done this Sprint? (2 hours for 2-week sprint)
1. Product Owner presents top priority items
2. Team asks clarifying questions
3. Sprint Goal is defined
4. Team selects items they can complete

### Part 2: How will the work get done? (2 hours for 2-week sprint)
1. Break down user stories into tasks
2. Estimate tasks (hours)
3. Identify dependencies
4. Confirm Sprint Backlog

## Outputs
- Sprint Goal
- Sprint Backlog
- Plan for delivering the Increment

## Best Practices
- Keep timeboxed (max 8 hours for 1-month sprint)
- Whole team participates
- Focus on collaboration, not estimation debates
- Leave buffer for unexpected work (typically 20%)

## Capacity Calculation
Team Capacity = (Number of team members) × (Available days) × (Focus factor)

Example:
- 5 team members
- 10 working days
- 80% focus factor
- Capacity = 5 × 10 × 0.8 = 40 person-days`
  },
  { 
    name: "User Story Template", 
    category: "Agile", 
    type: "Template",
    content: `# User Story Template

## User Story
**As a** [type of user]
**I want** [goal/desire]
**So that** [benefit/value]

## Story ID: [US-XXX]
## Epic: [Parent Epic]
## Priority: [High/Medium/Low]
## Story Points: [Estimate]

## Acceptance Criteria
Given [context/precondition]
When [action/trigger]
Then [expected outcome]

### Criteria 1:
- Given:
- When:
- Then:

### Criteria 2:
- Given:
- When:
- Then:

## Definition of Done
- [ ] Code complete and reviewed
- [ ] Unit tests written and passing
- [ ] Integration tests passing
- [ ] Documentation updated
- [ ] Deployed to staging
- [ ] Product Owner acceptance

## Technical Notes
[Any technical considerations or implementation notes]

## Dependencies
[List any dependencies on other stories or external factors]

## Attachments
[Links to mockups, designs, or other relevant documents]`
  },
  { 
    name: "Product Vision Canvas", 
    category: "Product", 
    type: "Template",
    content: `# Product Vision Canvas

## Vision Statement
[One sentence describing the ultimate purpose and inspiration for the product]

## Target Customer
### Primary Persona
- Name:
- Role:
- Goals:
- Pain Points:

### Secondary Persona
- Name:
- Role:
- Goals:
- Pain Points:

## Customer Needs
| Need | Importance | Current Solution | Gap |
|------|------------|------------------|-----|
| | | | |

## Product Overview
### Key Features
1. [Feature 1]
2. [Feature 2]
3. [Feature 3]

### Unique Value Proposition
[What makes this product uniquely valuable]

## Business Goals
| Goal | Metric | Target | Timeline |
|------|--------|--------|----------|
| | | | |

## Success Metrics (North Star)
- Primary Metric:
- Supporting Metrics:
  1.
  2.
  3.

## Competitive Landscape
| Competitor | Strengths | Weaknesses | Our Differentiation |
|------------|-----------|------------|---------------------|
| | | | |

## Key Assumptions to Validate
1. [Assumption 1] - Validation method:
2. [Assumption 2] - Validation method:
3. [Assumption 3] - Validation method:

## Risks
| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| | | | |`
  },
  { 
    name: "RICE Prioritization Worksheet", 
    category: "Product", 
    type: "Template",
    content: `# RICE Prioritization Worksheet

## RICE Scoring Formula
**RICE Score = (Reach × Impact × Confidence) / Effort**

## Scoring Guide

### Reach (Number of users/customers impacted per quarter)
- Estimate the number of people this will affect in a defined time period
- Use actual data where possible

### Impact (Scale: 0.25, 0.5, 1, 2, 3)
- 3 = Massive impact
- 2 = High impact
- 1 = Medium impact
- 0.5 = Low impact
- 0.25 = Minimal impact

### Confidence (Percentage: 100%, 80%, 50%)
- 100% = High confidence (strong data)
- 80% = Medium confidence (some data)
- 50% = Low confidence (gut feel)

### Effort (Person-months)
- Estimate the total time required from all team members

## Prioritization Matrix

| Feature | Reach | Impact | Confidence | Effort | RICE Score | Priority |
|---------|-------|--------|------------|--------|------------|----------|
| [Feature 1] | | | | | | |
| [Feature 2] | | | | | | |
| [Feature 3] | | | | | | |
| [Feature 4] | | | | | | |
| [Feature 5] | | | | | | |

## Example Calculation
Feature: Onboarding Redesign
- Reach: 5000 new users/quarter
- Impact: 2 (High)
- Confidence: 80%
- Effort: 2 person-months

RICE Score = (5000 × 2 × 0.8) / 2 = 4000

## Notes
[Additional context or decision rationale]`
  },
  { 
    name: "Lessons Learned Log", 
    category: "PRINCE2", 
    type: "Template",
    content: `# Lessons Learned Log

## Project/Program: [Name]
## Date: [Date]

| ID | Date | Category | What Happened | Root Cause | Lesson | Recommendation | Applicable To | Priority | Status |
|----|------|----------|---------------|------------|--------|----------------|---------------|----------|--------|
| LL001 | | [Process/Technical/People/Tools] | [Description] | [Why it happened] | [What we learned] | [Suggested action] | [Future projects] | [H/M/L] | [Identified/Actioned/Closed] |
| LL002 | | | | | | | | | |
| LL003 | | | | | | | | | |

## Categories
- **Process**: Project management, governance, planning
- **Technical**: Technology, tools, systems
- **People**: Communication, skills, team dynamics
- **Tools**: Software, equipment, resources

## Review Process
1. Lessons captured throughout project lifecycle
2. Review in Stage Gate meetings
3. Validate and prioritize in retrospectives
4. Share with PMO for organizational learning
5. Apply to future projects

## Distribution
- Project Team
- Program Board
- PMO
- Other relevant stakeholders`
  },
  { 
    name: "Definition of Done Checklist", 
    category: "Agile", 
    type: "Checklist",
    content: `# Definition of Done Checklist

## Code Quality
- [ ] Code has been written and follows coding standards
- [ ] Code has been peer reviewed
- [ ] No critical or high-severity code smells
- [ ] Technical debt has been documented (if any created)

## Testing
- [ ] Unit tests written with >80% coverage
- [ ] Unit tests passing
- [ ] Integration tests written and passing
- [ ] End-to-end tests passing (where applicable)
- [ ] Performance testing completed (where applicable)
- [ ] Security testing completed (where applicable)

## Documentation
- [ ] Technical documentation updated
- [ ] API documentation updated (if applicable)
- [ ] User-facing documentation updated
- [ ] Release notes drafted

## Deployment
- [ ] Feature deployed to staging environment
- [ ] Staging environment testing completed
- [ ] Feature flags configured (if applicable)
- [ ] Rollback plan documented

## Acceptance
- [ ] Acceptance criteria verified
- [ ] Product Owner has accepted the work
- [ ] Demo completed to stakeholders
- [ ] No critical bugs outstanding

## Accessibility & UX
- [ ] Meets accessibility standards (WCAG 2.1 AA)
- [ ] Responsive design verified
- [ ] Cross-browser testing completed
- [ ] UX review completed

## Metrics & Monitoring
- [ ] Analytics tracking implemented
- [ ] Monitoring/alerting configured
- [ ] Key metrics baseline established

---
**Story ID:** [US-XXX]
**Completed By:** [Name]
**Date:** [Date]
**Verified By:** [Name]`
  },
];

const prince2Processes = [
  {
    code: "SU",
    name: "Starting Up a Project",
    purpose: "Ensure prerequisites for initiating the project are in place",
    activities: [
      "Appoint the Executive and Project Manager",
      "Capture previous lessons",
      "Design and appoint the Project Management Team",
      "Prepare the outline Business Case",
      "Select the project approach and assemble the Project Brief",
      "Plan the Initiation Stage"
    ],
    products: ["Project Brief", "Initiation Stage Plan", "Project Product Description"]
  },
  {
    code: "DP",
    name: "Directing a Project",
    purpose: "Enable the Project Board to exercise overall control while delegating day-to-day management",
    activities: [
      "Authorize initiation",
      "Authorize the project",
      "Authorize a Stage or Exception Plan",
      "Give ad hoc direction",
      "Authorize project closure"
    ],
    products: ["Project authorization", "Stage/Exception authorization", "Project closure authorization"]
  },
  {
    code: "IP",
    name: "Initiating a Project",
    purpose: "Establish solid foundations for the project to achieve its objectives",
    activities: [
      "Prepare the Risk Management Strategy",
      "Prepare the Configuration Management Strategy",
      "Prepare the Quality Management Strategy",
      "Prepare the Communication Management Strategy",
      "Set up the project controls",
      "Create the Project Plan",
      "Refine the Business Case",
      "Assemble the Project Initiation Documentation"
    ],
    products: ["Project Initiation Documentation (PID)", "Benefits Management Approach", "Project Plan"]
  },
  {
    code: "CS",
    name: "Controlling a Stage",
    purpose: "Assign work, monitor progress, deal with issues, report to Project Board",
    activities: [
      "Authorize a Work Package",
      "Review Work Package status",
      "Receive completed Work Packages",
      "Review the Stage status",
      "Report highlights",
      "Capture and examine issues and risks",
      "Escalate issues and risks",
      "Take corrective action"
    ],
    products: ["Work Packages", "Highlight Reports", "Issue Register updates", "Risk Register updates"]
  },
  {
    code: "MP",
    name: "Managing Product Delivery",
    purpose: "Control link between Project Manager and Team Manager(s)",
    activities: [
      "Accept a Work Package",
      "Execute a Work Package",
      "Deliver a Work Package"
    ],
    products: ["Team Plans", "Quality Register entries", "Completed products"]
  },
  {
    code: "SB",
    name: "Managing a Stage Boundary",
    purpose: "Provide Project Board with information to review stage success and authorize next stage",
    activities: [
      "Plan the next stage",
      "Update the Project Plan",
      "Update the Business Case",
      "Report stage end",
      "Produce an Exception Plan (if required)"
    ],
    products: ["Stage Plan", "Updated Project Plan", "End Stage Report", "Exception Plan (if needed)"]
  },
  {
    code: "CP",
    name: "Closing a Project",
    purpose: "Provide a fixed point to confirm acceptance and recognize objectives have been achieved",
    activities: [
      "Prepare planned closure",
      "Prepare premature closure",
      "Hand over products",
      "Evaluate the project",
      "Recommend project closure"
    ],
    products: ["End Project Report", "Lessons Report", "Benefits Management Approach (updated)"]
  },
];

const mspPhases = [
  {
    name: "Identifying a Program",
    purpose: "Confirm there is a viable programme worth pursuing",
    activities: [
      "Understand strategic objectives",
      "Identify candidate programmes",
      "Develop initial vision",
      "Create Program Mandate"
    ],
    outputs: ["Program Mandate", "Strategic alignment confirmation"]
  },
  {
    name: "Defining a Program",
    purpose: "Develop the program to the point where it can be approved",
    activities: [
      "Develop the Vision Statement",
      "Create the Blueprint",
      "Identify benefits and design Benefits Realization",
      "Design the program organization",
      "Plan the tranches",
      "Develop the Business Case"
    ],
    outputs: ["Program Brief", "Vision Statement", "Blueprint", "Benefits Map", "Stakeholder Engagement Strategy"]
  },
  {
    name: "Managing the Tranches",
    purpose: "Coordinate and control delivery across multiple projects",
    activities: [
      "Start projects according to programme plan",
      "Monitor and control project delivery",
      "Manage dependencies between projects",
      "Review and update programme governance",
      "Manage stakeholder engagement"
    ],
    outputs: ["Tranche Reviews", "Updated Program Plan", "Issue and Risk updates"]
  },
  {
    name: "Delivering the Capability",
    purpose: "Ensure the outputs from projects deliver the intended capabilities",
    activities: [
      "Transition project outputs to operational use",
      "Manage organizational change",
      "Support capability embedding",
      "Track capability delivery"
    ],
    outputs: ["Capability Delivery Reports", "Transition Plans", "Change readiness assessments"]
  },
  {
    name: "Realizing the Benefits",
    purpose: "Ensure the intended benefits are achieved",
    activities: [
      "Track benefit realization",
      "Measure and report on benefits",
      "Identify new or emerging benefits",
      "Update Benefits Register"
    ],
    outputs: ["Benefits Realization Reports", "Updated Benefits Register", "Benefits Review reports"]
  },
  {
    name: "Closing a Program",
    purpose: "Confirm the program has achieved its objectives and can close",
    activities: [
      "Confirm benefits realization plan handover",
      "Close remaining projects",
      "Capture and transfer lessons",
      "Disband programme organization",
      "Celebrate success"
    ],
    outputs: ["Program Closure Report", "Lessons Learned Report", "Benefits handover documentation"]
  },
];

export default function Documentation() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProcess, setSelectedProcess] = useState<typeof prince2Processes[0] | null>(null);
  const [selectedPhase, setSelectedPhase] = useState<typeof mspPhases[0] | null>(null);

  return (
    <AppLayout title="Documentation" subtitle="Platform features, PRINCE2, MSP, Agile & Product Management">
      {/* Search */}
      <div className="flex gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search features, principles or processes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <Tabs defaultValue="features" className="space-y-6">
        <TabsList className="bg-secondary">
          <TabsTrigger value="features">Platform Features</TabsTrigger>
          <TabsTrigger value="principles">Principles</TabsTrigger>
          <TabsTrigger value="processes">Processes</TabsTrigger>
        </TabsList>

        <TabsContent value="features" className="space-y-6">
          <div className="metric-card">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">Platform Feature Reference</h3>
                <p className="text-sm text-muted-foreground">
                  Every shipped capability across AI, Governance, Security, Billing and Delivery.
                </p>
              </div>
            </div>
          </div>

          {platformFeatureGroups
            .filter((g) => {
              if (!searchQuery.trim()) return true;
              const q = searchQuery.toLowerCase();
              return (
                g.group.toLowerCase().includes(q) ||
                g.features.some(
                  (f) =>
                    f.name.toLowerCase().includes(q) ||
                    f.summary.toLowerCase().includes(q) ||
                    f.capabilities.some((c) => c.toLowerCase().includes(q)),
                )
              );
            })
            .map((group) => {
              const GroupIcon = group.icon;
              return (
                <div key={group.group} className="metric-card">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <GroupIcon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold">{group.group}</h3>
                      <p className="text-sm text-muted-foreground">
                        {group.features.length} feature{group.features.length === 1 ? "" : "s"}
                      </p>
                    </div>
                  </div>
                  <Accordion type="single" collapsible className="w-full">
                    {group.features.map((feature, idx) => {
                      const FeatureIcon = feature.icon;
                      return (
                        <AccordionItem key={idx} value={`${group.group}-${idx}`}>
                          <AccordionTrigger className="text-sm text-left">
                            <div className="flex items-center gap-2">
                              <FeatureIcon className="h-4 w-4 text-muted-foreground" />
                              <span>{feature.name}</span>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="space-y-3">
                            <p className="text-sm text-muted-foreground">{feature.summary}</p>
                            <div>
                              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">
                                Capabilities
                              </p>
                              <ul className="space-y-1">
                                {feature.capabilities.map((cap, ci) => (
                                  <li
                                    key={ci}
                                    className="flex items-start gap-2 text-sm text-muted-foreground"
                                  >
                                    <span className="text-primary mt-1">•</span>
                                    {cap}
                                  </li>
                                ))}
                              </ul>
                            </div>
                            {feature.permission && feature.permission !== "platform-default" && (
                              <div className="flex items-center gap-2 pt-1">
                                <Shield className="h-3.5 w-3.5 text-muted-foreground" />
                                <span className="text-xs text-muted-foreground">
                                  Requires permission:{" "}
                                  <code className="rounded bg-muted px-1 py-0.5 text-xs">
                                    {feature.permission}
                                  </code>
                                </span>
                              </div>
                            )}
                          </AccordionContent>
                        </AccordionItem>
                      );
                    })}
                  </Accordion>
                </div>
              );
            })}
        </TabsContent>

        <TabsContent value="principles" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
            {/* PRINCE2 Principles */}
            <div className="metric-card">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <BookOpen className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold">PRINCE2 Principles</h3>
                  <p className="text-sm text-muted-foreground">Project Management</p>
                </div>
              </div>
              <Accordion type="single" collapsible className="w-full">
                {prince2Principles.map((principle, index) => (
                  <AccordionItem key={index} value={`prince2-${index}`}>
                    <AccordionTrigger className="text-sm text-left">
                      {principle.title}
                    </AccordionTrigger>
                    <AccordionContent className="text-sm text-muted-foreground">
                      {principle.description}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>

            {/* MSP Principles */}
            <div className="metric-card">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
                  <BookOpen className="h-5 w-5 text-success" />
                </div>
                <div>
                  <h3 className="font-semibold">MSP Principles</h3>
                  <p className="text-sm text-muted-foreground">Program Management</p>
                </div>
              </div>
              <Accordion type="single" collapsible className="w-full">
                {mspPrinciples.map((principle, index) => (
                  <AccordionItem key={index} value={`msp-${index}`}>
                    <AccordionTrigger className="text-sm text-left">
                      {principle.title}
                    </AccordionTrigger>
                    <AccordionContent className="text-sm text-muted-foreground">
                      {principle.description}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>

            {/* Agile Principles */}
            <div className="metric-card">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-info/10">
                  <BookOpen className="h-5 w-5 text-info" />
                </div>
                <div>
                  <h3 className="font-semibold">Agile Principles</h3>
                  <p className="text-sm text-muted-foreground">Agile Manifesto</p>
                </div>
              </div>
              <Accordion type="single" collapsible className="w-full">
                {agilePrinciples.map((principle, index) => (
                  <AccordionItem key={index} value={`agile-${index}`}>
                    <AccordionTrigger className="text-sm text-left">
                      {principle.title}
                    </AccordionTrigger>
                    <AccordionContent className="text-sm text-muted-foreground">
                      {principle.description}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>

            {/* Product Management Principles */}
            <div className="metric-card">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/10">
                  <BookOpen className="h-5 w-5 text-warning" />
                </div>
                <div>
                  <h3 className="font-semibold">Product Management</h3>
                  <p className="text-sm text-muted-foreground">Best Practices</p>
                </div>
              </div>
              <Accordion type="single" collapsible className="w-full">
                {productManagementPrinciples.map((principle, index) => (
                  <AccordionItem key={index} value={`pm-${index}`}>
                    <AccordionTrigger className="text-sm text-left">
                      {principle.title}
                    </AccordionTrigger>
                    <AccordionContent className="text-sm text-muted-foreground">
                      {principle.description}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>

            {/* Change Management Principles (ITIL 4 Change Enablement) */}
            <div className="metric-card">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10">
                  <GitMerge className="h-5 w-5 text-destructive" />
                </div>
                <div>
                  <h3 className="font-semibold">Change Management</h3>
                  <p className="text-sm text-muted-foreground">ITIL 4 · ISO 20000 · ISO 27001</p>
                </div>
              </div>
              <Accordion type="single" collapsible className="w-full">
                {changeManagementPrinciples.map((principle, index) => (
                  <AccordionItem key={index} value={`cm-${index}`}>
                    <AccordionTrigger className="text-sm text-left">
                      {principle.title}
                    </AccordionTrigger>
                    <AccordionContent className="text-sm text-muted-foreground">
                      {principle.description}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>

            {/* Helpdesk / Service Management Principles (ITIL 4 + HDI) */}
            <div className="metric-card">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-info/10">
                  <Megaphone className="h-5 w-5 text-info" />
                </div>
                <div>
                  <h3 className="font-semibold">Helpdesk &amp; Service Mgmt</h3>
                  <p className="text-sm text-muted-foreground">ITIL 4 · HDI · KCS</p>
                </div>
              </div>
              <Accordion type="single" collapsible className="w-full">
                {helpdeskPrinciples.map((principle, index) => (
                  <AccordionItem key={index} value={`hd-${index}`}>
                    <AccordionTrigger className="text-sm text-left">
                      {principle.title}
                    </AccordionTrigger>
                    <AccordionContent className="text-sm text-muted-foreground">
                      {principle.description}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          </div>
        </TabsContent>




        <TabsContent value="processes">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* PRINCE2 Processes */}
            <div className="metric-card">
              <h3 className="font-semibold mb-4">PRINCE2 Processes</h3>
              <div className="space-y-3">
                {prince2Processes.map((process, index) => (
                  <div 
                    key={index} 
                    className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors cursor-pointer"
                    onClick={() => setSelectedProcess(process)}
                  >
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="font-mono">{process.code}</Badge>
                      <span className="text-sm">{process.name}</span>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                ))}
              </div>
            </div>

            {/* MSP Transformational Flow */}
            <div className="metric-card">
              <h3 className="font-semibold mb-4">MSP Transformational Flow</h3>
              <div className="space-y-3">
                {mspPhases.map((phase, index) => (
                  <div 
                    key={index} 
                    className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors cursor-pointer"
                    onClick={() => setSelectedPhase(phase)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-success/10 text-success text-xs font-medium">
                        {index + 1}
                      </div>
                      <span className="text-sm">{phase.name}</span>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Process Detail Dialog */}
          <Dialog open={!!selectedProcess} onOpenChange={() => setSelectedProcess(null)}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Badge variant="outline" className="font-mono">{selectedProcess?.code}</Badge>
                  {selectedProcess?.name}
                </DialogTitle>
                <DialogDescription>
                  {selectedProcess?.purpose}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">Key Activities</h4>
                  <ul className="space-y-1">
                    {selectedProcess?.activities.map((activity, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <span className="text-primary mt-1">•</span>
                        {activity}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Key Products/Outputs</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedProcess?.products.map((product, i) => (
                      <Badge key={i} variant="secondary">{product}</Badge>
                    ))}
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Phase Detail Dialog */}
          <Dialog open={!!selectedPhase} onOpenChange={() => setSelectedPhase(null)}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>{selectedPhase?.name}</DialogTitle>
                <DialogDescription>
                  {selectedPhase?.purpose}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">Key Activities</h4>
                  <ul className="space-y-1">
                    {selectedPhase?.activities.map((activity, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <span className="text-success mt-1">•</span>
                        {activity}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Key Outputs</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedPhase?.outputs.map((output, i) => (
                      <Badge key={i} variant="secondary">{output}</Badge>
                    ))}
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}