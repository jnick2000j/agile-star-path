// Generates AI-powered risk heat-map narrative + per-risk mitigation suggestions
// Input: { organization_id, scope?: { programme_id?, project_id?, product_id? }, mode: "narrative" | "mitigation", risk_id? }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { evaluateResidency } from "../_shared/residency.ts";
import { consumeAiCredits } from "../_shared/credits.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PROB = { "very-low": 1, low: 2, medium: 3, high: 4, "very-high": 5 } as const;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } }
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

    const body = await req.json();
    const { organization_id, scope = {}, mode = "narrative", risk_id } = body;

    // Residency check
    const residency = await evaluateResidency({
      supabase,
      organizationId: organization_id,
      userId: user.id,
      operation: "risk-insights",
      resourceType: "risk_register",
    });
    if (!residency.ok) {
      return new Response(JSON.stringify({ error: residency.message }), { status: residency.status ?? 451, headers: corsHeaders });
    }

    // AI credits guard.
    const credits = await consumeAiCredits({
      supabase,
      organizationId: organization_id,
      userId: user.id,
      actionType: `risk-insights:${mode}`,
      model: "google/gemini-3-flash-preview",
      metadata: { scope, risk_id: risk_id ?? null },
    });
    if (!credits.ok) {
      return new Response(
        JSON.stringify({
          error: credits.message,
          code: "credits_exhausted",
          credits: { quota: credits.quota, used: credits.used, remaining: credits.remaining },
        }),
        { status: credits.status ?? 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Fetch risks in scope
    let q = supabase.from("risks").select("id, title, description, category, probability, impact, score, status, response, project_id, programme_id, product_id");
    if (organization_id) q = q.eq("organization_id", organization_id);
    if (scope.programme_id) q = q.eq("programme_id", scope.programme_id);
    if (scope.project_id) q = q.eq("project_id", scope.project_id);
    if (scope.product_id) q = q.eq("product_id", scope.product_id);
    if (mode === "mitigation" && risk_id) q = q.eq("id", risk_id);

    const { data: risks, error } = await q.limit(200);
    if (error) throw error;

    if (!risks || risks.length === 0) {
      return new Response(JSON.stringify({ narrative: "No risks found in this scope.", suggestions: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    if (mode === "mitigation") {
      // Per-risk mitigation suggestions via tool calling
      const r = risks[0];
      const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: "You are a PRINCE2 / MoR risk specialist. Suggest pragmatic mitigation strategies for the risk provided. Map each suggestion to one of: avoid, reduce, transfer, accept, share, exploit. Be specific and actionable." },
            { role: "user", content: `Risk: ${r.title}\nCategory: ${r.category ?? "general"}\nProbability: ${r.probability}, Impact: ${r.impact}, Score: ${r.score}\nStatus: ${r.status}\nDescription: ${r.description ?? "(none)"}\nCurrent response: ${r.response ?? "(none)"}` },
          ],
          tools: [{
            type: "function",
            function: {
              name: "propose_mitigations",
              description: "Return 3-5 mitigation actions for the risk.",
              parameters: {
                type: "object",
                properties: {
                  suggestions: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        strategy: { type: "string", enum: ["avoid", "reduce", "transfer", "accept", "share", "exploit"] },
                        action: { type: "string", description: "Specific action to take" },
                        owner_role: { type: "string", description: "Suggested owner role (e.g. Project Manager, Sponsor)" },
                        effort: { type: "string", enum: ["low", "medium", "high"] },
                        rationale: { type: "string" },
                      },
                      required: ["strategy", "action", "owner_role", "effort", "rationale"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["suggestions"],
                additionalProperties: false,
              },
            },
          }],
          tool_choice: { type: "function", function: { name: "propose_mitigations" } },
        }),
      });

      if (aiRes.status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded, please try again shortly." }), { status: 429, headers: corsHeaders });
      if (aiRes.status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted. Add credits in your workspace." }), { status: 402, headers: corsHeaders });
      if (!aiRes.ok) throw new Error(`AI error: ${await aiRes.text()}`);

      const aiData = await aiRes.json();
      const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
      const args = toolCall ? JSON.parse(toolCall.function.arguments) : { suggestions: [] };

      return new Response(JSON.stringify({ risk_id: r.id, suggestions: args.suggestions }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Narrative mode: heat-map summary
    const heatmap: Record<string, number> = {};
    for (let p = 1; p <= 5; p++) for (let i = 1; i <= 5; i++) heatmap[`${p}-${i}`] = 0;
    const byCategory: Record<string, number> = {};
    let totalScore = 0;
    let critical = 0;
    for (const r of risks) {
      const p = PROB[r.probability as keyof typeof PROB] ?? 3;
      const i = PROB[r.impact as keyof typeof PROB] ?? 3;
      heatmap[`${p}-${i}`]++;
      const cat = r.category ?? "uncategorized";
      byCategory[cat] = (byCategory[cat] ?? 0) + 1;
      totalScore += r.score ?? 0;
      if ((r.score ?? 0) >= 15) critical++;
    }

    const summary = {
      total: risks.length,
      critical,
      avg_score: Math.round((totalScore / risks.length) * 10) / 10,
      open: risks.filter(r => ["open", "mitigating"].includes(r.status)).length,
      by_category: byCategory,
      heatmap_distribution: heatmap,
      top_risks: risks.sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, 5).map(r => ({
        title: r.title, category: r.category, probability: r.probability, impact: r.impact, score: r.score, status: r.status,
      })),
    };

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You are a senior risk officer briefing executives. Write a concise (3-5 short paragraph) narrative interpreting the risk heat-map data. Highlight: (1) the overall risk posture, (2) clusters or hotspots in the heat-map, (3) category concentration, (4) the top 2-3 critical risks demanding attention, (5) one clear recommended next action. No headers, no bullet lists — flowing prose. Be direct, no fluff." },
          { role: "user", content: `Risk register summary:\n${JSON.stringify(summary, null, 2)}` },
        ],
      }),
    });

    if (aiRes.status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded, please try again shortly." }), { status: 429, headers: corsHeaders });
    if (aiRes.status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted. Add credits in your workspace." }), { status: 402, headers: corsHeaders });
    if (!aiRes.ok) throw new Error(`AI error: ${await aiRes.text()}`);

    const aiData = await aiRes.json();
    const narrative = aiData.choices?.[0]?.message?.content ?? "";

    return new Response(JSON.stringify({ narrative, summary, residency: residency.decision }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("risk-insights error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: corsHeaders });
  }
});
