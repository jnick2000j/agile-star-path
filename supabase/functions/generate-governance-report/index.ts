import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

interface RequestBody {
  report_type: "highlight" | "end_stage" | "programme_status" | "product_status";
  scope_type: "programme" | "project" | "product";
  scope_id: string;
  organization_id: string;
  period_start?: string;
  period_end?: string;
  title?: string;
}

const SCOPE_TABLE: Record<string, string> = {
  programme: "programmes",
  project: "projects",
  product: "products",
};

const SCOPE_FILTER_COL: Record<string, string> = {
  programme: "programme_id",
  project: "project_id",
  product: "product_id",
};

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

    const body: RequestBody = await req.json();
    const { report_type, scope_type, scope_id, organization_id } = body;
    const period_end = body.period_end || new Date().toISOString().slice(0, 10);
    const period_start = body.period_start ||
      new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    // Use service role for data fetching to ensure consistent context
    const adminDb = createClient(SUPABASE_URL, SERVICE_KEY);

    // Fetch scope entity
    const scopeTable = SCOPE_TABLE[scope_type];
    if (!scopeTable) {
      return new Response(JSON.stringify({ error: "Unsupported scope_type" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: scope } = await adminDb.from(scopeTable).select("*").eq("id", scope_id).maybeSingle();

    if (!scope) {
      return new Response(JSON.stringify({ error: "Scope not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Aggregate context
    const filterCol = SCOPE_FILTER_COL[scope_type];
    const [risksRes, issuesRes, milestonesRes, benefitsRes, updatesRes, exceptionsRes] = await Promise.all([
      adminDb.from("risks").select("title, severity, status, owner_id, mitigation_plan").eq(filterCol, scope_id).limit(20),
      adminDb.from("issues").select("title, priority, status, type").eq(filterCol, scope_id).limit(20),
      adminDb.from("milestones").select("name, target_date, actual_date, status").eq(filterCol, scope_id).order("target_date").limit(20),
      adminDb.from("benefits").select("name, target_value, current_value, realization, status").eq(filterCol, scope_id).limit(10),
      adminDb.from("entity_updates").select("update_text, is_risk_flagged, risk_criticality, created_at").eq("entity_type", scope_type).eq("entity_id", scope_id).gte("created_at", period_start).order("created_at", { ascending: false }).limit(15),
      adminDb.from("exceptions").select("title, severity, status").eq(filterCol, scope_id).eq("status", "raised").limit(10),
    ]);

    // Compliance score
    const { data: complianceData } = await adminDb.rpc("compute_compliance_score", {
      _scope_type: scope_type,
      _scope_id: scope_id,
    });

    const reportTypeLabels: Record<string, string> = {
      highlight: "PRINCE2 Highlight Report",
      end_stage: "PRINCE2 End Stage Report",
      programme_status: "MSP Programme Status Report",
      product_status: "Product Status Report",
    };

    const systemPrompt = `You are a senior PMO governance writer. Produce a ${reportTypeLabels[report_type]} in the exact JSON structure requested. Be concise, factual, and PRINCE2/MSP-aligned. Never invent facts; if data is missing, say "No data available".`;

    const userPrompt = `Generate a ${reportTypeLabels[report_type]} for the ${scope_type}: "${scope.name}".
Reporting period: ${period_start} to ${period_end}.

CONTEXT:
- Description: ${scope.description || "N/A"}
- Status: ${scope.status || "N/A"}
- Compliance score: ${complianceData?.score ?? "unknown"}/100

RISKS (${risksRes.data?.length || 0}):
${JSON.stringify(risksRes.data?.slice(0, 10) || [], null, 2)}

ISSUES (${issuesRes.data?.length || 0}):
${JSON.stringify(issuesRes.data?.slice(0, 10) || [], null, 2)}

MILESTONES (${milestonesRes.data?.length || 0}):
${JSON.stringify(milestonesRes.data?.slice(0, 10) || [], null, 2)}

BENEFITS (${benefitsRes.data?.length || 0}):
${JSON.stringify(benefitsRes.data || [], null, 2)}

PERIOD UPDATES (${updatesRes.data?.length || 0}):
${JSON.stringify(updatesRes.data || [], null, 2)}

ACTIVE EXCEPTIONS (${exceptionsRes.data?.length || 0}):
${JSON.stringify(exceptionsRes.data || [], null, 2)}

Return ONLY valid JSON with this structure:
{
  "executive_summary": "2-3 sentence overview",
  "period_progress": "What was achieved this period",
  "key_risks": ["bullet 1", "bullet 2", ...],
  "key_issues": ["bullet 1", "bullet 2", ...],
  "milestone_status": "Narrative on schedule",
  "benefits_status": "Narrative on benefits realisation",
  "next_period": "Planned activities for the next period",
  "recommendations": ["recommendation 1", "recommendation 2"],
  "tolerance_status": "ON_TRACK | AT_RISK | EXCEEDED"
}`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (aiRes.status === 429) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again shortly." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (aiRes.status === 402) {
      return new Response(JSON.stringify({ error: "AI credits exhausted. Add credits to continue." }), {
        status: 402,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error("AI gateway error:", errText);
      return new Response(JSON.stringify({ error: "AI generation failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiRes.json();
    const rawContent = aiData.choices?.[0]?.message?.content || "{}";
    let content;
    try {
      content = typeof rawContent === "string" ? JSON.parse(rawContent) : rawContent;
    } catch {
      content = { executive_summary: rawContent };
    }

    const title = body.title || `${reportTypeLabels[report_type]} — ${scope.name} (${period_end})`;

    // Insert as draft using user's auth context for RLS
    const { data: report, error: insertErr } = await supabase
      .from("governance_reports")
      .insert({
        organization_id,
        report_type,
        scope_type,
        scope_id,
        title,
        period_start,
        period_end,
        status: "draft",
        content,
        ai_model: "google/gemini-2.5-pro",
        ai_prompt_version: "v1",
        generated_by: user.id,
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

    // Persist a fresh compliance score snapshot
    if (complianceData) {
      await adminDb.from("compliance_scores").insert({
        organization_id,
        scope_type,
        scope_id,
        score: complianceData.score,
        controls_score: complianceData.controls_score,
        cadence_score: complianceData.cadence_score,
        hygiene_score: complianceData.hygiene_score,
        details: complianceData.details,
      });
    }

    return new Response(JSON.stringify({ report, compliance: complianceData }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("generate-governance-report error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
