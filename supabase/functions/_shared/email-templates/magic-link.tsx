/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'
import { Shell, styles } from './_brand.tsx'

interface MagicLinkEmailProps {
  siteName: string
  confirmationUrl?: string
  token?: string
}

export const MagicLinkEmail = ({ siteName, token }: MagicLinkEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your {siteName} sign-in code: {token ?? '------'}</Preview>
    <Body style={styles.main}>
      <Shell>
        <Heading style={styles.h1}>Your sign-in code</Heading>
        <Text style={styles.text}>
          Use the code below to sign in to <strong>{siteName}</strong>. This code
          expires in a few minutes.
        </Text>
        <Section style={styles.codeBox}>
          <Text style={styles.codeText}>{token ?? '------'}</Text>
        </Section>
        <Text style={styles.text}>
          Enter this code on the {siteName} sign-in page.
        </Text>
        <Text style={styles.smallNote}>
          If you didn't request this code, you can safely ignore this email —
          no one can sign in without it.
        </Text>
      </Shell>
    </Body>
  </Html>
)

export default MagicLinkEmail
