import type { ViewSchema } from "./types";

export const risksSchema: ViewSchema = {
  scope: "risks.list",
  layouts: ["table"],
  fields: [
    { key: "title", label: "Title", type: "text", defaultVisible: true },
    { key: "reference_number", label: "Reference", type: "text", defaultVisible: true },
    {
      key: "status",
      label: "Status",
      type: "enum",
      defaultVisible: true,
      groupable: true,
      options: [
        { value: "open", label: "Open" },
        { value: "mitigating", label: "Mitigating" },
        { value: "closed", label: "Closed" },
        { value: "accepted", label: "Accepted" },
      ],
    },
    {
      key: "category",
      label: "Category",
      type: "enum",
      defaultVisible: true,
      groupable: true,
      options: [
        "Resource", "Technical", "Compliance", "Financial", "Stakeholder", "Quality", "Commercial",
      ].map((v) => ({ value: v, label: v })),
    },
    {
      key: "probability",
      label: "Probability",
      type: "enum",
      options: [
        { value: "very-low", label: "Very Low" },
        { value: "low", label: "Low" },
        { value: "medium", label: "Medium" },
        { value: "high", label: "High" },
        { value: "very-high", label: "Very High" },
      ],
    },
    {
      key: "impact",
      label: "Impact",
      type: "enum",
      options: [
        { value: "very-low", label: "Very Low" },
        { value: "low", label: "Low" },
        { value: "medium", label: "Medium" },
        { value: "high", label: "High" },
        { value: "very-high", label: "Very High" },
      ],
    },
    { key: "score", label: "Score", type: "number", defaultVisible: true },
    { key: "owner_id", label: "Owner", type: "user", groupable: true },
    { key: "review_date", label: "Review date", type: "date" },
    { key: "date_identified", label: "Identified", type: "date" },
    { key: "created_at", label: "Created", type: "date" },
  ],
};

export const issuesSchema: ViewSchema = {
  scope: "issues.list",
  layouts: ["table"],
  fields: [
    { key: "title", label: "Title", type: "text", defaultVisible: true },
    { key: "reference_number", label: "Reference", type: "text", defaultVisible: true },
    {
      key: "status",
      label: "Status",
      type: "enum",
      defaultVisible: true,
      groupable: true,
      options: [
        { value: "open", label: "Open" },
        { value: "investigating", label: "Investigating" },
        { value: "pending", label: "Pending" },
        { value: "resolved", label: "Resolved" },
        { value: "closed", label: "Closed" },
      ],
    },
    {
      key: "type",
      label: "Type",
      type: "enum",
      defaultVisible: true,
      groupable: true,
      options: [
        { value: "problem", label: "Problem" },
        { value: "concern", label: "Concern" },
        { value: "change-request", label: "Change Request" },
        { value: "off-specification", label: "Off-Spec" },
      ],
    },
    {
      key: "priority",
      label: "Priority",
      type: "enum",
      defaultVisible: true,
      groupable: true,
      options: [
        { value: "critical", label: "Critical" },
        { value: "high", label: "High" },
        { value: "medium", label: "Medium" },
        { value: "low", label: "Low" },
      ],
    },
    { key: "owner_id", label: "Owner", type: "user", groupable: true },
    { key: "target_date", label: "Target date", type: "date" },
    { key: "date_raised", label: "Raised", type: "date" },
    { key: "created_at", label: "Created", type: "date" },
  ],
};

export const projectsSchema: ViewSchema = {
  scope: "projects.list",
  layouts: ["table", "board"],
  fields: [
    { key: "name", label: "Name", type: "text", defaultVisible: true },
    {
      key: "stage",
      label: "Stage",
      type: "enum",
      defaultVisible: true,
      groupable: true,
      options: [
        { value: "initiating", label: "Initiating" },
        { value: "planning", label: "Planning" },
        { value: "executing", label: "Executing" },
        { value: "closing", label: "Closing" },
        { value: "completed", label: "Completed" },
      ],
    },
    {
      key: "priority",
      label: "Priority",
      type: "enum",
      defaultVisible: true,
      groupable: true,
      options: [
        { value: "high", label: "High" },
        { value: "medium", label: "Medium" },
        { value: "low", label: "Low" },
      ],
    },
    {
      key: "health",
      label: "Health",
      type: "enum",
      defaultVisible: true,
      groupable: true,
      options: [
        { value: "green", label: "Green" },
        { value: "amber", label: "Amber" },
        { value: "red", label: "Red" },
      ],
    },
    { key: "methodology", label: "Methodology", type: "text" },
    { key: "manager_id", label: "Manager", type: "user", groupable: true },
    { key: "start_date", label: "Start", type: "date" },
    { key: "end_date", label: "End", type: "date" },
  ],
};

export const programmesSchema: ViewSchema = {
  scope: "programmes.list",
  layouts: ["table", "board"],
  fields: [
    { key: "name", label: "Name", type: "text", defaultVisible: true },
    {
      key: "status",
      label: "Status",
      type: "enum",
      defaultVisible: true,
      groupable: true,
      options: [
        { value: "active", label: "Active" },
        { value: "at-risk", label: "At Risk" },
        { value: "on-hold", label: "On Hold" },
        { value: "completed", label: "Completed" },
        { value: "pending", label: "Pending" },
        { value: "rejected", label: "Rejected" },
        { value: "deferred", label: "Deferred" },
        { value: "closed", label: "Closed" },
      ],
    },
    { key: "manager_id", label: "Manager", type: "user", groupable: true },
    { key: "sponsor", label: "Sponsor", type: "text" },
    { key: "tranche", label: "Tranche", type: "text", groupable: true },
    { key: "progress", label: "Progress", type: "number" },
    { key: "start_date", label: "Start", type: "date" },
    { key: "end_date", label: "End", type: "date" },
  ],
};

export const productsSchema: ViewSchema = {
  scope: "products.portfolio",
  layouts: ["table"],
  fields: [
    { key: "name", label: "Name", type: "text", defaultVisible: true },
    {
      key: "stage",
      label: "Stage",
      type: "enum",
      defaultVisible: true,
      groupable: true,
      options: [
        { value: "discovery", label: "Discovery" },
        { value: "definition", label: "Definition" },
        { value: "development", label: "Development" },
        { value: "launch", label: "Launch" },
        { value: "growth", label: "Growth" },
        { value: "maturity", label: "Maturity" },
        { value: "decline", label: "Decline" },
        { value: "retired", label: "Retired" },
      ],
    },
    {
      key: "status",
      label: "Status",
      type: "enum",
      defaultVisible: true,
      groupable: true,
      options: [
        { value: "concept", label: "Concept" },
        { value: "in_development", label: "In Development" },
        { value: "active", label: "Active" },
        { value: "on_hold", label: "On Hold" },
        { value: "deprecated", label: "Deprecated" },
        { value: "retired", label: "Retired" },
      ],
    },
    { key: "product_type", label: "Type", type: "text", groupable: true },
    { key: "target_market", label: "Target market", type: "text" },
    { key: "launch_date", label: "Launch date", type: "date" },
  ],
};

export const featuresSchema: ViewSchema = {
  scope: "features.backlog",
  layouts: ["kanban", "table"],
  fields: [
    { key: "name", label: "Name", type: "text", defaultVisible: true },
    { key: "reference_number", label: "Reference", type: "text" },
    {
      key: "status",
      label: "Status",
      type: "enum",
      defaultVisible: true,
      groupable: true,
      options: [
        { value: "backlog", label: "Backlog" },
        { value: "planned", label: "Planned" },
        { value: "in_progress", label: "In Progress" },
        { value: "review", label: "Review" },
        { value: "done", label: "Done" },
      ],
    },
    {
      key: "priority",
      label: "Priority",
      type: "enum",
      defaultVisible: true,
      groupable: true,
      options: [
        { value: "high", label: "High" },
        { value: "medium", label: "Medium" },
        { value: "low", label: "Low" },
      ],
    },
    {
      key: "moscow",
      label: "MoSCoW",
      type: "enum",
      groupable: true,
      options: [
        { value: "must", label: "Must Have" },
        { value: "should", label: "Should Have" },
        { value: "could", label: "Could Have" },
        { value: "wont", label: "Won't Have" },
      ],
    },
    { key: "product_id", label: "Product", type: "ref", groupable: true },
    { key: "target_release", label: "Release", type: "text", groupable: true },
    { key: "story_points", label: "Story points", type: "number" },
  ],
};

export const workPackagesSchema: ViewSchema = {
  scope: "work-packages.list",
  layouts: ["table"],
  fields: [
    { key: "name", label: "Name", type: "text", defaultVisible: true },
    {
      key: "status",
      label: "Status",
      type: "enum",
      defaultVisible: true,
      groupable: true,
      options: [
        { value: "pending", label: "Pending" },
        { value: "authorized", label: "Authorized" },
        { value: "in_progress", label: "In Progress" },
        { value: "completed", label: "Completed" },
        { value: "closed", label: "Closed" },
      ],
    },
    { key: "project_id", label: "Project", type: "ref", groupable: true },
    { key: "assigned_to", label: "Assigned to", type: "text", groupable: true },
    { key: "progress", label: "Progress", type: "number" },
    { key: "target_start", label: "Start", type: "date" },
    { key: "target_end", label: "End", type: "date" },
  ],
};

export const changesSchema: ViewSchema = {
  scope: "change-management.list",
  layouts: ["table"],
  fields: [
    { key: "title", label: "Title", type: "text", defaultVisible: true },
    { key: "reference_number", label: "Reference", type: "text", defaultVisible: true },
    {
      key: "status",
      label: "Status",
      type: "enum",
      defaultVisible: true,
      groupable: true,
      options: [
        "draft", "submitted", "in_review", "cab_review", "needs_information",
        "approved", "rejected", "scheduled", "in_progress", "implemented",
        "closed", "cancelled", "failed",
      ].map((v) => ({ value: v, label: v.replace(/_/g, " ") })),
    },
    {
      key: "change_type",
      label: "Type",
      type: "enum",
      defaultVisible: true,
      groupable: true,
      options: [
        { value: "standard", label: "Standard" },
        { value: "normal", label: "Normal" },
        { value: "emergency", label: "Emergency" },
        { value: "operational", label: "Operational" },
      ],
    },
    {
      key: "urgency",
      label: "Urgency",
      type: "enum",
      groupable: true,
      options: [
        { value: "critical", label: "Critical" },
        { value: "high", label: "High" },
        { value: "medium", label: "Medium" },
        { value: "low", label: "Low" },
      ],
    },
    { key: "planned_start_at", label: "Planned start", type: "date" },
    { key: "created_at", label: "Created", type: "date" },
  ],
};

export const tasksSchema: ViewSchema = {
  scope: "tasks.list",
  layouts: ["table"],
  fields: [
    { key: "name", label: "Name", type: "text", defaultVisible: true },
    { key: "reference_number", label: "Reference", type: "text" },
    {
      key: "status",
      label: "Status",
      type: "enum",
      defaultVisible: true,
      groupable: true,
      options: [
        { value: "not_started", label: "Not Started" },
        { value: "in_progress", label: "In Progress" },
        { value: "on_hold", label: "On Hold" },
        { value: "completed", label: "Completed" },
        { value: "cancelled", label: "Cancelled" },
      ],
    },
    {
      key: "priority",
      label: "Priority",
      type: "enum",
      defaultVisible: true,
      groupable: true,
      options: [
        { value: "high", label: "High" },
        { value: "medium", label: "Medium" },
        { value: "low", label: "Low" },
      ],
    },
    {
      key: "entity_type",
      label: "Linked to",
      type: "enum",
      groupable: true,
      options: [
        { value: "project", label: "Project" },
        { value: "programme", label: "Programme" },
        { value: "product", label: "Product" },
        { value: "work_package", label: "Work package" },
        { value: "risk", label: "Risk" },
        { value: "issue", label: "Issue" },
      ],
    },
    { key: "assigned_to", label: "Assignee", type: "user", groupable: true },
    { key: "planned_start", label: "Planned start", type: "date" },
    { key: "planned_end", label: "Planned end", type: "date" },
    { key: "estimated_hours", label: "Est. hours", type: "number" },
    { key: "completion_percentage", label: "Completion %", type: "number" },
  ],
};
