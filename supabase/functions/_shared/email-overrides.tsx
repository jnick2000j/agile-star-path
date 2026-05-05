/// <reference types="npm:@types/react@18.3.1" />
// Per-organization email copy overrides.
//
// Looks up `org_email_template_overrides` for a given (org, template_key).
// When an override exists and is enabled, renders a branded shell with the
// admin-customized subject/greeting/body/CTA/footer copy.
//
// Branded shell (logo, colors, layout) stays locked. Only copy fields are
// admin-editable. Variables like {{user_name}}, {{action_url}} are
// substituted at send time.

import * as React from 'npm:react@18.3.1'
import {
  Body,
  Button,
  Head,
  Heading,
  Html,
  Preview,
  Text,
  renderAsync,
} from 'npm:@react-email/components@0.0.22'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { Shell, styles, SITE_NAME } from './email-templates/_brand.tsx'

export interface OverrideFields {
  greeting?: string
  body?: string
  cta_label?: string
  footer_note?: string
}

export interface OverrideRow {
  subject: string | null
  fields: OverrideFields | null
  enabled: boolean
}

export interface RenderedOverride {
  subject: string
  html: string
  text: string
}

/**
 * Substitute {{var}} tokens with values. Unknown tokens are left as-is.
 * All values are toString'd; React handles HTML escaping at render time.
 */
export function substitute(template: string, vars: Record<string, unknown>): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => {
    const v = vars[k]
    return v === undefined || v === null ? `{{${k}}}` : String(v)
  })
}

/**
 * Fetch the override row for (org, template_key). Returns null if missing,
 * disabled, or any error (so callers fall back to default templates).
 */
export async function fetchOverride(
  organizationId: string | null | undefined,
  templateKey: string,
): Promise<OverrideRow | null> {
  if (!organizationId) return null
  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) return null

  try {
    const sb = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { data, error } = await sb
      .from('org_email_template_overrides')
      .select('subject, fields, enabled')
      .eq('organization_id', organizationId)
      .eq('template_key', templateKey)
      .maybeSingle()
    if (error || !data) return null
    if (!data.enabled) return null
    return data as OverrideRow
  } catch (e) {
    console.warn('fetchOverride failed:', e)
    return null
  }
}

interface OverrideEmailProps {
  greeting: string
  body: string
  ctaLabel?: string
  ctaUrl?: string
  footerNote?: string
  preview?: string
  otpCode?: string
}

const OverrideEmail: React.FC<OverrideEmailProps> = ({
  greeting,
  body,
  ctaLabel,
  ctaUrl,
  footerNote,
  preview,
  otpCode,
}) => (
  <Html lang="en" dir="ltr">
    <Head />
    {preview ? <Preview>{preview}</Preview> : null}
    <Body style={styles.main}>
      <Shell>
        <Heading style={styles.h1}>{greeting}</Heading>

        {/* Body — split on blank lines into paragraphs */}
        {body.split(/\n{2,}/).map((para, i) => (
          <Text key={i} style={styles.text}>
            {para}
          </Text>
        ))}

        {otpCode ? (
          <div style={styles.codeBox}>
            <p style={styles.codeText}>{otpCode}</p>
          </div>
        ) : null}

        {ctaLabel && ctaUrl ? (
          <div style={{ textAlign: 'center', margin: '24px 0' }}>
            <Button href={ctaUrl} style={styles.button}>
              {ctaLabel}
            </Button>
          </div>
        ) : null}

        {footerNote ? <Text style={styles.smallNote}>{footerNote}</Text> : null}
      </Shell>
    </Body>
  </Html>
)

/**
 * Render an override (subject + branded shell with custom copy) to HTML/text.
 * Variables in `vars` are substituted into all copy fields and the subject.
 *
 * `defaults` provides fallback copy when an override field is empty (so that
 * disabling/clearing one field doesn't blank out the email).
 */
export async function renderOverride(
  override: OverrideRow,
  defaults: { subject: string; greeting: string; body: string; cta_label: string; footer_note: string },
  vars: Record<string, unknown>,
): Promise<RenderedOverride> {
  const f = override.fields ?? {}

  const subject = substitute(override.subject || defaults.subject, vars)
  const greeting = substitute(f.greeting || defaults.greeting, vars)
  const body = substitute(f.body || defaults.body, vars)
  const ctaLabel = substitute(f.cta_label || defaults.cta_label, vars)
  const footerNote = substitute(f.footer_note || defaults.footer_note, vars)

  const ctaUrl =
    (vars.action_url as string | undefined) ||
    (vars.confirmation_url as string | undefined) ||
    (vars.confirmationUrl as string | undefined) ||
    undefined

  const otpCode =
    (vars.otp_code as string | undefined) ||
    (vars.token as string | undefined) ||
    undefined

  const props: OverrideEmailProps = {
    greeting,
    body,
    ctaLabel: ctaLabel || undefined,
    ctaUrl,
    footerNote: footerNote || undefined,
    preview: subject,
    otpCode,
  }

  const html = await renderAsync(React.createElement(OverrideEmail, props))
  const text = await renderAsync(React.createElement(OverrideEmail, props), {
    plainText: true,
  })

  return { subject, html, text }
}

/** Default fallback copy mirrored from src/components/admin/EmailTemplatesPanel.tsx */
export const DEFAULT_COPY: Record<
  string,
  { subject: string; greeting: string; body: string; cta_label: string; footer_note: string }
> = {
  // Auth
  invite: {
    subject: "You're invited to {{site_name}}",
    greeting: 'Hi {{user_name}},',
    body: "You've been invited to join {{org_name}} on {{site_name}}. Click the button below to accept your invitation and set up your account.",
    cta_label: 'Accept invitation',
    footer_note: 'This invitation will expire in 7 days.',
  },
  signup: {
    subject: 'Confirm your {{site_name}} account',
    greeting: 'Welcome to {{site_name}}!',
    body: 'Please confirm your email address to activate your account and start using the platform.',
    cta_label: 'Confirm email',
    footer_note: "If you didn't create this account, you can safely ignore this email.",
  },
  recovery: {
    subject: 'Reset your {{site_name}} password',
    greeting: 'Hi {{user_name}},',
    body: 'We received a request to reset your password. Click the button below to choose a new one.',
    cta_label: 'Reset password',
    footer_note:
      "If you didn't request this, you can safely ignore this email — your password will not change.",
  },
  'magic-link': {
    subject: 'Your {{site_name}} sign-in code',
    greeting: 'Hi {{user_name}},',
    body: 'Use the code below to sign in to {{site_name}}. This code expires in 10 minutes.',
    cta_label: 'Sign in',
    footer_note: "If you didn't request this code, you can safely ignore this email.",
  },
  'email-change': {
    subject: 'Confirm your new email address',
    greeting: 'Hi {{user_name}},',
    body: 'Please confirm your new email address to complete the change on your {{site_name}} account.',
    cta_label: 'Confirm new email',
    footer_note: "If you didn't request this change, please contact your administrator immediately.",
  },
  reauthentication: {
    subject: 'Verification code for {{site_name}}',
    greeting: 'Hi {{user_name}},',
    body: 'Use the verification code below to confirm your identity and continue with your sensitive action.',
    cta_label: 'Continue',
    footer_note: "This code expires in 10 minutes. If you didn't request it, please secure your account.",
  },
  // App
  'task-assigned': {
    subject: 'New task assigned: {{task_title}}',
    greeting: 'Hi {{user_name}},',
    body: 'A new task has been assigned to you in {{org_name}}. Open it to see the details, due date, and priority.',
    cta_label: 'View task',
    footer_note: 'You can manage your notification preferences from your profile settings.',
  },
  'programme-weekly-digest': {
    subject: 'Weekly digest — {{programme_name}}',
    greeting: 'Hi {{user_name}},',
    body: "Here is this week's status update for {{programme_name}}, covering RAG status, key metrics, and top risks.",
    cta_label: 'Open programme',
    footer_note: "You're receiving this because you're subscribed to programme reports.",
  },
  'document-approval': {
    subject: 'Approval needed: {{document_title}}',
    greeting: 'Hi {{user_name}},',
    body: 'A document requires your review and approval as part of the {{org_name}} governance workflow.',
    cta_label: 'Review document',
    footer_note: 'Approvals are tracked for audit purposes per PRINCE2 governance.',
  },
  'organization-invite': {
    subject: "You've been invited to {{org_name}}",
    greeting: 'Hi {{user_name}},',
    body: "You've been invited to collaborate in {{org_name}} on {{site_name}}. Accept the invitation to get started.",
    cta_label: 'Join organization',
    footer_note: 'This invitation will expire in 7 days.',
  },
}

/**
 * One-shot helper: tries to load + render an org override for the given
 * template_key. Returns null when no enabled override exists, signaling
 * the caller to fall back to the default React Email template.
 */
export async function tryRenderOrgOverride(
  organizationId: string | null | undefined,
  templateKey: string,
  vars: Record<string, unknown>,
): Promise<RenderedOverride | null> {
  const override = await fetchOverride(organizationId, templateKey)
  if (!override) return null
  const defaults = DEFAULT_COPY[templateKey]
  if (!defaults) return null
  // Always inject site_name fallback so {{site_name}} works without callers passing it
  const merged = { site_name: SITE_NAME, ...vars }
  return renderOverride(override, defaults, merged)
}
