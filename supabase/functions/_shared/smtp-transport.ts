// Shared SMTP transport for on-premises deployments.
//
// When EMAIL_TRANSPORT === 'smtp', emails are sent directly via the
// customer's own SMTP server (Postfix, SES SMTP, Exchange, Sendgrid SMTP,
// etc.) instead of being queued through the Lovable email gateway.
//
// This keeps the SAME React Email templates portable between:
//   - Lovable Cloud (default) → queue + Lovable email API
//   - On-premises (EMAIL_TRANSPORT=smtp) → direct SMTP via denomailer
//
// Required env vars when EMAIL_TRANSPORT=smtp:
//   SMTP_HOST           e.g. "smtp.acme-corp.local" or "email-smtp.us-east-1.amazonaws.com"
//   SMTP_PORT           e.g. "587" or "465"
//   SMTP_USER           SMTP auth username (optional for unauthenticated relays)
//   SMTP_PASS           SMTP auth password (optional)
//   SMTP_FROM           Default From address, e.g. "TaskMaster <noreply@acme-corp.local>"
//   SMTP_TLS            "starttls" (default for 587), "tls" (for 465), or "none"
//
// Optional:
//   SMTP_REPLY_TO       Default Reply-To address

import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts'

export type EmailTransport = 'queue' | 'smtp'

export function getEmailTransport(): EmailTransport {
  const v = (Deno.env.get('EMAIL_TRANSPORT') || '').toLowerCase().trim()
  return v === 'smtp' ? 'smtp' : 'queue'
}

export interface SmtpSendInput {
  to: string
  subject: string
  html: string
  text?: string
  from?: string
  replyTo?: string
}

export interface SmtpSendResult {
  ok: boolean
  messageId?: string
  error?: string
}

/**
 * Send an email via the configured SMTP server.
 * Throws a helpful error if SMTP env vars are not configured.
 */
export async function sendViaSmtp(input: SmtpSendInput): Promise<SmtpSendResult> {
  const host = Deno.env.get('SMTP_HOST')
  const portRaw = Deno.env.get('SMTP_PORT') || '587'
  const user = Deno.env.get('SMTP_USER')
  const pass = Deno.env.get('SMTP_PASS')
  const fromDefault = Deno.env.get('SMTP_FROM')
  const replyToDefault = Deno.env.get('SMTP_REPLY_TO')
  const tlsMode = (Deno.env.get('SMTP_TLS') || '').toLowerCase()

  if (!host) {
    return {
      ok: false,
      error:
        'SMTP_HOST is not set. Set EMAIL_TRANSPORT=smtp and SMTP_HOST/SMTP_PORT/SMTP_FROM ' +
        '(plus SMTP_USER/SMTP_PASS if your relay requires auth).',
    }
  }

  const port = Number.parseInt(portRaw, 10)
  if (Number.isNaN(port) || port <= 0) {
    return { ok: false, error: `Invalid SMTP_PORT: ${portRaw}` }
  }

  const from = input.from || fromDefault
  if (!from) {
    return {
      ok: false,
      error: 'SMTP_FROM is not set and no `from` was provided to sendViaSmtp().',
    }
  }

  // Determine TLS strategy:
  //  - explicit "tls"      → implicit TLS (typically port 465)
  //  - explicit "starttls" → STARTTLS (typically port 587)
  //  - explicit "none"     → plaintext (only for trusted internal relays)
  //  - auto                → port 465 ⇒ implicit TLS, otherwise STARTTLS
  let tls = true
  if (tlsMode === 'tls') tls = true
  else if (tlsMode === 'starttls') tls = false
  else if (tlsMode === 'none') tls = false
  else tls = port === 465

  const client = new SMTPClient({
    connection: {
      hostname: host,
      port,
      tls,
      auth: user && pass ? { username: user, password: pass } : undefined,
    },
  })

  try {
    await client.send({
      from,
      to: input.to,
      replyTo: input.replyTo || replyToDefault,
      subject: input.subject,
      content: input.text || stripHtml(input.html),
      html: input.html,
    })
    await client.close()
    return { ok: true }
  } catch (err) {
    try {
      await client.close()
    } catch {
      /* ignore */
    }
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, error: `SMTP send failed: ${msg}` }
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}
