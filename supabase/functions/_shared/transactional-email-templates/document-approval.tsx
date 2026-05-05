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

interface DocApprovalProps {
  recipientName?: string
  documentName?: string
  documentType?: string
  requestedBy?: string
  programmeName?: string
  projectName?: string
  dueDate?: string
  notes?: string
  approvalUrl?: string
}

const DocumentApprovalEmail = ({
  recipientName,
  documentName = 'A document',
  documentType,
  requestedBy,
  programmeName,
  projectName,
  dueDate,
  notes,
  approvalUrl,
}: DocApprovalProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Approval needed: {documentName}</Preview>
    <Body style={styles.main}>
      <Shell>
        <Heading style={styles.h1}>Approval requested</Heading>
        <Text style={styles.text}>
          {recipientName ? `Hi ${recipientName}, ` : ''}
          {requestedBy ? <><strong>{requestedBy}</strong> has requested your approval</> : 'Your approval is requested'}
          {' '}on a {documentType ? <strong>{documentType}</strong> : 'document'}
          {projectName || programmeName
            ? <> in <strong>{projectName || programmeName}</strong>.</>
            : '.'}
        </Text>

        <Section style={styles.callout}>
          <Text style={{ ...styles.text, margin: '0 0 6px', color: BRAND.navy, fontWeight: 600 }}>
            {documentName}
          </Text>
          {documentType ? (
            <Text style={{ ...styles.smallNote, margin: '0 0 4px' }}>
              Type: <strong>{documentType}</strong>
            </Text>
          ) : null}
          {dueDate ? (
            <Text style={{ ...styles.smallNote, margin: 0 }}>
              Approval due: <strong>{dueDate}</strong>
            </Text>
          ) : null}
        </Section>

        {notes ? (
          <Text style={styles.text}>
            <strong>Notes from requester:</strong>
            <br />
            {notes}
          </Text>
        ) : null}

        {approvalUrl ? (
          <Button style={styles.button} href={approvalUrl}>Review &amp; approve</Button>
        ) : null}

        <Text style={styles.smallNote}>
          You're receiving this because you're listed as an approver under TaskMaster's
          PRINCE2 governance workflow.
        </Text>
      </Shell>
    </Body>
  </Html>
)

export const template = {
  component: DocumentApprovalEmail,
  subject: (d: Record<string, any>) =>
    d?.documentName ? `Approval needed: ${d.documentName}` : 'Document approval requested',
  displayName: 'Document approval needed',
  previewData: {
    recipientName: 'Alex',
    documentName: 'Project Initiation Document v1.2',
    documentType: 'PID',
    requestedBy: 'Jordan Lee (Project Manager)',
    programmeName: 'Digital Transformation Programme',
    projectName: 'Customer Portal Rebuild',
    dueDate: 'May 8, 2026',
    notes: 'Updated section 4 (Business Case) to reflect revised cost estimates.',
    approvalUrl: 'https://thetaskmaster.lovable.app',
  },
} satisfies TemplateEntry
