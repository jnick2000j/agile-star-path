// Catalog of platform email triggers that admins can toggle on/off.
// Keep these keys in sync with the `triggerKey` values passed to
// `sendTransactionalEmail` (Edge Functions) and `sendEmail` (shared helper).

export type EmailTriggerCategory =
  | "User management"
  | "Helpdesk"
  | "Change management"
  | "Programmes & projects"
  | "Workflow"
  | "Reports"
  | "System";

export interface EmailTriggerDef {
  key: string;
  category: EmailTriggerCategory;
  label: string;
  description: string;
}

export const EMAIL_TRIGGERS: EmailTriggerDef[] = [
  {
    key: "user_invite",
    category: "User management",
    label: "User invitations",
    description: "Invitation emails sent when a new user is added to the platform.",
  },
  {
    key: "user_invite_resend",
    category: "User management",
    label: "Re-sent invitations",
    description: "Sent when an admin re-sends an existing user's invite.",
  },
  {
    key: "org_suspension",
    category: "User management",
    label: "Account suspension / reinstatement",
    description: "Notifies organization admins when their org is suspended or reinstated.",
  },
  {
    key: "helpdesk_ticket_created",
    category: "Helpdesk",
    label: "New ticket created",
    description: "Sent to assigned agents and queue members when a new ticket arrives.",
  },
  {
    key: "helpdesk_ticket_reply",
    category: "Helpdesk",
    label: "Ticket replies & internal notes",
    description: "Notifies participants when a ticket receives a new reply or note.",
  },
  {
    key: "helpdesk_ticket_assigned",
    category: "Helpdesk",
    label: "Ticket assignment",
    description: "Sent when a ticket is assigned to an agent or queue.",
  },
  {
    key: "helpdesk_ticket_status",
    category: "Helpdesk",
    label: "Ticket status changes",
    description: "Including status updates and resolution notifications.",
  },
  {
    key: "helpdesk_sla_warning",
    category: "Helpdesk",
    label: "SLA warnings",
    description: "Alerts when a ticket is approaching or has breached SLA.",
  },
  {
    key: "helpdesk_report",
    category: "Helpdesk",
    label: "Scheduled helpdesk reports",
    description: "CSV reports emailed on a schedule.",
  },
  {
    key: "cm_activity",
    category: "Change management",
    label: "Change management activity",
    description: "Notifies owners and stakeholders of change-record activity.",
  },
  {
    key: "milestone_change",
    category: "Programmes & projects",
    label: "Milestone changes",
    description: "Owner notifications when milestone status or dates change.",
  },
  {
    key: "update_reminder",
    category: "Programmes & projects",
    label: "Status update reminders",
    description: "Reminders for owners with overdue or upcoming status updates.",
  },
  {
    key: "weekly_report",
    category: "Reports",
    label: "Weekly programme report",
    description: "Weekly stakeholder digest of programme status.",
  },
  {
    key: "construction_weekly_report",
    category: "Reports",
    label: "Weekly construction report",
    description: "Weekly progress report for construction projects.",
  },
  {
    key: "workflow_assignment",
    category: "Workflow",
    label: "Workflow assignments",
    description: "Sent when a user is assigned to a workflow step.",
  },
  {
    key: "sso_request",
    category: "System",
    label: "SSO/SAML setup requests",
    description: "Notifies platform administrators of new SSO requests.",
  },
  {
    key: "system_notification",
    category: "System",
    label: "General system notifications",
    description: "Catch-all for ad-hoc system notifications dispatched by the platform.",
  },
];

export const EMAIL_TRIGGER_CATEGORIES: EmailTriggerCategory[] = [
  "User management",
  "Helpdesk",
  "Change management",
  "Programmes & projects",
  "Workflow",
  "Reports",
  "System",
];
