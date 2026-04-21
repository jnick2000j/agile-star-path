// Register a tenant SAML SSO provider via Supabase Admin API
// Called by SSOSetupWizard after the org admin completes domain verification.
// Stores the returned provider id back into sso_configurations.sso_config_id.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface RegisterPayload {
  sso_configuration_id: string; // public.sso_configurations.id
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "Missing authorization" }, 401);
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);
    const userId = userData.user.id;

    const { sso_configuration_id }: RegisterPayload = await req.json();
    if (!sso_configuration_id) return json({ error: "sso_configuration_id required" }, 400);

    // Load config and check user has admin access to the org
    const { data: cfg, error: cfgErr } = await admin
      .from("sso_configurations")
      .select("*")
      .eq("id", sso_configuration_id)
      .maybeSingle();
    if (cfgErr || !cfg) return json({ error: "SSO configuration not found" }, 404);

    const { data: hasAccess } = await admin.rpc("has_org_access", {
      _user_id: userId,
      _org_id: cfg.organization_id,
      _min_level: "admin",
    });
    if (!hasAccess) return json({ error: "Forbidden" }, 403);

    if (cfg.provider_type !== "saml") {
      return json({ error: "Configuration is not SAML" }, 400);
    }
    if (!cfg.metadata_url) {
      return json({ error: "Metadata URL missing on configuration" }, 400);
    }

    // Verify all allowed domains have a verified record
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

    // Call Supabase Admin SSO Providers API
    const adminBase = `${SUPABASE_URL}/auth/v1/admin/sso/providers`;
    const body = {
      type: "saml",
      metadata_url: cfg.metadata_url,
      domains: cfg.allowed_domains,
      attribute_mapping: {
        keys: {
          email: { name: "email" },
          first_name: { name: "first_name" },
          last_name: { name: "last_name" },
          full_name: { name: "full_name" },
          groups: { name: "groups", array: true },
        },
      },
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
      console.error("SSO provider registration failed:", resp.status, respText);
      await admin
        .from("sso_configurations")
        .update({
          status: "rejected",
          provisioning_notes: `Provider registration failed: ${respText.slice(0, 500)}`,
        })
        .eq("id", sso_configuration_id);
      return json({ error: "Provider registration failed", detail: respText }, 502);
    }

    const provider = JSON.parse(respText);

    // Save provider id and activate
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
      _metadata: { provider_id: provider.id, type: "saml" },
    });

    return json({ ok: true, provider_id: provider.id });
  } catch (e) {
    console.error("register-tenant-saml error:", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
