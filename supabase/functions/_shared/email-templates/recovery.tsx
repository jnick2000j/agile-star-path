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

interface RecoveryEmailProps {
  siteName: string
  confirmationUrl: string
}

export const RecoveryEmail = ({
  siteName,
  confirmationUrl,
}: RecoveryEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Reset your password for {siteName}</Preview>
    <Body style={styles.main}>
      <Shell>
        <Heading style={styles.h1}>Reset your password</Heading>
        <Text style={styles.text}>
          We received a request to reset your password for <strong>{siteName}</strong>.
          Click the button below to choose a new password.
        </Text>
        <Button style={styles.button} href={confirmationUrl}>
          Reset password
        </Button>
        <Text style={styles.smallNote}>
          Or paste this link into your browser:
          <br />
          <Link href={confirmationUrl} style={styles.link}>{confirmationUrl}</Link>
        </Text>
        <Text style={styles.smallNote}>
          If you didn't request a password reset, you can safely ignore this
          email — your password will not be changed.
        </Text>
      </Shell>
    </Body>
  </Html>
)

export default RecoveryEmail
