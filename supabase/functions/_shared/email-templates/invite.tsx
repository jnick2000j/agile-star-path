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
import { Shell, styles, SITE_URL } from './_brand.tsx'

interface InviteEmailProps {
  siteName: string
  siteUrl: string
  confirmationUrl: string
}

export const InviteEmail = ({
  siteName,
  siteUrl,
  confirmationUrl,
}: InviteEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>You've been invited to join {siteName}</Preview>
    <Body style={styles.main}>
      <Shell>
        <Heading style={styles.h1}>You've been invited 🎉</Heading>
        <Text style={styles.text}>
          You've been invited to join{' '}
          <Link href={siteUrl || SITE_URL} style={styles.link}>
            <strong>{siteName}</strong>
          </Link>
          . Click the button below to accept and set up your account.
        </Text>
        <Button style={styles.button} href={confirmationUrl}>
          Accept invitation
        </Button>
        <Text style={styles.smallNote}>
          If the button doesn't work, copy and paste this link into your browser:
          <br />
          <Link href={confirmationUrl} style={styles.link}>{confirmationUrl}</Link>
        </Text>
        <Text style={styles.smallNote}>
          If you weren't expecting this invitation, you can safely ignore this email.
        </Text>
      </Shell>
    </Body>
  </Html>
)

export default InviteEmail
