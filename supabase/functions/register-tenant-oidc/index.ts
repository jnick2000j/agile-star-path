// Register a tenant OIDC SSO provider via Supabase Admin API
// Note: Supabase GoTrue currently exposes OIDC providers through the same SSO admin
// endpoint. If your project plan does not include OIDC at the platform level,
// the connection is recorded as `pending` and a platform admin can finish the
// wiring manually.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface RegisterPayload {
  sso_configuration_id: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing authorization" }, 401);

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);
    const userId = userData.user.id;

    const { sso_configuration_id }: RegisterPayload = await req.json();
    if (!sso_configuration_id) return json({ error: "sso_configuration_id required" }, 400);

    const { data: cfg } = await admin
      .from("sso_configurations")
      .select("*")
      .eq("id", sso_configuration_id)
      .maybeSingle();
    if (!cfg) return json({ error: "SSO configuration not found" }, 404);

    const { data: hasAccess } = await admin.rpc("has_org_access", {
      _user_id: userId,
      _org_id: cfg.organization_id,
      _min_level: "admin",
    });
    if (!hasAccess) return json({ error: "Forbidden" }, 403);

    if (cfg.provider_type !== "oidc") {
      return json({ error: "Configuration is not OIDC" }, 400);
    }
    if (!cfg.oidc_issuer_url || !cfg.oidc_client_id) {
      return json({ error: "OIDC issuer URL and client ID are required" }, 400);
    }

    // Verify domains
    const { data: domainRecords } = await admin
      .from("domain_verifications")
      .select("domain, status")
      .eq("organization_id", cfg.organization_id)
      .in("domain", cfg.allowed_domains ?? []);

    const verifiedSet = new Set(
      (domainRecords ?? []).filter((r: any) => r.status === "verified").map((r: any) => r.domain)
    );
    const unverified = (cfg.allowed_domains ?? []).filter((d: string) => !verifiedSet.has(d));
    if (unverified.length > 0) {
      return json({ error: `Domains not verified: ${unverified.join(", ")}` }, 400);
    }

    // Try the OIDC admin endpoint. Some Supabase plans do not expose this — in
    // that case we record the request as "pending platform review" and a
    // platform admin completes provisioning manually (same flow as SAML when it
    // first launched).
    const adminBase = `${SUPABASE_URL}/auth/v1/admin/sso/providers`;
    const body = {
      type: "oidc",
      issuer: cfg.oidc_issuer_url,
      client_id: cfg.oidc_client_id,
      domains: cfg.allowed_domains,
    };

    const resp = await fetch(adminBase, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SERVICE_KEY}`,
        apikey: SERVICE_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const respText = await resp.text();
    if (!resp.ok) {
      // Fall back to pending review
      console.warn("OIDC admin registration unavailable, marking pending:", resp.status, respText);
      await admin
        .from("sso_configurations")
        .update({
          status: "pending",
          provisioning_notes: `OIDC connection awaiting platform review. Detail: ${respText.slice(0, 300)}`,
        })
        .eq("id", sso_configuration_id);

      await admin.rpc("log_audit_event", {
        _event_type: "sso_oidc_pending_review",
        _event_category: "sso",
        _organization_id: cfg.organization_id,
        _target_entity_type: "sso_configuration",
        _target_entity_id: sso_configuration_id,
        _metadata: { issuer: cfg.oidc_issuer_url },
      });

      return json({ ok: true, pending_review: true });
    }

    const provider = JSON.parse(respText);
    await admin
      .from("sso_configurations")
      .update({
        sso_config_id: provider.id,
        status: "active",
        activated_at: new Date().toISOString(),
        provisioning_notes: null,
      })
      .eq("id", sso_configuration_id);

    await admin.rpc("log_audit_event", {
      _event_type: "sso_provider_registered",
      _event_category: "sso",
      _organization_id: cfg.organization_id,
      _target_entity_type: "sso_configuration",
      _target_entity_id: sso_configuration_id,
      _metadata: { provider_id: provider.id, type: "oidc" },
    });

    return json({ ok: true, provider_id: provider.id });
  } catch (e) {
    console.error("register-tenant-oidc error:", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
