// Shared email transport.
//
// Routes outbound email through one of:
//   1. Lovable Emails (built-in send-transactional-email function)
//   2. SMTP (on-prem / BYO mailserver)
//   3. Resend cloud API
//
// Selection priority:
//   - If `organizationId` is provided AND a row exists in `email_settings`,
//     that org's `active_transport` wins.
//   - Else explicit EMAIL_TRANSPORT env var (lovable|smtp|resend).
//   - Else auto-detect from secrets (SMTP_HOST → smtp, RESEND_API_KEY → resend).
//   - Else "lovable" if SUPABASE_URL is available.
//
// Usage:
//   import { sendEmail } from "../_shared/email.ts";
//   const res = await sendEmail({
//     to: ["alice@example.com"],
//     subject: "Hi",
//     html: "<p>Hello</p>",
//     organizationId: org.id, // optional, enables per-org transport
//   });

import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export type EmailTransport = "lovable" | "smtp" | "resend" | "none";

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  from?: string;
  replyTo?: string;
  attachments?: { filename: string; content: string /* base64 */; contentType?: string }[];
  /** When provided, looks up active_transport from email_settings for this org. */
  organizationId?: string;
  /** Override transport selection. */
  transport?: EmailTransport;
}

export interface SendEmailResult {
  ok: boolean;
  transport: EmailTransport;
  messageId?: string;
  error?: string;
}

function envTransport(): EmailTransport {
  const explicit = (Deno.env.get("EMAIL_TRANSPORT") || "").toLowerCase();
  if (explicit === "lovable") return "lovable";
  if (explicit === "smtp") return "smtp";
  if (explicit === "resend") return "resend";
  if (Deno.env.get("SMTP_HOST")) return "smtp";
  if (Deno.env.get("RESEND_API_KEY")) return "resend";
  if (Deno.env.get("SUPABASE_URL")) return "lovable";
  return "none";
}

async function orgTransport(organizationId: string): Promise<EmailTransport | null> {
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) return null;
    const sb = createClient(url, key);
    const { data } = await sb
      .from("email_settings")
      .select("active_transport, from_address, from_name")
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (!data) return null;
    return (data.active_transport as EmailTransport) ?? null;
  } catch (_) {
    return null;
  }
}

async function orgFrom(organizationId: string): Promise<string | null> {
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) return null;
    const sb = createClient(url, key);
    const { data } = await sb
      .from("email_settings")
      .select("from_address, from_name")
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (!data?.from_address) return null;
    return data.from_name
      ? `${data.from_name} <${data.from_address}>`
      : data.from_address;
  } catch (_) {
    return null;
  }
}

function defaultFrom(): string {
  return Deno.env.get("EMAIL_FROM") || "TaskMaster <onboarding@resend.dev>";
}

export function isEmailConfigured(): boolean {
  return envTransport() !== "none";
}

export async function resolveTransport(
  organizationId?: string,
  override?: EmailTransport,
): Promise<EmailTransport> {
  if (override && override !== "none") return override;
  if (organizationId) {
    const t = await orgTransport(organizationId);
    if (t) return t;
  }
  return envTransport();
}

export async function sendEmail(opts: SendEmailOptions): Promise<SendEmailResult> {
  const transport = await resolveTransport(opts.organizationId, opts.transport);
  const recipients = Array.isArray(opts.to) ? opts.to : [opts.to];
  const subject = opts.subject;
  const html = opts.html;
  const text = opts.text || (html ? stripHtml(html) : "");
  const from =
    opts.from ||
    (opts.organizationId ? await orgFrom(opts.organizationId) : null) ||
    defaultFrom();

  if (transport === "none") {
    return { ok: false, transport: "none", error: "No email transport configured" };
  }

  if (transport === "lovable") {
    try {
      const url = Deno.env.get("SUPABASE_URL");
      const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (!url || !key) {
        return { ok: false, transport: "lovable", error: "Lovable transport requires SUPABASE_URL and service role key" };
      }
      const sb = createClient(url, key);
      // One invocation per recipient (transactional 1:1 model)
      const errors: string[] = [];
      for (const to of recipients) {
        const idemKey = `adhoc-${crypto.randomUUID()}`;
        const { error } = await sb.functions.invoke("send-transactional-email", {
          body: {
            templateName: "generic-html",
            recipientEmail: to,
            idempotencyKey: idemKey,
            templateData: { subject, html: html || `<p>${text}</p>`, text },
            // Allow caller to override subject:
            subject,
          },
        });
        if (error) errors.push(`${to}: ${error.message}`);
      }
      if (errors.length) return { ok: false, transport: "lovable", error: errors.join("; ") };
      return { ok: true, transport: "lovable" };
    } catch (e) {
      console.error("Lovable email error:", e);
      return { ok: false, transport: "lovable", error: (e as Error).message };
    }
  }

  if (transport === "smtp") {
    try {
      const client = new SMTPClient({
        connection: {
          hostname: Deno.env.get("SMTP_HOST")!,
          port: Number(Deno.env.get("SMTP_PORT") || "587"),
          tls: (Deno.env.get("SMTP_TLS") || "true").toLowerCase() !== "false",
          auth: Deno.env.get("SMTP_USER")
            ? {
                username: Deno.env.get("SMTP_USER")!,
                password: Deno.env.get("SMTP_PASSWORD") || "",
              }
            : undefined,
        },
      });

      await client.send({
        from,
        to: recipients,
        replyTo: opts.replyTo,
        subject,
        content: text,
        html,
        attachments: opts.attachments?.map((a) => ({
          filename: a.filename,
          content: a.content,
          encoding: "base64",
          contentType: a.contentType ?? "application/octet-stream",
        })),
      });
      await client.close();
      return { ok: true, transport: "smtp" };
    } catch (e) {
      console.error("SMTP send error:", e);
      return { ok: false, transport: "smtp", error: (e as Error).message };
    }
  }

  // transport === "resend"
  try {
    const apiKey = Deno.env.get("RESEND_API_KEY");
    if (!apiKey) {
      return { ok: false, transport: "resend", error: "RESEND_API_KEY not configured" };
    }
    const resend = new Resend(apiKey);
    const result = await resend.emails.send({
      from,
      to: recipients,
      subject,
      html,
      text,
      reply_to: opts.replyTo,
      attachments: opts.attachments?.map((a) => ({
        filename: a.filename,
        content: a.content,
      })),
    } as any);
    return { ok: true, transport: "resend", messageId: (result as any)?.data?.id };
  } catch (e) {
    console.error("Resend send error:", e);
    return { ok: false, transport: "resend", error: (e as Error).message };
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
