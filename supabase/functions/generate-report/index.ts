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
      { data: helpdeskTickets },
      { data: helpdeskSlaPolicies },
      { data: helpdeskCatalogLists },
      { data: cmRequests },
      { data: cmApprovals },
      { data: cmActivity },
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
      supabase.from("helpdesk_tickets").select(
        "id, reference_number, subject, ticket_type, status, priority, requester_id, assignee_id, team_id, " +
        "created_at, updated_at, first_response_at, resolved_at, closed_at, " +
        "sla_response_due_at, sla_resolution_due_at, sla_response_breached, sla_resolution_breached, " +
        "sla_paused_at, sla_paused_seconds, csat_rating, programme_id, project_id, product_id"
      ).order("created_at", { ascending: false }).limit(500),
      supabase.from("helpdesk_sla_policies").select("*"),
      supabase.from("helpdesk_catalog_lists").select("id, key, name, is_active"),
      supabase.from("change_management_requests").select(
        "id, reference_number, title, status, change_type, impact, urgency, risk_score, " +
        "owner_id, requested_by, planned_start_at, planned_end_at, actual_start_at, actual_end_at, " +
        "downtime_required, downtime_minutes, programme_id, project_id, product_id, related_ticket_id, " +
        "created_at, updated_at"
      ).order("created_at", { ascending: false }).limit(500),
      supabase.from("change_management_approvals").select(
        "id, change_id, approval_kind, decision, decided_at, sequence, required"
      ).limit(2000),
      supabase.from("change_management_activity").select(
        "id, change_id, event_type, created_at"
      ).order("created_at", { ascending: false }).limit(500),
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
      helpdesk: {
        tickets: helpdeskTickets || [],
        slaPolicies: helpdeskSlaPolicies || [],
        catalogLists: helpdeskCatalogLists || [],
      },
      changeManagement: {
        requests: cmRequests || [],
        approvals: cmApprovals || [],
        activity: cmActivity || [],
      },
    });

    const systemPrompt = `You are an expert portfolio, programme, service-management and change-management report analyst. You have access to all data from a unified PPM + ITSM platform. Generate detailed, professional reports based on the user's natural language query.

The platform manages programmes, projects, products, risks, issues, benefits, milestones, tasks, project change requests, exceptions, lessons learned, stakeholders, helpdesk tickets (with SLA timers and breach tracking) and ITIL-style change management requests (with approvals, impact/urgency scoring and implementation activity).

When asked about service desk performance, lean on helpdesk.tickets — calculate SLA attainment from sla_response_breached / sla_resolution_breached, average resolution time from created_at→resolved_at, distributions by ticket_type, priority, status, team and CSAT.

When asked about change management, lean on changeManagement.requests, approvals and activity — break down by change_type (standard/normal/emergency), status pipeline, impact × urgency risk matrix, downtime exposure, approval lead time and post-implementation review status.

Current portfolio data:
${portfolioContext}

Instructions:
- Analyze the data and respond with a clear, well-structured report in markdown format.
- Include relevant statistics, summaries, and insights.
- Use tables where appropriate for data presentation.
- Highlight key findings, trends, and recommendations.
- If the data is empty for a requested area, mention that no data is currently available.
- Be specific with numbers and percentages.
- Include section headers for readability.
- If asked for charts or visualizations, describe the data in a table format that could be charted.`;

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
