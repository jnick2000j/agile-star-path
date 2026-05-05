import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendEmail, isEmailConfigured } from "../_shared/email.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Payload {
  milestone_id: string;
  event_type: "status_change" | "owner_change" | "target_date_revised" | "comment";
  from_value?: string | null;
  to_value?: string | null;
  comment?: string | null;
  revised_target_date?: string | null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const actorId = claimsData.claims.sub as string;

    const body = (await req.json()) as Payload;
    if (!body?.milestone_id || !body?.event_type) {
      return new Response(JSON.stringify({ error: "milestone_id and event_type required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    // Fetch milestone
    const { data: milestone, error: mErr } = await supabase
      .from("milestones")
      .select("id, name, status, target_date, revised_target_date, owner_id, organization_id, project_id, programme_id, product_id, reference_number")
      .eq("id", body.milestone_id)
      .maybeSingle();

    if (mErr || !milestone) {
      return new Response(JSON.stringify({ error: "Milestone not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Determine recipients: owner + org admins/managers
    const recipientIds = new Set<string>();
    if (milestone.owner_id) recipientIds.add(milestone.owner_id);

    let adminEmails: { user_id: string; email: string; full_name: string | null }[] = [];
    if (milestone.organization_id) {
      const { data: admins } = await supabase.rpc("get_org_admin_emails", {
        _org_id: milestone.organization_id,
      });
      adminEmails = admins || [];
      adminEmails.forEach((a) => recipientIds.add(a.user_id));
    }
    recipientIds.delete(actorId); // don't notify the person who made the change

    const eventLabels: Record<string, string> = {
      status_change: "Status changed",
      owner_change: "Owner reassigned",
      target_date_revised: "Target date revised",
      comment: "Comment added",
    };
    const eventLabel = eventLabels[body.event_type] || "Updated";

    let detail = "";
    if (body.event_type === "status_change") {
      detail = `${body.from_value || "—"} → ${body.to_value || "—"}`;
    } else if (body.event_type === "target_date_revised") {
      detail = `New target: ${body.revised_target_date || body.to_value || "—"}`;
    } else if (body.event_type === "owner_change") {
      detail = "Ownership reassigned";
    }
    if (body.comment) {
      detail = detail ? `${detail} — ${body.comment}` : body.comment;
    }

    const title = `Milestone "${milestone.name}": ${eventLabel}`;
    const link = `/milestone-tracking`;

    // 1. Create internal notifications
    const notifRows = Array.from(recipientIds).map((uid) => ({
      user_id: uid,
      type: "milestone_update",
      title,
      message: detail,
      link,
      metadata: {
        milestone_id: milestone.id,
        event_type: body.event_type,
        reference_number: milestone.reference_number,
      },
    }));

    if (notifRows.length > 0) {
      await supabase.from("notifications").insert(notifRows);
    }

    // 2. Send emails (best-effort)
    let emailsSent = 0;
    if (isEmailConfigured() && adminEmails.length > 0) {
      const emailRecipients = adminEmails
        .filter((a) => a.user_id !== actorId && a.email)
        .map((a) => a.email);

      if (emailRecipients.length > 0) {
        const html = `
          <div style="font-family: sans-serif; max-width: 600px;">
            <h2 style="color: #0f172a;">${title}</h2>
            ${milestone.reference_number ? `<p><strong>Reference:</strong> ${milestone.reference_number}</p>` : ""}
            <p><strong>Event:</strong> ${eventLabel}</p>
            ${detail ? `<p><strong>Details:</strong> ${detail}</p>` : ""}
            ${body.comment ? `<blockquote style="border-left: 3px solid #cbd5e1; padding-left: 12px; color: #475569;">${body.comment}</blockquote>` : ""}
            <p style="color: #64748b; font-size: 12px; margin-top: 24px;">
              You are receiving this because you administer this organization.
            </p>
          </div>`;

        const result = await sendEmail({
          to: emailRecipients,
          subject: title,
          html,
          organizationId: milestone.organization_id ?? undefined,
          triggerKey: "milestone_change",
        });
        if (result.ok) emailsSent = emailRecipients.length;
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        notifications_created: notifRows.length,
        emails_sent: emailsSent,
        email_configured: isEmailConfigured(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("notify-milestone-change error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
