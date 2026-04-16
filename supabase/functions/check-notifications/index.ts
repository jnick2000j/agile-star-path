import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
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

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
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
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    console.log("Checking for notifications to create...");

    // Get all users who are program managers or admins
    const { data: users } = await supabase
      .from("profiles")
      .select("user_id, email")
      .not("archived", "eq", true);

    if (!users || users.length === 0) {
      return new Response(JSON.stringify({ message: "No users found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const notifications = [];
    const today = new Date();
    const fridayThisWeek = new Date(today);
    fridayThisWeek.setDate(today.getDate() + (5 - today.getDay() + 7) % 7);

    // Check for weekly reports due (Friday)
    const daysTillFriday = Math.ceil((fridayThisWeek.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysTillFriday <= 2 && daysTillFriday >= 0) {
      const { data: programmes } = await supabase
        .from("programmes")
        .select("id, name, manager_id")
        .eq("status", "active");

      for (const prog of programmes || []) {
        if (prog.manager_id) {
          const weekEnding = fridayThisWeek.toISOString().split("T")[0];
          const { data: existingReport } = await supabase
            .from("weekly_reports")
            .select("id")
            .eq("programme_id", prog.id)
            .eq("week_ending", weekEnding)
            .single();

          if (!existingReport) {
            notifications.push({
              user_id: prog.manager_id,
              type: "weekly_report_due",
              title: "Weekly Report Due",
              message: `Your weekly report for ${prog.name} is due on Friday.`,
              link: "/updates",
            });
          }
        }
      }
    }

    // Check for high-impact risks that need attention
    const { data: risks } = await supabase
      .from("risks")
      .select("id, title, owner_id, impact")
      .eq("status", "open")
      .eq("impact", "high");

    for (const risk of risks || []) {
      if (risk.owner_id) {
        notifications.push({
          user_id: risk.owner_id,
          type: "risk_escalated",
          title: "High Impact Risk",
          message: `Risk "${risk.title}" requires attention.`,
          link: "/risk-register",
        });
      }
    }

    // Insert notifications (avoiding duplicates by checking recent ones)
    let created = 0;
    for (const notif of notifications) {
      const { data: existing } = await supabase
        .from("notifications")
        .select("id")
        .eq("user_id", notif.user_id)
        .eq("type", notif.type)
        .eq("title", notif.title)
        .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .single();

      if (!existing) {
        await supabase.from("notifications").insert(notif);
        created++;
      }
    }

    console.log(`Created ${created} notifications`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        notifications_created: created,
        checked: notifications.length 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: "An error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
