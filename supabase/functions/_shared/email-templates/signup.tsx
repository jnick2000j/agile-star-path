/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'
import { Shell, styles, SITE_URL } from './_brand.tsx'

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
    <Body style={styles.main}>
      <Shell>
        <Heading style={styles.h1}>Confirm your email</Heading>
        <Text style={styles.text}>
          Welcome to{' '}
          <Link href={siteUrl || SITE_URL} style={styles.link}>
            <strong>{siteName}</strong>
          </Link>
          ! Use the verification code below to finish creating your account
          for <Link href={`mailto:${recipient}`} style={styles.link}>{recipient}</Link>.
        </Text>
        <Section style={styles.codeBox}>
          <Text style={styles.codeText}>{token ?? '------'}</Text>
        </Section>
        <Text style={styles.text}>
          Enter this code on the {siteName} sign-up screen. The code expires in
          a few minutes. After verification, you'll be asked to log in.
        </Text>
        <Text style={styles.smallNote}>
          If you didn't create an account, you can safely ignore this email.
        </Text>
      </Shell>
    </Body>
  </Html>
)

export default SignupEmail
