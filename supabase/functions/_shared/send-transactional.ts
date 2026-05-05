// Helper to send transactional emails via Lovable Cloud's email queue.
// Use this from Edge Functions instead of the legacy SMTP/Resend helper.
//
// We bypass the `send-transactional-email` Edge Function (which requires a
// JWT-format auth token that the service role key does not always satisfy)
// and call the `enqueue_email` RPC directly. The same dispatcher
// (process-email-queue) processes both auth and transactional queues.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Baked in at email scaffold time. Keep these in sync with
// supabase/functions/send-transactional-email/index.ts.
const SITE_NAME = "thetaskmaster";
const SENDER_DOMAIN = "notifications.taskmastersoftware.com";
const FROM_DOMAIN = "taskmastersoftware.com";

interface SendArgs {
  to: string;
  subject: string;
  html: string;
  /**
   * Stable, unique key per logical send (e.g. `invite-${invite.id}`).
   * Used for the email_send_log message_id to make retries idempotent.
   */
  idempotencyKey: string;
  /** Optional plain text alternative; auto-derived from HTML if omitted. */
  text?: string;
  /** Friendly label shown in email logs. Defaults to "transactional". */
  label?: string;
}

interface SendResult {
  ok: boolean;
  error?: string;
}

function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>(?!\s*<)/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Enqueues a transactional email onto the `transactional_emails` pgmq queue.
 * The dispatcher (`process-email-queue`, scheduled via pg_cron) sends it
 * through Lovable Email infrastructure within seconds.
 */
export async function sendTransactionalEmail(args: SendArgs): Promise<SendResult> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    return { ok: false, error: "Missing Supabase env vars" };
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const messageId = args.idempotencyKey;
  const text = args.text ?? htmlToText(args.html);
  const label = args.label ?? "transactional";

  try {
    // Get/create unsubscribe token (one per recipient email).
    const normalizedEmail = args.to.toLowerCase();
    let unsubscribeToken: string | null = null;
    const { data: existing } = await admin
      .from("email_unsubscribe_tokens")
      .select("token, used_at")
      .eq("email", normalizedEmail)
      .maybeSingle();
    if (existing && !existing.used_at) {
      unsubscribeToken = existing.token;
    } else if (!existing) {
      const bytes = new Uint8Array(32);
      crypto.getRandomValues(bytes);
      unsubscribeToken = Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
      await admin.from("email_unsubscribe_tokens").upsert(
        { token: unsubscribeToken, email: normalizedEmail },
        { onConflict: "email", ignoreDuplicates: true },
      );
      const { data: stored } = await admin
        .from("email_unsubscribe_tokens")
        .select("token")
        .eq("email", normalizedEmail)
        .maybeSingle();
      if (stored?.token) unsubscribeToken = stored.token;
    } else {
      unsubscribeToken = existing.token;
    }

    // Log pending BEFORE enqueue so we have a record even if enqueue crashes.
    await admin.from("email_send_log").insert({
      message_id: messageId,
      template_name: label,
      recipient_email: args.to,
      status: "pending",
    });

    const { error: enqueueError } = await admin.rpc("enqueue_email", {
      queue_name: "transactional_emails",
      payload: {
        message_id: messageId,
        idempotency_key: messageId,
        to: args.to,
        from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
        sender_domain: SENDER_DOMAIN,
        subject: args.subject,
        html: args.html,
        text,
        purpose: "transactional",
        label,
        unsubscribe_token: unsubscribeToken,
        queued_at: new Date().toISOString(),
      },
    });

    if (enqueueError) {
      await admin.from("email_send_log").insert({
        message_id: messageId,
        template_name: label,
        recipient_email: args.to,
        status: "failed",
        error_message: enqueueError.message ?? "enqueue failed",
      });
      return { ok: false, error: enqueueError.message ?? "enqueue failed" };
    }

    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
