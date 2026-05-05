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
  if (!supabaseUrl || !serviceKey) {
    return { ok: false, error: "Missing Supabase env vars" };
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: {
      headers: { Authorization: `Bearer ${serviceKey}` },
    },
  });

  try {
    const { data, error } = await admin.functions.invoke(
      "send-transactional-email",
      {
        body: {
          templateName: "generic-html",
          recipientEmail: args.to,
          idempotencyKey: args.idempotencyKey,
          templateData: {
            subject: args.subject,
            html: args.html,
          },
        },
        headers: { Authorization: `Bearer ${serviceKey}` },
      },
    );
    if (error) {
      return { ok: false, error: error.message ?? String(error) };
    }
    if (data && typeof data === "object" && "error" in data && data.error) {
      return { ok: false, error: String(data.error) };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
