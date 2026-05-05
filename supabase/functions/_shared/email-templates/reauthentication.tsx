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

interface ReauthenticationEmailProps {
  token: string
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your TaskMaster verification code</Preview>
    <Body style={styles.main}>
      <Shell>
        <Heading style={styles.h1}>Confirm it's you</Heading>
        <Text style={styles.text}>
          Use the code below to confirm your identity and complete this sensitive
          action on your TaskMaster account:
        </Text>
        <Section style={styles.codeBox}>
          <Text style={styles.codeText}>{token}</Text>
        </Section>
        <Text style={styles.smallNote}>
          This code will expire shortly. If you didn't request it, you can safely
          ignore this email.
        </Text>
      </Shell>
    </Body>
  </Html>
)

export default ReauthenticationEmail
