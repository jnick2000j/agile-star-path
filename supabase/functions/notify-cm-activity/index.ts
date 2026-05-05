import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { sendEmail, isEmailConfigured } from "../_shared/email.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface Payload {
  change_id: string;
  event_type: string; // status_changed | type_changed | urgency_changed | impact_changed | owner_id_changed | progress_note | test_result | implementation_note | comment | approval_approved | approval_rejected | approval_added
  from_value?: any;
  to_value?: any;
  notes?: string | null;
  action_url?: string;
}

const EVENT_LABELS: Record<string, string> = {
  status_changed: "Status changed",
  change_type_changed: "Type changed",
  urgency_changed: "Urgency changed",
  impact_changed: "Impact changed",
  owner_id_changed: "Owner changed",
  progress_note: "Progress update",
  test_result: "Test result",
  implementation_note: "Implementation note",
  comment: "New comment",
  approval_approved: "Approval granted",
  approval_rejected: "Approval rejected",
  approval_added: "Approval requested",
};

// Map event_type → settings column
const EVENT_TO_SETTING: Record<string, string> = {
  status_changed: "notify_on_status_change",
  change_type_changed: "notify_on_type_change",
  urgency_changed: "notify_on_urgency_change",
  impact_changed: "notify_on_impact_change",
  owner_id_changed: "notify_on_owner_change",
  progress_note: "notify_on_progress_note",
  test_result: "notify_on_test_result",
  implementation_note: "notify_on_implementation_note",
  comment: "notify_on_comment",
  approval_approved: "notify_on_approval_decision",
  approval_rejected: "notify_on_approval_decision",
  approval_added: "notify_on_approval_decision",
};

function pretty(v: any): string {
  if (v === null || v === undefined || v === "") return "—";
  return String(v).replace(/_/g, " ");
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
    const actor = userData.user;

    const body = (await req.json()) as Payload;
    const { change_id, event_type, from_value, to_value, notes, action_url } = body;

    if (!change_id || !event_type) {
      return new Response(JSON.stringify({ error: "Invalid input" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load change record
    const { data: change } = await admin
      .from("change_management_requests")
      .select("id,title,reference_number,organization_id,owner_id,implementer_id,requested_by,created_by")
      .eq("id", change_id)
      .maybeSingle();

    if (!change) {
      return new Response(JSON.stringify({ error: "Change not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load org notification settings (defaults if missing)
    const { data: settings } = await admin
      .from("change_notification_settings")
      .select("*")
      .eq("organization_id", change.organization_id)
      .maybeSingle();

    const settingKey = EVENT_TO_SETTING[event_type];
    const enabled = settings ? (settings as any)[settingKey] !== false : true;
    if (!enabled) {
      return new Response(
        JSON.stringify({ success: true, skipped: "disabled_for_event" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Build recipient set: owner, implementer, requester, creator + approvers (all distinct, exclude actor)
    const stakeholderIds = new Set<string>();
    [change.owner_id, change.implementer_id, change.requested_by, change.created_by]
      .filter((v): v is string => !!v && v !== actor.id)
      .forEach((id) => stakeholderIds.add(id));

    const { data: approvals } = await admin
      .from("change_management_approvals")
      .select("approver_id")
      .eq("change_id", change_id);
    (approvals ?? []).forEach((a: any) => {
      if (a.approver_id && a.approver_id !== actor.id) stakeholderIds.add(a.approver_id);
    });

    if (stakeholderIds.size === 0) {
      return new Response(
        JSON.stringify({ success: true, skipped: "no_recipients" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Resolve emails
    const { data: profiles } = await admin
      .from("profiles")
      .select("user_id, full_name, email")
      .in("user_id", Array.from(stakeholderIds));

    const { data: actorProfile } = await admin
      .from("profiles")
      .select("full_name, email")
      .eq("user_id", actor.id)
      .maybeSingle();
    const actorName = actorProfile?.full_name || actorProfile?.email || "A team member";

    const eventLabel = EVENT_LABELS[event_type] ?? event_type.replace(/_/g, " ");
    const refLabel = change.reference_number ? `${change.reference_number} — ${change.title}` : change.title;
    const subject = `[${refLabel}] ${eventLabel}`;

    let changeDetail = "";
    const fieldKey = event_type.endsWith("_changed") ? event_type.replace(/_changed$/, "") : null;
    if (fieldKey && from_value && to_value) {
      const f = pretty(from_value[fieldKey]);
      const t = pretty(to_value[fieldKey]);
      changeDetail = `<p style="margin:0 0 12px"><strong>${eventLabel}:</strong> ${f} → <strong>${t}</strong></p>`;
    }

    const noteBlock = notes
      ? `<div style="background:#f3f4f6;border-left:3px solid #0f172a;padding:10px 12px;border-radius:4px;margin:12px 0;white-space:pre-wrap">${notes.replace(/</g, "&lt;")}</div>`
      : "";

    // In-app notifications + email per stakeholder
    let emailsSent = 0;
    for (const profile of profiles ?? []) {
      // best-effort in-app
      await admin.from("notifications").insert({
        user_id: profile.user_id,
        type: "change_management_activity",
        title: subject,
        message: notes || `${actorName} — ${eventLabel}`,
        link: action_url || `/change-management/${change_id}`,
        metadata: {
          change_id,
          event_type,
          actor_id: actor.id,
          organization_id: change.organization_id,
        },
      });

      if (isEmailConfigured() && profile.email) {
        const html = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a1a;">
            <h2 style="margin:0 0 8px">${eventLabel}</h2>
            <p style="color:#6b7280;margin:0 0 16px">${refLabel}</p>
            <p style="line-height:1.5;margin:0 0 12px">${actorName} updated this change request.</p>
            ${changeDetail}
            ${noteBlock}
            ${
              action_url
                ? `<p style="margin:24px 0"><a href="${action_url}" style="background:#0f172a;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;display:inline-block">Open change request</a></p>`
                : ""
            }
            <p style="font-size:12px;color:#9ca3af;margin-top:32px">
              You received this because you are an owner, implementer, requester or approver on this change request.
            </p>
          </div>
        `;
        const result = await sendEmail({
          to: [profile.email],
          subject,
          html,
          organizationId: change.organization_id,
          triggerKey: "cm_activity",
        });
        if (result.ok) emailsSent++;
        else console.error("notify-cm-activity email failed:", result.error);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        recipients: stakeholderIds.size,
        emails_sent: emailsSent,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("notify-cm-activity error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
