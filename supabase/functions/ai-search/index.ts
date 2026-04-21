import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { callAI } from "../_shared/ai-provider.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query } = await req.json();
    if (!query || typeof query !== "string") {
      return new Response(JSON.stringify({ error: "Query is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // API key resolved per provider inside callAI().

    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const [
      programmes,
      projects,
      products,
      tasks,
      risks,
      issues,
      benefits,
      milestones,
    ] = await Promise.all([
      supabase.from("programmes").select("id,name,description,status").limit(50),
      supabase.from("projects").select("id,name,description,status,stage").limit(50),
      supabase.from("products").select("id,name,description,status").limit(50),
      supabase.from("tasks").select("id,title,description,status,reference_number").limit(50),
      supabase.from("risks").select("id,title,description,status,reference_number").limit(30),
      supabase.from("issues").select("id,title,description,status,reference_number").limit(30),
      supabase.from("benefits").select("id,name,description,status,reference_number").limit(30),
      supabase.from("milestones").select("id,name,description,status,reference_number,target_date").limit(30),
    ]);

    const corpus = {
      programmes: programmes.data ?? [],
      projects: projects.data ?? [],
      products: products.data ?? [],
      tasks: tasks.data ?? [],
      risks: risks.data ?? [],
      issues: issues.data ?? [],
      benefits: benefits.data ?? [],
      milestones: milestones.data ?? [],
    };

    const systemPrompt = `You are TaskMaster, an intelligent search assistant for a project/programme/product management platform.
Search across the provided data and return the MOST RELEVANT items for the user's query.
For each match, briefly explain WHY it matches. Group results by entity type. Use markdown with clear headings and bullet lists.
If nothing matches, say so plainly and suggest what they could try instead. Keep responses concise and scannable.

Routes for linking (use these paths in markdown links):
- Programme → /programmes
- Project → /projects
- Product → /products
- Task → /tasks
- Risk → /registers/risks
- Issue → /registers/issues
- Benefit → /registers/benefits
- Milestone → /prince2/milestones`;

    const userPrompt = `User query: "${query}"

Available data (JSON):
${JSON.stringify(corpus, null, 2)}

Return matches grouped by type with reference numbers where available.`;

    const aiResp = await callAI({
      supabase,
      organizationId: null,
      model: "google/gemini-3-flash-preview",
      stream: true,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });
    if (!aiResp.ok) return aiResp.errorResponse;

    return new Response(aiResp.body ?? null, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("ai-search error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
