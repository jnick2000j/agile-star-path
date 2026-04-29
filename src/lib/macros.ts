// Helpdesk macro variable interpolation
// Supported tokens: {{ticket.ref}}, {{ticket.subject}}, {{ticket.status}},
// {{ticket.priority}}, {{ticket.type}}, {{customer.first_name}},
// {{customer.last_name}}, {{customer.name}}, {{customer.email}},
// {{agent.first_name}}, {{agent.last_name}}, {{agent.name}},
// {{org.name}}, {{date.today}}

export interface MacroContext {
  ticket?: {
    reference_number?: string | null;
    subject?: string | null;
    status?: string | null;
    priority?: string | null;
    type?: string | null;
  } | null;
  customer?: {
    first_name?: string | null;
    last_name?: string | null;
    email?: string | null;
  } | null;
  agent?: {
    first_name?: string | null;
    last_name?: string | null;
  } | null;
  organization?: { name?: string | null } | null;
}

const safe = (v: unknown) =>
  v === null || v === undefined || v === "" ? "" : String(v);

export function renderMacro(template: string, ctx: MacroContext): string {
  const today = new Date().toLocaleDateString();

  const customerFull = [ctx.customer?.first_name, ctx.customer?.last_name]
    .filter(Boolean).join(" ").trim();
  const agentFull = [ctx.agent?.first_name, ctx.agent?.last_name]
    .filter(Boolean).join(" ").trim();

  const map: Record<string, string> = {
    "ticket.ref": safe(ctx.ticket?.reference_number),
    "ticket.subject": safe(ctx.ticket?.subject),
    "ticket.status": safe(ctx.ticket?.status),
    "ticket.priority": safe(ctx.ticket?.priority),
    "ticket.type": safe(ctx.ticket?.type),
    "customer.first_name": safe(ctx.customer?.first_name),
    "customer.last_name": safe(ctx.customer?.last_name),
    "customer.name": customerFull || safe(ctx.customer?.first_name),
    "customer.email": safe(ctx.customer?.email),
    "agent.first_name": safe(ctx.agent?.first_name),
    "agent.last_name": safe(ctx.agent?.last_name),
    "agent.name": agentFull || safe(ctx.agent?.first_name),
    "org.name": safe(ctx.organization?.name),
    "date.today": today,
  };

  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key) => {
    const k = String(key).trim();
    if (k in map) return map[k];
    return `{{${k}}}`; // leave unknown tokens visible
  });
}

export const MACRO_VARIABLES: Array<{ token: string; label: string }> = [
  { token: "{{customer.first_name}}", label: "Customer first name" },
  { token: "{{customer.last_name}}", label: "Customer last name" },
  { token: "{{customer.name}}", label: "Customer full name" },
  { token: "{{customer.email}}", label: "Customer email" },
  { token: "{{agent.first_name}}", label: "Agent first name" },
  { token: "{{agent.name}}", label: "Agent full name" },
  { token: "{{ticket.ref}}", label: "Ticket reference" },
  { token: "{{ticket.subject}}", label: "Ticket subject" },
  { token: "{{ticket.status}}", label: "Ticket status" },
  { token: "{{ticket.priority}}", label: "Ticket priority" },
  { token: "{{ticket.type}}", label: "Ticket type" },
  { token: "{{org.name}}", label: "Organization name" },
  { token: "{{date.today}}", label: "Today's date" },
];
