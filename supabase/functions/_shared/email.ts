// Shared email transport.
//
// Routes outbound email through one of:
//   1. SMTP (on-prem / BYO mailserver) — when SMTP_HOST is set
//   2. Resend cloud API                — when RESEND_API_KEY is set
//
// Set EMAIL_TRANSPORT=smtp|resend to force a specific transport;
// otherwise auto-detected based on which env var is present.
//
// Usage:
//   import { sendEmail } from "../_shared/email.ts";
//   const res = await sendEmail({
//     to: ["alice@example.com"],
//     subject: "Hi",
//     html: "<p>Hello</p>",
//     from: "PIMP <noreply@example.com>", // optional, defaults to EMAIL_FROM
//   });
//   if (!res.ok) console.error(res.error);

import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  from?: string;
  replyTo?: string;
  attachments?: { filename: string; content: string /* base64 */; contentType?: string }[];
}

export interface SendEmailResult {
  ok: boolean;
  transport: "smtp" | "resend" | "none";
  messageId?: string;
  error?: string;
}

function pickTransport(): "smtp" | "resend" | "none" {
  const explicit = (Deno.env.get("EMAIL_TRANSPORT") || "").toLowerCase();
  if (explicit === "smtp") return "smtp";
  if (explicit === "resend") return "resend";
  if (Deno.env.get("SMTP_HOST")) return "smtp";
  if (Deno.env.get("RESEND_API_KEY")) return "resend";
  return "none";
}

function defaultFrom(): string {
  return (
    Deno.env.get("EMAIL_FROM") ||
    "TaskMaster <onboarding@resend.dev>"
  );
}

export function isEmailConfigured(): boolean {
  return pickTransport() !== "none";
}

export async function sendEmail(opts: SendEmailOptions): Promise<SendEmailResult> {
  const transport = pickTransport();
  const recipients = Array.isArray(opts.to) ? opts.to : [opts.to];
  const from = opts.from || defaultFrom();
  const subject = opts.subject;
  const html = opts.html;
  const text = opts.text || (html ? stripHtml(html) : "");

  if (transport === "none") {
    return { ok: false, transport: "none", error: "No email transport configured" };
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
    const resend = new Resend(Deno.env.get("RESEND_API_KEY")!);
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
