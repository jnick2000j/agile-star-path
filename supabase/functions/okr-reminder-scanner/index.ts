// OKR reminder scanner — runs hourly via cron.
// Creates bell notifications for KR owners with stale check-ins,
// and for cycle start/end milestones.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const now = new Date();
  const stats = { checkin_due: 0, low_confidence: 0, cycle_ending: 0, cycle_starting: 0 };

  // Per-org settings + KRs in active cycles
  const { data: settings } = await supabase.from("okr_settings").select("*");
  const settingsByOrg = new Map((settings ?? []).map((s: any) => [s.organization_id, s]));

  const { data: krs } = await supabase
    .from("okr_key_results")
    .select("id, organization_id, owner_user_id, title, last_checkin_at, confidence, objective_id, okr_objectives!inner(title, cycle_id, okr_cycles!inner(status))")
    .neq("status", "achieved")
    .neq("status", "missed")
    .neq("status", "cancelled");

  for (const kr of krs ?? []) {
    if (!kr.owner_user_id) continue;
    const obj: any = kr.okr_objectives;
    if (obj?.okr_cycles?.status !== "active") continue;
    const s: any = settingsByOrg.get(kr.organization_id);
    const cadenceDays = s?.checkin_cadence === "biweekly" ? 14 : s?.checkin_cadence === "monthly" ? 30 : 7;
    const lowThresh = Number(s?.low_confidence_threshold ?? 0.4);
    const reminders = s?.reminder_enabled ?? true;
    if (!reminders) continue;

    const last = kr.last_checkin_at ? new Date(kr.last_checkin_at).getTime() : 0;
    const daysSince = (now.getTime() - last) / 86400000;
    if (daysSince >= cadenceDays) {
      await supabase.from("notifications").insert({
        user_id: kr.owner_user_id,
        
        type: "okr_checkin_due",
        title: "OKR check-in due",
        message: `Time for your weekly check-in on "${kr.title}".`,
        link: `/okrs/objectives/${kr.objective_id}`,
      }).then(() => stats.checkin_due++);
    }
    if (Number(kr.confidence) < lowThresh) {
      await supabase.from("notifications").insert({
        user_id: kr.owner_user_id,
        
        type: "okr_confidence_dropped",
        title: "Low confidence on key result",
        message: `Confidence on "${kr.title}" is ${Number(kr.confidence).toFixed(2)}.`,
        link: `/okrs/objectives/${kr.objective_id}`,
      }).then(() => stats.low_confidence++);
    }
  }

  // Cycle start/end reminders
  const { data: cycles } = await supabase.from("okr_cycles").select("*").in("status", ["planned", "active"]);
  for (const c of cycles ?? []) {
    const s: any = settingsByOrg.get(c.organization_id);
    const daysBefore = Number(s?.cycle_reminder_days_before_end ?? 7);
    const end = new Date(c.end_date).getTime();
    const start = new Date(c.start_date).getTime();
    const daysToEnd = (end - now.getTime()) / 86400000;
    const daysToStart = (start - now.getTime()) / 86400000;

    // Notify org admins (members with admin role)
    const { data: admins } = await supabase
      .from("user_organization_access")
      .select("user_id")
      .eq("organization_id", c.organization_id);

    if (c.status === "active" && daysToEnd > 0 && daysToEnd <= daysBefore) {
      for (const a of admins ?? []) {
        await supabase.from("notifications").insert({
          user_id: a.user_id,
          
          type: "okr_cycle_ending",
          title: "OKR cycle ending soon",
          message: `Cycle "${c.name}" ends in ${Math.ceil(daysToEnd)} day(s). Time to grade.`,
          link: "/okrs/grading",
        });
        stats.cycle_ending++;
      }
    }
    if (c.status === "planned" && daysToStart >= 0 && daysToStart <= 3) {
      for (const a of admins ?? []) {
        await supabase.from("notifications").insert({
          user_id: a.user_id,
          
          type: "okr_cycle_starting",
          title: "OKR cycle starting",
          message: `Cycle "${c.name}" starts on ${c.start_date}.`,
          link: "/okrs/cycles",
        });
        stats.cycle_starting++;
      }
    }
  }

  return new Response(JSON.stringify({ ok: true, stats }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
