// SIEM exporter — sends a batch of audit events to a configured destination
// Action: { exporter_id?: string, event_ids?: string[], dry_run?: boolean }
//   - If exporter_id omitted, runs all active exporters across orgs the caller can admin.
//   - If event_ids omitted, picks events since the exporter's last_delivery_at (max 500).
//   - Records each delivery in siem_export_log.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface Payload {
  exporter_id?: string;
  organization_id?: string;
  dry_run?: boolean;
}

interface Exporter {
  id: string;
  organization_id: string;
  destination_type: string;
  endpoint_url: string;
  auth_header_name: string | null;
  auth_secret_name: string | null;
  format: string;
  event_categories: string[];
  last_delivery_at: string | null;
  consecutive_failures: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing authorization" }, 401);
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    const isServiceRole = token === SERVICE_KEY;

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    let callerUserId: string | null = null;
    if (!isServiceRole) {
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);
      callerUserId = userData.user.id;
    }

    const payload: Payload = await req.json().catch(() => ({}));

    let exporters: Exporter[];
    if (payload.exporter_id) {
      const { data, error } = await admin
        .from("siem_exporters")
        .select("*")
        .eq("id", payload.exporter_id)
        .eq("is_active", true);
      if (error) throw error;
      exporters = data ?? [];
    } else if (payload.organization_id) {
      if (!isServiceRole) {
        const { data: hasAccess } = await admin.rpc("has_org_access", {
          _user_id: callerUserId,
          _org_id: payload.organization_id,
          _min_level: "admin",
        });
        if (!hasAccess) return json({ error: "Forbidden" }, 403);
      }
      const { data, error } = await admin
        .from("siem_exporters")
        .select("*")
        .eq("organization_id", payload.organization_id)
        .eq("is_active", true);
      if (error) throw error;
      exporters = data ?? [];
    } else {
      return json({ error: "exporter_id or organization_id required" }, 400);
    }

    const results: any[] = [];
    for (const exp of exporters) {
      const since =
        exp.last_delivery_at ?? new Date(Date.now() - 24 * 3600_000).toISOString();
      const { data: events } = await admin
        .from("auth_audit_log")
        .select("*")
        .eq("organization_id", exp.organization_id)
        .gt("created_at", since)
        .in("event_category", exp.event_categories)
        .order("created_at", { ascending: true })
        .limit(500);

      const eventCount = events?.length ?? 0;
      if (eventCount === 0) {
        results.push({ exporter_id: exp.id, status: "noop", events: 0 });
        continue;
      }

      const body = formatEvents(events!, exp.format);
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (exp.auth_header_name && exp.auth_secret_name) {
        if (!isAllowedSecretName(exp.auth_secret_name)) {
          await admin.from("siem_export_log").insert({
            exporter_id: exp.id,
            organization_id: exp.organization_id,
            event_count: 0,
            status: "failure",
            http_status: 0,
            response_body: `Refused: secret name "${exp.auth_secret_name}" is not in the allowlist (must start with SIEM_).`,
            duration_ms: 0,
          });
          results.push({ exporter_id: exp.id, status: "failure", events: 0, error: "secret_name_not_allowed" });
          continue;
        }
        const secret = Deno.env.get(exp.auth_secret_name);
        if (secret) headers[exp.auth_header_name] = secret;
      }

      // SSRF guard: block private/loopback/link-local destinations
      const urlCheck = validateEndpointUrl(exp.endpoint_url);
      if (!urlCheck.ok) {
        await admin.from("siem_export_log").insert({
          exporter_id: exp.id,
          organization_id: exp.organization_id,
          event_count: 0,
          status: "failure",
          http_status: 0,
          response_body: `Refused endpoint: ${urlCheck.reason}`,
          duration_ms: 0,
        });
        results.push({ exporter_id: exp.id, status: "failure", events: 0, error: urlCheck.reason });
        continue;
      }

      const start = Date.now();
      let httpStatus = 0;
      let respBody = "";
      let status: "success" | "failure" = "failure";

      if (payload.dry_run) {
        status = "success";
        httpStatus = 200;
        respBody = "dry-run";
      } else {
        try {
          const resp = await fetch(exp.endpoint_url, { method: "POST", headers, body });
          httpStatus = resp.status;
          respBody = (await resp.text()).slice(0, 1000);
          status = resp.ok ? "success" : "failure";
        } catch (e) {
          respBody = e instanceof Error ? e.message : String(e);
        }
      }
      const duration = Date.now() - start;

      await admin.from("siem_export_log").insert({
        exporter_id: exp.id,
        organization_id: exp.organization_id,
        event_count: eventCount,
        status,
        http_status: httpStatus,
        response_body: respBody,
        duration_ms: duration,
      });

      await admin
        .from("siem_exporters")
        .update({
          last_delivery_at: new Date().toISOString(),
          last_delivery_status: status,
          consecutive_failures:
            status === "success" ? 0 : exp.consecutive_failures + 1,
        })
        .eq("id", exp.id);

      results.push({ exporter_id: exp.id, status, events: eventCount, http_status: httpStatus });
    }

    return json({ ok: true, results });
  } catch (e) {
    console.error("siem-export error:", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

function formatEvents(events: any[], format: string): string {
  if (format === "cef") {
    return events
      .map(
        (e) =>
          `CEF:0|TaskMaster|Audit|1.0|${e.event_type}|${e.event_category}|5|src=${e.ip_address ?? ""} suser=${e.user_email ?? ""}`
      )
      .join("\n");
  }
  if (format === "leef") {
    return events
      .map(
        (e) =>
          `LEEF:1.0|TaskMaster|Audit|1.0|${e.event_type}|cat=${e.event_category}\tsrc=${e.ip_address ?? ""}\tusrName=${e.user_email ?? ""}`
      )
      .join("\n");
  }
  return JSON.stringify({ events });
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Allowlist: org-admins may only reference Deno env vars whose name starts with "SIEM_".
// This blocks exfiltration of platform secrets like SUPABASE_SERVICE_ROLE_KEY,
// LOVABLE_API_KEY, STRIPE_*, etc., via a malicious exporter row.
function isAllowedSecretName(name: string): boolean {
  if (!name || typeof name !== "string") return false;
  if (name.length > 128) return false;
  if (!/^[A-Z][A-Z0-9_]*$/.test(name)) return false;
  return name.startsWith("SIEM_");
}

// SSRF guard: only allow http(s) URLs to public hostnames. Reject loopback,
// private RFC1918 ranges, link-local, and metadata service IPs to stop an
// org-admin from pivoting through this function to internal infrastructure.
function validateEndpointUrl(rawUrl: string): { ok: true } | { ok: false; reason: string } {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { ok: false, reason: "endpoint_url is not a valid URL" };
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return { ok: false, reason: "endpoint_url must use http or https" };
  }
  const host = parsed.hostname.toLowerCase();
  if (!host) return { ok: false, reason: "endpoint_url missing host" };

  // Block obvious loopback / metadata hostnames.
  const blockedHostnames = new Set([
    "localhost",
    "ip6-localhost",
    "ip6-loopback",
    "metadata.google.internal",
  ]);
  if (blockedHostnames.has(host)) {
    return { ok: false, reason: "endpoint_url targets a blocked hostname" };
  }
  if (host.endsWith(".localhost") || host.endsWith(".internal") || host.endsWith(".local")) {
    return { ok: false, reason: "endpoint_url targets a blocked TLD" };
  }

  // If the host is a literal IP, block private/loopback/link-local/CGNAT/metadata ranges.
  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const [a, b] = [parseInt(ipv4[1], 10), parseInt(ipv4[2], 10)];
    if (
      a === 10 ||
      a === 127 ||
      a === 0 ||
      (a === 169 && b === 254) || // link-local + AWS/GCP metadata 169.254.169.254
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127) || // CGNAT
      a >= 224 // multicast / reserved
    ) {
      return { ok: false, reason: "endpoint_url targets a private or reserved IPv4 range" };
    }
  }

  // IPv6 literals come wrapped in [...]; reject loopback/link-local/unique-local.
  if (host.startsWith("[") || host.includes(":")) {
    const v6 = host.replace(/^\[|\]$/g, "").toLowerCase();
    if (
      v6 === "::1" ||
      v6 === "::" ||
      v6.startsWith("fe80:") ||
      v6.startsWith("fc") ||
      v6.startsWith("fd")
    ) {
      return { ok: false, reason: "endpoint_url targets a private or reserved IPv6 range" };
    }
  }

  return { ok: true };
}
