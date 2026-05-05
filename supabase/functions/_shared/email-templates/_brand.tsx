/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Container,
  Hr,
  Img,
  Link,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'

// Shared TaskMaster brand chrome for both auth and app emails.
export const BRAND = {
  primary: 'hsl(178, 58%, 40%)',
  primaryDark: 'hsl(178, 58%, 32%)',
  navy: 'hsl(213, 60%, 15%)',
  text: 'hsl(213, 20%, 42%)',
  muted: 'hsl(213, 15%, 55%)',
  border: 'hsl(210, 22%, 88%)',
  bg: '#ffffff',
  surface: 'hsl(200, 25%, 97%)',
  font:
    'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
}

export const SITE_NAME = 'The TaskMaster'
export const SITE_URL = 'https://thetaskmaster.lovable.app'

// Branding overrides resolved per-send (org → platform → defaults).
export interface EmailBrand {
  siteName?: string | null
  siteUrl?: string | null
  logoUrl?: string | null
  logoWidth?: number | null  // px
  logoHeight?: number | null // px
  tagline?: string | null
}

export const BrandContext = React.createContext<EmailBrand>({})

export const Header = () => {
  const brand = React.useContext(BrandContext)
  const name = brand.siteName || SITE_NAME
  const tag =
    brand.tagline ?? 'Programme & Project Information Management'
  const w = brand.logoWidth && brand.logoWidth > 0 ? brand.logoWidth : undefined
  const h = brand.logoHeight && brand.logoHeight > 0 ? brand.logoHeight : 32

  return (
    <Section style={headerSection}>
      {brand.logoUrl ? (
        <Img
          src={brand.logoUrl}
          alt={name}
          width={w as any}
          height={h as any}
          style={{
            display: 'block',
            objectFit: 'contain',
            ...(w ? { width: `${w}px` } : { width: 'auto' }),
            height: `${h}px`,
            margin: '0 0 4px',
          }}
        />
      ) : (
        <Text style={brandMark}>
          <span style={brandDot}>●</span> <span style={brandText}>{name}</span>
        </Text>
      )}
      {tag ? <Text style={tagline}>{tag}</Text> : null}
    </Section>
  )
}

export const Footer = () => {
  const brand = React.useContext(BrandContext)
  const name = brand.siteName || SITE_NAME
  const url = brand.siteUrl || SITE_URL
  const display = url.replace(/^https?:\/\//, '')
  return (
    <Section style={footerSection}>
      <Hr style={hr} />
      <Text style={footerText}>
        Sent by <strong>{name}</strong> &middot;{' '}
        <Link href={url} style={footerLink}>
          {display}
        </Link>
      </Text>
      <Text style={footerSmall}>
        You're receiving this email because of activity on your {name}{' '}
        account. Need help? Contact your organization administrator.
      </Text>
    </Section>
  )
}

export const Shell: React.FC<{
  children: React.ReactNode
  brand?: EmailBrand
}> = ({ children, brand }) => {
  const inner = (
    <Container style={shell}>
      <Header />
      <Section style={body}>{children}</Section>
      <Footer />
    </Container>
  )
  if (brand) {
    return <BrandContext.Provider value={brand}>{inner}</BrandContext.Provider>
  }
  return inner
}

const shell = {
  maxWidth: '600px',
  margin: '0 auto',
  backgroundColor: BRAND.bg,
  border: `1px solid ${BRAND.border}`,
  borderRadius: '8px',
  overflow: 'hidden',
}
const headerSection = {
  background: 'linear-gradient(135deg, hsl(213, 60%, 25%) 0%, hsl(178, 58%, 42%) 100%)',
  padding: '20px 28px',
}
const brandMark = {
  margin: 0,
  color: '#ffffff',
  fontSize: '18px',
  fontWeight: 700,
  fontFamily: BRAND.font,
}
const brandDot = { color: 'hsl(174, 62%, 70%)', fontSize: '20px' }
const brandText = { letterSpacing: '0.2px' }
const tagline = {
  margin: '4px 0 0',
  color: 'rgba(255,255,255,0.8)',
  fontSize: '12px',
  fontFamily: BRAND.font,
}
const body = { padding: '28px 32px', backgroundColor: BRAND.bg }
const footerSection = { padding: '0 32px 24px', backgroundColor: BRAND.bg }
const hr = { border: 'none', borderTop: `1px solid ${BRAND.border}`, margin: '0 0 16px' }
const footerText = {
  margin: '0 0 6px',
  fontSize: '12px',
  color: BRAND.muted,
  fontFamily: BRAND.font,
}
const footerLink = { color: BRAND.primary, textDecoration: 'none' }
const footerSmall = {
  margin: 0,
  fontSize: '11px',
  color: BRAND.muted,
  lineHeight: '1.5',
  fontFamily: BRAND.font,
}

export const styles = {
  main: { backgroundColor: BRAND.surface, fontFamily: BRAND.font, padding: '24px 0' },
  h1: {
    fontSize: '22px',
    fontWeight: 700 as const,
    color: BRAND.navy,
    margin: '0 0 16px',
    fontFamily: BRAND.font,
  },
  text: {
    fontSize: '14px',
    color: BRAND.text,
    lineHeight: '1.6',
    margin: '0 0 16px',
    fontFamily: BRAND.font,
  },
  link: { color: BRAND.primary, textDecoration: 'underline' },
  button: {
    backgroundColor: BRAND.primary,
    color: '#ffffff',
    fontSize: '14px',
    borderRadius: '6px',
    padding: '12px 22px',
    textDecoration: 'none',
    fontWeight: 600 as const,
    display: 'inline-block',
    fontFamily: BRAND.font,
  },
  codeBox: {
    backgroundColor: BRAND.surface,
    border: `1px solid ${BRAND.border}`,
    borderRadius: '8px',
    padding: '20px',
    textAlign: 'center' as const,
    margin: '0 0 20px',
  },
  codeText: {
    fontSize: '32px',
    fontWeight: 700 as const,
    letterSpacing: '8px',
    color: BRAND.navy,
    margin: 0,
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  },
  callout: {
    backgroundColor: 'hsl(178, 50%, 96%)',
    border: `1px solid hsl(178, 50%, 85%)`,
    borderRadius: '6px',
    padding: '12px 16px',
    margin: '12px 0 16px',
  },
  smallNote: {
    fontSize: '12px',
    color: BRAND.muted,
    margin: '20px 0 0',
    lineHeight: '1.5',
    fontFamily: BRAND.font,
  },
}
