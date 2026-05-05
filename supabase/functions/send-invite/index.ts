import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { sendTransactionalEmail } from "../_shared/send-transactional.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface InvitePayload {
  email: string;
  organization_id: string;
  access_level?: string;
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
    const inviter = userData.user;

    const body = (await req.json()) as InvitePayload;
    const email = (body.email || "").trim().toLowerCase();
    const organization_id = body.organization_id;
    const access_level = body.access_level || "editor";

    if (!email || !email.includes("@") || !organization_id) {
      return new Response(JSON.stringify({ error: "Invalid input" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify inviter is org admin
    const { data: access } = await admin
      .from("user_organization_access")
      .select("access_level")
      .eq("user_id", inviter.id)
      .eq("organization_id", organization_id)
      .maybeSingle();

    const { data: profile } = await admin
      .from("profiles")
      .select("role")
      .eq("user_id", inviter.id)
      .maybeSingle();

    const isPlatformAdmin = profile?.role === "admin";
    if (!isPlatformAdmin && access?.access_level !== "admin") {
      return new Response(
        JSON.stringify({ error: "Only org admins can invite users" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Check plan user limit
    const { data: orgSub } = await admin
      .from("organization_subscriptions")
      .select("*, subscription_plans(max_users)")
      .eq("organization_id", organization_id)
      .maybeSingle();
    const maxUsers = (orgSub?.subscription_plans as any)?.max_users ?? -1;
    if (maxUsers !== -1) {
      const { count } = await admin
        .from("user_organization_access")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organization_id);
      const { count: pendingCount } = await admin
        .from("organization_invitations")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organization_id)
        .eq("status", "pending");
      if ((count || 0) + (pendingCount || 0) >= maxUsers) {
        return new Response(
          JSON.stringify({
            error: `Plan limit reached (${maxUsers} users). Upgrade to invite more.`,
            code: "PLAN_LIMIT",
          }),
          {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
    }

    // Get org name for email
    const { data: org } = await admin
      .from("organizations")
      .select("name")
      .eq("id", organization_id)
      .single();

    // Upsert invitation (replace existing pending)
    await admin
      .from("organization_invitations")
      .delete()
      .eq("organization_id", organization_id)
      .eq("status", "pending")
      .ilike("email", email);

    const { data: invite, error: invErr } = await admin
      .from("organization_invitations")
      .insert({
        organization_id,
        email,
        access_level,
        invited_by: inviter.id,
      })
      .select()
      .single();

    if (invErr) throw invErr;

    // Send invite email via Lovable Cloud's transactional email queue.
    const origin =
      req.headers.get("origin") || req.headers.get("referer") || "";
    const baseUrl = origin.replace(/\/$/, "");
    const acceptUrl = `${baseUrl}/accept-invite?token=${invite.token}`;

    let emailSent = false;
    const inviterName =
      inviter.user_metadata?.full_name || inviter.email || "A teammate";
    const result = await sendTransactionalEmail({
      to: email,
      subject: `${inviterName} invited you to join ${org?.name || "their organization"}`,
      html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width:560px; margin:0 auto; padding:32px;">
              <h2 style="color:#0f172a;">You're invited to join ${org?.name || "an organization"}</h2>
              <p style="color:#475569; font-size:15px; line-height:1.6;">
                ${inviterName} has invited you to collaborate on <strong>${org?.name || "their workspace"}</strong>
                with <strong>${access_level}</strong> access.
              </p>
              <p style="margin: 28px 0;">
                <a href="${acceptUrl}" style="background:#2563eb; color:white; padding:12px 24px; border-radius:8px; text-decoration:none; font-weight:600; display:inline-block;">
                  Accept invitation
                </a>
              </p>
              <p style="color:#94a3b8; font-size:13px;">
                Or copy this link: <br/>
                <a href="${acceptUrl}" style="color:#2563eb; word-break:break-all;">${acceptUrl}</a>
              </p>
              <p style="color:#94a3b8; font-size:12px; margin-top:32px;">
                This invitation expires in 14 days. If you weren't expecting this, you can safely ignore it.
              </p>
            </div>
          `,
      idempotencyKey: `org-invite-${invite.id}`,
      label: "user-invite",
      triggerKey: "user_invite",
      organizationId: organization_id,
      templateKey: "organization-invite",
      templateData: {
        user_name: email.split("@")[0],
        org_name: org?.name || "their organization",
        site_name: "The TaskMaster",
        action_url: acceptUrl,
      },
    });
    emailSent = result.ok;
    if (!result.ok) console.error("send-invite email failed:", result.error);

    return new Response(
      JSON.stringify({
        success: true,
        emailSent,
        invitation_id: invite.id,
        accept_url: acceptUrl,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    console.error("send-invite error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message || "Internal error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
