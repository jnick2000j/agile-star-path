/// <reference types="npm:@types/react@18.3.1" />
// Resolves the email-shell branding (logo + sizes + site name) for a given
// org context. Tries the org-specific branding_settings row first, falls
// back to the platform (organization_id IS NULL) row, then to defaults.
//
// Logo objects live in the private 'logos' storage bucket so we mint a
// time-limited signed URL that survives the email's lifetime in the inbox
// (~7 days; this is the practical max we can give a remote image link).
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import type { EmailBrand } from './email-templates/_brand.tsx'

const SIGN_TTL_SECONDS = 60 * 60 * 24 * 7 // 7 days

function extractLogoPath(stored: string | null | undefined): string | null {
  if (!stored) return null
  const marker = '/storage/v1/object/'
  const idx = stored.indexOf(marker)
  if (idx === -1) return stored.replace(/^logos\//, '')
  let rest = stored.slice(idx + marker.length)
  rest = rest.replace(/^(public|sign|authenticated)\//, '')
  if (!rest.startsWith('logos/')) return null
  return rest.slice('logos/'.length).split('?')[0]
}

async function signLogo(
  supabase: SupabaseClient,
  stored: string | null | undefined,
): Promise<string | null> {
  const path = extractLogoPath(stored)
  if (!path) return null
  const { data } = await supabase.storage.from('logos').createSignedUrl(path, SIGN_TTL_SECONDS)
  return data?.signedUrl ?? null
}

function pickNumber(...vals: Array<number | null | undefined>): number | null {
  for (const v of vals) {
    if (typeof v === 'number' && v > 0) return v
  }
  return null
}

export async function resolveEmailBranding(
  supabaseUrl: string,
  serviceRoleKey: string,
  organizationId?: string | null,
): Promise<EmailBrand> {
  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey)

    const [{ data: platform }, orgRes] = await Promise.all([
      supabase
        .from('branding_settings')
        .select('*')
        .is('organization_id', null)
        .maybeSingle(),
      organizationId
        ? supabase
            .from('branding_settings')
            .select('*')
            .eq('organization_id', organizationId)
            .maybeSingle()
        : Promise.resolve({ data: null } as any),
    ])
    const org = (orgRes as any)?.data ?? null

    // Logo: prefer org logo if present, else platform.
    const storedLogo =
      (org?.logo_url as string | null) ?? (platform?.logo_url as string | null) ?? null
    const logoUrl = await signLogo(
      createClient(supabaseUrl, serviceRoleKey),
      storedLogo,
    )

    const logoWidth = pickNumber(org?.logo_email_width, platform?.logo_email_width)
    const logoHeight = pickNumber(org?.logo_email_height, platform?.logo_email_height)

    const siteName =
      (org?.site_name as string | null) ??
      (platform?.site_name as string | null) ??
      null

    return {
      siteName,
      logoUrl,
      logoWidth,
      logoHeight,
    }
  } catch (e) {
    console.error('resolveEmailBranding failed', e)
    return {}
  }
}
