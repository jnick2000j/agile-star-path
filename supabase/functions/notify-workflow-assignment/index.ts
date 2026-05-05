import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { sendEmail, isEmailConfigured } from "../_shared/email.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface Payload {
  entity_type: string; // stage_gate | change_request | milestone | exception | quality_review
  entity_id: string;
  entity_title?: string;
  assignment_role: "owner" | "approver" | "verifier" | "notifier";
  recipient_user_id: string;
  organization_id?: string | null;
  action_url?: string;
  message?: string;
}

const ENTITY_LABEL: Record<string, string> = {
  stage_gate: "Stage Gate",
  change_request: "Change Request",
  milestone: "Milestone",
  exception: "Exception",
  quality_review: "Quality Review",
};

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
    const actor = userData.user;

    const body = (await req.json()) as Payload;
    const {
      entity_type,
      entity_id,
      entity_title,
      assignment_role,
      recipient_user_id,
      organization_id,
      action_url,
      message,
    } = body;

    if (!entity_type || !entity_id || !assignment_role || !recipient_user_id) {
      return new Response(JSON.stringify({ error: "Invalid input" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Resolve recipient
    const { data: recipient } = await admin
      .from("profiles")
      .select("user_id, email, full_name")
      .eq("user_id", recipient_user_id)
      .maybeSingle();

    if (!recipient) {
      return new Response(JSON.stringify({ error: "Recipient not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Resolve actor name
    const { data: actorProfile } = await admin
      .from("profiles")
      .select("full_name, email")
      .eq("user_id", actor.id)
      .maybeSingle();
    const actorName =
      actorProfile?.full_name || actorProfile?.email || "A team member";

    const entityLabel = ENTITY_LABEL[entity_type] ?? entity_type;
    const roleLabel =
      assignment_role === "notifier"
        ? "a notifier"
        : `the ${assignment_role}`;
    const itemTitle = entity_title || entityLabel;
    const subject =
      assignment_role === "notifier"
        ? `You're being kept informed: ${itemTitle}`
        : `Action required: you're the ${assignment_role} for ${itemTitle}`;
    const intro =
      assignment_role === "notifier"
        ? `${actorName} added you as a notifier on the ${entityLabel} "${itemTitle}". You'll receive updates as decisions progress.`
        : `${actorName} assigned you as ${roleLabel} on the ${entityLabel} "${itemTitle}". Your sign-off is pending.`;

    // 1. Create in-app notification (best-effort)
    await admin.from("notifications").insert({
      user_id: recipient_user_id,
      type:
        assignment_role === "notifier"
          ? "workflow_notifier"
          : "workflow_assignment",
      title: subject,
      message: message || intro,
      link: action_url || null,
      metadata: {
        entity_type,
        entity_id,
        assignment_role,
        organization_id,
        assigned_by: actor.id,
      },
    });

    // 2. Send email (best-effort) via configured transport
    let emailSent = false;
    if (isEmailConfigured() && recipient.email) {
      const html = `
          <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #1a1a1a;">
            <h2 style="margin: 0 0 16px;">${subject}</h2>
            <p style="line-height: 1.5;">${intro}</p>
            ${message ? `<p style="line-height: 1.5;">${message}</p>` : ""}
            ${
              action_url
                ? `<p style="margin: 24px 0;"><a href="${action_url}" style="background:#0f172a;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;display:inline-block;">Open ${entityLabel}</a></p>`
                : ""
            }
            <p style="font-size: 12px; color: #6b7280; margin-top: 32px;">
              You received this because you were added to a workflow in TaskMaster.
            </p>
          </div>
        `;
      const result = await sendEmail({
        to: [recipient.email],
        subject,
        html,
        organizationId: organization_id ?? undefined,
        triggerKey: "workflow_assignment",
      });
      emailSent = result.ok;
      if (!result.ok) console.error("notify-workflow-assignment email failed:", result.error);
    }

    return new Response(
      JSON.stringify({ success: true, email_sent: emailSent }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (e) {
    console.error("notify-workflow-assignment error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
