// MFA TOTP enroll / verify / disable / regenerate-recovery-codes
// Actions:
//  - "enroll": generates a TOTP secret + provisioning URI (returns secret + otpauth URL)
//  - "verify": confirms a 6-digit code against pending factor and marks it verified
//  - "verify_login": verifies code at login time (used by client guard)
//  - "disable": removes a factor
//  - "regenerate_codes": issues new recovery codes (returns plaintext once)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import * as OTPAuth from "https://esm.sh/otpauth@9.3.6";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface Payload {
  action: "enroll" | "verify" | "verify_login" | "disable" | "regenerate_codes";
  friendly_name?: string;
  factor_id?: string;
  code?: string;
  recovery_code?: string;
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function generateRecoveryCode(): string {
  // 10-char alphanumeric, formatted XXXXX-XXXXX
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(10);
  crypto.getRandomValues(bytes);
  const chars = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
  return `${chars.slice(0, 5)}-${chars.slice(5)}`;
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

    if (payload.action === "enroll") {
      const friendly = payload.friendly_name?.trim() || "Authenticator";
      const secret = new OTPAuth.Secret({ size: 20 });
      const totp = new OTPAuth.TOTP({
        issuer: "TaskMaster",
        label: user.email ?? user.id,
        algorithm: "SHA1",
        digits: 6,
        period: 30,
        secret,
      });

      const { data: factor, error } = await admin
        .from("user_mfa_factors")
        .insert({
          user_id: user.id,
          factor_type: "totp",
          friendly_name: friendly,
          secret_encrypted: secret.base32, // TODO: wrap with vault if available
          verified: false,
        })
        .select()
        .single();
      if (error) throw error;

      return json({
        ok: true,
        factor_id: factor.id,
        otpauth_url: totp.toString(),
        secret_base32: secret.base32,
      });
    }

    if (payload.action === "verify") {
      if (!payload.factor_id || !payload.code) {
        return json({ error: "factor_id and code required" }, 400);
      }
      const { data: factor, error } = await admin
        .from("user_mfa_factors")
        .select("*")
        .eq("id", payload.factor_id)
        .eq("user_id", user.id)
        .maybeSingle();
      if (error || !factor) return json({ error: "Factor not found" }, 404);

      const totp = new OTPAuth.TOTP({
        issuer: "TaskMaster",
        label: user.email ?? user.id,
        secret: OTPAuth.Secret.fromBase32(factor.secret_encrypted),
      });
      const delta = totp.validate({ token: payload.code.replace(/\s/g, ""), window: 1 });
      if (delta === null) return json({ error: "Invalid code" }, 400);

      // First-time verify: mark verified + issue recovery codes
      let recovery_codes: string[] | undefined;
      if (!factor.verified) {
        const codes = Array.from({ length: 10 }, generateRecoveryCode);
        const hashes = await Promise.all(codes.map((c) => sha256Hex(c)));
        await admin
          .from("user_mfa_recovery_codes")
          .delete()
          .eq("user_id", user.id);
        await admin.from("user_mfa_recovery_codes").insert(
          hashes.map((h) => ({ user_id: user.id, code_hash: h }))
        );
        recovery_codes = codes;
      }

      await admin
        .from("user_mfa_factors")
        .update({ verified: true, last_used_at: new Date().toISOString() })
        .eq("id", factor.id);

      await admin.rpc("log_audit_event", {
        _event_type: factor.verified ? "mfa_verified" : "mfa_enrolled",
        _event_category: "auth",
        _metadata: { factor_id: factor.id },
      });

      return json({ ok: true, recovery_codes });
    }

    if (payload.action === "verify_login") {
      // Accept either TOTP code OR a recovery code
      if (payload.recovery_code) {
        const hash = await sha256Hex(payload.recovery_code.trim().toUpperCase());
        const { data: row } = await admin
          .from("user_mfa_recovery_codes")
          .select("*")
          .eq("user_id", user.id)
          .eq("code_hash", hash)
          .is("used_at", null)
          .maybeSingle();
        if (!row) return json({ error: "Invalid recovery code" }, 400);
        await admin
          .from("user_mfa_recovery_codes")
          .update({ used_at: new Date().toISOString() })
          .eq("id", row.id);
        await admin.rpc("log_audit_event", {
          _event_type: "mfa_recovery_used",
          _event_category: "auth",
        });
        return json({ ok: true, method: "recovery_code" });
      }

      if (!payload.code) return json({ error: "code or recovery_code required" }, 400);
      const { data: factors } = await admin
        .from("user_mfa_factors")
        .select("*")
        .eq("user_id", user.id)
        .eq("verified", true);
      if (!factors || factors.length === 0) return json({ error: "No verified factor" }, 400);

      for (const factor of factors) {
        const totp = new OTPAuth.TOTP({
          issuer: "TaskMaster",
          label: user.email ?? user.id,
          secret: OTPAuth.Secret.fromBase32(factor.secret_encrypted),
        });
        const delta = totp.validate({ token: payload.code.replace(/\s/g, ""), window: 1 });
        if (delta !== null) {
          await admin
            .from("user_mfa_factors")
            .update({ last_used_at: new Date().toISOString() })
            .eq("id", factor.id);
          await admin.rpc("log_audit_event", {
            _event_type: "mfa_verified",
            _event_category: "auth",
            _metadata: { factor_id: factor.id },
          });
          return json({ ok: true, method: "totp" });
        }
      }
      return json({ error: "Invalid code" }, 400);
    }

    if (payload.action === "disable") {
      if (!payload.factor_id) return json({ error: "factor_id required" }, 400);
      await admin
        .from("user_mfa_factors")
        .delete()
        .eq("id", payload.factor_id)
        .eq("user_id", user.id);
      await admin.rpc("log_audit_event", {
        _event_type: "mfa_disabled",
        _event_category: "auth",
        _metadata: { factor_id: payload.factor_id },
      });
      return json({ ok: true });
    }

    if (payload.action === "regenerate_codes") {
      const codes = Array.from({ length: 10 }, generateRecoveryCode);
      const hashes = await Promise.all(codes.map((c) => sha256Hex(c)));
      await admin.from("user_mfa_recovery_codes").delete().eq("user_id", user.id);
      await admin.from("user_mfa_recovery_codes").insert(
        hashes.map((h) => ({ user_id: user.id, code_hash: h }))
      );
      await admin.rpc("log_audit_event", {
        _event_type: "mfa_recovery_codes_regenerated",
        _event_category: "auth",
      });
      return json({ ok: true, recovery_codes: codes });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    console.error("mfa-manage error:", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
