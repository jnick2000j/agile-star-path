import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PRIORITY_LADDER = ["low", "medium", "high", "urgent"];

const TERMINAL_STATUSES = new Set(["resolved", "closed", "cancelled"]);

function nextPriority(p: string | null | undefined): string | null {
  if (!p) return null;
  const i = PRIORITY_LADDER.indexOf(p);
  if (i < 0 || i >= PRIORITY_LADDER.length - 1) return null;
  return PRIORITY_LADDER[i + 1];
}

function renderNote(template: string | null, ctx: any): string {
  const t =
    template ||
    "🚨 SLA escalation: rule \"{{rule.name}}\" fired ({{rule.trigger_type}} on {{rule.sla_leg}} SLA). Actions: {{actions}}.";
  return t.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, k) => {
    const parts = String(k).split(".");
    let v: any = ctx;
    for (const p of parts) v = v?.[p];
    return v == null ? `{{${k}}}` : String(v);
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const startedAt = new Date().toISOString();
  let rulesEvaluated = 0;
  let eventsFired = 0;
  const errors: string[] = [];

  try {
    const { data: rules, error: rulesErr } = await supabase
      .from("helpdesk_sla_escalation_rules")
      .select("*")
      .eq("is_active", true);

    if (rulesErr) throw rulesErr;

    const now = Date.now();

    for (const rule of rules ?? []) {
      rulesEvaluated++;
      try {
        let q = supabase
          .from("helpdesk_tickets")
          .select(
            "id, organization_id, subject, status, priority, assignee_id, sla_response_due_at, sla_resolution_due_at, sla_response_breached, sla_resolution_breached, first_response_at, resolved_at, created_at, sla_paused_at"
          )
          .eq("organization_id", rule.organization_id)
          .not("status", "in", "(resolved,closed,cancelled)")
          .is("sla_paused_at", null);

        if (rule.priority_filter && rule.priority_filter.length > 0) {
          q = q.in("priority", rule.priority_filter);
        }

        const dueColumn =
          rule.sla_leg === "response" ? "sla_response_due_at" : "sla_resolution_due_at";
        q = q.not(dueColumn, "is", null);

        const { data: tickets, error: tErr } = await q.limit(500);
        if (tErr) throw tErr;

        for (const t of tickets ?? []) {
          if (TERMINAL_STATUSES.has(t.status)) continue;

          const isResponseLeg = rule.sla_leg === "response";
          if (isResponseLeg && t.first_response_at) continue;

          const dueAt = isResponseLeg
            ? t.sla_response_due_at
            : t.sla_resolution_due_at;
          if (!dueAt) continue;

          const dueTs = new Date(dueAt).getTime();
          const startTs = new Date(t.created_at).getTime();
          const totalMs = dueTs - startTs;
          if (totalMs <= 0) continue;
          const elapsedMs = now - startTs;
          const percentElapsed = (elapsedMs / totalMs) * 100;

          let shouldFire = false;
          if (rule.trigger_type === "breach") {
            shouldFire = now >= dueTs;
          } else {
            shouldFire =
              percentElapsed >= rule.threshold_percent && now < dueTs;
          }

          if (!shouldFire) continue;

          const actions: string[] = [];
          const updates: Record<string, any> = {};

          if (rule.raise_priority) {
            const np = nextPriority(t.priority);
            if (np) {
              updates.priority = np;
              actions.push(`raised priority to ${np}`);
            }
          }
          if (rule.reassign_to) {
            updates.assignee_id = rule.reassign_to;
            actions.push(`reassigned to specified user`);
          }
          if (rule.trigger_type === "breach") {
            if (isResponseLeg && !t.sla_response_breached) {
              updates.sla_response_breached = true;
            }
            if (!isResponseLeg && !t.sla_resolution_breached) {
              updates.sla_resolution_breached = true;
            }
          }

          if (Object.keys(updates).length > 0) {
            await supabase
              .from("helpdesk_tickets")
              .update(updates)
              .eq("id", t.id);
          }

          if (rule.post_internal_note) {
            const note = renderNote(rule.note_template, {
              rule,
              actions: actions.join(", ") || "notification only",
              ticket: t,
            });
            await supabase.from("helpdesk_ticket_comments").insert({
              ticket_id: t.id,
              organization_id: t.organization_id,
              body: note,
              is_internal: true,
            });
            actions.push("posted internal note");
          }

          const recipients = new Set<string>();
          if (rule.notify_assignee && t.assignee_id) recipients.add(t.assignee_id);
          for (const u of rule.notify_user_ids ?? []) recipients.add(u);

          for (const userId of recipients) {
            await supabase.from("notifications").insert({
              user_id: userId,
              organization_id: t.organization_id,
              title: `SLA ${rule.trigger_type === "breach" ? "BREACH" : "warning"}: ${t.subject}`,
              message: `Rule "${rule.name}" fired on ${rule.sla_leg} SLA.`,
              type: "warning",
              link: `/support/tickets/${t.id}`,
            }).catch(() => {});
          }
          if (recipients.size > 0) actions.push(`notified ${recipients.size} user(s)`);

          const { error: evErr } = await supabase
            .from("helpdesk_sla_escalation_events")
            .insert({
              organization_id: t.organization_id,
              rule_id: rule.id,
              ticket_id: t.id,
              trigger_type: rule.trigger_type,
              sla_leg: rule.sla_leg,
              actions_taken: actions,
              details: {
                percent_elapsed: Math.round(percentElapsed),
                due_at: dueAt,
                priority_before: t.priority,
              },
            });

          if (!evErr) eventsFired++;
        }
      } catch (e: any) {
        errors.push(`rule ${rule.id}: ${e?.message ?? e}`);
        console.error("Rule failed", rule.id, e);
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        startedAt,
        finishedAt: new Date().toISOString(),
        rulesEvaluated,
        eventsFired,
        errors,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("escalation engine fatal", e);
    return new Response(
      JSON.stringify({ ok: false, error: e?.message ?? "unknown" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
