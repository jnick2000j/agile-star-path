// Helper to send transactional emails via Lovable Cloud's email queue.
// Use this from Edge Functions instead of the legacy SMTP/Resend helper.
//
// Requires: the project must have transactional email infra set up
// (the `send-transactional-email` Edge Function and `enqueue_email` RPC).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface SendArgs {
  to: string;
  subject: string;
  html: string;
  /**
   * Stable, unique key per logical send (e.g. `invite-${invite.id}`).
   * Required for the queue's idempotency / retry safety.
   */
  idempotencyKey: string;
}

interface SendResult {
  ok: boolean;
  error?: string;
}

/**
 * Enqueues a transactional email via the `send-transactional-email`
 * Edge Function using the built-in `generic-html` template.
 *
 * Returns `{ ok: true }` once the email has been accepted by the queue.
 * Actual delivery happens asynchronously via the email queue dispatcher.
 */
export async function sendTransactionalEmail(args: SendArgs): Promise<SendResult> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !serviceKey) {
    return { ok: false, error: "Missing Supabase env vars" };
  }

  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/send-transactional-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceKey}`,
        apikey: anonKey ?? serviceKey,
      },
      body: JSON.stringify({
        templateName: "generic-html",
        recipientEmail: args.to,
        idempotencyKey: args.idempotencyKey,
        templateData: { subject: args.subject, html: args.html },
      }),
    });
    const text = await res.text();
    if (!res.ok) {
      return { ok: false, error: `send-transactional-email ${res.status}: ${text}` };
    }
    let parsed: any = {};
    try { parsed = JSON.parse(text); } catch { /* ignore */ }
    if (parsed && parsed.error) {
      return { ok: false, error: String(parsed.error) };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
