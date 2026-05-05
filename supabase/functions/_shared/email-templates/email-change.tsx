/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body,
  Button,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'
import { Shell, styles } from './_brand.tsx'

interface EmailChangeEmailProps {
  siteName: string
  email: string
  newEmail: string
  confirmationUrl: string
}

export const EmailChangeEmail = ({
  siteName,
  email,
  newEmail,
  confirmationUrl,
}: EmailChangeEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Confirm your email change for {siteName}</Preview>
    <Body style={styles.main}>
      <Shell>
        <Heading style={styles.h1}>Confirm your email change</Heading>
        <Text style={styles.text}>
          You requested to change your <strong>{siteName}</strong> sign-in email
          from <Link href={`mailto:${email}`} style={styles.link}>{email}</Link>{' '}
          to <Link href={`mailto:${newEmail}`} style={styles.link}>{newEmail}</Link>.
        </Text>
        <Button style={styles.button} href={confirmationUrl}>
          Confirm email change
        </Button>
        <Text style={styles.smallNote}>
          If you didn't request this change, please secure your account
          immediately by resetting your password.
        </Text>
      </Shell>
    </Body>
  </Html>
)

export default EmailChangeEmail
