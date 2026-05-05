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

interface DigestItem {
  label: string
  value: string | number
}

interface ProgrammeDigestProps {
  recipientName?: string
  programmeName?: string
  weekRange?: string
  ragStatus?: 'green' | 'amber' | 'red'
  summary?: string
  metrics?: DigestItem[]
  highlights?: string[]
  risks?: string[]
  programmeUrl?: string
}

const ragColor = (s?: string) =>
  s === 'red' ? '#b91c1c' : s === 'amber' ? '#c2410c' : '#15803d'

const ProgrammeWeeklyDigestEmail = ({
  recipientName,
  programmeName = 'Your programme',
  weekRange,
  ragStatus = 'green',
  summary,
  metrics = [],
  highlights = [],
  risks = [],
  programmeUrl,
}: ProgrammeDigestProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{programmeName} weekly digest{weekRange ? ` — ${weekRange}` : ''}</Preview>
    <Body style={styles.main}>
      <Shell>
        <Heading style={styles.h1}>
          {programmeName} — weekly digest
        </Heading>
        {weekRange ? (
          <Text style={{ ...styles.smallNote, margin: '-8px 0 12px' }}>{weekRange}</Text>
        ) : null}
        <Text style={styles.text}>
          {recipientName ? `Hi ${recipientName}, here's your programme summary.` : `Here's your programme summary.`}
        </Text>

        <Section style={{ ...styles.callout, borderLeft: `4px solid ${ragColor(ragStatus)}` }}>
          <Text style={{ ...styles.text, margin: 0, color: BRAND.navy }}>
            <strong>Overall RAG status:</strong>{' '}
            <span style={{ color: ragColor(ragStatus), textTransform: 'uppercase' }}>
              {ragStatus}
            </span>
          </Text>
          {summary ? <Text style={{ ...styles.text, margin: '6px 0 0' }}>{summary}</Text> : null}
        </Section>

        {metrics.length > 0 && (
          <Section style={{ marginBottom: '16px' }}>
            <Text style={{ ...styles.text, fontWeight: 600, color: BRAND.navy, margin: '0 0 8px' }}>
              Key metrics
            </Text>
            {metrics.map((m, i) => (
              <Text key={i} style={{ ...styles.text, margin: '0 0 4px' }}>
                • {m.label}: <strong>{m.value}</strong>
              </Text>
            ))}
          </Section>
        )}

        {highlights.length > 0 && (
          <Section style={{ marginBottom: '16px' }}>
            <Text style={{ ...styles.text, fontWeight: 600, color: BRAND.navy, margin: '0 0 8px' }}>
              Highlights this week
            </Text>
            {highlights.map((h, i) => (
              <Text key={i} style={{ ...styles.text, margin: '0 0 4px' }}>• {h}</Text>
            ))}
          </Section>
        )}

        {risks.length > 0 && (
          <Section style={{ marginBottom: '16px' }}>
            <Text style={{ ...styles.text, fontWeight: 600, color: BRAND.navy, margin: '0 0 8px' }}>
              Top risks &amp; issues
            </Text>
            {risks.map((r, i) => (
              <Text key={i} style={{ ...styles.text, margin: '0 0 4px' }}>• {r}</Text>
            ))}
          </Section>
        )}

        {programmeUrl ? (
          <Button style={styles.button} href={programmeUrl}>Open programme dashboard</Button>
        ) : null}
      </Shell>
    </Body>
  </Html>
)

export const template = {
  component: ProgrammeWeeklyDigestEmail,
  subject: (d: Record<string, any>) =>
    d?.programmeName ? `${d.programmeName} — weekly digest` : 'Your weekly programme digest',
  displayName: 'Programme weekly digest',
  previewData: {
    recipientName: 'Alex',
    programmeName: 'Digital Transformation Programme',
    weekRange: 'Apr 28 – May 4, 2026',
    ragStatus: 'amber',
    summary: '2 of 3 projects on track. Vendor delay impacting Q2 milestone.',
    metrics: [
      { label: 'Active projects', value: 3 },
      { label: 'Open risks', value: 7 },
      { label: 'Budget consumed', value: '$1.2M / $2.0M' },
      { label: 'Milestones hit (week)', value: '4 / 5' },
    ],
    highlights: [
      'Stage 2 closure approved by Programme Board',
      'New supplier onboarded for portal rebuild',
    ],
    risks: [
      'Vendor X delivery slipping by 2 weeks',
      'Resource constraint on backend team in Sprint 14',
    ],
    programmeUrl: 'https://thetaskmaster.lovable.app',
  },
} satisfies TemplateEntry
