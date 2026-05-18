import { createClient } from "npm:@supabase/supabase-js@2";
import {
  corsHeaders, getOrgCreds, authEndpoint, getRedirectUri, signState,
  GOOGLE_SCOPES, MS_SCOPES, type Provider,
} from "../_shared/calendar.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: claims } = await supabase.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (!claims?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const user_id = claims.claims.sub as string;
    const { provider, organization_id } = await req.json() as { provider: Provider; organization_id: string };
    if (!provider || !organization_id) {
      return new Response(JSON.stringify({ error: "provider and organization_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Use service role to read org integration (admin-only RLS doesn't block service role).
    const svc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const creds = await getOrgCreds(svc, organization_id, provider);
    if (!creds) {
      return new Response(JSON.stringify({ error: "This integration has not been configured by your administrator." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const origin = req.headers.get("origin") || req.headers.get("referer") || "";
    const state = await signState({ user_id, organization_id, provider, origin });

    const params = new URLSearchParams({
      client_id: creds.clientId,
      redirect_uri: getRedirectUri(),
      response_type: "code",
      scope: provider === "google" ? GOOGLE_SCOPES : MS_SCOPES,
      state,
      access_type: "offline",
      prompt: "consent",
    });
    if (provider === "microsoft") {
      params.delete("access_type");
      params.set("response_mode", "query");
    }
    const url = `${authEndpoint(provider, creds.tenant)}?${params.toString()}`;
    return new Response(JSON.stringify({ url }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
