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
  | "definition_of_done"
  | "issue_register"
  | "benefit_definition"
  | "stakeholder_engagement"
  | "change_request_form"
  | "sprint_retro"
  | "compliance_health_check"
  // Construction & Engineering templates
  | "con_rfi_form"
  | "con_submittal_form"
  | "con_daily_log_form"
  | "con_punch_item_form"
  | "con_change_order_form"
  | "con_permit_to_work_form"
  | "con_toolbox_talk_form"
  | "con_ncr_form"
  | "con_handover_checklist"
  // Construction: Bid / RFP / Pursuit Lifecycle
  | "con_opportunity_form"
  | "con_rfp_intake_form"
  | "con_bid_no_bid_form"
  | "con_pqq_form"
  | "con_bid_form"
  | "con_award_form"
  | "con_winloss_form"
  | "con_lifecycle_phase_form"
  | "con_precon_item_form"
  // Professional Services & Consulting templates
  | "ps_engagement_setup"
  | "ps_sow_form"
  | "ps_msa_summary"
  | "ps_change_order_form"
  | "ps_deliverable_form"
  | "ps_retainer_setup"
  | "ps_timesheet_entry"
  | "ps_csat_capture"
  | "ps_bid_no_bid";

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

const getWizardSteps = (templateType: TemplateType, orgs: Organization[], programmes: any[], projects: any[], products: any[]): WizardStep[] => {
  const orgField: WizardField = {
    key: "organization_id",
    label: "Organization",
    type: "select",
    placeholder: "Select organization",
    helpText: "Which organization does this belong to?",
    options: orgs.map(o => ({ value: o.id, label: o.name })),
  };

  const entityParentFields = (includeProduct = false): WizardField[] => {
    const fields: WizardField[] = [
      { key: "programme_id", label: "Programme", type: "select", placeholder: "Optional", options: programmes.map(p => ({ value: p.id, label: p.name })) },
      { key: "project_id", label: "Project", type: "select", placeholder: "Optional", options: projects.map(p => ({ value: p.id, label: p.name })) },
    ];
    if (includeProduct) {
      fields.push({ key: "product_id", label: "Product", type: "select", placeholder: "Optional", options: products.map(p => ({ value: p.id, label: p.name })) });
    }
    return fields;
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

    case "risk_register":
      return [
        {
          title: "Risk Identification",
          description: "Describe the risk and its context.",
          fields: [
            orgField,
            { key: "title", label: "Risk Title", type: "text", placeholder: "e.g. Key supplier bankruptcy", required: true, helpText: "A short, clear description of the risk event" },
            { key: "description", label: "Risk Description", type: "textarea", placeholder: "Describe the risk in detail — what could happen and why...", helpText: "Include the cause, event, and effect", fullWidth: true },
            { key: "category", label: "Category", type: "select", options: [
              { value: "strategic", label: "Strategic" },
              { value: "operational", label: "Operational" },
              { value: "financial", label: "Financial" },
              { value: "technical", label: "Technical" },
              { value: "organizational", label: "Organizational" },
              { value: "external", label: "External" },
            ]},
          ],
        },
        {
          title: "Assessment",
          description: "Evaluate the probability and impact.",
          fields: [
            { key: "probability", label: "Probability", type: "select", required: true, options: [
              { value: "very_low", label: "Very Low (<10%)" },
              { value: "low", label: "Low (10-30%)" },
              { value: "medium", label: "Medium (30-60%)" },
              { value: "high", label: "High (60-85%)" },
              { value: "very_high", label: "Very High (>85%)" },
            ]},
            { key: "impact", label: "Impact", type: "select", required: true, options: [
              { value: "very_low", label: "Very Low — Negligible" },
              { value: "low", label: "Low — Minor disruption" },
              { value: "medium", label: "Medium — Significant impact" },
              { value: "high", label: "High — Major impact" },
              { value: "very_high", label: "Very High — Catastrophic" },
            ]},
            { key: "date_identified", label: "Date Identified", type: "date" },
            { key: "review_date", label: "Next Review Date", type: "date" },
          ],
        },
        {
          title: "Response & Ownership",
          description: "Plan how to handle this risk.",
          fields: [
            { key: "response", label: "Response Strategy", type: "textarea", placeholder: "Describe the planned response: Avoid, Reduce, Transfer, Accept, or Share...", helpText: "Include specific actions and triggers", fullWidth: true },
            ...entityParentFields(true),
          ],
        },
      ];

    case "lessons_learned":
      return [
        {
          title: "Lesson Overview",
          description: "What happened and what did we learn?",
          fields: [
            orgField,
            { key: "title", label: "Lesson Title", type: "text", placeholder: "e.g. Early stakeholder engagement reduced rework", required: true },
            { key: "lesson_type", label: "Type", type: "select", options: [
              { value: "recommendation", label: "Recommendation" },
              { value: "success", label: "Success" },
              { value: "problem", label: "Problem" },
              { value: "observation", label: "Observation" },
            ]},
            { key: "category", label: "Category", type: "select", options: [
              { value: "process", label: "Process" },
              { value: "people", label: "People" },
              { value: "technology", label: "Technology" },
              { value: "communication", label: "Communication" },
              { value: "planning", label: "Planning" },
              { value: "risk_management", label: "Risk Management" },
            ]},
          ],
        },
        {
          title: "What Happened",
          description: "Describe the event and its context.",
          fields: [
            { key: "what_happened", label: "What Happened", type: "textarea", placeholder: "Describe the event or situation...", fullWidth: true },
            { key: "root_cause", label: "Root Cause", type: "textarea", placeholder: "What was the underlying cause?", fullWidth: true },
            { key: "outcome", label: "Outcome", type: "textarea", placeholder: "What was the actual result?", fullWidth: true },
          ],
        },
        {
          title: "Recommendations",
          description: "How should this lesson be applied in the future?",
          fields: [
            { key: "recommendation", label: "Recommendation", type: "textarea", placeholder: "What should be done differently next time?", fullWidth: true },
            { key: "action_taken", label: "Action Taken", type: "textarea", placeholder: "What actions have already been taken?", fullWidth: true },
            { key: "priority", label: "Priority", type: "select", options: [
              { value: "high", label: "High" },
              { value: "medium", label: "Medium" },
              { value: "low", label: "Low" },
            ]},
            { key: "event_date", label: "Event Date", type: "date" },
            ...entityParentFields(true),
          ],
        },
      ];

    case "sprint_planning":
      return [
        {
          title: "Sprint Setup",
          description: "Define the sprint parameters.",
          fields: [
            { key: "product_id", label: "Product", type: "select", placeholder: "Select the product", required: true, options: products.map(p => ({ value: p.id, label: p.name })) },
            { key: "sprint_name", label: "Sprint Name", type: "text", placeholder: "e.g. Sprint 14 — Checkout Flow", required: true },
            { key: "sprint_goal", label: "Sprint Goal", type: "textarea", placeholder: "One clear sentence describing the sprint objective...", helpText: "What is the single most important outcome for this sprint?", fullWidth: true },
          ],
        },
        {
          title: "Capacity & Scope",
          description: "Plan the team's capacity and stories.",
          fields: [
            { key: "team_capacity", label: "Team Capacity (story points)", type: "number", placeholder: "e.g. 40", helpText: "Total story points the team can deliver this sprint" },
            { key: "carry_over", label: "Carry-Over Items", type: "textarea", placeholder: "List unfinished items from last sprint...", fullWidth: true },
            { key: "planned_stories", label: "Planned Stories", type: "textarea", placeholder: "List the user stories / features planned:\n1. As a user, I want...\n2. As a user, I want...", helpText: "Include acceptance criteria and story points for each", fullWidth: true },
          ],
        },
        {
          title: "Risks & Dependencies",
          description: "Identify blockers and dependencies for this sprint.",
          fields: [
            { key: "dependencies", label: "Dependencies", type: "textarea", placeholder: "List any cross-team or external dependencies...", fullWidth: true },
            { key: "risks", label: "Sprint Risks", type: "textarea", placeholder: "List risks that could affect delivery...", fullWidth: true },
            { key: "definition_of_done", label: "Definition of Done Reminder", type: "textarea", placeholder: "Confirm the team's DoD:\n✓ Code reviewed\n✓ Tests passing\n✓ Deployed to staging", fullWidth: true },
          ],
        },
      ];

    case "user_story":
      return [
        {
          title: "Story Definition",
          description: "Write the user story using the standard format.",
          fields: [
            { key: "product_id", label: "Product", type: "select", placeholder: "Select the product", required: true, options: products.map(p => ({ value: p.id, label: p.name })) },
            { key: "name", label: "Story Title", type: "text", placeholder: "e.g. Password Reset Flow", required: true },
            { key: "persona", label: "As a...", type: "text", placeholder: "e.g. registered user", helpText: "Who is the user?" },
            { key: "want", label: "I want to...", type: "text", placeholder: "e.g. reset my password via email", helpText: "What action do they want to perform?" },
            { key: "so_that", label: "So that...", type: "text", placeholder: "e.g. I can regain access to my account", helpText: "What value does this provide?" },
          ],
        },
        {
          title: "Details & Criteria",
          description: "Add acceptance criteria and sizing.",
          fields: [
            { key: "description", label: "Detailed Description", type: "textarea", placeholder: "Additional context, edge cases, and technical notes...", fullWidth: true },
            { key: "acceptance_criteria", label: "Acceptance Criteria", type: "textarea", placeholder: "Given [context]\nWhen [action]\nThen [expected result]\n\nGiven...\nWhen...\nThen...", helpText: "Use Given/When/Then format", fullWidth: true },
            { key: "story_points", label: "Story Points", type: "number", placeholder: "e.g. 5" },
            { key: "priority", label: "Priority", type: "select", options: [
              { value: "critical", label: "Critical" },
              { value: "high", label: "High" },
              { value: "medium", label: "Medium" },
              { value: "low", label: "Low" },
            ]},
            { key: "moscow", label: "MoSCoW", type: "select", options: [
              { value: "must", label: "Must Have" },
              { value: "should", label: "Should Have" },
              { value: "could", label: "Could Have" },
              { value: "wont", label: "Won't Have" },
            ]},
          ],
        },
      ];

    case "rice_worksheet":
      return [
        {
          title: "Feature to Score",
          description: "Select the feature you want to prioritize.",
          fields: [
            { key: "product_id", label: "Product", type: "select", placeholder: "Select the product", required: true, options: products.map(p => ({ value: p.id, label: p.name })) },
            { key: "name", label: "Feature Name", type: "text", placeholder: "e.g. One-click checkout", required: true },
            { key: "description", label: "Feature Description", type: "textarea", placeholder: "What does this feature do and why is it being considered?", fullWidth: true },
          ],
        },
        {
          title: "RICE Scoring",
          description: "Score each dimension to calculate priority.",
          fields: [
            { key: "reach_score", label: "Reach (users/quarter)", type: "number", placeholder: "e.g. 1000", helpText: "How many users will this impact per quarter?" },
            { key: "impact_score", label: "Impact (1-3)", type: "select", helpText: "How much will this move the needle?", options: [
              { value: "1", label: "1 — Low impact" },
              { value: "2", label: "2 — Medium impact" },
              { value: "3", label: "3 — High impact" },
            ]},
            { key: "confidence_score", label: "Confidence (%)", type: "select", helpText: "How confident are you in these estimates?", options: [
              { value: "100", label: "100% — High confidence" },
              { value: "80", label: "80% — Medium confidence" },
              { value: "50", label: "50% — Low confidence" },
            ]},
            { key: "effort_score", label: "Effort (person-weeks)", type: "number", placeholder: "e.g. 4", helpText: "How many person-weeks will this take?" },
          ],
        },
      ];

    case "definition_of_done":
      return [
        {
          title: "Code Quality",
          description: "Define standards for code and development.",
          fields: [
            { key: "product_id", label: "Product", type: "select", placeholder: "Select the product", required: true, options: products.map(p => ({ value: p.id, label: p.name })) },
            { key: "code_review", label: "Code Review Criteria", type: "textarea", placeholder: "e.g.\n✓ Peer reviewed by at least 1 developer\n✓ No critical code smells\n✓ Follows team coding standards", helpText: "What code quality checks must pass?", fullWidth: true },
            { key: "testing", label: "Testing Requirements", type: "textarea", placeholder: "e.g.\n✓ Unit tests written and passing\n✓ Integration tests updated\n✓ Manual QA completed\n✓ Edge cases covered", fullWidth: true },
          ],
        },
        {
          title: "Deployment & Documentation",
          description: "Define release readiness criteria.",
          fields: [
            { key: "deployment", label: "Deployment Criteria", type: "textarea", placeholder: "e.g.\n✓ Deployed to staging successfully\n✓ No regression in smoke tests\n✓ Performance benchmarks met", fullWidth: true },
            { key: "documentation", label: "Documentation Requirements", type: "textarea", placeholder: "e.g.\n✓ README updated\n✓ API docs updated\n✓ Release notes written\n✓ User-facing help docs updated", fullWidth: true },
            { key: "acceptance", label: "Acceptance Criteria", type: "textarea", placeholder: "e.g.\n✓ Product owner accepted\n✓ All acceptance criteria from story met\n✓ No open blockers", fullWidth: true },
          ],
        },
      ];

    case "issue_register":
      return [
        {
          title: "Issue Identification",
          description: "Capture the issue and its context.",
          fields: [
            orgField,
            { key: "title", label: "Issue Title", type: "text", placeholder: "e.g. Vendor missed UAT date", required: true },
            { key: "description", label: "Description", type: "textarea", placeholder: "What happened, what is the impact, what's needed to resolve?", fullWidth: true },
            { key: "type", label: "Type", type: "select", required: true, options: [
              { value: "problem", label: "Problem" },
              { value: "concern", label: "Concern" },
              { value: "change-request", label: "Change Request" },
              { value: "off-specification", label: "Off-Specification" },
            ]},
          ],
        },
        {
          title: "Priority & Dates",
          description: "Set priority and target resolution.",
          fields: [
            { key: "priority", label: "Priority", type: "select", required: true, options: [
              { value: "critical", label: "Critical" },
              { value: "high", label: "High" },
              { value: "medium", label: "Medium" },
              { value: "low", label: "Low" },
            ]},
            { key: "date_raised", label: "Date Raised", type: "date" },
            { key: "target_date", label: "Target Resolution", type: "date" },
          ],
        },
        {
          title: "Linkage",
          description: "Link this issue to its parent entity.",
          fields: entityParentFields(true),
        },
      ];

    case "benefit_definition":
      return [
        {
          title: "Benefit Identity",
          description: "Name the benefit and pick a category.",
          fields: [
            orgField,
            { key: "name", label: "Benefit Name", type: "text", placeholder: "e.g. 20% reduction in handling time", required: true },
            { key: "description", label: "Description", type: "textarea", placeholder: "What is this benefit and how does it support the strategy?", fullWidth: true },
            { key: "category", label: "Category", type: "select", required: true, options: [
              { value: "financial", label: "Financial" },
              { value: "operational", label: "Operational" },
              { value: "strategic", label: "Strategic" },
              { value: "compliance", label: "Compliance" },
              { value: "customer", label: "Customer" },
            ]},
            { key: "type", label: "Type", type: "select", required: true, options: [
              { value: "quantitative", label: "Quantitative" },
              { value: "qualitative", label: "Qualitative" },
            ]},
          ],
        },
        {
          title: "Measurement",
          description: "How will this benefit be measured?",
          fields: [
            { key: "current_value", label: "Baseline (current value)", type: "text", placeholder: "e.g. 8 minutes" },
            { key: "target_value", label: "Target", type: "text", placeholder: "e.g. 6.4 minutes" },
            { key: "start_date", label: "Realisation Start", type: "date" },
            { key: "end_date", label: "Realisation End", type: "date" },
          ],
        },
        {
          title: "Linkage",
          description: "Link this benefit to a programme, project or product.",
          fields: entityParentFields(true),
        },
      ];

    case "stakeholder_engagement":
      return [
        {
          title: "Stakeholder Profile",
          description: "Identify the stakeholder and their role.",
          fields: [
            orgField,
            { key: "name", label: "Name", type: "text", placeholder: "e.g. Jane Smith", required: true },
            { key: "email", label: "Email", type: "text", placeholder: "jane@example.com" },
            { key: "role", label: "Role / Title", type: "text", placeholder: "e.g. CFO" },
            { key: "organization", label: "Organisation", type: "text", placeholder: "e.g. Acme Corp" },
          ],
        },
        {
          title: "Influence & Interest",
          description: "Plot them on the influence/interest grid.",
          fields: [
            { key: "influence", label: "Influence", type: "select", required: true, options: [
              { value: "high", label: "High" },
              { value: "medium", label: "Medium" },
              { value: "low", label: "Low" },
            ]},
            { key: "interest", label: "Interest", type: "select", required: true, options: [
              { value: "high", label: "High" },
              { value: "medium", label: "Medium" },
              { value: "low", label: "Low" },
            ]},
            { key: "engagement", label: "Current Engagement", type: "select", required: true, options: [
              { value: "champion", label: "Champion" },
              { value: "supporter", label: "Supporter" },
              { value: "neutral", label: "Neutral" },
              { value: "critic", label: "Critic" },
              { value: "blocker", label: "Blocker" },
            ]},
            { key: "communication_frequency", label: "Communication Cadence", type: "select", options: [
              { value: "weekly", label: "Weekly" },
              { value: "bi-weekly", label: "Bi-weekly" },
              { value: "monthly", label: "Monthly" },
              { value: "quarterly", label: "Quarterly" },
            ]},
          ],
        },
        {
          title: "Linkage",
          description: "Link to a programme, project or product.",
          fields: entityParentFields(true),
        },
      ];

    case "change_request_form":
      return [
        {
          title: "Change Summary",
          description: "Describe the change being requested.",
          fields: [
            orgField,
            { key: "title", label: "Change Title", type: "text", placeholder: "e.g. Extend UAT window by 2 weeks", required: true },
            { key: "description", label: "Description", type: "textarea", placeholder: "What change is being proposed?", fullWidth: true },
            { key: "change_type", label: "Change Type", type: "select", required: true, options: [
              { value: "scope", label: "Scope" },
              { value: "schedule", label: "Schedule" },
              { value: "budget", label: "Budget" },
              { value: "quality", label: "Quality" },
              { value: "resource", label: "Resource" },
            ]},
            { key: "reason", label: "Reason for Change", type: "textarea", placeholder: "Why is this change needed?", fullWidth: true },
          ],
        },
        {
          title: "Impact Analysis",
          description: "Quantify the impact across dimensions.",
          fields: [
            { key: "cost_impact", label: "Cost Impact ($)", type: "number", placeholder: "e.g. 12500" },
            { key: "time_impact_days", label: "Time Impact (days)", type: "number", placeholder: "e.g. 14" },
            { key: "risk_impact", label: "Risk Impact", type: "textarea", placeholder: "How does this affect existing risks?", fullWidth: true },
            { key: "quality_impact", label: "Quality Impact", type: "textarea", placeholder: "Any effect on quality criteria?", fullWidth: true },
            { key: "benefits", label: "Benefits Impact", type: "textarea", placeholder: "How will benefits realisation be affected?", fullWidth: true },
            { key: "impact_summary", label: "Overall Impact Summary", type: "textarea", placeholder: "One-paragraph summary for the change board.", fullWidth: true },
          ],
        },
        {
          title: "Decision & Linkage",
          description: "Set priority, target date and link the change.",
          fields: [
            { key: "priority", label: "Priority", type: "select", required: true, options: [
              { value: "critical", label: "Critical" },
              { value: "high", label: "High" },
              { value: "medium", label: "Medium" },
              { value: "low", label: "Low" },
            ]},
            { key: "date_required", label: "Decision Required By", type: "date" },
            ...entityParentFields(true),
          ],
        },
      ];

    case "sprint_retro":
      return [
        {
          title: "Retro Setup",
          description: "Which sprint are we reflecting on?",
          fields: [
            { key: "product_id", label: "Product", type: "select", required: true, placeholder: "Select the product", options: products.map(p => ({ value: p.id, label: p.name })) },
            { key: "sprint_name", label: "Sprint Name", type: "text", placeholder: "e.g. Sprint 14", required: true },
            { key: "sprint_goal_met", label: "Sprint Goal Met?", type: "select", options: [
              { value: "yes", label: "Yes — goal achieved" },
              { value: "partial", label: "Partial — some commitments slipped" },
              { value: "no", label: "No — goal missed" },
            ]},
          ],
        },
        {
          title: "What Worked / Didn't",
          description: "Capture observations across the team.",
          fields: [
            { key: "went_well", label: "What went well", type: "textarea", placeholder: "Wins, improvements, things to keep doing...", fullWidth: true },
            { key: "didnt_go_well", label: "What didn't go well", type: "textarea", placeholder: "Pain points, blockers, things to stop...", fullWidth: true },
            { key: "ideas", label: "Ideas to try", type: "textarea", placeholder: "Experiments, new practices, process tweaks...", fullWidth: true },
          ],
        },
        {
          title: "Actions",
          description: "Commit to a small number of concrete improvements.",
          fields: [
            { key: "actions", label: "Action Items", type: "textarea", placeholder: "1. [Owner] Action — by date\n2. ...", helpText: "Aim for 1-3 actions max — focused beats long lists.", fullWidth: true },
          ],
        },
      ];

    case "compliance_health_check":
      return [
        {
          title: "Scope",
          description: "Pick what we're checking.",
          fields: [
            orgField,
            { key: "scope_type", label: "Scope", type: "select", required: true, options: [
              { value: "organization", label: "Whole organisation" },
              { value: "programme", label: "Single programme" },
              { value: "project", label: "Single project" },
            ]},
            { key: "programme_id", label: "Programme", type: "select", placeholder: "If scope = programme", options: programmes.map(p => ({ value: p.id, label: p.name })) },
            { key: "project_id", label: "Project", type: "select", placeholder: "If scope = project", options: projects.map(p => ({ value: p.id, label: p.name })) },
          ],
        },
        {
          title: "Cadence",
          description: "Are status updates and reviews happening on time?",
          fields: [
            { key: "last_status_update", label: "Days since last status update", type: "number", placeholder: "e.g. 7" },
            { key: "last_governance_review", label: "Days since last governance review", type: "number", placeholder: "e.g. 30" },
          ],
        },
        {
          title: "Hygiene",
          description: "Are core registers populated and looked after?",
          fields: [
            { key: "open_risks", label: "Open risks (count)", type: "number" },
            { key: "stale_risks", label: "Risks not reviewed in 30+ days", type: "number" },
            { key: "open_issues", label: "Open issues (count)", type: "number" },
            { key: "orphan_items", label: "Register items missing parent linkage", type: "number" },
          ],
        },
        {
          title: "Notes",
          description: "Any context to flag for the steering committee.",
          fields: [
            { key: "notes", label: "Observations", type: "textarea", placeholder: "Anything else worth flagging...", fullWidth: true },
          ],
        },
      ];

    // ─── Construction & Engineering ────────────────────────────────────────
    case "con_rfi_form":
      return [
        {
          title: "RFI Basics",
          description: "Identify the project and the question.",
          fields: [
            orgField,
            { key: "project_id", label: "Project / Site", type: "select", required: true, placeholder: "Select project", options: projects.map(p => ({ value: p.id, label: p.name })) },
            { key: "subject", label: "Subject", type: "text", required: true, placeholder: "e.g. Clash between L2 ductwork and beam B-12" },
            { key: "discipline", label: "Discipline", type: "select", options: [
              { value: "architectural", label: "Architectural" },
              { value: "structural", label: "Structural" },
              { value: "mechanical", label: "Mechanical" },
              { value: "electrical", label: "Electrical" },
              { value: "plumbing", label: "Plumbing" },
              { value: "civil", label: "Civil" },
              { value: "fire", label: "Fire / Life Safety" },
              { value: "facade", label: "Façade" },
            ]},
          ],
        },
        {
          title: "Question & Refs",
          description: "Spec / drawing references and the actual question.",
          fields: [
            { key: "spec_section", label: "Spec Section", type: "text", placeholder: "e.g. 23 31 13" },
            { key: "drawing_ref", label: "Drawing Reference(s)", type: "text", placeholder: "e.g. M-202 Rev C" },
            { key: "question", label: "Question", type: "textarea", required: true, placeholder: "One specific question — keep it answerable", fullWidth: true },
            { key: "proposed_solution", label: "Proposed solution (optional)", type: "textarea", fullWidth: true },
          ],
        },
        {
          title: "Routing & SLA",
          description: "Who needs to answer and by when.",
          fields: [
            { key: "priority", label: "Priority", type: "select", options: [
              { value: "low", label: "Low" }, { value: "medium", label: "Medium" }, { value: "high", label: "High" }, { value: "critical", label: "Critical" },
            ]},
            { key: "due_date", label: "Response due", type: "date" },
          ],
        },
      ];

    case "con_submittal_form":
      return [
        {
          title: "Submittal Basics",
          description: "What is being submitted and against which spec.",
          fields: [
            orgField,
            { key: "project_id", label: "Project / Site", type: "select", required: true, options: projects.map(p => ({ value: p.id, label: p.name })) },
            { key: "title", label: "Title", type: "text", required: true, placeholder: "e.g. Acoustic ceiling tile data sheet" },
            { key: "spec_section", label: "Spec Section", type: "text", placeholder: "e.g. 09 51 13" },
            { key: "submittal_type", label: "Type", type: "select", options: [
              { value: "product_data", label: "Product data" },
              { value: "shop_drawing", label: "Shop drawing" },
              { value: "sample", label: "Sample" },
              { value: "mock_up", label: "Mock-up" },
              { value: "calculation", label: "Calculation" },
              { value: "manufacturer_cert", label: "Manufacturer cert" },
            ]},
          ],
        },
        {
          title: "Description & Timing",
          description: "Detail and required-on-site date.",
          fields: [
            { key: "description", label: "Description", type: "textarea", fullWidth: true, placeholder: "What is included, lead time considerations" },
            { key: "due_date", label: "Reviewer due date", type: "date", helpText: "Back-calculate from required-on-site minus procurement lead time" },
          ],
        },
      ];

    case "con_daily_log_form":
      return [
        {
          title: "Day & Site",
          description: "When and where.",
          fields: [
            orgField,
            { key: "project_id", label: "Project / Site", type: "select", required: true, options: projects.map(p => ({ value: p.id, label: p.name })) },
            { key: "log_date", label: "Date", type: "date", required: true },
            { key: "weather", label: "Weather AM / PM", type: "text", placeholder: "e.g. cloudy AM, rain PM, 12°C" },
            { key: "crew_count", label: "Total manpower on site", type: "number", placeholder: "e.g. 42" },
            { key: "hours_worked", label: "Crew-hours worked", type: "number", placeholder: "e.g. 336" },
          ],
        },
        {
          title: "Activity",
          description: "Works performed, delays, visitors.",
          fields: [
            { key: "work_performed", label: "Work performed today", type: "textarea", required: true, fullWidth: true, placeholder: "By trade / area / grid" },
            { key: "delays", label: "Delays / disruptions", type: "textarea", fullWidth: true, placeholder: "Cause, area affected, impact (hours/days)" },
            { key: "safety_incidents", label: "Safety observations / incidents", type: "textarea", fullWidth: true },
            { key: "visitors", label: "Visitors / inspections", type: "textarea", fullWidth: true },
            { key: "notes", label: "Other notes", type: "textarea", fullWidth: true },
          ],
        },
      ];

    case "con_punch_item_form":
      return [
        {
          title: "Defect / Snag",
          description: "What was found and where.",
          fields: [
            orgField,
            { key: "project_id", label: "Project / Site", type: "select", required: true, options: projects.map(p => ({ value: p.id, label: p.name })) },
            { key: "description", label: "Description", type: "textarea", required: true, fullWidth: true, placeholder: "What's wrong / what needs doing" },
            { key: "location", label: "Location (level / room / grid)", type: "text", placeholder: "e.g. L2-203, Grid C-7" },
            { key: "trade", label: "Trade responsible", type: "text", placeholder: "e.g. M&E sub, plasterer, joiner" },
          ],
        },
        {
          title: "Priority & Closeout",
          description: "Severity and target close.",
          fields: [
            { key: "priority", label: "Priority", type: "select", options: [
              { value: "low", label: "Low" }, { value: "medium", label: "Medium" }, { value: "high", label: "High" }, { value: "critical", label: "Critical (blocks PC)" },
            ]},
            { key: "due_date", label: "Target close date", type: "date" },
          ],
        },
      ];

    case "con_change_order_form":
      return [
        {
          title: "Change Summary",
          description: "What's changing and why.",
          fields: [
            orgField,
            { key: "title", label: "Change title", type: "text", required: true, placeholder: "e.g. Add fire-rated partition to L3 plant room" },
            { key: "description", label: "Description", type: "textarea", required: true, fullWidth: true },
            { key: "change_type", label: "Type", type: "select", required: true, options: [
              { value: "scope", label: "Scope" }, { value: "schedule", label: "Schedule" }, { value: "budget", label: "Budget" }, { value: "quality", label: "Quality" },
            ]},
            { key: "reason", label: "Reason / contractual mechanism", type: "textarea", fullWidth: true, placeholder: "NEC4 CE, JCT VO, AIA G701, site condition…" },
          ],
        },
        {
          title: "Cost & Time Impact",
          description: "Quantify the impact.",
          fields: [
            { key: "cost_impact", label: "Cost impact (currency)", type: "number", placeholder: "e.g. 12500" },
            { key: "time_impact_days", label: "Time impact (working days on critical path)", type: "number", placeholder: "e.g. 7" },
            { key: "impact_summary", label: "Summary for the change board", type: "textarea", fullWidth: true },
            { key: "priority", label: "Priority", type: "select", options: [
              { value: "low", label: "Low" }, { value: "medium", label: "Medium" }, { value: "high", label: "High" }, { value: "critical", label: "Critical" },
            ]},
            { key: "date_required", label: "Decision required by", type: "date" },
            ...entityParentFields(false),
          ],
        },
      ];

    case "con_permit_to_work_form":
      return [
        {
          title: "Permit Details",
          description: "Type, location and validity.",
          fields: [
            orgField,
            { key: "project_id", label: "Project / Site", type: "select", required: true, options: projects.map(p => ({ value: p.id, label: p.name })) },
            { key: "permit_type", label: "Permit type", type: "select", required: true, options: [
              { value: "hot_work", label: "Hot work" },
              { value: "confined_space", label: "Confined space" },
              { value: "working_at_height", label: "Working at height" },
              { value: "excavation", label: "Excavation" },
              { value: "electrical_isolation", label: "Electrical isolation" },
              { value: "lifting_operation", label: "Lifting operation" },
              { value: "live_traffic", label: "Live traffic management" },
            ]},
            { key: "activity", label: "Activity description", type: "textarea", required: true, fullWidth: true },
            { key: "location", label: "Location (with grid)", type: "text", placeholder: "e.g. L4 Grid C-7 to D-9" },
          ],
        },
        {
          title: "Validity & Controls",
          description: "When and under what controls.",
          fields: [
            { key: "valid_from", label: "Valid from", type: "date" },
            { key: "valid_to", label: "Valid to", type: "date" },
            { key: "issued_to", label: "Issued to (person / company)", type: "text" },
            { key: "controls", label: "Required controls / isolations / PPE", type: "textarea", fullWidth: true },
            { key: "rescue_plan", label: "Standby / rescue plan", type: "textarea", fullWidth: true },
          ],
        },
      ];

    case "con_toolbox_talk_form":
      return [
        {
          title: "Talk Setup",
          description: "Topic and audience.",
          fields: [
            orgField,
            { key: "project_id", label: "Project / Site", type: "select", options: projects.map(p => ({ value: p.id, label: p.name })) },
            { key: "topic", label: "Topic", type: "text", required: true, placeholder: "e.g. Working safely around mobile plant" },
            { key: "log_date", label: "Date delivered", type: "date" },
            { key: "audience", label: "Audience / trades", type: "text", placeholder: "e.g. all trades, ground workers only" },
          ],
        },
        {
          title: "Content & Sign-off",
          description: "Key messages and attendance.",
          fields: [
            { key: "key_messages", label: "Key messages / hazards / controls", type: "textarea", required: true, fullWidth: true },
            { key: "questions_asked", label: "Check questions asked", type: "textarea", fullWidth: true },
            { key: "attendees", label: "Attendees (names or count)", type: "textarea", fullWidth: true },
          ],
        },
      ];

    case "con_ncr_form":
      return [
        {
          title: "Non-Conformance",
          description: "What was found, against which standard.",
          fields: [
            orgField,
            { key: "project_id", label: "Project / Site", type: "select", required: true, options: projects.map(p => ({ value: p.id, label: p.name })) },
            { key: "title", label: "NCR title", type: "text", required: true, placeholder: "Short factual summary" },
            { key: "description", label: "Description of non-conformance", type: "textarea", required: true, fullWidth: true },
            { key: "spec_ref", label: "Specification / standard reference", type: "text", placeholder: "e.g. BS EN 13670 §8.4" },
            { key: "trade_party", label: "Trade / party responsible", type: "text" },
            { key: "location", label: "Location", type: "text", placeholder: "Grid / level / room" },
          ],
        },
        {
          title: "Severity & CAPA",
          description: "Disposition and corrective action.",
          fields: [
            { key: "priority", label: "Severity", type: "select", required: true, options: [
              { value: "low", label: "Minor" }, { value: "medium", label: "Major" }, { value: "high", label: "Critical" },
            ]},
            { key: "disposition", label: "Proposed disposition", type: "select", options: [
              { value: "rework", label: "Rework" },
              { value: "repair", label: "Repair" },
              { value: "use_as_is", label: "Use as-is (concession)" },
              { value: "reject_replace", label: "Reject & replace" },
            ]},
            { key: "root_cause", label: "Root cause (5 Whys)", type: "textarea", fullWidth: true },
            { key: "capa", label: "Corrective & preventive action (CAPA)", type: "textarea", fullWidth: true },
            { key: "due_date", label: "Target close date", type: "date" },
          ],
        },
      ];

    case "con_handover_checklist":
      return [
        {
          title: "Handover Scope",
          description: "What's being handed over.",
          fields: [
            orgField,
            { key: "project_id", label: "Project / Site", type: "select", required: true, options: projects.map(p => ({ value: p.id, label: p.name })) },
            { key: "title", label: "Handover package title", type: "text", required: true, placeholder: "e.g. Block A — Practical Completion" },
            { key: "pc_date", label: "Target Practical Completion", type: "date" },
            { key: "client_requirements", label: "Client-specific requirements", type: "textarea", fullWidth: true, placeholder: "Soft Landings BG6, BIM COBie drop, CAFM upload…" },
          ],
        },
        {
          title: "Deliverables Checklist",
          description: "Standard PC deliverables to verify.",
          fields: [
            { key: "om_manuals", label: "O&M manuals collated?", type: "select", options: [
              { value: "no", label: "Not started" }, { value: "in_progress", label: "In progress" }, { value: "yes", label: "Complete" },
            ]},
            { key: "as_built", label: "As-built drawings status", type: "select", options: [
              { value: "no", label: "Not started" }, { value: "in_progress", label: "In progress" }, { value: "yes", label: "Complete" },
            ]},
            { key: "test_certs", label: "Test & commissioning certs collected?", type: "select", options: [
              { value: "no", label: "No" }, { value: "partial", label: "Partial" }, { value: "yes", label: "Yes" },
            ]},
            { key: "warranties", label: "Warranties / DLP letters collected?", type: "select", options: [
              { value: "no", label: "No" }, { value: "partial", label: "Partial" }, { value: "yes", label: "Yes" },
            ]},
            { key: "hs_file", label: "H&S File (CDM Reg 12.5) ready?", type: "select", options: [
              { value: "no", label: "No" }, { value: "in_progress", label: "In progress" }, { value: "yes", label: "Yes" },
            ]},
            { key: "training", label: "Operator / end-user training delivered?", type: "select", options: [
              { value: "no", label: "No" }, { value: "scheduled", label: "Scheduled" }, { value: "yes", label: "Done" },
            ]},
            { key: "notes", label: "Outstanding items / notes", type: "textarea", fullWidth: true },
          ],
        },
      ];

    // ─── Professional Services & Consulting ────────────────────────────────
    case "ps_engagement_setup":
      return [
        {
          title: "Client & Engagement",
          description: "Identify the client and engagement type.",
          fields: [
            orgField,
            { key: "client_name", label: "Client name", type: "text", required: true, placeholder: "e.g. Acme Corp" },
            { key: "engagement_code", label: "Engagement code", type: "text", required: true, placeholder: "e.g. ACME-2026-001" },
            { key: "engagement_type", label: "Engagement type", type: "select", required: true, options: [
              { value: "time_and_materials", label: "Time & Materials (T&M)" },
              { value: "fixed_price", label: "Fixed Price" },
              { value: "retainer", label: "Retainer" },
              { value: "milestone_based", label: "Milestone-based" },
            ]},
            { key: "account_manager", label: "Account manager / partner", type: "text", placeholder: "Name of lead" },
          ],
        },
        {
          title: "Commercials & Timeline",
          description: "Contract value and dates.",
          fields: [
            { key: "contract_value", label: "Contract value", type: "number", placeholder: "e.g. 250000" },
            { key: "start_date", label: "Start date", type: "date" },
            { key: "end_date", label: "End date", type: "date" },
            { key: "notes", label: "Scope summary / notes", type: "textarea", fullWidth: true, placeholder: "One-paragraph engagement summary, key outcomes" },
          ],
        },
      ];

    case "ps_sow_form":
      return [
        {
          title: "SOW Header",
          description: "Tie the Statement of Work to a client engagement.",
          fields: [
            orgField,
            { key: "title", label: "SOW title", type: "text", required: true, placeholder: "e.g. SOW-001 — Discovery Phase" },
            { key: "client_name", label: "Client name", type: "text", required: true },
            { key: "msa_reference", label: "Parent MSA reference", type: "text", placeholder: "e.g. MSA-Acme-2025" },
            { key: "engagement_type", label: "Pricing model", type: "select", required: true, options: [
              { value: "fixed_price", label: "Fixed Price" },
              { value: "time_and_materials", label: "Time & Materials" },
              { value: "milestone_based", label: "Milestone-based" },
              { value: "retainer", label: "Retainer" },
            ]},
          ],
        },
        {
          title: "Scope, Deliverables & Acceptance",
          description: "What's in / out of scope, what gets delivered, how it's accepted.",
          fields: [
            { key: "objectives", label: "Engagement objectives", type: "textarea", required: true, fullWidth: true, placeholder: "What outcomes will this SOW deliver?" },
            { key: "in_scope", label: "In scope", type: "textarea", fullWidth: true },
            { key: "out_of_scope", label: "Out of scope", type: "textarea", fullWidth: true },
            { key: "deliverables", label: "Deliverables (with acceptance criteria)", type: "textarea", required: true, fullWidth: true, placeholder: "1. Discovery report — accepted when…\n2. Solution blueprint — accepted when…" },
            { key: "assumptions", label: "Assumptions & dependencies", type: "textarea", fullWidth: true },
          ],
        },
        {
          title: "Commercials",
          description: "Fees, expenses, payment.",
          fields: [
            { key: "contract_value", label: "Total fees", type: "number", placeholder: "e.g. 120000" },
            { key: "expense_policy", label: "Expense policy", type: "textarea", fullWidth: true, placeholder: "e.g. Billed at cost + 10%, pre-approval > $500" },
            { key: "payment_terms", label: "Payment terms", type: "text", placeholder: "e.g. Net 30, monthly invoice" },
            { key: "start_date", label: "Start date", type: "date" },
            { key: "end_date", label: "End date", type: "date" },
          ],
        },
      ];

    case "ps_msa_summary":
      return [
        {
          title: "MSA Identification",
          description: "Master Services Agreement basics.",
          fields: [
            orgField,
            { key: "title", label: "MSA title", type: "text", required: true, placeholder: "e.g. MSA — Acme Corp 2026" },
            { key: "client_name", label: "Client legal entity", type: "text", required: true },
            { key: "effective_date", label: "Effective date", type: "date" },
            { key: "term_years", label: "Term (years)", type: "number", placeholder: "e.g. 3" },
          ],
        },
        {
          title: "Key Terms",
          description: "The terms PMs need at a glance.",
          fields: [
            { key: "liability_cap", label: "Liability cap", type: "text", placeholder: "e.g. Fees paid in last 12 months" },
            { key: "ip_terms", label: "IP ownership", type: "select", options: [
              { value: "client_owns", label: "Client owns deliverables" },
              { value: "consultant_owns", label: "Consultant owns, client licensed" },
              { value: "joint", label: "Joint ownership" },
            ]},
            { key: "confidentiality", label: "Confidentiality term", type: "text", placeholder: "e.g. 5 years post-termination" },
            { key: "notice_period", label: "Termination notice period", type: "text", placeholder: "e.g. 60 days" },
            { key: "summary", label: "Anything else PMs should know", type: "textarea", fullWidth: true },
          ],
        },
      ];

    case "ps_change_order_form":
      return [
        {
          title: "Engagement Change",
          description: "Identify the engagement and the change.",
          fields: [
            orgField,
            { key: "title", label: "Change title", type: "text", required: true, placeholder: "e.g. Add second integration to scope" },
            { key: "client_name", label: "Client", type: "text", required: true },
            { key: "sow_reference", label: "Original SOW reference", type: "text" },
            { key: "change_type", label: "Type", type: "select", required: true, options: [
              { value: "scope", label: "Scope expansion" },
              { value: "schedule", label: "Schedule" },
              { value: "budget", label: "Budget / fees" },
              { value: "team", label: "Team / staffing" },
            ]},
            { key: "description", label: "What's changing", type: "textarea", required: true, fullWidth: true },
            { key: "reason", label: "Why", type: "textarea", fullWidth: true },
          ],
        },
        {
          title: "Impact",
          description: "Cost, time and team impact.",
          fields: [
            { key: "cost_impact", label: "Fee impact", type: "number", placeholder: "e.g. 25000" },
            { key: "time_impact_days", label: "Schedule impact (working days)", type: "number" },
            { key: "impact_summary", label: "Summary", type: "textarea", fullWidth: true },
            { key: "priority", label: "Priority", type: "select", options: [
              { value: "low", label: "Low" }, { value: "medium", label: "Medium" }, { value: "high", label: "High" },
            ]},
            { key: "date_required", label: "Client decision required by", type: "date" },
            ...entityParentFields(false),
          ],
        },
      ];

    case "ps_deliverable_form":
      return [
        {
          title: "Deliverable",
          description: "What's being produced.",
          fields: [
            orgField,
            { key: "name", label: "Deliverable name", type: "text", required: true, placeholder: "e.g. Discovery Report v1.0" },
            { key: "project_id", label: "Engagement / Project", type: "select", placeholder: "Which engagement?", options: projects.map(p => ({ value: p.id, label: p.name })) },
            { key: "description", label: "Description", type: "textarea", fullWidth: true },
          ],
        },
        {
          title: "Acceptance & Dates",
          description: "How will it be accepted?",
          fields: [
            { key: "acceptance_criteria", label: "Acceptance criteria", type: "textarea", required: true, fullWidth: true, placeholder: "Specific, testable criteria the client will sign against" },
            { key: "start_date", label: "Drafting starts", type: "date" },
            { key: "end_date", label: "Target submission to client", type: "date" },
            { key: "priority", label: "Priority", type: "select", options: [
              { value: "low", label: "Low" }, { value: "medium", label: "Medium" }, { value: "high", label: "High" }, { value: "critical", label: "Critical" },
            ]},
          ],
        },
      ];

    case "ps_retainer_setup":
      return [
        {
          title: "Retainer Period",
          description: "Client and period covered.",
          fields: [
            orgField,
            { key: "client_name", label: "Client", type: "text", required: true },
            { key: "period_start", label: "Period start", type: "date", required: true },
            { key: "period_end", label: "Period end", type: "date", required: true },
            { key: "monthly_value", label: "Monthly retainer value", type: "number", placeholder: "e.g. 15000" },
          ],
        },
        {
          title: "Hours & Rules",
          description: "Allocation and rollover.",
          fields: [
            { key: "hours_allocated", label: "Hours allocated this period", type: "number", required: true, placeholder: "e.g. 80" },
            { key: "rollover_allowed", label: "Rollover allowed?", type: "select", options: [
              { value: "true", label: "Yes — unused hours roll forward" },
              { value: "false", label: "No — use it or lose it" },
            ]},
            { key: "notes", label: "Scope of services covered by retainer", type: "textarea", fullWidth: true, placeholder: "What is in vs out of the retainer (advisory, BAU support, escalations…)" },
          ],
        },
      ];

    case "ps_timesheet_entry":
      return [
        {
          title: "Timesheet Setup",
          description: "Reference the engagement and period.",
          fields: [
            orgField,
            { key: "project_id", label: "Engagement / Project", type: "select", required: true, options: projects.map(p => ({ value: p.id, label: p.name })) },
            { key: "period", label: "Period (e.g. wk of YYYY-MM-DD)", type: "text", required: true, placeholder: "e.g. wk of 2026-04-20" },
            { key: "billable", label: "Billable?", type: "select", options: [
              { value: "yes", label: "Billable" }, { value: "no", label: "Non-billable" },
            ]},
          ],
        },
        {
          title: "Time Detail",
          description: "Hours by activity.",
          fields: [
            { key: "hours", label: "Total hours", type: "number", required: true, placeholder: "e.g. 36.5" },
            { key: "activity_summary", label: "Activity summary", type: "textarea", required: true, fullWidth: true, placeholder: "Bullets: what was worked on, deliverable refs" },
            { key: "rate_card", label: "Applicable rate card", type: "text", placeholder: "e.g. Senior Consultant — $250/hr" },
          ],
        },
      ];

    case "ps_csat_capture":
      return [
        {
          title: "Survey Setup",
          description: "Which engagement and respondent.",
          fields: [
            orgField,
            { key: "project_id", label: "Engagement / Project", type: "select", required: true, options: projects.map(p => ({ value: p.id, label: p.name })) },
            { key: "respondent_name", label: "Respondent", type: "text", placeholder: "Name + role" },
            { key: "survey_date", label: "Survey date", type: "date" },
          ],
        },
        {
          title: "Scores",
          description: "Capture the scores.",
          fields: [
            { key: "csat_score", label: "CSAT (1-5)", type: "select", required: true, options: [
              { value: "1", label: "1 — Very dissatisfied" },
              { value: "2", label: "2 — Dissatisfied" },
              { value: "3", label: "3 — Neutral" },
              { value: "4", label: "4 — Satisfied" },
              { value: "5", label: "5 — Very satisfied" },
            ]},
            { key: "nps_score", label: "NPS (0-10)", type: "number", placeholder: "0-10" },
            { key: "what_went_well", label: "What went well", type: "textarea", fullWidth: true },
            { key: "what_to_improve", label: "What to improve", type: "textarea", fullWidth: true },
            { key: "would_recommend", label: "Would recommend?", type: "select", options: [
              { value: "promoter", label: "Promoter (9-10)" },
              { value: "passive", label: "Passive (7-8)" },
              { value: "detractor", label: "Detractor (0-6)" },
            ]},
          ],
        },
      ];

    case "ps_bid_no_bid":
      return [
        {
          title: "Opportunity",
          description: "Basic facts about the lead.",
          fields: [
            orgField,
            { key: "client_name", label: "Prospective client", type: "text", required: true },
            { key: "opportunity_name", label: "Opportunity name", type: "text", required: true, placeholder: "e.g. Acme — ERP modernisation" },
            { key: "estimated_value", label: "Estimated fee value", type: "text", placeholder: "e.g. $750k" },
            { key: "submission_deadline", label: "Proposal deadline", type: "date" },
          ],
        },
        {
          title: "Decision Factors",
          description: "Score the bid/no-bid factors.",
          fields: [
            { key: "strategic_fit", label: "Strategic fit (1-5)", type: "select", options: [
              { value: "1", label: "1 — None" }, { value: "2", label: "2" }, { value: "3", label: "3" }, { value: "4", label: "4" }, { value: "5", label: "5 — Perfect fit" },
            ]},
            { key: "win_probability", label: "Win probability (%)", type: "number", placeholder: "0-100" },
            { key: "delivery_risk", label: "Delivery risk", type: "select", options: [
              { value: "low", label: "Low" }, { value: "medium", label: "Medium" }, { value: "high", label: "High" },
            ]},
            { key: "team_availability", label: "Team availability", type: "select", options: [
              { value: "available", label: "Team available" },
              { value: "stretched", label: "Stretched but possible" },
              { value: "unavailable", label: "Will need to hire / sub" },
            ]},
            { key: "decision", label: "Recommendation", type: "select", required: true, options: [
              { value: "bid", label: "Bid" }, { value: "no_bid", label: "No-Bid" }, { value: "qualify_more", label: "Qualify further" },
            ]},
            { key: "rationale", label: "Rationale (one paragraph)", type: "textarea", required: true, fullWidth: true },
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
    case "risk_register":
      return "risk";
    case "lessons_learned":
      return "lesson";
    case "user_story":
    case "rice_worksheet":
      return "feature";
    case "issue_register":
      return "issue";
    case "benefit_definition":
      return "benefit";
    case "stakeholder_engagement":
      return "stakeholder";
    case "change_request_form":
      return "change_request";
    case "sprint_planning":
    case "definition_of_done":
    case "sprint_retro":
    case "compliance_health_check":
      return null; // reference/guide wizards — no entity created
    case "con_rfi_form":
      return "rfi";
    case "con_submittal_form":
      return "submittal";
    case "con_daily_log_form":
      return "daily_log";
    case "con_punch_item_form":
      return "punch_item";
    case "con_change_order_form":
    case "ps_change_order_form":
      return "change_request";
    case "con_permit_to_work_form":
    case "con_toolbox_talk_form":
    case "con_ncr_form":
    case "con_handover_checklist":
    case "con_opportunity_form":
    case "con_rfp_intake_form":
    case "con_bid_no_bid_form":
    case "con_pqq_form":
    case "con_bid_form":
    case "con_award_form":
    case "con_winloss_form":
    case "con_lifecycle_phase_form":
    case "con_precon_item_form":
      return "vertical_record";
    case "ps_engagement_setup":
      return "engagement";
    case "ps_retainer_setup":
      return "retainer";
    case "ps_csat_capture":
      return "csat";
    case "ps_deliverable_form":
      return "deliverable";
    case "ps_sow_form":
    case "ps_msa_summary":
    case "ps_timesheet_entry":
    case "ps_bid_no_bid":
      return "vertical_record";
    default:
      return null;
  }
};

const getEntityLabel = (entityType: string | null): string => {
  switch (entityType) {
    case "programme": return "Programme";
    case "project": return "Project";
    case "product": return "Product";
    case "risk": return "Risk";
    case "lesson": return "Lesson";
    case "feature": return "Feature";
    case "issue": return "Issue";
    case "benefit": return "Benefit";
    case "stakeholder": return "Stakeholder";
    case "change_request": return "Change Request";
    case "rfi": return "RFI";
    case "submittal": return "Submittal";
    case "daily_log": return "Daily Log";
    case "punch_item": return "Punch Item";
    case "engagement": return "Engagement";
    case "retainer": return "Retainer";
    case "csat": return "CSAT Response";
    case "deliverable": return "Deliverable";
    case "vertical_record": return "Record";
    default: return "";
  }
};

export function TemplateWizard({ open, onOpenChange, templateType, templateName }: TemplateWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [programmes, setProgrammes] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (open) {
      setCurrentStep(0);
      setFormData({});
      const fetchData = async () => {
        const [orgsRes, progsRes, projsRes, prodsRes] = await Promise.all([
          supabase.from("organizations").select("id, name").order("name"),
          supabase.from("programmes").select("id, name").order("name"),
          supabase.from("projects").select("id, name").order("name"),
          supabase.from("products").select("id, name").order("name"),
        ]);
        if (orgsRes.data) setOrganizations(orgsRes.data);
        if (progsRes.data) setProgrammes(progsRes.data);
        if (projsRes.data) setProjects(projsRes.data);
        if (prodsRes.data) setProducts(prodsRes.data);
      };
      fetchData();
    }
  }, [open]);

  const steps = getWizardSteps(templateType, organizations, programmes, projects, products);
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

  const computeRiskScore = () => {
    const probMap: Record<string, number> = { very_low: 1, low: 2, medium: 3, high: 4, very_high: 5 };
    const p = probMap[formData.probability] || 3;
    const i = probMap[formData.impact] || 3;
    return p * i;
  };

  const handleSubmit = async () => {
    if (!user) return;
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
      } else if (entityType === "risk") {
        const { error } = await supabase.from("risks").insert({
          title: formData.title,
          description: formData.description || null,
          category: formData.category || null,
          probability: formData.probability || "medium",
          impact: formData.impact || "medium",
          score: computeRiskScore(),
          status: "open",
          response: formData.response || null,
          date_identified: formData.date_identified || null,
          review_date: formData.review_date || null,
          organization_id: formData.organization_id || null,
          programme_id: formData.programme_id || null,
          project_id: formData.project_id || null,
          product_id: formData.product_id || null,
          created_by: user.id,
          owner_id: user.id,
        });

        if (error) throw error;
        toast.success("Risk created from template!");
        navigate("/registers");
      } else if (entityType === "lesson") {
        const { error } = await supabase.from("lessons_learned").insert({
          title: formData.title,
          lesson_type: formData.lesson_type || "recommendation",
          category: formData.category || "process",
          what_happened: formData.what_happened || null,
          root_cause: formData.root_cause || null,
          outcome: formData.outcome || null,
          recommendation: formData.recommendation || null,
          action_taken: formData.action_taken || null,
          priority: formData.priority || "medium",
          status: "identified",
          event_date: formData.event_date || null,
          organization_id: formData.organization_id || null,
          programme_id: formData.programme_id || null,
          project_id: formData.project_id || null,
          product_id: formData.product_id || null,
          created_by: user.id,
          owner_id: user.id,
        });

        if (error) throw error;
        toast.success("Lesson learned created from template!");
        navigate("/registers");
      } else if (entityType === "feature") {
        const desc = templateType === "user_story"
          ? `As a ${formData.persona || "user"}, I want to ${formData.want || "..."} so that ${formData.so_that || "..."}.\n\n${formData.description || ""}\n\nAcceptance Criteria:\n${formData.acceptance_criteria || ""}`
          : formData.description || null;

        const { error } = await supabase.from("product_features").insert({
          name: formData.name,
          description: desc,
          product_id: formData.product_id,
          priority: formData.priority || "medium",
          status: "backlog",
          story_points: formData.story_points ? parseInt(formData.story_points) : null,
          moscow: formData.moscow || null,
          reach_score: formData.reach_score ? parseInt(formData.reach_score) : null,
          impact_score: formData.impact_score ? parseInt(formData.impact_score) : null,
          confidence_score: formData.confidence_score ? parseInt(formData.confidence_score) : null,
          effort_score: formData.effort_score ? parseInt(formData.effort_score) : null,
          created_by: user.id,
        });

        if (error) throw error;
        toast.success("Feature created from template!");
        navigate(`/products/${formData.product_id}`);
      } else if (entityType === "issue") {
        const { error } = await supabase.from("issues").insert({
          title: formData.title,
          description: formData.description || null,
          type: formData.type || "problem",
          priority: formData.priority || "medium",
          status: "open",
          date_raised: formData.date_raised || null,
          target_date: formData.target_date || null,
          organization_id: formData.organization_id || null,
          programme_id: formData.programme_id || null,
          project_id: formData.project_id || null,
          product_id: formData.product_id || null,
          created_by: user.id,
          owner_id: user.id,
        });
        if (error) throw error;
        toast.success("Issue created from template!");
        navigate("/registers");
      } else if (entityType === "benefit") {
        const { error } = await supabase.from("benefits").insert({
          name: formData.name,
          description: formData.description || null,
          category: formData.category || "operational",
          type: formData.type || "quantitative",
          target_value: formData.target_value || null,
          current_value: formData.current_value || null,
          status: "identified",
          start_date: formData.start_date || null,
          end_date: formData.end_date || null,
          organization_id: formData.organization_id || null,
          programme_id: formData.programme_id || null,
          project_id: formData.project_id || null,
          product_id: formData.product_id || null,
          created_by: user.id,
          owner_id: user.id,
        });
        if (error) throw error;
        toast.success("Benefit created from template!");
        navigate("/benefits");
      } else if (entityType === "stakeholder") {
        const { error } = await supabase.from("stakeholders").insert({
          name: formData.name,
          email: formData.email || null,
          role: formData.role || null,
          organization: formData.organization || null,
          influence: formData.influence || "medium",
          interest: formData.interest || "medium",
          engagement: formData.engagement || "neutral",
          communication_frequency: formData.communication_frequency || "monthly",
          organization_id: formData.organization_id || null,
          programme_id: formData.programme_id || null,
          project_id: formData.project_id || null,
          product_id: formData.product_id || null,
          created_by: user.id,
        });
        if (error) throw error;
        toast.success("Stakeholder added from template!");
        navigate("/registers");
      } else if (entityType === "change_request") {
        const ref = `CR-${Date.now().toString(36).toUpperCase()}`;
        const { error } = await supabase.from("change_requests").insert({
          reference_number: ref,
          title: formData.title,
          description: formData.description || null,
          change_type: formData.change_type || "scope",
          reason: formData.reason || null,
          impact_summary: formData.impact_summary || null,
          cost_impact: formData.cost_impact ? parseFloat(formData.cost_impact) : null,
          time_impact_days: formData.time_impact_days ? parseInt(formData.time_impact_days) : null,
          risk_impact: formData.risk_impact || null,
          quality_impact: formData.quality_impact || null,
          benefits: formData.benefits || null,
          priority: formData.priority || "medium",
          date_required: formData.date_required || null,
          status: "pending",
          organization_id: formData.organization_id || null,
          programme_id: formData.programme_id || null,
          project_id: formData.project_id || null,
          product_id: formData.product_id || null,
          created_by: user.id,
          raised_by: user.id,
          owner_id: user.id,
        });
        if (error) throw error;
        toast.success("Change request raised!");
        navigate("/change-control");
      } else if (entityType === "rfi") {
        const ref = `RFI-${Date.now().toString(36).toUpperCase()}`;
        const { error } = await supabase.from("rfis").insert({
          rfi_number: ref,
          subject: formData.subject,
          question: [formData.question, formData.proposed_solution ? `\n\nProposed solution:\n${formData.proposed_solution}` : ""].join(""),
          priority: formData.priority || "medium",
          status: "open",
          due_date: formData.due_date || null,
          organization_id: formData.organization_id,
          project_id: formData.project_id || null,
          submitted_by: user.id,
        });
        if (error) throw error;
        toast.success("RFI raised!");
        navigate("/rfis");
      } else if (entityType === "submittal") {
        const ref = `SUB-${Date.now().toString(36).toUpperCase()}`;
        const { error } = await supabase.from("submittals").insert({
          submittal_number: ref,
          title: formData.title,
          spec_section: formData.spec_section || null,
          description: [formData.description || "", formData.submittal_type ? `\nType: ${formData.submittal_type}` : ""].join(""),
          status: "pending",
          due_date: formData.due_date || null,
          organization_id: formData.organization_id,
          project_id: formData.project_id || null,
          submitted_by: user.id,
        });
        if (error) throw error;
        toast.success("Submittal logged!");
        navigate("/submittals");
      } else if (entityType === "daily_log") {
        const { error } = await supabase.from("daily_logs").insert({
          log_date: formData.log_date,
          weather: formData.weather || null,
          crew_count: formData.crew_count ? parseInt(formData.crew_count) : 0,
          hours_worked: formData.hours_worked ? parseFloat(formData.hours_worked) : 0,
          work_performed: formData.work_performed || null,
          delays: formData.delays || null,
          safety_incidents: formData.safety_incidents || null,
          visitors: formData.visitors || null,
          notes: formData.notes || null,
          organization_id: formData.organization_id,
          project_id: formData.project_id || null,
          created_by: user.id,
        });
        if (error) throw error;
        toast.success("Daily log saved!");
        navigate("/daily-logs");
      } else if (entityType === "punch_item") {
        const ref = `PL-${Date.now().toString(36).toUpperCase().slice(0, 6)}`;
        const { error } = await supabase.from("punch_list_items").insert({
          item_number: ref,
          description: formData.description,
          location: formData.location || null,
          trade: formData.trade || null,
          priority: formData.priority || "medium",
          status: "open",
          due_date: formData.due_date || null,
          organization_id: formData.organization_id,
          project_id: formData.project_id || null,
          identified_by: user.id,
        });
        if (error) throw error;
        toast.success("Punch item added!");
        navigate("/punch-list");
      } else if (entityType === "engagement") {
        const { error } = await supabase.from("client_engagements").insert({
          engagement_code: formData.engagement_code,
          client_name: formData.client_name,
          engagement_type: formData.engagement_type || "time_and_materials",
          status: "active",
          start_date: formData.start_date || null,
          end_date: formData.end_date || null,
          contract_value: formData.contract_value ? parseFloat(formData.contract_value) : 0,
          notes: formData.notes || null,
          organization_id: formData.organization_id,
          account_manager: user.id,
        });
        if (error) throw error;
        toast.success("Engagement created!");
        navigate("/engagements");
      } else if (entityType === "retainer") {
        const { error } = await supabase.from("retainers").insert({
          client_name: formData.client_name,
          period_start: formData.period_start,
          period_end: formData.period_end,
          hours_allocated: formData.hours_allocated ? parseFloat(formData.hours_allocated) : 0,
          hours_consumed: 0,
          monthly_value: formData.monthly_value ? parseFloat(formData.monthly_value) : 0,
          rollover_allowed: formData.rollover_allowed === "true",
          status: "active",
          notes: formData.notes || null,
          organization_id: formData.organization_id,
        });
        if (error) throw error;
        toast.success("Retainer set up!");
        navigate("/retainers");
      } else if (entityType === "csat") {
        // Lightweight CSAT capture stored as an update against the engagement/project.
        const note = `CSAT ${formData.csat_score}/5${formData.nps_score ? `, NPS ${formData.nps_score}` : ""}\nRespondent: ${formData.respondent_name || "—"}\nWent well: ${formData.what_went_well || "—"}\nImprove: ${formData.what_to_improve || "—"}`;
        const { error } = await supabase.from("entity_updates").insert({
          entity_type: "project",
          entity_id: formData.project_id,
          organization_id: formData.organization_id,
          update_text: `[CSAT] ${note}`,
          created_by: user.id,
        });
        if (error) throw error;
        toast.success("CSAT response captured!");
      } else if (entityType === "deliverable") {
        // Deliverables are tracked as work packages in the project module.
        const { error } = await supabase.from("work_packages").insert({
          name: formData.name,
          description: formData.description || null,
          deliverables: formData.acceptance_criteria || null,
          project_id: formData.project_id || null,
          status: "pending",
          target_start: formData.start_date || null,
          target_end: formData.end_date || null,
          organization_id: formData.organization_id,
          created_by: user.id,
        });
        if (error) throw error;
        toast.success("Deliverable created!");
        navigate("/work-packages");
      } else if (entityType === "vertical_record") {
        // Generic vertical entity record — find the matching vertical_entity by slug.
        const slugByTemplate: Record<string, string> = {
          con_permit_to_work_form: "permits_to_work",
          con_toolbox_talk_form: "toolbox_talks",
          con_ncr_form: "quality_ncrs",
          con_handover_checklist: "handover",
          ps_sow_form: "sow",
          ps_msa_summary: "msa",
          ps_timesheet_entry: "timesheets",
          ps_bid_no_bid: "opportunities",
        };
        const slug = slugByTemplate[templateType];
        if (slug) {
          const { data: ve } = await supabase
            .from("vertical_entities")
            .select("id")
            .eq("slug", slug)
            .maybeSingle();
          const veId = ve?.id ?? null;
          if (veId) {
            const titleField = (formData.title as string) || (formData.topic as string) || (formData.opportunity_name as string) || (formData.client_name as string) || templateName;
            const { error } = await supabase.from("vertical_entity_records").insert({
              entity_id: veId,
              organization_id: formData.organization_id,
              title: titleField,
              data: formData as any,
              status: "open",
              priority: (formData.priority as string) || "medium",
              due_date: (formData.due_date as string) || (formData.date_required as string) || null,
              project_id: (formData.project_id as string) || null,
              created_by: user.id,
            });
            if (error) throw error;
            toast.success(`${templateName} captured.`);
          } else {
            toast.message(`Install the vertical pack to enable “${templateName}” records.`);
          }
        } else {
          toast.success("Captured.");
        }
      }

      // For non-entity wizards (guides), just close and show success.
      if (!entityType) {
        if (templateType === "sprint_retro") {
          toast.success("Retro captured — share the actions with your team.");
        } else if (templateType === "compliance_health_check") {
          toast.success("Health check captured — review with the steering committee.");
        } else {
          toast.success("Template completed!");
        }
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
                {entityType && <span className="ml-2 text-primary">• Creates a {getEntityLabel(entityType)}</span>}
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

          {isLastStep ? (
            canCreate ? (
              <Button onClick={handleSubmit} disabled={loading || !hasRequiredFields}>
                {loading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Check className="h-4 w-4 mr-1" />}
                Create {getEntityLabel(entityType)}
              </Button>
            ) : (
              <Button onClick={() => { toast.success("Template guide completed!"); onOpenChange(false); }}>
                <Check className="h-4 w-4 mr-1" />
                Done
              </Button>
            )
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
