import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";
import { evaluateResidency } from "../_shared/residency.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MODEL = "google/gemini-2.5-pro";

const TOOLS = [
  {
    type: "function",
    function: {
      name: "query_portfolio",
      description: "Query the user's portfolio (programmes, projects, products, risks, issues, benefits, milestones, tasks). Use for any read.",
      parameters: {
        type: "object",
        properties: {
          entity: { type: "string", enum: ["programmes", "projects", "products", "risks", "issues", "benefits", "milestones", "tasks", "stakeholders", "exceptions", "change_requests"] },
          filters: { type: "object", description: "Equality filters as key/value, e.g. {\"programme_id\":\"...\",\"status\":\"open\"}" },
          limit: { type: "number" },
        },
        required: ["entity"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "draft_risk",
      description: "Create a draft risk (status='open'). Returns the risk id.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          score: { type: "number" },
          programme_id: { type: "string" },
          project_id: { type: "string" },
          product_id: { type: "string" },
        },
        required: ["title"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "draft_issue",
      description: "Create a draft issue.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          priority: { type: "string", enum: ["low", "medium", "high", "critical"] },
          programme_id: { type: "string" },
          project_id: { type: "string" },
          product_id: { type: "string" },
        },
        required: ["title"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "draft_task",
      description: "Create a draft task.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" },
          status: { type: "string" },
          priority: { type: "string" },
          project_id: { type: "string" },
          programme_id: { type: "string" },
          product_id: { type: "string" },
          planned_end: { type: "string", description: "ISO date" },
        },
        required: ["name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "post_update",
      description: "Post an update on an entity (programme/project/product/task).",
      parameters: {
        type: "object",
        properties: {
          entity_type: { type: "string", enum: ["programme", "project", "product", "task"] },
          entity_id: { type: "string" },
          update_text: { type: "string" },
        },
        required: ["entity_type", "entity_id", "update_text"],
      },
    },
  },
];

async function executeTool(
  name: string,
  args: Record<string, unknown>,
  ctx: { supabase: ReturnType<typeof createClient>; userId: string; orgId: string; conversationId: string }
) {
  const { supabase, userId, orgId, conversationId } = ctx;
  const isWrite = name !== "query_portfolio";

  let output: unknown = null;
  let entityType: string | null = null;
  let entityId: string | null = null;

  try {
    if (name === "query_portfolio") {
      const entity = String(args.entity);
      const filters = (args.filters as Record<string, unknown>) ?? {};
      const limit = Math.min(Number(args.limit ?? 25), 100);
      let q = supabase.from(entity).select("*").eq("organization_id", orgId).limit(limit);
      for (const [k, v] of Object.entries(filters)) {
        if (v !== null && v !== undefined && v !== "") q = q.eq(k, v as never);
      }
      const { data, error } = await q;
      if (error) throw error;
      output = data;
    } else if (name === "draft_risk") {
      const { data, error } = await supabase.from("risks").insert({
        title: args.title, description: args.description ?? null, score: args.score ?? 0,
        organization_id: orgId, owner_id: userId, status: "open",
        programme_id: args.programme_id ?? null, project_id: args.project_id ?? null, product_id: args.product_id ?? null,
        created_by: userId,
      }).select("id").single();
      if (error) throw error;
      entityType = "risk"; entityId = data.id; output = data;
    } else if (name === "draft_issue") {
      const { data, error } = await supabase.from("issues").insert({
        title: args.title, description: args.description ?? null, priority: args.priority ?? "medium",
        organization_id: orgId, owner_id: userId, status: "open",
        programme_id: args.programme_id ?? null, project_id: args.project_id ?? null, product_id: args.product_id ?? null,
        created_by: userId,
      }).select("id").single();
      if (error) throw error;
      entityType = "issue"; entityId = data.id; output = data;
    } else if (name === "draft_task") {
      const { data, error } = await supabase.from("tasks").insert({
        name: args.name, status: args.status ?? "todo", priority: args.priority ?? "medium",
        project_id: args.project_id ?? null, programme_id: args.programme_id ?? null, product_id: args.product_id ?? null,
        planned_end: args.planned_end ?? null, organization_id: orgId, created_by: userId,
      }).select("id").single();
      if (error) throw error;
      entityType = "task"; entityId = data.id; output = data;
    } else if (name === "post_update") {
      const { data, error } = await supabase.from("entity_updates").insert({
        entity_type: args.entity_type, entity_id: args.entity_id, update_text: args.update_text,
        organization_id: orgId, created_by: userId,
      }).select("id").single();
      if (error) throw error;
      entityType = String(args.entity_type); entityId = String(args.entity_id); output = data;
    } else {
      throw new Error(`Unknown tool: ${name}`);
    }

    await supabase.from("ai_agent_actions").insert({
      user_id: userId, organization_id: orgId, conversation_id: conversationId,
      tool_name: name, tool_input: args as never, tool_output: output as never,
      target_entity_type: entityType, target_entity_id: entityId,
      is_write: isWrite, status: "completed",
    });
    await supabase.from("ai_audit_log").insert({
      action_type: `agent:${name}`, entity_type: entityType, entity_id: entityId,
      organization_id: orgId, user_id: userId, model: MODEL,
      prompt_summary: `Agent tool ${name}`, output_summary: JSON.stringify(output).slice(0, 500),
      draft_payload: { args, output } as never,
      status: isWrite ? "approved" : "approved",
    });
    return output;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await supabase.from("ai_agent_actions").insert({
      user_id: userId, organization_id: orgId, conversation_id: conversationId,
      tool_name: name, tool_input: args as never, tool_output: { error: msg } as never,
      is_write: isWrite, status: "failed",
    });
    return { error: msg };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableKey) throw new Error("LOVABLE_API_KEY not configured");

    const authClient = createClient(supabaseUrl, anon, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userErr } = await authClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const user = userData.user;
    const supabase = createClient(supabaseUrl, serviceKey);

    const body = await req.json();
    const { messages, conversation_id, organization_id } = body as {
      messages: { role: string; content: string }[];
      conversation_id: string;
      organization_id: string;
    };
    if (!conversation_id || !organization_id || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "Missing fields" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const ctx = { supabase, userId: user.id, orgId: organization_id, conversationId: conversation_id };

    const systemPrompt = `You are the AI Advisor for a PMO platform. You help users analyse their portfolio and can take actions on their behalf using tools.

Rules:
- Always use query_portfolio to read data before suggesting changes.
- When the user clearly asks for a write (create, log, post), use the appropriate tool. Confirm briefly after.
- Cite entity names when summarising data. Be concise. Use markdown.
- Never invent IDs — query first.`;

    const convo = [
      { role: "system", content: systemPrompt },
      ...messages,
    ];

    // Tool-calling loop — non-streaming so we can run tools, then stream the final answer.
    let finalContent = "";
    const allToolCalls: unknown[] = [];

    for (let iter = 0; iter < 5; iter++) {
      const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${lovableKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: MODEL, messages: convo, tools: TOOLS, tool_choice: "auto" }),
      });

      if (!aiResp.ok) {
        if (aiResp.status === 429) return new Response(JSON.stringify({ error: "Rate limited. Please try again." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        if (aiResp.status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted. Add funds in Settings → Workspace → Usage." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const t = await aiResp.text(); console.error("AI", aiResp.status, t);
        throw new Error("AI gateway error");
      }
      const aiData = await aiResp.json();
      const msg = aiData.choices?.[0]?.message;
      if (!msg) break;

      const toolCalls = msg.tool_calls as Array<{ id: string; function: { name: string; arguments: string } }> | undefined;
      if (toolCalls && toolCalls.length > 0) {
        convo.push({ role: "assistant", content: msg.content ?? "", tool_calls: toolCalls } as never);
        for (const tc of toolCalls) {
          let args: Record<string, unknown> = {};
          try { args = JSON.parse(tc.function.arguments || "{}"); } catch { /* ignore */ }
          const result = await executeTool(tc.function.name, args, ctx);
          allToolCalls.push({ name: tc.function.name, args, result });
          convo.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify(result).slice(0, 8000) } as never);
        }
        continue; // loop again so the model can use tool results
      }

      finalContent = msg.content ?? "";
      break;
    }

    // Persist user message + assistant response
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (lastUser) {
      await supabase.from("ai_advisor_messages").insert({
        conversation_id, user_id: user.id, role: "user", content: lastUser.content,
      });
    }
    await supabase.from("ai_advisor_messages").insert({
      conversation_id, user_id: user.id, role: "assistant", content: finalContent,
      tool_calls: allToolCalls as never,
    });
    await supabase.from("ai_advisor_conversations").update({ updated_at: new Date().toISOString() }).eq("id", conversation_id);

    return new Response(JSON.stringify({ content: finalContent, tool_calls: allToolCalls }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("ai-advisor error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
