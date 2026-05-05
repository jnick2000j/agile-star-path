import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendTransactionalEmail } from "../_shared/send-transactional.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function inviteEmailHtml(opts: {
  inviterName: string;
  appName: string;
  acceptUrl: string;
  tempPassword?: string;
}) {
  const { inviterName, appName, acceptUrl, tempPassword } = opts;
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width:560px; margin:0 auto; padding:32px;">
      <h2 style="color:#0f172a;">You've been invited to ${appName}</h2>
      <p style="color:#475569; font-size:15px; line-height:1.6;">
        ${inviterName} has created an account for you on <strong>${appName}</strong>.
        Click the button below to confirm your email and sign in.
      </p>
      <p style="margin: 28px 0;">
        <a href="${acceptUrl}" style="background:#2563eb; color:white; padding:12px 24px; border-radius:8px; text-decoration:none; font-weight:600; display:inline-block;">
          Confirm &amp; sign in
        </a>
      </p>
      ${
        tempPassword
          ? `<p style="color:#475569; font-size:14px;">
               Your temporary password is: <code style="background:#f1f5f9; padding:2px 6px; border-radius:4px;">${tempPassword}</code><br/>
               You'll be asked to change it after signing in.
             </p>`
          : ""
      }
      <p style="color:#94a3b8; font-size:13px;">
        Or copy this link: <br/>
        <a href="${acceptUrl}" style="color:#2563eb; word-break:break-all;">${acceptUrl}</a>
      </p>
    </div>
  `;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Verify caller is admin
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");

    const { data: { user: callerUser }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !callerUser) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if caller is admin
    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", callerUser.id)
      .single();

    if (roleData?.role !== "admin") {
      return new Response(
        JSON.stringify({ error: "Only admins can perform this action" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { action, user_id, email, password, full_name, redirect_to, organization_id } = await req.json();

    if (action === "invite") {
      if (!email) {
        return new Response(
          JSON.stringify({ error: "email is required for invite" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const redirectTo =
        redirect_to ||
        `${supabaseUrl.replace(".supabase.co", ".lovable.app")}/auth`;

      // 1. Create the user. If a temp password was supplied use it, otherwise
      //    create with email_confirm=false and rely on the invite link.
      const createPayload: Record<string, unknown> = {
        email,
        email_confirm: false,
        user_metadata: { full_name: full_name || email.split("@")[0] },
      };
      if (password) createPayload.password = password;

      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser(
        createPayload as any,
      );
      if (createError) throw createError;

      // 2. Generate a signup confirmation link (does NOT send email itself).
      const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
        type: "signup",
        email,
        password: password || undefined,
        options: { redirectTo },
      } as any);

      if (linkError) {
        console.error("generateLink error:", linkError);
      }

      const acceptUrl =
        (linkData as any)?.properties?.action_link ||
        (linkData as any)?.action_link ||
        redirectTo;

      // 3. Enqueue the invite email via Lovable Cloud's transactional email queue.
      let emailSent = false;
      let emailError: string | undefined;

      const inviterName =
        (callerUser.user_metadata as any)?.full_name || callerUser.email || "An administrator";
      const appName = Deno.env.get("APP_NAME") || "TaskMaster";
      const result = await sendTransactionalEmail({
        to: email,
        subject: `${inviterName} invited you to ${appName}`,
        html: inviteEmailHtml({
          inviterName,
          appName,
          acceptUrl,
          tempPassword: password,
        }),
        idempotencyKey: `manage-user-invite-${newUser.user?.id ?? email}`,
        label: "user-invite",
        triggerKey: "user_invite",
        organizationId: organization_id ?? null,
      });
      emailSent = result.ok;
      if (!result.ok) {
        emailError = result.error;
        console.error("manage-user invite email failed:", result.error);
      }

      return new Response(
        JSON.stringify({
          success: true,
          user_id: newUser.user?.id,
          emailSent,
          emailError,
          accept_url: acceptUrl,
          message: emailSent
            ? "User created and invite email sent"
            : "User created. Email not sent — share the accept_url manually.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "resend_invite") {
      if (!user_id) {
        return new Response(
          JSON.stringify({ error: "user_id is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get the user's email
      const { data: { user: targetUser }, error: getUserError } = await supabaseAdmin.auth.admin.getUserById(user_id);

      if (getUserError || !targetUser) {
        return new Response(
          JSON.stringify({ error: "User not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const redirectTo = redirect_to || `${req.headers.get("origin") || ""}/auth`;

      const { data: linkData, error: resendError } = await supabaseAdmin.auth.admin.generateLink({
        type: "signup",
        email: targetUser.email!,
        options: { redirectTo },
      });

      if (resendError) throw resendError;

      const acceptUrl =
        (linkData as any)?.properties?.action_link ||
        (linkData as any)?.action_link ||
        redirectTo;

      let emailSent = false;
      let emailError: string | undefined;
      const inviterName =
        (callerUser.user_metadata as any)?.full_name || callerUser.email || "An administrator";
      const appName = Deno.env.get("APP_NAME") || "TaskMaster";
      const result = await sendTransactionalEmail({
        to: targetUser.email!,
        subject: `${inviterName} re-sent your invite to ${appName}`,
        html: inviteEmailHtml({ inviterName, appName, acceptUrl }),
        idempotencyKey: `manage-user-resend-${user_id}-${Date.now()}`,
        label: "user-invite-resend",
        triggerKey: "user_invite_resend",
        organizationId: organization_id ?? null,
      });
      emailSent = result.ok;
      if (!result.ok) emailError = result.error;

      return new Response(
        JSON.stringify({
          success: true,
          emailSent,
          emailError,
          accept_url: acceptUrl,
          message: emailSent
            ? "Invite email resent"
            : `Email queue error — ${emailError ?? "unknown"} (share accept_url manually).`,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!user_id) {
      return new Response(
        JSON.stringify({ error: "user_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "archive") {
      const { error: profileError } = await supabaseAdmin
        .from("profiles")
        .update({
          archived: true,
          archived_at: new Date().toISOString()
        })
        .eq("user_id", user_id);

      if (profileError) throw profileError;

      const { error: banError } = await supabaseAdmin.auth.admin.updateUserById(user_id, {
        ban_duration: "876000h",
      });

      if (banError) throw banError;

      return new Response(
        JSON.stringify({ success: true, message: "User archived and disabled" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "unarchive") {
      const { error: profileError } = await supabaseAdmin
        .from("profiles")
        .update({
          archived: false,
          archived_at: null
        })
        .eq("user_id", user_id);

      if (profileError) throw profileError;

      const { error: unbanError } = await supabaseAdmin.auth.admin.updateUserById(user_id, {
        ban_duration: "0h",
      });

      if (unbanError) throw unbanError;

      return new Response(
        JSON.stringify({ success: true, message: "User unarchived and enabled" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "delete") {
      const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user_id);

      if (deleteError) throw deleteError;

      return new Response(
        JSON.stringify({ success: true, message: "User permanently deleted" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action. Use 'invite', 'resend_invite', 'archive', 'unarchive', or 'delete'" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
