import { supabase } from "@/integrations/supabase/client";

/**
 * Default fallback site URL used when the platform setting hasn't been
 * configured yet (e.g. very first run, or DB unavailable). Platform admins
 * can override this in Platform Admin → Settings.
 */
export const DEFAULT_SITE_URL = "https://thetaskmaster.lovable.app";

let cached: { value: string; at: number } | null = null;
const TTL_MS = 60_000;

/** Resolve the configured production site URL (used for auth redirects). */
export async function getSiteUrl(): Promise<string> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.value;
  try {
    const { data, error } = await supabase.rpc("get_site_url");
    if (error) throw error;
    const value = (typeof data === "string" && data.trim()) || DEFAULT_SITE_URL;
    cached = { value, at: Date.now() };
    return value;
  } catch (err) {
    console.warn("Falling back to DEFAULT_SITE_URL:", err);
    return DEFAULT_SITE_URL;
  }
}

/** Clear the cached value (call after a platform admin updates the setting). */
export function invalidateSiteUrlCache() {
  cached = null;
}
