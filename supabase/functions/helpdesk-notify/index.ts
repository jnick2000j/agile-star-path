// Outbound notification dispatcher for helpdesk events.
// Records every notification to helpdesk_notifications, then attempts to send
// via the configured provider. Currently supports Resend (when RESEND_API_KEY
// is configured via the Resend connector). Falls back to "queued" status when
// no provider is configured — UI surfaces this in the activity log.

// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { sendTransactionalEmail } from "../_shared/send-transactional.ts";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface NotifyPayload {
  ticket_id: string;
  notification_type:
    | "reply"
    | "assigned"
    | "status_changed"
    | "sla_warning"
    | "created"
    | "resolved"
    | "internal_note";
  recipient_email?: string;
  metadata?: Record<string, any>;
}

const RESOLUTION_LABELS: Record<string, string> = {
  fixed: "Fixed",
  not_fixed: "Not Fixed",
  duplicate: "Duplicate",
  wont_fix: "Won't Fix",
  cannot_reproduce: "Cannot Reproduce",
  known_error: "Known Error",
  workaround_provided: "Workaround Provided",
};

const TEMPLATES: Record<string, (ctx: any) => { subject: string; body: string }> = {
  created: (t) => ({
    subject: `[${t.reference_number}] Ticket received: ${t.subject}`,
    body: `Hi ${t.reporter_name || "there"},\n\nWe've received your ticket and our team will respond shortly.\n\nReference: ${t.reference_number}\nPriority: ${t.priority}\n\n— Support Team`,
  }),
  reply: (t) => ({
    subject: `[${t.reference_number}] New reply on your ticket`,
    body: `${t.comment_body || "(no content)"}\n\n--\nView ticket: ${t.ticket_url || ""}`,
  }),
  internal_note: (t) => ({
    subject: `[${t.reference_number}] Internal note added`,
    body: `An internal note was added to ticket "${t.subject}":\n\n${t.comment_body || "(no content)"}`,
  }),
  assigned: (t) => ({
    subject: `[${t.reference_number}] You've been assigned a ticket`,
    body: `You've been assigned ticket ${t.reference_number}: ${t.subject}\nPriority: ${t.priority}`,
  }),
  status_changed: (t) => ({
    subject: `[${t.reference_number}] Status updated to ${t.new_status}`,
    body: `Your ticket "${t.subject}" status changed to: ${t.new_status}`,
  }),
  resolved: (t) => {
    const code = t.resolution_code ? RESOLUTION_LABELS[t.resolution_code] ?? t.resolution_code : null;
    return {
      subject: `[${t.reference_number}] Your ticket has been resolved${code ? ` — ${code}` : ""}`,
      body:
        `Hi ${t.reporter_name || "there"},\n\n` +
        `Your ticket "${t.subject}" has been marked as resolved.\n` +
        (code ? `Resolution: ${code}\n` : "") +
        (t.resolution ? `\nNotes:\n${t.resolution}\n` : "") +
        `\nIf this didn't fully address your issue, simply reply to this email and we'll re-open the ticket.\n\n— Support Team`,
    };
  },
  sla_warning: (t) => ({
    subject: `[${t.reference_number}] SLA approaching`,
    body: `Ticket "${t.subject}" is approaching its SLA target. Please action.`,
  }),
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  let payload: NotifyPayload;
  try { payload = await req.json(); }
  catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: ticket, error: tErr } = await supabase
    .from("helpdesk_tickets")
    .select("id, organization_id, reference_number, subject, priority, status, reporter_email, reporter_name, assignee_id, resolution, resolution_code")
    .eq("id", payload.ticket_id)
    .single();

  if (tErr || !ticket) {
    return new Response(JSON.stringify({ error: "Ticket not found" }), {
      status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Determine recipient
  let recipient = payload.recipient_email;
  if (!recipient) {
    if (payload.notification_type === "assigned" && ticket.assignee_id) {
      const { data: profile } = await supabase
        .from("profiles").select("email").eq("user_id", ticket.assignee_id).maybeSingle();
      recipient = profile?.email ?? undefined;
    } else {
      recipient = ticket.reporter_email ?? undefined;
    }
  }

  if (!recipient) {
    return new Response(JSON.stringify({ ok: false, reason: "no_recipient" }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const tplCtx = { ...ticket, ...(payload.metadata ?? {}) };
  const tpl = TEMPLATES[payload.notification_type] ?? TEMPLATES.reply;
  const { subject, body } = tpl(tplCtx);

  // Insert log row first (always)
  const { data: logRow, error: logErr } = await supabase
    .from("helpdesk_notifications")
    .insert({
      organization_id: ticket.organization_id,
      ticket_id: ticket.id,
      notification_type: payload.notification_type,
      recipient_email: recipient,
      subject,
      body,
      status: "queued",
      metadata: payload.metadata ?? {},
    })
    .select("id")
    .single();

  if (logErr) console.error("notification log insert failed", logErr);

  // Try to send via Resend (optional)
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  const resendKey = Deno.env.get("RESEND_API_KEY");

  if (lovableKey && resendKey) {
    try {
      const res = await fetch("https://connector-gateway.lovable.dev/resend/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${lovableKey}`,
          "X-Connection-Api-Key": resendKey,
        },
        body: JSON.stringify({
          from: "Support <onboarding@resend.dev>",
          to: [recipient],
          subject,
          text: body,
          headers: { "X-Helpdesk-Ref": ticket.reference_number ?? "" },
        }),
      });
      const respBody = await res.json().catch(() => ({}));
      if (res.ok) {
        if (logRow?.id) {
          await supabase.from("helpdesk_notifications").update({
            status: "sent", sent_at: new Date().toISOString(),
            metadata: { ...(payload.metadata ?? {}), provider: "resend", provider_id: respBody.id },
          }).eq("id", logRow.id);
        }
        return new Response(JSON.stringify({ ok: true, sent: true, provider: "resend" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } else {
        if (logRow?.id) {
          await supabase.from("helpdesk_notifications").update({
            status: "error",
            error_message: `Resend ${res.status}: ${JSON.stringify(respBody)}`,
          }).eq("id", logRow.id);
        }
      }
    } catch (e: any) {
      if (logRow?.id) {
        await supabase.from("helpdesk_notifications").update({
          status: "error", error_message: e.message ?? String(e),
        }).eq("id", logRow.id);
      }
    }
  }

  // No provider configured — leave as queued
  return new Response(JSON.stringify({
    ok: true, sent: false,
    reason: "no_provider_configured",
    notification_id: logRow?.id,
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
