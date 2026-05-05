// Notifies organization admins/owners by email when their organization is
// suspended or reinstated by a platform administrator.
//
// Invoked from the OrgSuspensionDialog right after set_organization_suspension
// succeeds. JWT-authenticated; the function re-checks the caller is a platform
// admin before sending.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { sendEmail, isEmailConfigured } from "../_shared/email.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Body {
  organization_id: string;
  action: "suspended" | "reinstated";
  kind?: string | null;
  reason?: string | null;
}

const KIND_LABELS: Record<string, string> = {
  non_payment: "Non-payment",
  admin_action: "Administrative action",
  license_expired: "License expired",
  security: "Security incident",
  trial_expired: "Trial expired",
  policy_violation: "Policy violation",
  other: "Other",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "Unauthorized" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Caller-context client (to verify identity + admin status)
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Unauthorized" }, 401);

    const { data: isAdmin } = await userClient.rpc("is_admin", { _user_id: userData.user.id });
    if (!isAdmin) return json({ error: "Forbidden — platform admins only" }, 403);

    const body = (await req.json()) as Body;
    if (!body?.organization_id || (body.action !== "suspended" && body.action !== "reinstated")) {
      return json({ error: "Invalid body" }, 400);
    }

    // Use service role for cross-org reads (org name, admin emails)
    const admin = createClient(supabaseUrl, serviceKey);

    const { data: org } = await admin
      .from("organizations")
      .select("id, name")
      .eq("id", body.organization_id)
      .single();

    if (!org) return json({ error: "Organization not found" }, 404);

    const { data: recipients, error: recipErr } = await admin.rpc("get_org_admin_emails", {
      _org_id: body.organization_id,
    });
    if (recipErr) {
      console.error("Failed to load recipients:", recipErr);
      return json({ error: "Failed to load recipients" }, 500);
    }

    const emails = (recipients as Array<{ email: string }> | null || [])
      .map((r) => r.email)
      .filter(Boolean);

    if (emails.length === 0) {
      return json({ ok: true, sent: 0, note: "No org admins to notify" });
    }

    if (!isEmailConfigured()) {
      console.warn("Email not configured — skipping send");
      return json({ ok: true, sent: 0, note: "Email transport not configured" });
    }

    const isSuspend = body.action === "suspended";
    const subject = isSuspend
      ? `[Action Required] ${org.name} access has been suspended`
      : `${org.name} access has been restored`;
    const kindLabel = body.kind ? KIND_LABELS[body.kind] ?? body.kind : "Suspended";
    const html = isSuspend ? suspendHtml(org.name, kindLabel, body.reason) : reinstateHtml(org.name);

    const result = await sendEmail({
      to: emails,
      subject,
      html,
      organizationId: body.organization_id,
      triggerKey: "org_suspension",
    });

    if (!result.ok) {
      console.error("Email send failed:", result.error);
      return json({ ok: false, error: result.error, sent: 0 }, 500);
    }

    return json({ ok: true, sent: emails.length, transport: result.transport });
  } catch (e) {
    console.error("notify-org-suspension error:", e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function suspendHtml(orgName: string, kindLabel: string, reason?: string | null) {
  return `
  <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:24px;color:#1f2937;">
    <h2 style="color:#b91c1c;margin:0 0 16px;">Access suspended: ${escapeHtml(orgName)}</h2>
    <p>Hello,</p>
    <p>
      Access to <strong>${escapeHtml(orgName)}</strong> has been suspended by a platform administrator.
      Users in this organization will not be able to sign in or use the platform until access is restored.
    </p>
    <table style="border-collapse:collapse;margin:16px 0;">
      <tr><td style="padding:6px 12px;background:#f3f4f6;font-weight:600;">Reason category</td><td style="padding:6px 12px;">${escapeHtml(kindLabel)}</td></tr>
      ${reason ? `<tr><td style="padding:6px 12px;background:#f3f4f6;font-weight:600;vertical-align:top;">Notes</td><td style="padding:6px 12px;">${escapeHtml(reason)}</td></tr>` : ""}
    </table>
    <p>
      Existing data is preserved. Please contact your platform administrator or support to resolve the issue
      and restore access.
    </p>
    <p style="color:#6b7280;font-size:12px;margin-top:24px;">
      This is an automated notification from your platform.
    </p>
  </div>`;
}

function reinstateHtml(orgName: string) {
  return `
  <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:24px;color:#1f2937;">
    <h2 style="color:#15803d;margin:0 0 16px;">Access restored: ${escapeHtml(orgName)}</h2>
    <p>Hello,</p>
    <p>
      Access to <strong>${escapeHtml(orgName)}</strong> has been restored. Users can now sign in and resume
      using the platform immediately.
    </p>
    <p style="color:#6b7280;font-size:12px;margin-top:24px;">
      This is an automated notification from your platform.
    </p>
  </div>`;
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
