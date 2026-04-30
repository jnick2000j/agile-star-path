import { supabase } from "@/integrations/supabase/client";

/**
 * Extracts the object path inside the 'logos' bucket from either a legacy
 * Supabase public URL or an already-bare path. Returns null if the input
 * doesn't look like a logos-bucket asset.
 */
export function extractLogoPath(stored: string | null | undefined): string | null {
  if (!stored) return null;
  const marker = "/storage/v1/object/";
  const idx = stored.indexOf(marker);
  if (idx === -1) {
    // Already a path (or an external absolute URL — only treat as path if no scheme)
    if (/^https?:\/\//i.test(stored)) return null;
    return stored.replace(/^logos\//, "");
  }
  let rest = stored.slice(idx + marker.length);
  rest = rest.replace(/^(public|sign|authenticated)\//, "");
  if (!rest.startsWith("logos/")) return null;
  return rest.slice("logos/".length).split("?")[0];
}

/**
 * Resolve a stored logo reference to a usable URL for an authenticated user.
 * Uses signed URLs because the 'logos' bucket is private.
 *
 * - If `stored` is an external URL (not in our storage), returns it unchanged.
 * - If we can't sign it, falls back to the original value.
 */
export async function resolveLogoUrl(stored: string | null | undefined): Promise<string | null> {
  if (!stored) return null;
  const path = extractLogoPath(stored);
  if (!path) return stored; // external URL, return as-is
  const { data, error } = await supabase.storage
    .from("logos")
    .createSignedUrl(path, 60 * 60);
  if (error || !data?.signedUrl) return stored;
  return data.signedUrl;
}
