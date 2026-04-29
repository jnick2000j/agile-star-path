import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const now = new Date();
  const summary = { rules_evaluated: 0, escalations_fired: 0, tickets_scanned: 0 };

  try {
    // Load all enabled rules across orgs
    const { data: rules, error: rulesErr } = await supabase
      .from("helpdesk_escalation_rules")
      .select("*")
      .eq("is_enabled", true);
    if (rulesErr) throw rulesErr;
    summary.rules_evaluated = (rules ?? []).length;

    for (const rule of rules ?? []) {
      // Build base ticket query — only open/active tickets
      let q = supabase
        .from("helpdesk_tickets")
        .select("id, organization_id, subject, status, priority, ticket_type, created_at, sla_response_due_at, sla_resolution_due_at, first_response_at, resolved_at, assigned_to_user_id")
        .eq("organization_id", rule.organization_id)
        .not("status", "in", "(resolved,closed,cancelled)");

      if (rule.priority) q = q.eq("priority", rule.priority);
      if (rule.ticket_type) q = q.eq("ticket_type", rule.ticket_type);

      // Trigger-specific filters
      const thresholdMs = (rule.threshold_minutes ?? 0) * 60 * 1000;

      if (rule.trigger_type === "response_breach") {
        q = q.is("first_response_at", null).lte("sla_response_due_at", now.toISOString());
      } else if (rule.trigger_type === "resolution_breach") {
        q = q.lte("sla_resolution_due_at", now.toISOString());
      } else if (rule.trigger_type === "approaching_response") {
        const future = new Date(now.getTime() + thresholdMs).toISOString();
        q = q.is("first_response_at", null).gt("sla_response_due_at", now.toISOString()).lte("sla_response_due_at", future);
      } else if (rule.trigger_type === "approaching_resolution") {
        const future = new Date(now.getTime() + thresholdMs).toISOString();
        q = q.gt("sla_resolution_due_at", now.toISOString()).lte("sla_resolution_due_at", future);
      } else if (rule.trigger_type === "time_open") {
        const cutoff = new Date(now.getTime() - thresholdMs).toISOString();
        q = q.lte("created_at", cutoff);
      } else if (rule.trigger_type === "time_unassigned") {
        const cutoff = new Date(now.getTime() - thresholdMs).toISOString();
        q = q.is("assigned_to_user_id", null).lte("created_at", cutoff);
      }

      const { data: tickets, error: tErr } = await q;
      if (tErr) { console.error(tErr); continue; }
      summary.tickets_scanned += (tickets ?? []).length;

      for (const ticket of tickets ?? []) {
        // Cooldown check: skip if same rule fired for this ticket within cooldown_minutes
        const cooldownCutoff = new Date(now.getTime() - (rule.cooldown_minutes ?? 60) * 60 * 1000).toISOString();
        const { data: recent } = await supabase
          .from("helpdesk_escalation_events")
          .select("id")
          .eq("rule_id", rule.id)
          .eq("ticket_id", ticket.id)
          .gte("created_at", cooldownCutoff)
          .limit(1);
        if (recent && recent.length > 0) continue;

        // Execute action
        const details: any = { rule_name: rule.name };
        try {
          if (rule.action === "reassign" && rule.target_user_id) {
            await supabase.from("helpdesk_tickets")
              .update({ assigned_to_user_id: rule.target_user_id })
              .eq("id", ticket.id);
            details.reassigned_to = rule.target_user_id;
          } else if (rule.action === "raise_priority" && rule.raise_to_priority) {
            await supabase.from("helpdesk_tickets")
              .update({ priority: rule.raise_to_priority })
              .eq("id", ticket.id);
            details.priority_from = ticket.priority;
            details.priority_to = rule.raise_to_priority;
          } else if (rule.action === "notify") {
            details.notify_emails = rule.notify_emails ?? [];
            details.notify_role = rule.target_role;
          }
        } catch (actionErr) {
          details.error = String(actionErr);
        }

        await supabase.from("helpdesk_escalation_events").insert({
          organization_id: rule.organization_id,
          rule_id: rule.id,
          ticket_id: ticket.id,
          trigger_type: rule.trigger_type,
          action: rule.action,
          details,
        });
        summary.escalations_fired += 1;
      }
    }

    return new Response(JSON.stringify({ ok: true, ...summary, ran_at: now.toISOString() }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
