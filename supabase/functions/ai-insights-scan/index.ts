import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Insight {
  organization_id: string;
  insight_type: string;
  severity: "low" | "medium" | "high";
  scope_type: string | null;
  scope_id: string | null;
  title: string;
  description: string;
  recommendation: string;
  evidence: Record<string, unknown>;
  generated_by: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    let orgFilter: string | null = null;
    let triggeredBy = "scan";

    if (req.method === "POST") {
      try {
        const body = await req.json();
        if (body?.organization_id) orgFilter = String(body.organization_id);
        if (body?.triggered_by) triggeredBy = String(body.triggered_by);
      } catch { /* no body ok */ }
    }

    const orgQuery = supabase.from("organizations").select("id");
    const { data: orgs, error: orgsError } = orgFilter
      ? await orgQuery.eq("id", orgFilter)
      : await orgQuery;
    if (orgsError) throw orgsError;

    const insights: Insight[] = [];
    const now = Date.now();
    const STALE_DAYS = 30;
    const NO_UPDATE_DAYS = 14;

    for (const org of orgs ?? []) {
      const orgId = (org as { id: string }).id;

      // Stale, unowned, or high-score open risks
      const { data: risks } = await supabase
        .from("risks")
        .select("id, title, owner_id, score, status, updated_at, programme_id, project_id")
        .eq("organization_id", orgId)
        .in("status", ["open", "mitigating"]);
      for (const r of risks ?? []) {
        if (!r.owner_id) {
          insights.push({
            organization_id: orgId, insight_type: "risk_unowned", severity: "high",
            scope_type: "risk", scope_id: r.id,
            title: `Open risk has no owner: "${r.title}"`,
            description: "Open risks must have an owner accountable for mitigation.",
            recommendation: "Assign an owner.",
            evidence: { score: r.score, status: r.status },
            generated_by: triggeredBy,
          });
        }
        const ageDays = (now - new Date(r.updated_at).getTime()) / 86400000;
        if (ageDays > STALE_DAYS) {
          insights.push({
            organization_id: orgId, insight_type: "risk_stale", severity: "medium",
            scope_type: "risk", scope_id: r.id,
            title: `Risk not reviewed in ${Math.floor(ageDays)} days: "${r.title}"`,
            description: "Open risks should be reviewed at least monthly.",
            recommendation: "Update the risk status, score, or mitigation plan.",
            evidence: { age_days: Math.floor(ageDays) },
            generated_by: triggeredBy,
          });
        }
        if ((r.score ?? 0) >= 16) {
          insights.push({
            organization_id: orgId, insight_type: "risk_critical", severity: "high",
            scope_type: "risk", scope_id: r.id,
            title: `Critical risk open: "${r.title}" (score ${r.score})`,
            description: "High-score risks (≥16) need urgent escalation.",
            recommendation: "Escalate to the Programme Board and review mitigation.",
            evidence: { score: r.score },
            generated_by: triggeredBy,
          });
        }
      }

      // Open issues without owner
      const { data: issues } = await supabase
        .from("issues")
        .select("id, title, owner_id, status, updated_at")
        .eq("organization_id", orgId)
        .in("status", ["open", "investigating", "pending"]);
      for (const i of issues ?? []) {
        if (!i.owner_id) {
          insights.push({
            organization_id: orgId, insight_type: "issue_unowned", severity: "medium",
            scope_type: "issue", scope_id: i.id,
            title: `Open issue has no owner: "${i.title}"`,
            description: "Issues without an owner risk being lost.", recommendation: "Assign an owner.",
            evidence: { status: i.status }, generated_by: triggeredBy,
          });
        }
      }

      // Slipping milestones (target_date in past, status not done)
      const today = new Date().toISOString().split("T")[0];
      const { data: milestones } = await supabase
        .from("milestones")
        .select("id, name, target_date, actual_date, status, programme_id, project_id")
        .eq("organization_id", orgId)
        .lt("target_date", today)
        .is("actual_date", null);
      for (const m of milestones ?? []) {
        if (!["done", "completed", "achieved"].includes(String(m.status).toLowerCase())) {
          const slippageDays = Math.floor((now - new Date(m.target_date).getTime()) / 86400000);
          insights.push({
            organization_id: orgId, insight_type: "milestone_slipping",
            severity: slippageDays > 30 ? "high" : "medium",
            scope_type: "milestone", scope_id: m.id,
            title: `Milestone overdue by ${slippageDays} days: "${m.name}"`,
            description: "Milestone target date has passed without completion.",
            recommendation: "Either close the milestone, set a new target date, or raise an exception.",
            evidence: { target_date: m.target_date, slippage_days: slippageDays },
            generated_by: triggeredBy,
          });
        }
      }

      // Programmes/projects with no recent updates
      const { data: programmes } = await supabase
        .from("programmes")
        .select("id, name, status")
        .eq("organization_id", orgId)
        .eq("status", "active");
      for (const p of programmes ?? []) {
        const { data: lastUpd } = await supabase
          .from("entity_updates").select("created_at")
          .eq("entity_type", "programme").eq("entity_id", p.id)
          .order("created_at", { ascending: false }).limit(1).maybeSingle();
        const ageDays = lastUpd?.created_at
          ? (now - new Date(lastUpd.created_at).getTime()) / 86400000
          : 999;
        if (ageDays > NO_UPDATE_DAYS) {
          insights.push({
            organization_id: orgId, insight_type: "programme_no_updates", severity: "medium",
            scope_type: "programme", scope_id: p.id,
            title: `Active programme with no updates in ${Math.floor(ageDays)} days: "${p.name}"`,
            description: "Active programmes should post status updates regularly.",
            recommendation: "Post a status update.",
            evidence: { last_update_days: Math.floor(ageDays) },
            generated_by: triggeredBy,
          });
        }
      }

      // Benefit shortfall (realization < 50% past start_date)
      const { data: benefits } = await supabase
        .from("benefits").select("id, name, realization, start_date, status")
        .eq("organization_id", orgId).neq("status", "closed");
      for (const b of benefits ?? []) {
        if (b.start_date && new Date(b.start_date) < new Date() && (b.realization ?? 0) < 50) {
          insights.push({
            organization_id: orgId, insight_type: "benefit_shortfall", severity: "medium",
            scope_type: "benefit", scope_id: b.id,
            title: `Benefit underperforming: "${b.name}" (${b.realization ?? 0}%)`,
            description: "Benefit started but realization is below 50%.",
            recommendation: "Review benefit profile, baseline measurements, and trajectory.",
            evidence: { realization: b.realization, start_date: b.start_date },
            generated_by: triggeredBy,
          });
        }
      }
    }

    // Upsert (dedupe via unique partial index)
    let inserted = 0;
    for (const ins of insights) {
      const { error } = await supabase.from("ai_insights").insert(ins as never);
      if (!error) inserted++;
    }

    return new Response(JSON.stringify({ success: true, scanned_orgs: orgs?.length ?? 0, inserted, total_findings: insights.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("ai-insights-scan error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
