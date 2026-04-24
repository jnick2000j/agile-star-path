import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { sendEmail, isEmailConfigured } from "../_shared/email.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type EventType =
  | "task_assignment"
  | "entity_assignment"
  | "timesheet_submitted"
  | "timesheet_decision"
  | "workflow_decision"
  | "helpdesk_workflow_pending"
  | "helpdesk_workflow_decision";

interface Payload {
  event_type: EventType;
  recipient_user_id?: string;
  recipient_user_ids?: string[];
  actor_user_id?: string | null;
  organization_id?: string | null;
  link?: string | null;
  title?: string | null;
  message?: string | null;
  entity_type?: string | null;
  entity_id?: string | null;
  task_id?: string | null;
  task_name?: string | null;
  task_status?: string | null;
  task_priority?: string | null;
  assignment_role?: string | null;
  programme_id?: string | null;
  project_id?: string | null;
  product_id?: string | null;
  timesheet_id?: string | null;
  timesheet_reference?: string | null;
  timesheet_status?: string | null;
  helpdesk_approval_id?: string | null;
  workflow_approval_id?: string | null;
  decision?: string | null;
  decision_comment?: string | null;
  approval_role?: string | null;
  extra?: Record<string, unknown> | null;
}

interface ProfileLite {
  user_id: string;
  full_name: string | null;
  email: string | null;
}

const ENTITY_LABELS: Record<string, string> = {
  programme: "programme",
  project: "project",
  product: "product",
  task: "task",
  stage_gate: "stage gate",
  change_request: "change request",
  milestone: "milestone",
  exception: "exception",
  quality_review: "quality review",
  helpdesk_ticket: "ticket",
};

const NOTIFICATION_TYPES: Record<EventType, string> = {
  task_assignment: "workflow_assignment",
  entity_assignment: "workflow_assignment",
  timesheet_submitted: "timesheet_pending",
  timesheet_decision: "approval_approved",
  workflow_decision: "approval_approved",
  helpdesk_workflow_pending: "approval_pending",
  helpdesk_workflow_decision: "approval_approved",
};

function dedupe(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.filter((v): v is string => !!v)));
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function labelForEntity(entityType?: string | null): string {
  if (!entityType) return "item";
  return ENTITY_LABELS[entityType] ?? entityType.replace(/_/g, " ");
}

async function fetchProfiles(admin: ReturnType<typeof createClient>, userIds: string[]): Promise<Map<string, ProfileLite>> {
  if (!userIds.length) return new Map();
  const { data } = await admin
    .from("profiles")
    .select("user_id, full_name, email")
    .in("user_id", userIds);

  return new Map(((data ?? []) as ProfileLite[]).map((profile) => [profile.user_id, profile]));
}

function displayName(profile: ProfileLite | null | undefined, fallback = "A team member") {
  return profile?.full_name || profile?.email || fallback;
}

async function resolveEntityName(admin: ReturnType<typeof createClient>, payload: Payload): Promise<string | null> {
  if (payload.task_name) return payload.task_name;
  if (!payload.entity_type || !payload.entity_id) return null;

  const queryByType: Record<string, { table: string; select: string; fields: string[] }> = {
    programme: { table: "programmes", select: "name", fields: ["name"] },
    project: { table: "projects", select: "name", fields: ["name"] },
    product: { table: "products", select: "name", fields: ["name"] },
    stage_gate: { table: "stage_gates", select: "name", fields: ["name"] },
    change_request: { table: "change_requests", select: "title,reference_number", fields: ["title", "reference_number"] },
    milestone: { table: "milestones", select: "name", fields: ["name"] },
    exception: { table: "exceptions", select: "title,reference_number", fields: ["title", "reference_number"] },
    quality_review: { table: "quality_reviews", select: "title,reference_number", fields: ["title", "reference_number"] },
    helpdesk_ticket: { table: "helpdesk_tickets", select: "subject,reference_number", fields: ["subject", "reference_number"] },
  };

  const config = queryByType[payload.entity_type];
  if (!config) return null;

  const { data } = await admin.from(config.table as any).select(config.select).eq("id", payload.entity_id).maybeSingle();
  const record = data as Record<string, string | null> | null;
  return config.fields.map((field) => record?.[field]).find((value): value is string => !!value) ?? null;
}

async function buildNotification(admin: ReturnType<typeof createClient>, payload: Payload, recipientId: string) {
  const profileIds = dedupe([recipientId, payload.actor_user_id]);
  const profiles = await fetchProfiles(admin, profileIds);
  const recipient = profiles.get(recipientId);
  const actor = payload.actor_user_id ? profiles.get(payload.actor_user_id) : null;
  const actorName = displayName(actor, "A team member");
  const entityName = await resolveEntityName(admin, payload);
  const entityLabel = labelForEntity(payload.entity_type);

  let type = NOTIFICATION_TYPES[payload.event_type];
  let title = payload.title?.trim() || "";
  let message = payload.message?.trim() || "";
  let emailSubject = "";
  let emailIntro = "";

  switch (payload.event_type) {
    case "task_assignment": {
      const taskName = payload.task_name || entityName || "Task";
      title ||= `Task assigned: ${taskName}`;
      message ||= `${actorName} assigned you to task \"${taskName}\".`;
      emailSubject = title;
      emailIntro = message;
      type = "workflow_assignment";
      break;
    }
    case "entity_assignment": {
      const name = entityName || "item";
      const role = payload.assignment_role ? ` as ${payload.assignment_role}` : "";
      title ||= `${entityLabel.charAt(0).toUpperCase() + entityLabel.slice(1)} assignment: ${name}`;
      message ||= `${actorName} assigned you${role} on ${entityLabel} \"${name}\".`;
      emailSubject = title;
      emailIntro = message;
      type = "workflow_assignment";
      break;
    }
    case "timesheet_submitted": {
      const ref = payload.timesheet_reference || "Timesheet";
      title ||= `Timesheet awaiting approval: ${ref}`;
      message ||= `${actorName} submitted ${ref} for your approval.`;
      emailSubject = title;
      emailIntro = message;
      type = "timesheet_pending";
      break;
    }
    case "timesheet_decision": {
      const approved = payload.decision === "approved";
      const ref = payload.timesheet_reference || "your timesheet";
      title ||= approved ? `Timesheet approved: ${ref}` : `Timesheet rejected: ${ref}`;
      message ||= approved
        ? `${actorName} approved ${ref}.`
        : `${actorName} rejected ${ref}${payload.decision_comment ? ` — ${payload.decision_comment}` : "."}`;
      emailSubject = title;
      emailIntro = message;
      type = approved ? "approval_approved" : "approval_denied";
      break;
    }
    case "workflow_decision": {
      const approved = ["approve", "approved", "verified", "conditional"].includes(payload.decision || "");
      const name = entityName || "workflow item";
      const decisionLabel = (payload.decision || "updated").replace(/_/g, " ");
      title ||= approved
        ? `Workflow decision recorded: ${name}`
        : `Workflow requires attention: ${name}`;
      message ||= `${actorName} recorded a ${decisionLabel} decision on ${entityLabel} \"${name}\"${payload.decision_comment ? ` — ${payload.decision_comment}` : "."}`;
      emailSubject = title;
      emailIntro = message;
      type = approved ? "approval_approved" : "approval_denied";
      break;
    }
    case "helpdesk_workflow_pending": {
      const ticketRef = typeof payload.extra?.ticket_reference === "string" ? payload.extra.ticket_reference : null;
      const name = entityName || ticketRef || "ticket approval";
      title ||= `Approval needed: ${name}`;
      message ||= `${actorName} requested your approval for ${name}.`;
      emailSubject = title;
      emailIntro = message;
      type = "approval_pending";
      break;
    }
    case "helpdesk_workflow_decision": {
      const approved = payload.decision === "approved";
      const ticketRef = typeof payload.extra?.ticket_reference === "string" ? payload.extra.ticket_reference : null;
      const name = entityName || ticketRef || "ticket approval";
      title ||= approved ? `Approval completed: ${name}` : `Approval rejected: ${name}`;
      message ||= approved
        ? `${actorName} approved ${name}.`
        : `${actorName} rejected ${name}${payload.decision_comment ? ` — ${payload.decision_comment}` : "."}`;
      emailSubject = title;
      emailIntro = message;
      type = approved ? "approval_approved" : "approval_denied";
      break;
    }
  }

  return {
    recipient,
    actorName,
    type,
    title,
    message,
    emailSubject,
    emailIntro,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization");
    const userClient = authHeader
      ? createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } })
      : null;
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    let actorUserId: string | null = null;
    if (userClient) {
      const { data: userData } = await userClient.auth.getUser();
      actorUserId = userData.user?.id ?? null;
    }

    const payload = (await req.json()) as Payload;
    const recipientIds = dedupe([payload.recipient_user_id, ...(payload.recipient_user_ids ?? [])]);

    if (!payload.event_type || recipientIds.length === 0) {
      return new Response(JSON.stringify({ error: "invalid_input" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const actorId = payload.actor_user_id ?? actorUserId;
    let inserted = 0;
    let emailed = 0;

    for (const recipientId of recipientIds) {
      const built = await buildNotification(admin, { ...payload, actor_user_id: actorId }, recipientId);
      if (!built.title) continue;

      const metadata = {
        event_type: payload.event_type,
        entity_type: payload.entity_type,
        entity_id: payload.entity_id,
        task_id: payload.task_id,
        timesheet_id: payload.timesheet_id,
        workflow_approval_id: payload.workflow_approval_id,
        helpdesk_approval_id: payload.helpdesk_approval_id,
        organization_id: payload.organization_id,
        actor_user_id: actorId,
        decision: payload.decision,
        decision_comment: payload.decision_comment,
        assignment_role: payload.assignment_role,
        extra: payload.extra ?? {},
      };

      const { error: insertError } = await admin.from("notifications").insert({
        user_id: recipientId,
        type: built.type,
        title: built.title,
        message: built.message || null,
        link: payload.link || null,
        metadata,
      });

      if (!insertError) inserted++;
      else console.error("notification insert failed", insertError);

      if (isEmailConfigured() && built.recipient?.email) {
        const html = `
          <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #1a1a1a;">
            <h2 style="margin: 0 0 16px;">${escapeHtml(built.emailSubject)}</h2>
            <p style="line-height: 1.5; margin: 0 0 12px;">${escapeHtml(built.emailIntro)}</p>
            ${payload.decision_comment ? `<div style="background:#f3f4f6;border-left:3px solid #0f172a;padding:10px 12px;border-radius:4px;margin:12px 0;white-space:pre-wrap">${escapeHtml(payload.decision_comment)}</div>` : ""}
            ${payload.link ? `<p style="margin: 24px 0;"><a href="${escapeHtml(payload.link)}" style="background:#0f172a;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;display:inline-block;">Open item</a></p>` : ""}
            <p style="font-size: 12px; color: #6b7280; margin-top: 24px;">You received this because this item needs your attention in TaskMaster.</p>
          </div>`;
        const result = await sendEmail({
          to: [built.recipient.email],
          subject: built.emailSubject,
          html,
        });
        if (result.ok) emailed++;
        else console.error("notification email failed", result.error);
      }
    }

    return new Response(JSON.stringify({ success: true, inserted, emailed }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("notification-dispatcher error", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "unknown_error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
