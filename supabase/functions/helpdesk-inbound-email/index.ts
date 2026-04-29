// Inbound email handler for the helpdesk module.
// Accepts POST from a Resend inbound webhook (or any email-forwarding service)
// and creates/updates a helpdesk ticket. The "to" address is matched against
// per-org support routing — the local part may be `support+<orgslug>@...` or
// the org is identified via the `X-Organization-Id` header.
//
// Replies threaded by `In-Reply-To` / `References` / subject `[HD-YYYY-####]`.
//
// This function is intentionally permissive on payload shape so it works with
// Resend inbound, SendGrid Parse, Postmark, or a generic JSON proxy.

// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-organization-id",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface InboundPayload {
  from?: string;
  from_email?: string;
  from_name?: string;
  to?: string | string[];
  subject?: string;
  text?: string;
  html?: string;
  message_id?: string;
  in_reply_to?: string;
  references?: string;
  // Resend-style nested
  data?: any;
}

function extractEmail(addr: string | undefined | null): { email: string | null; name: string | null } {
  if (!addr) return { email: null, name: null };
  const m = addr.match(/^\s*(?:"?([^"<]*?)"?\s*)?<?([^<>\s,]+@[^<>\s,]+)>?/);
  if (!m) return { email: addr.trim(), name: null };
  return { email: m[2].trim(), name: (m[1] || "").trim() || null };
}

function pickRefFromSubject(subject: string | undefined | null): string | null {
  if (!subject) return null;
  const m = subject.match(/\[(HD-\d{4}-\d{4,})\]/i);
  return m ? m[1].toUpperCase() : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  let payload: InboundPayload;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Normalise common provider shapes
  const inner = payload.data ?? payload;
  const fromRaw = inner.from || inner.from_email || inner.sender || null;
  const toRaw = Array.isArray(inner.to) ? inner.to[0] : (inner.to || inner.recipient || null);
  const subject = inner.subject || "(no subject)";
  const bodyText = inner.text || inner.body_text || inner.plain_text || "";
  const bodyHtml = inner.html || inner.body_html || "";
  const messageId = inner.message_id || inner.messageId || crypto.randomUUID();
  const inReplyTo = inner.in_reply_to || inner.inReplyTo || null;

  const { email: fromEmail, name: fromName } = extractEmail(fromRaw);

  // Resolve organization
  let organizationId: string | null = req.headers.get("X-Organization-Id");
  if (!organizationId && toRaw) {
    // Look for support+<slug>@domain
    const match = String(toRaw).match(/support\+([a-z0-9-]+)@/i);
    if (match) {
      const { data } = await supabase
        .from("organizations")
        .select("id")
        .eq("slug", match[1].toLowerCase())
        .maybeSingle();
      if (data?.id) organizationId = data.id;
    }
  }

  // Log the inbound message regardless of whether we can resolve org
  const logRow = {
    organization_id: organizationId,
    direction: "inbound",
    message_id: messageId,
    from_address: fromEmail,
    to_address: typeof toRaw === "string" ? toRaw : null,
    subject,
    body_text: bodyText,
    body_html: bodyHtml,
    raw_payload: payload as any,
    status: organizationId ? "processing" : "unrouted",
  };

  const { data: logInsert, error: logErr } = await supabase
    .from("helpdesk_email_log")
    .insert(logRow)
    .select("id")
    .single();

  if (logErr) {
    console.error("email log insert failed", logErr);
  }

  if (!organizationId) {
    return new Response(JSON.stringify({
      ok: false,
      reason: "no_organization_resolved",
      hint: "Set X-Organization-Id header or send to support+<orgslug>@domain",
    }), {
      status: 202,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Find existing ticket via subject reference, in-reply-to, or message id
  const refFromSubject = pickRefFromSubject(subject);
  let ticketId: string | null = null;

  if (refFromSubject) {
    const { data: t } = await supabase
      .from("helpdesk_tickets")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("reference_number", refFromSubject)
      .maybeSingle();
    if (t?.id) ticketId = t.id;
  }

  if (!ticketId && inReplyTo) {
    const { data: prevLog } = await supabase
      .from("helpdesk_email_log")
      .select("ticket_id")
      .eq("message_id", inReplyTo)
      .maybeSingle();
    if (prevLog?.ticket_id) ticketId = prevLog.ticket_id;
  }

  if (ticketId) {
    // Append as comment
    await supabase.from("helpdesk_ticket_comments").insert({
      ticket_id: ticketId,
      organization_id: organizationId,
      author_email: fromEmail,
      author_name: fromName,
      body: bodyText || bodyHtml.replace(/<[^>]*>/g, "").trim(),
      is_internal: false,
      is_from_email: true,
      metadata: { message_id: messageId, in_reply_to: inReplyTo },
    });
    await supabase.from("helpdesk_ticket_activity").insert({
      ticket_id: ticketId,
      organization_id: organizationId,
      event_type: "email_received",
      to_value: { from: fromEmail },
    });
    if (logInsert?.id) {
      await supabase.from("helpdesk_email_log").update({
        ticket_id: ticketId, status: "appended", processed_at: new Date().toISOString(),
      }).eq("id", logInsert.id);
    }
    return new Response(JSON.stringify({ ok: true, action: "comment_appended", ticket_id: ticketId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Create new ticket
  const { data: newTicket, error: createErr } = await supabase
    .from("helpdesk_tickets")
    .insert({
      organization_id: organizationId,
      subject: subject.slice(0, 280),
      description: (bodyText || bodyHtml.replace(/<[^>]*>/g, "").trim()).slice(0, 10000),
      ticket_type: "support",
      priority: "medium",
      status: "new",
      source: "email",
      reporter_email: fromEmail,
      reporter_name: fromName,
      metadata: { message_id: messageId },
    })
    .select("id, reference_number")
    .single();

  if (createErr) {
    if (logInsert?.id) {
      await supabase.from("helpdesk_email_log").update({
        status: "error", error_message: createErr.message,
      }).eq("id", logInsert.id);
    }
    return new Response(JSON.stringify({ ok: false, error: createErr.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (logInsert?.id) {
    await supabase.from("helpdesk_email_log").update({
      ticket_id: newTicket.id, status: "ticket_created", processed_at: new Date().toISOString(),
    }).eq("id", logInsert.id);
  }

  // Send confirmation email to the reporter
  try {
    await supabase.functions.invoke("helpdesk-notify", {
      body: { ticket_id: newTicket.id, notification_type: "created" },
    });
  } catch (e) {
    console.error("created notify failed", e);
  }

  return new Response(JSON.stringify({
    ok: true, action: "ticket_created",
    ticket_id: newTicket.id,
    reference_number: newTicket.reference_number,
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
