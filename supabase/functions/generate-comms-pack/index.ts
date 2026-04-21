import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { evaluateResidency } from "../_shared/residency.ts";
import { callAI } from "../_shared/ai-provider.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface RequestBody {
  governance_report_id: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { governance_report_id }: RequestBody = await req.json();
    const { data: report, error: reportErr } = await supabase
      .from("governance_reports")
      .select("*")
      .eq("id", governance_report_id)
      .single();

    if (reportErr || !report) {
      return new Response(JSON.stringify({ error: "Report not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Residency policy check.
    const residency = await evaluateResidency({
      supabase,
      organizationId: report.organization_id,
      userId: user.id,
      operation: "generate-comms-pack",
      resourceType: "governance_report",
      resourceId: report.id,
    });
    if (!residency.ok) {
      return new Response(
        JSON.stringify({ error: residency.message, code: "residency_blocked", org_region: residency.org_region }),
        { status: residency.status ?? 451, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const adminDb = createClient(SUPABASE_URL, SERVICE_KEY);
    const scopeTable = report.scope_type === "programme" ? "programmes" : "projects";
    const { data: scope } = await adminDb.from(scopeTable).select("name").eq("id", report.scope_id).maybeSingle();

    const systemPrompt = `You are a corporate communications writer. Generate a 3-format comms pack from a governance report. Output strictly valid JSON.`;
    const userPrompt = `Source governance report:
${JSON.stringify(report.content, null, 2)}

Scope: ${scope?.name || "N/A"} (${report.scope_type})
Period: ${report.period_start || "?"} to ${report.period_end || "?"}

Generate three deliverables and return ONLY this JSON:
{
  "email_subject": "Concise subject line under 80 chars",
  "email_html": "Full HTML email body. Use inline styles, no <html>/<body> wrappers. Include heading, summary, key bullets, CTA.",
  "slack_markdown": "Slack-flavored markdown summary, max ~250 words, with bold headers and bullet lists",
  "pdf_summary": "Markdown 1-pager: title, executive summary, KPIs in a table, top risks, top milestones, recommendations, tolerance status"
}`;

    const aiRes = await callAI({
      supabase,
      organizationId: report.organization_id,
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
    });
    if (!aiRes.ok) return aiRes.errorResponse;

    const raw = aiRes.data.choices?.[0]?.message?.content || "{}";
    let pack;
    try {
      pack = typeof raw === "string" ? JSON.parse(raw) : raw;
    } catch {
      pack = { email_html: raw };
    }

    const { data: comms, error: insertErr } = await supabase
      .from("comms_packs")
      .insert({
        organization_id: report.organization_id,
        governance_report_id: report.id,
        scope_type: report.scope_type,
        scope_id: report.scope_id,
        title: `Comms Pack — ${report.title}`,
        period_start: report.period_start,
        period_end: report.period_end,
        email_subject: pack.email_subject,
        email_html: pack.email_html,
        slack_markdown: pack.slack_markdown,
        pdf_summary: pack.pdf_summary,
        created_by: user.id,
      })
      .select()
      .single();

    if (insertErr) {
      console.error("Insert error:", insertErr);
      return new Response(JSON.stringify({ error: insertErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ comms_pack: comms }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("generate-comms-pack error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
