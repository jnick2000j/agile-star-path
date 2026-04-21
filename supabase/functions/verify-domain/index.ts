// DNS TXT verification for tenant domain ownership.
// Action "issue": creates a domain_verifications row with a fresh token.
// Action "check": resolves _lovable-verify.<domain> via DNS-over-HTTPS and
// marks the row verified if the token matches.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface Payload {
  action: "issue" | "check";
  organization_id: string;
  domain: string;
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

    const { action, organization_id, domain }: Payload = await req.json();
    if (!action || !organization_id || !domain) {
      return json({ error: "action, organization_id, domain required" }, 400);
    }
    const normalized = domain.trim().toLowerCase();
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(normalized)) {
      return json({ error: "Invalid domain" }, 400);
    }

    const { data: hasAccess } = await admin.rpc("has_org_access", {
      _user_id: userId,
      _org_id: organization_id,
      _min_level: "admin",
    });
    if (!hasAccess) return json({ error: "Forbidden" }, 403);

    if (action === "issue") {
      // Upsert (organization_id, domain) — generates token via default
      const { data: existing } = await admin
        .from("domain_verifications")
        .select("*")
        .eq("organization_id", organization_id)
        .eq("domain", normalized)
        .maybeSingle();

      if (existing && existing.status === "verified") {
        return json({ ok: true, token: existing.verification_token, status: "verified" });
      }

      if (existing) {
        return json({
          ok: true,
          token: existing.verification_token,
          status: existing.status,
          host: `_lovable-verify.${normalized}`,
        });
      }

      const { data: created, error } = await admin
        .from("domain_verifications")
        .insert({
          organization_id,
          domain: normalized,
          status: "pending",
          created_by: userId,
        })
        .select()
        .single();
      if (error) throw error;

      return json({
        ok: true,
        token: created.verification_token,
        status: "pending",
        host: `_lovable-verify.${normalized}`,
      });
    }

    if (action === "check") {
      const { data: row } = await admin
        .from("domain_verifications")
        .select("*")
        .eq("organization_id", organization_id)
        .eq("domain", normalized)
        .maybeSingle();
      if (!row) return json({ error: "No verification request found" }, 404);

      const host = `_lovable-verify.${normalized}`;
      const dnsResp = await fetch(
        `https://dns.google/resolve?name=${encodeURIComponent(host)}&type=TXT`,
        { headers: { accept: "application/dns-json" } }
      );
      if (!dnsResp.ok) return json({ error: "DNS resolver unavailable" }, 502);
      const dnsJson = await dnsResp.json();
      const answers: { data: string }[] = dnsJson.Answer ?? [];
      const records = answers.map((a) => a.data.replace(/^"|"$/g, "").replace(/"\s+"/g, ""));
      const matched = records.some((r) => r.includes(row.verification_token));

      const newStatus = matched ? "verified" : "pending";
      await admin
        .from("domain_verifications")
        .update({
          status: newStatus,
          last_checked_at: new Date().toISOString(),
          verified_at: matched ? new Date().toISOString() : null,
        })
        .eq("id", row.id);

      if (matched) {
        await admin.rpc("log_audit_event", {
          _event_type: "domain_verified",
          _event_category: "sso",
          _organization_id: organization_id,
          _metadata: { domain: normalized },
        });
      }

      return json({
        ok: true,
        status: newStatus,
        verified: matched,
        host,
        records,
      });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    console.error("verify-domain error:", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
