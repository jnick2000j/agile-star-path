// Session management edge function
// Actions:
//  - "register": records a session (called after successful login)
//  - "heartbeat": updates last_seen_at + checks idle/absolute timeout
//  - "revoke": revokes a single session
//  - "revoke_all": revokes all sessions for the current user (or org admin: another user)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface Payload {
  action: "register" | "heartbeat" | "revoke" | "revoke_all";
  session_token?: string;
  organization_id?: string;
  device_label?: string;
  session_id?: string;
  target_user_id?: string;
}

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
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
    const user = userData.user;

    const payload: Payload = await req.json();
    const ua = req.headers.get("user-agent") ?? null;
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? null;

    if (payload.action === "register") {
      if (!payload.session_token) return json({ error: "session_token required" }, 400);
      const tokenHash = await sha256Hex(payload.session_token);

      // Check IP allowlist if org session policy enforces it
      if (payload.organization_id) {
        const { data: pol } = await admin
          .from("org_session_policies")
          .select("ip_allowlist, enforce_ip_allowlist")
          .eq("organization_id", payload.organization_id)
          .maybeSingle();
        if (pol?.enforce_ip_allowlist && pol.ip_allowlist?.length && ip) {
          const allowed = pol.ip_allowlist.some((cidr: string) => ipMatchesCidr(ip, cidr));
          if (!allowed) {
            await admin.rpc("log_audit_event", {
              _event_type: "session_blocked_ip",
              _event_category: "auth",
              _organization_id: payload.organization_id,
              _status: "failure",
              _metadata: { ip, allowlist_size: pol.ip_allowlist.length },
              _ip_address: ip,
              _user_agent: ua,
            });
            return json({ error: "Your IP address is not on this organization's allowlist." }, 403);
          }
        }
      }

      const { data, error } = await admin
        .from("user_sessions")
        .upsert(
          {
            user_id: user.id,
            organization_id: payload.organization_id ?? null,
            session_token_hash: tokenHash,
            user_agent: ua,
            ip_address: ip,
            device_label: payload.device_label ?? null,
            last_seen_at: new Date().toISOString(),
            revoked_at: null,
          },
          { onConflict: "session_token_hash" }
        )
        .select()
        .single();
      if (error) throw error;
      await admin.rpc("log_audit_event", {
        _event_type: "session_started",
        _event_category: "auth",
        _organization_id: payload.organization_id ?? null,
        _ip_address: ip,
        _user_agent: ua,
      });
      return json({ ok: true, session_id: data.id });
    }

    if (payload.action === "heartbeat") {
      if (!payload.session_token) return json({ error: "session_token required" }, 400);
      const tokenHash = await sha256Hex(payload.session_token);
      const { data: session } = await admin
        .from("user_sessions")
        .select("*")
        .eq("session_token_hash", tokenHash)
        .maybeSingle();
      if (!session) return json({ active: false, reason: "unknown_session" });
      if (session.revoked_at) return json({ active: false, reason: "revoked" });

      // Idle/absolute timeout check
      if (session.organization_id) {
        const { data: pol } = await admin
          .from("org_session_policies")
          .select("idle_timeout_minutes, absolute_timeout_minutes")
          .eq("organization_id", session.organization_id)
          .maybeSingle();
        if (pol) {
          const lastSeen = new Date(session.last_seen_at).getTime();
          const created = new Date(session.created_at).getTime();
          const now = Date.now();
          if (now - lastSeen > pol.idle_timeout_minutes * 60_000) {
            await admin
              .from("user_sessions")
              .update({ revoked_at: new Date().toISOString(), revoke_reason: "idle_timeout" })
              .eq("id", session.id);
            return json({ active: false, reason: "idle_timeout" });
          }
          if (now - created > pol.absolute_timeout_minutes * 60_000) {
            await admin
              .from("user_sessions")
              .update({ revoked_at: new Date().toISOString(), revoke_reason: "absolute_timeout" })
              .eq("id", session.id);
            return json({ active: false, reason: "absolute_timeout" });
          }
        }
      }

      await admin
        .from("user_sessions")
        .update({ last_seen_at: new Date().toISOString() })
        .eq("id", session.id);
      return json({ active: true });
    }

    if (payload.action === "revoke") {
      if (!payload.session_id) return json({ error: "session_id required" }, 400);
      // RLS will enforce ownership / org admin
      const { error } = await supabase
        .from("user_sessions")
        .update({
          revoked_at: new Date().toISOString(),
          revoked_by: user.id,
          revoke_reason: "manual",
        })
        .eq("id", payload.session_id);
      if (error) throw error;
      return json({ ok: true });
    }

    if (payload.action === "revoke_all") {
      const target = payload.target_user_id ?? user.id;
      const { error } = await supabase
        .from("user_sessions")
        .update({
          revoked_at: new Date().toISOString(),
          revoked_by: user.id,
          revoke_reason: "manual_all",
        })
        .eq("user_id", target)
        .is("revoked_at", null);
      if (error) throw error;
      return json({ ok: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    console.error("session-manage error:", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

function ipMatchesCidr(ip: string, cidr: string): boolean {
  // Simple IPv4 CIDR match. IPv6 not supported in this stub.
  const [range, bitsStr] = cidr.includes("/") ? cidr.split("/") : [cidr, "32"];
  const bits = parseInt(bitsStr, 10);
  const ipNum = ipv4ToInt(ip);
  const rangeNum = ipv4ToInt(range);
  if (ipNum === null || rangeNum === null) return false;
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return (ipNum & mask) === (rangeNum & mask);
}

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) return null;
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
