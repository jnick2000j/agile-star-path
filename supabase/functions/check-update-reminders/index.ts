import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { sendEmail, isEmailConfigured } from "../_shared/email.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Validate JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
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

    // Use service role for data operations
    const supabase = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const now = new Date();

    // Fetch all mandatory frequency settings with entity info
    const { data: settings, error: settingsError } = await supabase
      .from("update_frequency_settings")
      .select("*")
      .eq("is_mandatory", true);

    if (settingsError) throw settingsError;
    if (!settings || settings.length === 0) {
      return new Response(JSON.stringify({ message: "No mandatory settings" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let notificationsCreated = 0;

    for (const setting of settings) {
      if (!setting.entity_id || !setting.organization_id) continue;

      // Calculate the next due date based on frequency
      const intervalDays = getIntervalDays(setting.frequency, setting.custom_interval_days);
      if (!intervalDays) continue;

      // Get the last update for this entity
      const { data: lastUpdate } = await supabase
        .from("entity_updates")
        .select("created_at")
        .eq("entity_type", setting.entity_type)
        .eq("entity_id", setting.entity_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const lastUpdateDate = lastUpdate ? new Date(lastUpdate.created_at) : new Date(setting.created_at);
      const nextDue = new Date(lastUpdateDate.getTime() + intervalDays * 24 * 60 * 60 * 1000);
      const reminderTime = new Date(nextDue.getTime() - setting.reminder_hours_before * 60 * 60 * 1000);

      const isPastDue = now > nextDue;
      const isAlmostDue = now >= reminderTime && now <= nextDue;

      if (!isPastDue && !isAlmostDue) continue;

      // Get assigned users for this entity
      let assignedUsers: string[] = [];

      if (setting.entity_type === "task") {
        const { data: taskAssignments } = await supabase
          .from("task_assignments")
          .select("user_id")
          .eq("task_id", setting.entity_id);
        assignedUsers = taskAssignments?.map((a: any) => a.user_id) || [];
      } else {
        const { data: entityAssignments } = await supabase
          .from("entity_assignments")
          .select("user_id")
          .eq("entity_type", setting.entity_type)
          .eq("entity_id", setting.entity_id);
        assignedUsers = entityAssignments?.map((a: any) => a.user_id) || [];

        // Also include the manager/owner
        if (setting.entity_type === "programme" || setting.entity_type === "project") {
          const table = setting.entity_type === "programme" ? "programmes" : "projects";
          const { data: entity } = await supabase
            .from(table)
            .select("manager_id")
            .eq("id", setting.entity_id)
            .maybeSingle();
          if (entity?.manager_id && !assignedUsers.includes(entity.manager_id)) {
            assignedUsers.push(entity.manager_id);
          }
        } else if (setting.entity_type === "product") {
          const { data: entity } = await supabase
            .from("products")
            .select("product_owner_id")
            .eq("id", setting.entity_id)
            .maybeSingle();
          if (entity?.product_owner_id && !assignedUsers.includes(entity.product_owner_id)) {
            assignedUsers.push(entity.product_owner_id);
          }
        }
      }

      if (assignedUsers.length === 0) continue;

      // Check if we already sent a notification today for this entity
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);

      const { data: existingNotifs } = await supabase
        .from("notifications")
        .select("id")
        .eq("type", isPastDue ? "update_overdue" : "update_reminder")
        .in("user_id", assignedUsers)
        .gte("created_at", todayStart.toISOString())
        .limit(1);

      if (existingNotifs && existingNotifs.length > 0) continue;

      // Create notifications for each assigned user
      const entityLabel = setting.entity_type.charAt(0).toUpperCase() + setting.entity_type.slice(1);
      const statusText = isPastDue ? "overdue" : "due soon";

      for (const userId of assignedUsers) {
        await supabase.from("notifications").insert({
          user_id: userId,
          type: isPastDue ? "update_overdue" : "update_reminder",
          title: `Update ${statusText}: ${entityLabel}`,
          message: `Your ${setting.frequency} update for this ${setting.entity_type} is ${statusText}. Please submit your update.`,
          link: `/updates`,
        });
        notificationsCreated++;
      }

      // Send emails via configured transport (SMTP for on-prem, Resend for cloud)
      if (isEmailConfigured()) {
        for (const userId of assignedUsers) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("email, full_name")
            .eq("user_id", userId)
            .maybeSingle();

          if (profile?.email) {
            const result = await sendEmail({
              to: [profile.email],
              subject: `Update ${statusText}: ${entityLabel}`,
              html: `<p>Hi ${profile.full_name || "there"},</p>
                <p>Your <strong>${setting.frequency}</strong> update for this ${setting.entity_type} is <strong>${statusText}</strong>.</p>
                <p>Please log in and submit your update at your earliest convenience.</p>
                <p>Thank you.</p>`,
              organizationId: setting.organization_id,
              triggerKey: "update_reminder",
            });
            if (!result.ok) {
              console.error("Email send failed:", result.error);
            }
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, notifications_created: notificationsCreated }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: "An error occurred" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function getIntervalDays(frequency: string, customDays: number | null): number | null {
  switch (frequency) {
    case "daily": return 1;
    case "weekly": return 7;
    case "monthly": return 30;
    case "custom": return customDays || 14;
    default: return null;
  }
}
