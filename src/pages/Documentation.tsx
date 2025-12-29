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
  Building2
} from "lucide-react";
import { toast } from "sonner";

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
  { title: "Focusing on Benefits and Threats to Them", description: "Benefits realization is the primary measure of programme success. Threats must be actively managed." },
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

interface Template {
  name: string;
  category: string;
  type: string;
  content: string;
}

const templates: Template[] = [
  { 
    name: "Programme Mandate Template", 
    category: "MSP", 
    type: "Template",
    content: `# Programme Mandate

## 1. Programme Background
[Describe the strategic context and drivers for this programme]

## 2. Programme Objectives
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
- Programme Manager: [Name]
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
| Programme Board | | | |`
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

## Project/Programme: [Name]
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

## Project/Programme: [Name]
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
- Programme Board
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
    name: "Identifying a Programme",
    purpose: "Confirm there is a viable programme worth pursuing",
    activities: [
      "Understand strategic objectives",
      "Identify candidate programmes",
      "Develop initial vision",
      "Create Programme Mandate"
    ],
    outputs: ["Programme Mandate", "Strategic alignment confirmation"]
  },
  {
    name: "Defining a Programme",
    purpose: "Develop the programme to the point where it can be approved",
    activities: [
      "Develop the Vision Statement",
      "Create the Blueprint",
      "Identify benefits and design Benefits Realization",
      "Design the programme organization",
      "Plan the tranches",
      "Develop the Business Case"
    ],
    outputs: ["Programme Brief", "Vision Statement", "Blueprint", "Benefits Map", "Stakeholder Engagement Strategy"]
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
    outputs: ["Tranche Reviews", "Updated Programme Plan", "Issue and Risk updates"]
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
    name: "Closing a Programme",
    purpose: "Confirm the programme has achieved its objectives and can close",
    activities: [
      "Confirm benefits realization plan handover",
      "Close remaining projects",
      "Capture and transfer lessons",
      "Disband programme organization",
      "Celebrate success"
    ],
    outputs: ["Programme Closure Report", "Lessons Learned Report", "Benefits handover documentation"]
  },
];

export default function Documentation() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [copied, setCopied] = useState(false);
  const [selectedProcess, setSelectedProcess] = useState<typeof prince2Processes[0] | null>(null);
  const [selectedPhase, setSelectedPhase] = useState<typeof mspPhases[0] | null>(null);

  const filteredTemplates = templates.filter((t) =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCopy = async (content: string) => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    toast.success("Template copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = (template: Template) => {
    const blob = new Blob([template.content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${template.name.replace(/\s+/g, "_")}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Template downloaded");
  };

  return (
    <AppLayout title="Documentation" subtitle="PRINCE2, MSP, Agile & Product Management resources">
      {/* Search */}
      <div className="flex gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search documentation..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <Tabs defaultValue="app-guide" className="space-y-6">
        <TabsList className="bg-secondary">
          <TabsTrigger value="app-guide">Application Guide</TabsTrigger>
          <TabsTrigger value="principles">Principles</TabsTrigger>
          <TabsTrigger value="templates">Templates & Guides</TabsTrigger>
          <TabsTrigger value="processes">Processes</TabsTrigger>
        </TabsList>

        <TabsContent value="app-guide" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* User Management */}
            <div className="metric-card">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold">User Management</h3>
                  <p className="text-sm text-muted-foreground">Managing users and access</p>
                </div>
              </div>
              <div className="space-y-4 text-sm">
                <div>
                  <h4 className="font-medium mb-2">Creating Users</h4>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>• Navigate to Admin Panel → Users</li>
                    <li>• Click "Create User" and enter First Name, Last Name, and Email</li>
                    <li>• Select the user's role and organization assignment</li>
                    <li>• Users receive login credentials via email</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Archiving Users</h4>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>• Click on a user to open the Edit User dialog</li>
                    <li>• Toggle "Archive User" to disable their account</li>
                    <li>• Archived users cannot log in and are hidden from active lists</li>
                    <li>• Unarchive users by toggling the archive status off</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Deleting Users (Admin Only)</h4>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>• Only administrators can permanently delete users</li>
                    <li>• Open Edit User dialog and click "Delete User Permanently"</li>
                    <li>• Confirm the deletion - this action cannot be undone</li>
                    <li>• All user data and assignments will be removed</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Branding & Customization */}
            <div className="metric-card">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
                  <FileEdit className="h-5 w-5 text-success" />
                </div>
                <div>
                  <h3 className="font-semibold">Branding & Customization</h3>
                  <p className="text-sm text-muted-foreground">Customize your organization's look</p>
                </div>
              </div>
              <div className="space-y-4 text-sm">
                <div>
                  <h4 className="font-medium mb-2">Organization Branding</h4>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>• Navigate to Settings → Branding</li>
                    <li>• Upload your organization logo (PNG format recommended for transparency)</li>
                    <li>• Set primary, secondary, and accent colors</li>
                    <li>• Organization logo appears in the page header next to the title</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Global Branding (Admin)</h4>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>• Admins can set global branding for the login page</li>
                    <li>• Configure app name, tagline, and welcome message</li>
                    <li>• Set feature highlights displayed on the login page</li>
                    <li>• Adjust header font sizing (small to extra large)</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Logo Guidelines</h4>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>• Use PNG format for best transparency support</li>
                    <li>• Logo size can be adjusted: small, medium, large, or extra large</li>
                    <li>• Logo appears in page headers for easy brand visibility</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Role Management */}
            <div className="metric-card">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-info/10">
                  <Shield className="h-5 w-5 text-info" />
                </div>
                <div>
                  <h3 className="font-semibold">Roles & Permissions</h3>
                  <p className="text-sm text-muted-foreground">Understanding user roles</p>
                </div>
              </div>
              <div className="space-y-4 text-sm">
                <div>
                  <h4 className="font-medium mb-2">System Roles</h4>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>• <strong>Admin:</strong> Full system access, user management, delete users</li>
                    <li>• <strong>Programme Manager:</strong> Manage programmes and projects</li>
                    <li>• <strong>Project Manager:</strong> Manage assigned projects</li>
                    <li>• <strong>Team Member:</strong> View and update assigned tasks</li>
                    <li>• <strong>Viewer:</strong> Read-only access to assigned areas</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Custom Roles</h4>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>• Admins can create custom roles with specific permissions</li>
                    <li>• Assign granular permissions for each module</li>
                    <li>• Custom roles can be assigned to users like system roles</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Organization Management */}
            <div className="metric-card">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/10">
                  <Building2 className="h-5 w-5 text-warning" />
                </div>
                <div>
                  <h3 className="font-semibold">Organization Management</h3>
                  <p className="text-sm text-muted-foreground">Multi-org structure</p>
                </div>
              </div>
              <div className="space-y-4 text-sm">
                <div>
                  <h4 className="font-medium mb-2">Creating Organizations</h4>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>• Navigate to Admin Panel → Organizations</li>
                    <li>• Click "Create Organization" and enter details</li>
                    <li>• Each organization has its own branding settings</li>
                    <li>• Assign users to organizations for data segregation</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Switching Organizations</h4>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>• Use the organization selector in the sidebar</li>
                    <li>• Users only see organizations they have access to</li>
                    <li>• Data is filtered by the selected organization</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="principles" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-4">
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
                  <p className="text-sm text-muted-foreground">Programme Management</p>
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
          </div>
        </TabsContent>

        <TabsContent value="templates">
          <div className="metric-card">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredTemplates.map((template, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-secondary/50 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{template.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">{template.category}</Badge>
                        <Badge variant="secondary" className="text-xs">{template.type}</Badge>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8"
                      onClick={() => setSelectedTemplate(template)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8"
                      onClick={() => handleDownload(template)}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Template Preview Dialog */}
          <Dialog open={!!selectedTemplate} onOpenChange={() => setSelectedTemplate(null)}>
            <DialogContent className="max-w-4xl max-h-[90vh]">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  {selectedTemplate?.name}
                </DialogTitle>
                <DialogDescription>
                  <Badge variant="outline" className="mr-2">{selectedTemplate?.category}</Badge>
                  <Badge variant="secondary">{selectedTemplate?.type}</Badge>
                </DialogDescription>
              </DialogHeader>
              <div className="overflow-y-auto max-h-[60vh] bg-secondary/30 rounded-lg p-4">
                <pre className="text-sm whitespace-pre-wrap font-mono">{selectedTemplate?.content}</pre>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => handleCopy(selectedTemplate?.content || "")}>
                  {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                  {copied ? "Copied!" : "Copy to Clipboard"}
                </Button>
                <Button onClick={() => selectedTemplate && handleDownload(selectedTemplate)}>
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
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