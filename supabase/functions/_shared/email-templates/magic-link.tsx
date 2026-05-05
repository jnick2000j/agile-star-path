/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface MagicLinkEmailProps {
  siteName: string
  confirmationUrl?: string
  token?: string
}

export const MagicLinkEmail = ({
  siteName,
  token,
}: MagicLinkEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your {siteName} sign-in code: {token ?? '------'}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Your sign-in code</Heading>
        <Text style={text}>
          Use the code below to sign in to <strong>{siteName}</strong>. This code
          expires in a few minutes.
        </Text>
        <Section style={codeBox}>
          <Text style={codeText}>{token ?? '------'}</Text>
        </Section>
        <Text style={text}>
          Enter this code in the verification screen on the {siteName} sign-in page.
        </Text>
        <Text style={footer}>
          If you didn't request this code, you can safely ignore this email — no one
          can sign in without it.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default MagicLinkEmail

const main = {
  backgroundColor: '#ffffff',
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
}
const container = { padding: '24px 32px', maxWidth: '600px' }
const h1 = {
  fontSize: '22px',
  fontWeight: 'bold' as const,
  color: 'hsl(213, 60%, 15%)',
  margin: '0 0 20px',
}
const text = {
  fontSize: '14px',
  color: 'hsl(213, 20%, 42%)',
  lineHeight: '1.5',
  margin: '0 0 20px',
}
const codeBox = {
  backgroundColor: 'hsl(213, 30%, 96%)',
  border: '1px solid hsl(213, 25%, 88%)',
  borderRadius: '8px',
  padding: '20px',
  textAlign: 'center' as const,
  margin: '0 0 24px',
}
const codeText = {
  fontSize: '32px',
  fontWeight: 700,
  letterSpacing: '8px',
  color: 'hsl(213, 60%, 15%)',
  margin: 0,
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
}
const footer = { fontSize: '12px', color: 'hsl(213, 15%, 55%)', margin: '24px 0 0' }
