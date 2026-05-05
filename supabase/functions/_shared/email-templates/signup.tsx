/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl?: string
  token?: string
}

export const SignupEmail = ({
  siteName,
  siteUrl,
  recipient,
  token,
}: SignupEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your {siteName} verification code: {token ?? '------'}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Confirm your email</Heading>
        <Text style={text}>
          Welcome to{' '}
          <Link href={siteUrl} style={link}>
            <strong>{siteName}</strong>
          </Link>
          ! Use the verification code below to finish creating your account for{' '}
          <Link href={`mailto:${recipient}`} style={link}>{recipient}</Link>.
        </Text>
        <Section style={codeBox}>
          <Text style={codeText}>{token ?? '------'}</Text>
        </Section>
        <Text style={text}>
          Enter this code on the {siteName} sign-up screen. The code expires
          in a few minutes.
        </Text>
        <Text style={footer}>
          If you didn't create an account, you can safely ignore this email.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default SignupEmail

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
const link = { color: 'hsl(178, 58%, 40%)', textDecoration: 'underline' }
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
