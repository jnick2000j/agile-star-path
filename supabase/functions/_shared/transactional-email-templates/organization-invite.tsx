import * as React from 'npm:react@18.3.1'
import {
  Body,
  Button,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import { Shell, styles, BRAND } from '../email-templates/_brand.tsx'

interface OrgInviteProps {
  recipientName?: string
  inviterName?: string
  organizationName?: string
  role?: string
  acceptUrl?: string
}

const OrganizationInviteEmail = ({
  recipientName,
  inviterName,
  organizationName = 'an organization',
  role,
  acceptUrl,
}: OrgInviteProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>You're invited to join {organizationName} on The TaskMaster</Preview>
    <Body style={styles.main}>
      <Shell>
        <Heading style={styles.h1}>You're invited to join {organizationName}</Heading>
        <Text style={styles.text}>
          {recipientName ? `Hi ${recipientName}, ` : ''}
          {inviterName ? <><strong>{inviterName}</strong> has invited you</> : 'You have been invited'}
          {' '}to join <strong>{organizationName}</strong> on The TaskMaster.
        </Text>

        {role ? (
          <Section style={styles.callout}>
            <Text style={{ ...styles.text, margin: 0, color: BRAND.navy }}>
              Your role: <strong>{role}</strong>
            </Text>
          </Section>
        ) : null}

        <Text style={styles.text}>
          Click the button below to accept the invitation. You'll be guided through
          confirming your email and setting up your account.
        </Text>

        {acceptUrl ? (
          <Button style={styles.button} href={acceptUrl}>Accept invitation</Button>
        ) : null}

        <Text style={styles.smallNote}>
          The TaskMaster is a PRINCE2 &amp; Agile programme information management
          platform — your organization uses it to coordinate programmes, projects,
          products, and governance.
        </Text>
      </Shell>
    </Body>
  </Html>
)

export const template = {
  component: OrganizationInviteEmail,
  subject: (d: Record<string, any>) =>
    d?.organizationName
      ? `You're invited to join ${d.organizationName} on The TaskMaster`
      : `You're invited to The TaskMaster`,
  displayName: 'Organization invitation',
  previewData: {
    recipientName: 'Alex',
    inviterName: 'Jordan Lee',
    organizationName: 'Acme Programme Office',
    role: 'Programme Manager',
    acceptUrl: 'https://thetaskmaster.lovable.app',
  },
} satisfies TemplateEntry
