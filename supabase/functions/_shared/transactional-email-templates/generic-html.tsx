import * as React from 'npm:react@18.3.1'
import {
  Body,
  Container,
  Head,
  Html,
  Preview,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'TaskMaster'

interface GenericHtmlProps {
  subject?: string
  html?: string
  text?: string
}

const GenericHtmlEmail = ({ subject, html, text }: GenericHtmlProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{subject || `A message from ${SITE_NAME}`}</Preview>
    <Body style={main}>
      <Container style={container}>
        {html ? (
          // The HTML body is provided by the caller (already trusted server-side
          // content from the app's own backend). Render it inside a wrapper div.
          <div
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{ __html: html }}
          />
        ) : (
          <div style={text as any}>{text}</div>
        )}
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: GenericHtmlEmail,
  subject: (data: Record<string, any>) =>
    (data?.subject as string) || `A message from ${SITE_NAME}`,
  displayName: 'Generic HTML',
  previewData: {
    subject: 'Sample message',
    html: '<h1>Hello from TaskMaster</h1><p>This is a preview of the generic HTML email template.</p>',
  },
} satisfies TemplateEntry

const main = {
  backgroundColor: '#ffffff',
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
}
const container = {
  padding: '24px 32px',
  maxWidth: '600px',
}
