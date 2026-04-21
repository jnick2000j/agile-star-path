import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";
import { evaluateResidency } from "../_shared/residency.ts";
import { callAI } from "../_shared/ai-provider.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { query, organization_id } = await req.json();
    if (!query || typeof query !== "string" || query.length > 2000) {
      return new Response(JSON.stringify({ error: "Invalid query" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Residency policy check (skip if no org context provided).
    if (organization_id) {
      const residency = await evaluateResidency({
        supabase,
        organizationId: organization_id,
        userId: user.id,
        operation: "generate-report",
        metadata: { query_preview: query.slice(0, 120) },
      });
      if (!residency.ok) {
        return new Response(
          JSON.stringify({ error: residency.message, code: "residency_blocked", org_region: residency.org_region }),
          { status: residency.status ?? 451, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    // Fetch portfolio data for context
    const [
      { data: programmes },
      { data: projects },
      { data: products },
      { data: risks },
      { data: issues },
      { data: benefits },
      { data: milestones },
      { data: tasks },
      { data: changeRequests },
      { data: exceptions },
      { data: lessonsLearned },
      { data: stakeholders },
    ] = await Promise.all([
      supabase.from("programmes").select("*"),
      supabase.from("projects").select("*"),
      supabase.from("products").select("*"),
      supabase.from("risks").select("*"),
      supabase.from("issues").select("*"),
      supabase.from("benefits").select("*"),
      supabase.from("milestones").select("*"),
      supabase.from("tasks").select("*"),
      supabase.from("change_requests").select("*"),
      supabase.from("exceptions").select("*"),
      supabase.from("lessons_learned").select("*"),
      supabase.from("stakeholders").select("*"),
    ]);

    const portfolioContext = JSON.stringify({
      programmes: programmes || [],
      projects: projects || [],
      products: products || [],
      risks: risks || [],
      issues: issues || [],
      benefits: benefits || [],
      milestones: milestones || [],
      tasks: tasks || [],
      changeRequests: changeRequests || [],
      exceptions: exceptions || [],
      lessonsLearned: lessonsLearned || [],
      stakeholders: stakeholders || [],
    });

    const aiResponse = await callAI({
      supabase,
      organizationId: organization_id ?? null,
      model: "google/gemini-3-flash-preview",
      stream: true,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: query },
      ],
    });
    if (!aiResponse.ok) return aiResponse.errorResponse;

    return new Response(aiResponse.body ?? null, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("generate-report error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
