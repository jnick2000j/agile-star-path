// Inbound email webhook — receives parsed emails from providers like
// SendGrid Inbound Parse, Mailgun Routes, Postmark Inbound, or CloudMailin.
// Threads replies into existing tickets via In-Reply-To/References headers
// or [T-XXXX] subject markers. Stores attachments in Supabase Storage.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (status: number, body: any) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

interface InboundPayload {
  from?: string;          // "Jane <jane@x.com>"
  from_email?: string;
  from_name?: string;
  to?: string | string[];
  cc?: string | string[];
  subject?: string;
  text?: string;
  html?: string;
  message_id?: string;    // e.g. <abc@mail.example.com>
  in_reply_to?: string;
  references?: string;    // space-separated message-ids
  headers?: Record<string, string>;
  attachments?: Array<{
    filename: string;
    content_type?: string;
    content?: string;     // base64
    url?: string;         // alternative: pre-uploaded URL
    size?: number;
  }>;
}

function parseAddress(input?: string): { email: string; name?: string } {
  if (!input) return { email: "" };
  const m = input.match(/^\s*"?([^"<]*)"?\s*<([^>]+)>\s*$/);
  if (m) return { name: m[1].trim() || undefined, email: m[2].trim().toLowerCase() };
  return { email: input.trim().toLowerCase() };
}

function extractTicketRef(subject?: string): string | null {
  if (!subject) return null;
  const m = subject.match(/\[(?:Re:\s*)?(T-[A-Z0-9-]+)\]/i) || subject.match(/\b(T-[A-Z0-9-]+)\b/);
  return m ? m[1].toUpperCase() : null;
}

function detectAutoReply(headers: Record<string, string> = {}, subject = ""): boolean {
  const auto = headers["auto-submitted"] || headers["Auto-Submitted"];
  if (auto && auto.toLowerCase() !== "no") return true;
  if (headers["x-autoreply"] || headers["X-Autoreply"]) return true;
  if (/^(out of office|auto[- ]?reply|automatic reply)/i.test(subject)) return true;
  return false;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  // Optional shared-secret check (set INBOUND_EMAIL_SECRET env var)
  const expectedSecret = Deno.env.get("INBOUND_EMAIL_SECRET");
  if (expectedSecret) {
    const provided = req.headers.get("x-webhook-secret");
    if (provided !== expectedSecret) return json(401, { error: "invalid_secret" });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let payload: InboundPayload;
  try {
    payload = await req.json();
  } catch {
    return json(400, { error: "invalid_json" });
  }

  const fromParsed = payload.from_email
    ? { email: payload.from_email.toLowerCase(), name: payload.from_name }
    : parseAddress(payload.from);
  if (!fromParsed.email) return json(400, { error: "missing_from" });

  const toRaw = Array.isArray(payload.to) ? payload.to[0] : payload.to;
  const toParsed = parseAddress(toRaw);
  if (!toParsed.email) return json(400, { error: "missing_to" });

  // Find inbox by destination address
  const { data: inbox } = await supabase
    .from("helpdesk_email_inboxes")
    .select("*")
    .eq("email_address", toParsed.email)
    .eq("is_active", true)
    .maybeSingle();

  if (!inbox) return json(404, { error: "inbox_not_found", to: toParsed.email });

  const headers = payload.headers || {};
  const isAutoReply = detectAutoReply(headers, payload.subject);

  // Resolve thread: by In-Reply-To, References, or [T-REF] subject marker
  let ticketId: string | null = null;
  let threadingMethod = "new";

  const inReplyTo = payload.in_reply_to;
  const referencesIds = (payload.references || "").split(/\s+/).filter(Boolean);

  if (inReplyTo) {
    const { data: prior } = await supabase
      .from("helpdesk_email_messages")
      .select("ticket_id")
      .eq("organization_id", inbox.organization_id)
      .eq("message_id", inReplyTo)
      .not("ticket_id", "is", null)
      .maybeSingle();
    if (prior?.ticket_id) {
      ticketId = prior.ticket_id;
      threadingMethod = "in_reply_to";
    }
  }

  if (!ticketId && referencesIds.length) {
    const { data: prior } = await supabase
      .from("helpdesk_email_messages")
      .select("ticket_id")
      .eq("organization_id", inbox.organization_id)
      .in("message_id", referencesIds)
      .not("ticket_id", "is", null)
      .order("received_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (prior?.ticket_id) {
      ticketId = prior.ticket_id;
      threadingMethod = "references";
    }
  }

  if (!ticketId) {
    const ref = extractTicketRef(payload.subject);
    if (ref) {
      const { data: t } = await supabase
        .from("helpdesk_tickets")
        .select("id")
        .eq("organization_id", inbox.organization_id)
        .eq("reference_number", ref)
        .maybeSingle();
      if (t?.id) {
        ticketId = t.id;
        threadingMethod = "subject_ref";
      }
    }
  }

  // Insert log row first to get an ID for attachment paths
  const { data: msgRow, error: insErr } = await supabase
    .from("helpdesk_email_messages")
    .insert({
      organization_id: inbox.organization_id,
      inbox_id: inbox.id,
      direction: "inbound",
      message_id: payload.message_id || null,
      in_reply_to: inReplyTo || null,
      references_ids: referencesIds.length ? referencesIds : null,
      from_email: fromParsed.email,
      from_name: fromParsed.name || null,
      to_email: toParsed.email,
      cc_emails: payload.cc ? (Array.isArray(payload.cc) ? payload.cc : [payload.cc]) : null,
      subject: payload.subject || "(no subject)",
      body_text: payload.text || null,
      body_html: payload.html || null,
      raw_headers: headers,
      is_auto_reply: isAutoReply,
      processing_status: "processing",
    })
    .select()
    .single();

  if (insErr || !msgRow) return json(500, { error: "log_insert_failed", message: insErr?.message });

  // Skip auto-replies — log only
  if (isAutoReply && inbox.spam_filter_enabled) {
    await supabase
      .from("helpdesk_email_messages")
      .update({ processing_status: "skipped_auto_reply" })
      .eq("id", msgRow.id);
    return json(200, { success: true, skipped: "auto_reply", message_id: msgRow.id });
  }

  // Upload attachments
  const uploadedAttachments: any[] = [];
  for (const att of payload.attachments || []) {
    if (!att.filename) continue;
    if (att.content) {
      try {
        const bytes = Uint8Array.from(atob(att.content), (c) => c.charCodeAt(0));
        const path = `${inbox.organization_id}/${msgRow.id}/${att.filename}`;
        const { error: upErr } = await supabase.storage
          .from("helpdesk-email-attachments")
          .upload(path, bytes, { contentType: att.content_type || "application/octet-stream", upsert: true });
        if (!upErr) {
          uploadedAttachments.push({ filename: att.filename, path, size: bytes.length, content_type: att.content_type });
        }
      } catch (e) {
        console.error("attachment upload failed", att.filename, e);
      }
    } else if (att.url) {
      uploadedAttachments.push({ filename: att.filename, external_url: att.url, size: att.size, content_type: att.content_type });
    }
  }

  // Create or thread into ticket
  if (!ticketId) {
    const refSuffix = Math.random().toString(36).slice(2, 8).toUpperCase();
    const reference = `T-${Date.now().toString(36).toUpperCase()}-${refSuffix}`;
    const { data: ticket, error: tErr } = await supabase
      .from("helpdesk_tickets")
      .insert({
        organization_id: inbox.organization_id,
        reference_number: reference,
        subject: payload.subject || "(no subject)",
        description: payload.text || (payload.html ? payload.html.replace(/<[^>]+>/g, " ").trim() : null),
        ticket_type: "incident",
        category: inbox.default_category || null,
        priority: inbox.default_priority || "medium",
        status: "new",
        source: "email",
        reporter_email: fromParsed.email,
        reporter_name: fromParsed.name || null,
        assignee_id: inbox.default_assignee_id || null,
        metadata: {
          inbound_email_inbox_id: inbox.id,
          inbound_email_message_id: payload.message_id,
        },
      })
      .select("id, reference_number")
      .single();

    if (tErr) {
      await supabase
        .from("helpdesk_email_messages")
        .update({ processing_status: "error", error_message: tErr.message })
        .eq("id", msgRow.id);
      return json(500, { error: "ticket_creation_failed", message: tErr.message });
    }
    ticketId = ticket.id;
  } else {
    // Thread reply: append a comment if helpdesk_ticket_comments table exists
    try {
      await supabase.from("helpdesk_ticket_comments" as any).insert({
        organization_id: inbox.organization_id,
        ticket_id: ticketId,
        author_email: fromParsed.email,
        author_name: fromParsed.name,
        body: payload.text || payload.html?.replace(/<[^>]+>/g, " ").trim() || "",
        is_internal: false,
        source: "email",
      });
    } catch (e) {
      console.warn("comment insert skipped:", e);
    }

    // Reopen if resolved/closed
    await supabase
      .from("helpdesk_tickets")
      .update({ status: "open", updated_at: new Date().toISOString() })
      .eq("id", ticketId)
      .in("status", ["resolved", "closed"]);
  }

  await supabase
    .from("helpdesk_email_messages")
    .update({
      ticket_id: ticketId,
      attachments: uploadedAttachments,
      processing_status: "processed",
    })
    .eq("id", msgRow.id);

  return json(200, {
    success: true,
    ticket_id: ticketId,
    message_id: msgRow.id,
    threading: threadingMethod,
    attachments_stored: uploadedAttachments.length,
  });
});
