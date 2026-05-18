// Shared helpers for calendar OAuth + sync edge functions
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export type Provider = "google" | "microsoft";

export const GOOGLE_SCOPES =
  "openid email https://www.googleapis.com/auth/calendar.events";
export const MS_SCOPES =
  "openid email offline_access Calendars.ReadWrite User.Read";

export function getRedirectUri(): string {
  return `${Deno.env.get("SUPABASE_URL")}/functions/v1/calendar-oauth-callback`;
}

export function authEndpoint(provider: Provider, tenant?: string | null): string {
  if (provider === "google") {
    return "https://accounts.google.com/o/oauth2/v2/auth";
  }
  return `https://login.microsoftonline.com/${tenant || "common"}/oauth2/v2.0/authorize`;
}

export function tokenEndpoint(provider: Provider, tenant?: string | null): string {
  if (provider === "google") return "https://oauth2.googleapis.com/token";
  return `https://login.microsoftonline.com/${tenant || "common"}/oauth2/v2.0/token`;
}

// HMAC-signed compact state token: base64url(payload).base64url(sig)
async function hmacKey() {
  const secret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || "fallback";
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

function b64url(bytes: Uint8Array | ArrayBuffer): string {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlDecode(s: string): Uint8Array {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  return Uint8Array.from(atob(s), c => c.charCodeAt(0));
}

export async function signState(payload: Record<string, unknown>): Promise<string> {
  const key = await hmacKey();
  const body = b64url(new TextEncoder().encode(JSON.stringify({ ...payload, iat: Date.now() })));
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return `${body}.${b64url(sig)}`;
}

export async function verifyState(state: string): Promise<Record<string, any> | null> {
  const [body, sig] = state.split(".");
  if (!body || !sig) return null;
  const key = await hmacKey();
  const ok = await crypto.subtle.verify(
    "HMAC", key, b64urlDecode(sig), new TextEncoder().encode(body)
  );
  if (!ok) return null;
  const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(body)));
  if (Date.now() - (payload.iat || 0) > 15 * 60 * 1000) return null; // 15 min
  return payload;
}

export async function getOrgCreds(
  supabase: any,
  organization_id: string,
  provider: Provider
): Promise<{ clientId: string; clientSecret: string; tenant?: string | null } | null> {
  const { data } = await supabase
    .from("organization_calendar_integrations")
    .select("enabled, use_custom_oauth, custom_client_id, custom_client_secret, tenant_id")
    .eq("organization_id", organization_id)
    .eq("provider", provider)
    .maybeSingle();
  if (!data || !data.enabled) return null;
  if (!data.use_custom_oauth || !data.custom_client_id || !data.custom_client_secret) return null;
  return {
    clientId: data.custom_client_id,
    clientSecret: data.custom_client_secret,
    tenant: data.tenant_id,
  };
}

export async function refreshToken(
  provider: Provider,
  clientId: string,
  clientSecret: string,
  refresh_token: string,
  tenant?: string | null
): Promise<{ access_token: string; expires_in: number; refresh_token?: string } | null> {
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token,
    grant_type: "refresh_token",
  });
  if (provider === "microsoft") body.set("scope", MS_SCOPES);
  const res = await fetch(tokenEndpoint(provider, tenant), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) return null;
  return await res.json();
}

export async function ensureFreshToken(
  supabase: any,
  conn: any
): Promise<string | null> {
  const expSoon = !conn.token_expires_at || new Date(conn.token_expires_at).getTime() - Date.now() < 60_000;
  if (!expSoon && conn.access_token) return conn.access_token;
  const creds = await getOrgCreds(supabase, conn.organization_id, conn.provider);
  if (!creds || !conn.refresh_token) return conn.access_token || null;
  const fresh = await refreshToken(conn.provider, creds.clientId, creds.clientSecret, conn.refresh_token, creds.tenant);
  if (!fresh) return null;
  const expires_at = new Date(Date.now() + (fresh.expires_in - 30) * 1000).toISOString();
  await supabase.from("user_calendar_connections").update({
    access_token: fresh.access_token,
    refresh_token: fresh.refresh_token || conn.refresh_token,
    token_expires_at: expires_at,
  }).eq("id", conn.id);
  return fresh.access_token;
}
