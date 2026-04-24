/**
 * Built-in starter packs admins can install with one click.
 * Each adds a row to industry_verticals and (optionally) some vertical_entities.
 */
export interface SeedPack {
  id: string;
  name: string;
  description: string;
  icon: string;
  enabled_modules: string[];
  terminology_overrides: Record<string, string>;
  default_dashboards: string[];
  ai_context_prompt: string;
  entities?: {
    slug: string;
    name: string;
    name_plural: string;
    description: string;
    icon: string;
    fields: Array<{ key: string; label: string; type: "text" | "textarea" | "number" | "date" | "select"; options?: string[]; required?: boolean }>;
    default_status_options: string[];
  }[];
}

export const SEED_PACKS: SeedPack[] = [
  {
    id: "healthcare",
    name: "Healthcare",
    description: "Clinical projects, compliance and patient initiatives",
    icon: "Stethoscope",
    enabled_modules: ["programmes", "projects", "tasks", "risks", "issues", "reports", "knowledgebase", "incidents", "patient_cohorts"],
    terminology_overrides: { project: "Care Programme", stakeholder: "Patient Group" },
    default_dashboards: ["clinical_overview"],
    ai_context_prompt: "You are assisting a Healthcare team. Use clinical terminology, HIPAA awareness, patient outcomes.",
    entities: [
      {
        slug: "incidents",
        name: "Clinical Incident",
        name_plural: "Clinical Incidents",
        description: "Adverse events, near misses and patient safety reports",
        icon: "AlertTriangle",
        fields: [
          { key: "patient_ref", label: "Patient Reference", type: "text", required: true },
          { key: "severity", label: "Severity", type: "select", options: ["low", "moderate", "severe", "catastrophic"], required: true },
          { key: "narrative", label: "Narrative", type: "textarea", required: true },
        ],
        default_status_options: ["reported", "under_review", "resolved", "escalated"],
      },
    ],
  },
  {
    id: "manufacturing",
    name: "Manufacturing",
    description: "Production lines, work orders and quality control",
    icon: "Factory",
    enabled_modules: ["programmes", "projects", "tasks", "risks", "issues", "reports", "knowledgebase", "work_orders", "quality_checks"],
    terminology_overrides: { project: "Production Run", work_package: "Batch", stakeholder: "Supplier" },
    default_dashboards: ["throughput", "oee"],
    ai_context_prompt: "You are assisting a Manufacturing team. Reference OEE, work orders, lead time, scrap rate, supplier QA.",
    entities: [
      {
        slug: "work-orders",
        name: "Work Order",
        name_plural: "Work Orders",
        description: "Production and maintenance work orders",
        icon: "Wrench",
        fields: [
          { key: "wo_type", label: "Type", type: "select", options: ["production", "maintenance", "inspection"], required: true },
          { key: "asset", label: "Asset / Line", type: "text" },
          { key: "qty", label: "Quantity", type: "number" },
        ],
        default_status_options: ["scheduled", "in_progress", "complete", "on_hold"],
      },
    ],
  },
  {
    id: "education",
    name: "Education",
    description: "Curriculum, courses, learning outcomes and student initiatives",
    icon: "GraduationCap",
    enabled_modules: ["programmes", "projects", "tasks", "risks", "reports", "knowledgebase", "courses"],
    terminology_overrides: { programme: "Curriculum", project: "Course", stakeholder: "Student Cohort" },
    default_dashboards: ["enrolment", "outcomes"],
    ai_context_prompt: "You are assisting an Education team. Reference curriculum design, learning outcomes, accreditation, student engagement.",
    entities: [
      {
        slug: "courses",
        name: "Course",
        name_plural: "Courses",
        description: "Offered courses and modules",
        icon: "BookOpen",
        fields: [
          { key: "code", label: "Code", type: "text", required: true },
          { key: "credits", label: "Credits", type: "number" },
          { key: "level", label: "Level", type: "select", options: ["foundation", "undergrad", "grad", "post-grad"] },
        ],
        default_status_options: ["draft", "approved", "running", "retired"],
      },
    ],
  },
  {
    id: "legal",
    name: "Legal & Professional",
    description: "Matter management, deadlines, document review",
    icon: "Scale",
    enabled_modules: ["programmes", "projects", "tasks", "risks", "issues", "reports", "knowledgebase", "matters"],
    terminology_overrides: { project: "Matter", programme: "Practice Area", stakeholder: "Counterparty" },
    default_dashboards: ["matter_load", "billable_hours"],
    ai_context_prompt: "You are assisting a Legal practice. Reference matters, deadlines, conflicts checks, privilege, disclosure.",
    entities: [
      {
        slug: "matters",
        name: "Matter",
        name_plural: "Matters",
        description: "Legal matters and case files",
        icon: "Gavel",
        fields: [
          { key: "matter_type", label: "Matter Type", type: "select", options: ["litigation", "transactional", "advisory", "compliance"], required: true },
          { key: "client", label: "Client", type: "text", required: true },
          { key: "opposing", label: "Opposing Party", type: "text" },
        ],
        default_status_options: ["open", "discovery", "trial", "settled", "closed"],
      },
    ],
  },
  {
    id: "retail",
    name: "Retail & E-commerce",
    description: "Store ops, merchandising, inventory and seasonal launches",
    icon: "ShoppingBag",
    enabled_modules: ["programmes", "projects", "tasks", "risks", "issues", "reports", "knowledgebase", "store_initiatives"],
    terminology_overrides: { project: "Initiative", stakeholder: "Customer Segment" },
    default_dashboards: ["sales_lift", "shrinkage"],
    ai_context_prompt: "You are assisting a Retail team. Reference store ops, merchandising, seasonal calendar, inventory turn.",
  },
  {
    id: "non_profit",
    name: "Non-profit & NGO",
    description: "Grant programmes, donor relations, impact tracking",
    icon: "HandHeart",
    enabled_modules: ["programmes", "projects", "tasks", "risks", "reports", "knowledgebase", "grants"],
    terminology_overrides: { programme: "Programme", project: "Initiative", stakeholder: "Donor" },
    default_dashboards: ["impact", "grant_pipeline"],
    ai_context_prompt: "You are assisting a Non-profit/NGO team. Reference grants, beneficiaries, theory of change, impact measurement.",
    entities: [
      {
        slug: "grants",
        name: "Grant",
        name_plural: "Grants",
        description: "Grant applications and awards",
        icon: "Award",
        fields: [
          { key: "funder", label: "Funder", type: "text", required: true },
          { key: "amount", label: "Amount", type: "number" },
          { key: "deadline", label: "Application Deadline", type: "date" },
        ],
        default_status_options: ["prospect", "submitted", "awarded", "declined", "reporting"],
      },
    ],
  },
];
