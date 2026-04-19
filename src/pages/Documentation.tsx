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
  CalendarCheck
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
    <AppLayout title="Principles" subtitle="PRINCE2, MSP, Agile & Product Management resources">
      {/* Search */}
      <div className="flex gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search principles..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <Tabs defaultValue="principles" className="space-y-6">
        <TabsList className="bg-secondary">
          <TabsTrigger value="principles">Principles</TabsTrigger>
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

            {/* Roles & Permissions */}
            <div className="metric-card">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-info/10">
                  <Shield className="h-5 w-5 text-info" />
                </div>
                <div>
                  <h3 className="font-semibold">Roles & Permissions</h3>
                  <p className="text-sm text-muted-foreground">Understanding user roles and stakeholder access</p>
                </div>
              </div>
              <div className="space-y-4 text-sm">
                <div>
                  <h4 className="font-medium mb-2">System Roles</h4>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>• <strong>Admin:</strong> Full system access, user management, delete users</li>
                    <li>• <strong>Program Manager:</strong> Manage programs and projects</li>
                    <li>• <strong>Project Manager:</strong> Manage assigned projects</li>
                    <li>• <strong>Team Member:</strong> View and update assigned tasks</li>
                    <li>• <strong>Viewer:</strong> Read-only access to assigned areas</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Stakeholder Roles</h4>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>• <strong>Organization Stakeholder:</strong> View-only access to the entire organization's data</li>
                    <li>• <strong>Programme Stakeholder:</strong> View-only access to assigned programmes</li>
                    <li>• <strong>Project Stakeholder:</strong> View-only access to assigned projects</li>
                    <li>• <strong>Product Stakeholder:</strong> View-only access to assigned products</li>
                    <li>• Stakeholders cannot submit updates or reports</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Custom Roles</h4>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>• Admins can create custom roles with specific permissions</li>
                    <li>• Assign granular permissions for each module (risks, issues, benefits, etc.)</li>
                    <li>• Custom roles can be assigned to users like system roles</li>
                    <li>• The "Administrator" role is locked and cannot be modified</li>
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
                  <p className="text-sm text-muted-foreground">Multi-tenant structure</p>
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
                    <li>• All data is siloed by the selected organization (RLS)</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Organization Access Levels</h4>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>• <strong>Admin:</strong> Full control over org settings and users</li>
                    <li>• <strong>Editor:</strong> Create and modify programmes, projects, products</li>
                    <li>• <strong>Viewer:</strong> Read-only access to org data</li>
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
                    <li>• Upload your organization logo (PNG format recommended)</li>
                    <li>• Set primary, secondary, and accent colors</li>
                    <li>• Organization logo appears in the page header</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Global Branding (Admin)</h4>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>• Set global branding for the login page</li>
                    <li>• Configure app name, tagline, and welcome message</li>
                    <li>• Set feature highlights displayed on the login page</li>
                    <li>• Adjust header font sizing (small to extra large)</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Programme Management */}
            <div className="metric-card">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Layers className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold">Programme Management</h3>
                  <p className="text-sm text-muted-foreground">MSP-based programme lifecycle</p>
                </div>
              </div>
              <div className="space-y-4 text-sm">
                <div>
                  <h4 className="font-medium mb-2">Creating & Managing Programmes</h4>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>• Navigate to Programmes and click "New Programme"</li>
                    <li>• Set name, description, dates, budget, and benefits target</li>
                    <li>• Assign a programme manager and sponsor</li>
                    <li>• Link projects to the programme for traceability</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Programme Tabs</h4>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>• <strong>Blueprint:</strong> Vision, objectives, and programme brief</li>
                    <li>• <strong>Definition:</strong> Scope, strategic objectives, constraints</li>
                    <li>• <strong>Tranches:</strong> Manage delivery phases with start/end dates</li>
                    <li>• <strong>Success Plan:</strong> Track KPIs, targets, and success criteria</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Multi-User Assignments</h4>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>• Assign multiple users to a programme with roles (Lead, Contributor, Reviewer)</li>
                    <li>• All assigned users receive update reminders</li>
                    <li>• Each user is individually responsible for submitting updates</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Project Management */}
            <div className="metric-card">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
                  <FolderKanban className="h-5 w-5 text-success" />
                </div>
                <div>
                  <h3 className="font-semibold">Project Management</h3>
                  <p className="text-sm text-muted-foreground">PRINCE2-based project controls</p>
                </div>
              </div>
              <div className="space-y-4 text-sm">
                <div>
                  <h4 className="font-medium mb-2">Creating Projects</h4>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>• Navigate to Projects and click "New Project"</li>
                    <li>• Set methodology (PRINCE2, Agile, Hybrid, Waterfall)</li>
                    <li>• Link to a programme for cross-entity traceability</li>
                    <li>• Assign project manager and set priority/health status</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Project Details</h4>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>• <strong>Overview:</strong> Key metrics, budget, timeline</li>
                    <li>• <strong>Registers:</strong> Linked risks, issues, lessons, benefits</li>
                    <li>• <strong>Updates:</strong> Progress updates with frequency settings</li>
                    <li>• <strong>Documents:</strong> Upload and manage supporting files</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Status & Lifecycle</h4>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>• Projects follow defined stage gates</li>
                    <li>• Status changes are tracked in an audit trail</li>
                    <li>• Health indicators: Green, Amber, Red</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Product Management */}
            <div className="metric-card">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-info/10">
                  <Package className="h-5 w-5 text-info" />
                </div>
                <div>
                  <h3 className="font-semibold">Product Management</h3>
                  <p className="text-sm text-muted-foreground">Roadmap, backlog, and lifecycle</p>
                </div>
              </div>
              <div className="space-y-4 text-sm">
                <div>
                  <h4 className="font-medium mb-2">Creating Products</h4>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>• Navigate to Products and click "New Product"</li>
                    <li>• Set vision, value proposition, target market, and North Star metric</li>
                    <li>• Choose product type: Digital, Physical, Service, Platform, Hybrid</li>
                    <li>• Link to a programme and/or project</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Product Features</h4>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>• <strong>Roadmap:</strong> Visual quarterly timeline of features</li>
                    <li>• <strong>Kanban Board:</strong> Drag-and-drop feature management</li>
                    <li>• <strong>RICE Scoring:</strong> Reach, Impact, Confidence, Effort prioritization</li>
                    <li>• <strong>MoSCoW:</strong> Must/Should/Could/Won't categorization</li>
                    <li>• <strong>Dependencies:</strong> Visualize feature-to-feature dependencies</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Lifecycle Stages</h4>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>• Discovery → Definition → Development → Launch → Growth → Maturity → Decline → Retired</li>
                    <li>• Revenue target and launch date tracking</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Updates & Frequency Settings */}
            <div className="metric-card">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/10">
                  <Clock className="h-5 w-5 text-warning" />
                </div>
                <div>
                  <h3 className="font-semibold">Updates & Reporting</h3>
                  <p className="text-sm text-muted-foreground">Configurable update frequencies and status reports</p>
                </div>
              </div>
              <div className="space-y-4 text-sm">
                <div>
                  <h4 className="font-medium mb-2">Submitting Updates</h4>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>• Navigate to Updates to create status reports</li>
                    <li>• Select the entity type (Programme, Project, Product) and entity</li>
                    <li>• Enter highlights, risks/issues, and next week plans</li>
                    <li>• Set overall health (Green, Amber, Red)</li>
                    <li>• Updates are automatically synced to the entity's progress feed</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Update Frequency Settings</h4>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>• Set update frequency per entity: Daily, Weekly, Monthly, or Custom</li>
                    <li>• Toggle "Mandatory" to require updates from all assigned users</li>
                    <li>• Configure reminder timing (hours before due)</li>
                    <li>• Organization-wide defaults can be set with per-entity overrides</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Automated Reminders</h4>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>• System checks for due/overdue updates every hour</li>
                    <li>• In-app notifications sent to all assigned users</li>
                    <li>• Email reminders sent when email domain is configured</li>
                    <li>• Each assigned user is individually responsible for their update</li>
                    <li>• Stakeholder roles are excluded from update requirements</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Multi-User Assignments */}
            <div className="metric-card">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <UserPlus className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold">Multi-User Assignments</h3>
                  <p className="text-sm text-muted-foreground">Assign multiple users to entities</p>
                </div>
              </div>
              <div className="space-y-4 text-sm">
                <div>
                  <h4 className="font-medium mb-2">Entity Assignments</h4>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>• Programmes, Projects, and Products support multi-user assignment</li>
                    <li>• Navigate to any entity detail page to see the "Assigned Users" panel</li>
                    <li>• Select a user from the organization and assign a role</li>
                    <li>• Available roles: Lead, Contributor, Reviewer</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Task Assignments</h4>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>• Tasks support multiple assignees</li>
                    <li>• Expand a task row to see and manage assigned users</li>
                    <li>• Each assignee receives individual update reminders</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Permissions</h4>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>• Editors and above can assign/remove users</li>
                    <li>• Users who assigned someone can also remove them</li>
                    <li>• Admins can manage all assignments</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Task Management */}
            <div className="metric-card">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
                  <ListChecks className="h-5 w-5 text-success" />
                </div>
                <div>
                  <h3 className="font-semibold">Task Management</h3>
                  <p className="text-sm text-muted-foreground">Tasks, work packages, and sprints</p>
                </div>
              </div>
              <div className="space-y-4 text-sm">
                <div>
                  <h4 className="font-medium mb-2">Creating & Managing Tasks</h4>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>• Create tasks linked to programmes, projects, or products</li>
                    <li>• Set priority, status, due dates, and story points</li>
                    <li>• Assign multiple users to each task</li>
                    <li>• Expand task rows to add progress updates</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Work Packages</h4>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>• Group related tasks and milestones into work packages</li>
                    <li>• Track level of effort (LOE) and story points</li>
                    <li>• Link work packages to projects for traceability</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Sprint Planning</h4>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>• Create sprints with start/end dates and capacity</li>
                    <li>• Assign backlog items to sprints</li>
                    <li>• Track velocity and burndown progress</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Unified Backlog</h4>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>• View and manage items across all entities in one place</li>
                    <li>• Filter by entity, priority, status, and assignee</li>
                    <li>• Drag items between sprint and backlog</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Registers */}
            <div className="metric-card">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                </div>
                <div>
                  <h3 className="font-semibold">Registers</h3>
                  <p className="text-sm text-muted-foreground">Risks, Issues, Benefits, Lessons, Stakeholders</p>
                </div>
              </div>
              <div className="space-y-4 text-sm">
                <div>
                  <h4 className="font-medium mb-2">Register Types</h4>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>• <strong>Risk Register:</strong> Probability, impact, score matrix, response strategies</li>
                    <li>• <strong>Issue Register:</strong> Track and resolve issues with priority levels</li>
                    <li>• <strong>Benefits Register:</strong> Target vs. actual value, realization tracking</li>
                    <li>• <strong>Lessons Learned:</strong> Capture root causes and recommendations</li>
                    <li>• <strong>Stakeholder Register:</strong> Influence, interest, engagement strategy</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Cross-Entity Traceability</h4>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>• All register items can be linked to Programmes, Projects, and Products</li>
                    <li>• Filter registers by entity and status using popover filters</li>
                    <li>• View linked items from entity detail pages</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Editing & Deleting</h4>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>• Click any register row to edit details</li>
                    <li>• Only administrators can permanently delete register items</li>
                    <li>• Deletion requires confirmation and cannot be undone</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Document Management */}
            <div className="metric-card">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-info/10">
                  <Upload className="h-5 w-5 text-info" />
                </div>
                <div>
                  <h3 className="font-semibold">Document Management</h3>
                  <p className="text-sm text-muted-foreground">Upload and manage files</p>
                </div>
              </div>
              <div className="space-y-4 text-sm">
                <div>
                  <h4 className="font-medium mb-2">Uploading Documents</h4>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>• Documents can be attached to any entity (programme, project, product, etc.)</li>
                    <li>• Navigate to the entity detail page → Documents tab</li>
                    <li>• Drag and drop or click to upload files</li>
                    <li>• Files are stored securely with organization-level access control</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Accessing Documents</h4>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>• Documents use signed URLs for secure, time-limited access</li>
                    <li>• Only users with access to the organization can view documents</li>
                    <li>• Download documents directly from the file list</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Status Management */}
            <div className="metric-card">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/10">
                  <GitBranch className="h-5 w-5 text-warning" />
                </div>
                <div>
                  <h3 className="font-semibold">Status Management & Audit Trail</h3>
                  <p className="text-sm text-muted-foreground">Lifecycle tracking and history</p>
                </div>
              </div>
              <div className="space-y-4 text-sm">
                <div>
                  <h4 className="font-medium mb-2">Status Changes</h4>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>• Projects, programmes, and products have lifecycle status workflows</li>
                    <li>• Use the status action buttons on detail pages to transition states</li>
                    <li>• Each status change requires a reason/notes</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Audit Trail</h4>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>• All status changes are logged in the status_history table</li>
                    <li>• View complete history via the "Status History" button</li>
                    <li>• Records include who changed it, when, from/to status, and notes</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Milestones & Stage Gates */}
            <div className="metric-card">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
                  <Target className="h-5 w-5 text-success" />
                </div>
                <div>
                  <h3 className="font-semibold">Milestones & Stage Gates</h3>
                  <p className="text-sm text-muted-foreground">Delivery checkpoints and governance</p>
                </div>
              </div>
              <div className="space-y-4 text-sm">
                <div>
                  <h4 className="font-medium mb-2">Milestones</h4>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>• Create milestones linked to programmes, projects, or products</li>
                    <li>• Set target and actual dates, acceptance criteria, and deliverables</li>
                    <li>• Mark milestones as stage boundaries for PRINCE2 governance</li>
                    <li>• Link milestones to work packages for tracking</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Stage Gates</h4>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>• Define gate criteria for each project stage</li>
                    <li>• Track gate approvals and decision outcomes</li>
                    <li>• Use stage gates for go/no-go decisions</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Change Control & Exceptions */}
            <div className="metric-card">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10">
                  <CalendarCheck className="h-5 w-5 text-destructive" />
                </div>
                <div>
                  <h3 className="font-semibold">Change Control & Exceptions</h3>
                  <p className="text-sm text-muted-foreground">Manage changes and tolerance breaches</p>
                </div>
              </div>
              <div className="space-y-4 text-sm">
                <div>
                  <h4 className="font-medium mb-2">Change Requests</h4>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>• Submit change requests with impact assessment</li>
                    <li>• Track cost, time, quality, and risk impacts</li>
                    <li>• Workflow: Submitted → Under Review → Approved/Rejected → Implemented</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Exception Management</h4>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>• Raise exceptions when tolerances are breached</li>
                    <li>• Track original tolerance vs. current forecast</li>
                    <li>• Escalation tracking with resolution workflow</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Notifications & AI */}
            <div className="metric-card">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Bell className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold">Notifications & AI Assistant</h3>
                  <p className="text-sm text-muted-foreground">Alerts and intelligent guidance</p>
                </div>
              </div>
              <div className="space-y-4 text-sm">
                <div>
                  <h4 className="font-medium mb-2">Notification Bell</h4>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>• Bell icon in the header shows unread notification count</li>
                    <li>• Notifications for due updates, overdue reports, and high-impact risks</li>
                    <li>• Click notifications to navigate directly to the relevant page</li>
                    <li>• Mark all as read or dismiss individual notifications</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Ask the Task Master (AI)</h4>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>• Access via the chat icon in the sidebar or header</li>
                    <li>• Ask questions about PRINCE2, MSP, Agile, and platform usage</li>
                    <li>• Get guidance on methodology processes and best practices</li>
                    <li>• Chat history is saved for reference</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Quality & Requirements */}
            <div className="metric-card">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-info/10">
                  <BarChart3 className="h-5 w-5 text-info" />
                </div>
                <div>
                  <h3 className="font-semibold">Quality & Requirements</h3>
                  <p className="text-sm text-muted-foreground">Quality management and requirements tracing</p>
                </div>
              </div>
              <div className="space-y-4 text-sm">
                <div>
                  <h4 className="font-medium mb-2">Quality Management</h4>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>• Create quality records (reviews, inspections, audits, testing)</li>
                    <li>• Track acceptance criteria, review methods, and defects</li>
                    <li>• Approval workflow with reviewer assignments</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Business Requirements</h4>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>• Capture requirements with reference numbers and categories</li>
                    <li>• Link to programmes, projects, and products</li>
                    <li>• Track status: Draft → Under Review → Approved → Implemented</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Technical Requirements</h4>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>• Define technical specifications and constraints</li>
                    <li>• Separate from business requirements for clarity</li>
                    <li>• Full traceability to parent entities</li>
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