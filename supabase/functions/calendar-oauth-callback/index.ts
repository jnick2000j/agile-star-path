import { createClient } from "npm:@supabase/supabase-js@2";
import {
  corsHeaders, verifyState, getOrgCreds, tokenEndpoint, getRedirectUri,
  GOOGLE_SCOPES, MS_SCOPES, type Provider,
} from "../_shared/calendar.ts";

function redirect(origin: string, ok: boolean, reason?: string) {
  const base = origin || (Deno.env.get("SUPABASE_URL") || "");
  const url = new URL(base);
  url.pathname = "/profile";
  url.search = ok ? "?calendar=connected" : `?calendar=error&reason=${encodeURIComponent(reason || "Unknown error")}`;
  return new Response(null, { status: 302, headers: { ...corsHeaders, Location: url.toString() } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const err = url.searchParams.get("error");

  const payload = state ? await verifyState(state) : null;
  const origin = payload?.origin || "";
  if (err) return redirect(origin, false, err);
  if (!code || !payload) return redirect(origin, false, "Invalid state");

  const provider = payload.provider as Provider;
  const svc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const creds = await getOrgCreds(svc, payload.organization_id, provider);
  if (!creds) return redirect(origin, false, "Integration disabled");

  // Exchange code for tokens
  const body = new URLSearchParams({
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
    code,
    redirect_uri: getRedirectUri(),
    grant_type: "authorization_code",
  });
  if (provider === "microsoft") body.set("scope", MS_SCOPES);
  else body.set("scope", GOOGLE_SCOPES);

  const tokRes = await fetch(tokenEndpoint(provider, creds.tenant), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!tokRes.ok) {
    const t = await tokRes.text();
    return redirect(origin, false, `Token exchange failed: ${t.slice(0, 120)}`);
  }
  const tok = await tokRes.json();
  const expires_at = new Date(Date.now() + (tok.expires_in - 30) * 1000).toISOString();

  // Fetch account email
  let email: string | null = null;
  try {
    if (provider === "google") {
      const r = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${tok.access_token}` },
      });
      if (r.ok) email = (await r.json()).email;
    } else {
      const r = await fetch("https://graph.microsoft.com/v1.0/me", {
        headers: { Authorization: `Bearer ${tok.access_token}` },
      });
      if (r.ok) {
        const j = await r.json();
        email = j.mail || j.userPrincipalName;
      }
    }
  } catch { /* ignore */ }

  const upsertPayload = {
    user_id: payload.user_id,
    organization_id: payload.organization_id,
    provider,
    account_email: email,
    target_calendar_id: "primary",
    access_token: tok.access_token,
    refresh_token: tok.refresh_token || null,
    token_expires_at: expires_at,
    sync_enabled: true,
    last_error: null,
  };
  const { error } = await svc
    .from("user_calendar_connections")
    .upsert(upsertPayload, { onConflict: "user_id,provider" });
  if (error) return redirect(origin, false, error.message);
  return redirect(origin, true);
});
