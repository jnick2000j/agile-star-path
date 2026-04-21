import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { sendEmail, isEmailConfigured } from "../_shared/email.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface Payload {
  sso_config_id: string;
  organization_name: string;
  domains: string[];
  metadata_url: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(supabaseUrl, serviceKey);

    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const requester = userData.user;

    const body = (await req.json()) as Payload;
    if (!body.sso_config_id || !body.organization_name) {
      return new Response(JSON.stringify({ error: "Invalid payload" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find platform admins to notify
    const { data: admins } = await admin
      .from("profiles")
      .select("user_id, email, full_name")
      .eq("role", "admin");

    // Create in-app notifications for each platform admin
    if (admins && admins.length > 0) {
      const notifications = admins.map((a: any) => ({
        user_id: a.user_id,
        type: "sso_request",
        title: "New SSO Request",
        message: `${body.organization_name} has requested SAML SSO setup for ${body.domains.join(", ")}.`,
        link: "/platform-admin",
        metadata: {
          sso_config_id: body.sso_config_id,
          organization_name: body.organization_name,
          domains: body.domains,
        },
      }));

      await admin.from("notifications").insert(notifications);
    }

    // Send email notification (best-effort) via configured transport
    let emailSent = false;
    if (isEmailConfigured() && admins && admins.length > 0) {
      const adminEmails = admins.map((a: any) => a.email).filter(Boolean);

      if (adminEmails.length > 0) {
        const result = await sendEmail({
          to: adminEmails,
          subject: `New SSO Request: ${body.organization_name}`,
          html: `
              <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width:560px; margin:0 auto; padding:32px;">
                <h2 style="color:#0f172a;">New SSO/SAML Setup Request</h2>
                <p style="color:#475569; font-size:15px; line-height:1.6;">
                  <strong>${body.organization_name}</strong> has submitted a SAML SSO request and is awaiting provisioning.
                </p>
                <table style="width:100%; border-collapse:collapse; margin: 16px 0;">
                  <tr>
                    <td style="padding:8px 0; color:#64748b; font-size:13px;">Requested by:</td>
                    <td style="padding:8px 0; font-size:14px;">${requester.email}</td>
                  </tr>
                  <tr>
                    <td style="padding:8px 0; color:#64748b; font-size:13px;">Allowed domains:</td>
                    <td style="padding:8px 0; font-size:14px;">${body.domains.join(", ")}</td>
                  </tr>
                  <tr>
                    <td style="padding:8px 0; color:#64748b; font-size:13px;">IdP metadata URL:</td>
                    <td style="padding:8px 0; font-size:12px; font-family: monospace; word-break:break-all;">${body.metadata_url}</td>
                  </tr>
                </table>
                <p style="margin: 28px 0;">
                  <a href="${req.headers.get("origin") || ""}/platform-admin"
                     style="background:#2563eb; color:white; padding:12px 24px; border-radius:8px; text-decoration:none; font-weight:600; display:inline-block;">
                    Review in Platform Admin
                  </a>
                </p>
                <p style="color:#94a3b8; font-size:12px; margin-top:32px;">
                  Provision the SAML connection on Lovable Cloud, then approve the request in the platform admin queue.
                </p>
              </div>
            `,
        });
        emailSent = result.ok;
        if (!result.ok) console.error("notify-sso-request email failed:", result.error);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        emailSent,
        notifiedAdmins: admins?.length || 0,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    console.error("notify-sso-request error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message || "Internal error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
