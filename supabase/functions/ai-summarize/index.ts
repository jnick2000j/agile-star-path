import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MODEL = "google/gemini-2.5-pro";
const PROMPT_VERSION = "summary-v1";

type SummaryKind =
  | "entity_overview"
  | "weekly_status"
  | "risk_issue_digest"
  | "stakeholder_exec"
  | "meeting_notes"
  | "search_answer";

interface SummarizeBody {
  scope_type: "programme" | "project" | "product" | "weekly_report" | "portfolio" | "meeting" | "search";
  scope_id: string; // for portfolio/search may be the org id; for meeting an arbitrary id
  organization_id: string;
  summary_kind: SummaryKind;
  inputs?: Record<string, unknown>; // free-form (meeting transcript, search query, etc.)
  require_approval?: boolean; // default true
}

const KIND_INSTRUCTIONS: Record<SummaryKind, string> = {
  entity_overview:
    "Produce a crisp executive overview (3 short paragraphs + a 'Key risks' bullet list + a 'Next steps' bullet list).",
  weekly_status:
    "Produce a weekly status report with sections: Headline, Progress this week, Key risks & issues, Decisions needed, Looking ahead.",
  risk_issue_digest:
    "Produce a digest of the most critical open risks and issues. Group by severity. Call out anything stale or unowned.",
  stakeholder_exec:
    "Produce a non-technical executive summary suitable for external stakeholders. Avoid jargon. 4-6 short paragraphs max.",
  meeting_notes:
    "Convert the provided raw notes/transcript into structured minutes: Attendees, Decisions, Action items (with owner/date if present), Risks raised, Next meeting.",
  search_answer:
    "Answer the user's query using only the provided portfolio data. Cite the entities you used (by name + type). If the data is insufficient, say so.",
};

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

    const authClient = createClient(supabaseUrl, anon, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await authClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const user = userData.user;

    const body = (await req.json()) as SummarizeBody & { output_language?: string };
    if (!body?.scope_type || !body?.scope_id || !body?.summary_kind || !body?.organization_id) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const requireApproval = body.require_approval !== false;

    const supabase = createClient(supabaseUrl, serviceKey);

    // Phase 5 — fetch the user's preferred language and pass it to the model.
    let outputLanguage = body.output_language ?? null;
    if (!outputLanguage) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("preferred_language")
        .eq("user_id", user.id)
        .maybeSingle();
      outputLanguage = (profile?.preferred_language as string | undefined) ?? "en";
    }
    const langDirective =
      outputLanguage && outputLanguage !== "en"
        ? ` IMPORTANT: Write the entire summary in ${outputLanguage}. Preserve product names and section headings naturally.`
        : "";

    // Gather context based on scope
    const ctx: Record<string, unknown> = { scope_type: body.scope_type, scope_id: body.scope_id };

    if (body.scope_type === "programme") {
      const [{ data: prog }, { data: projects }, { data: risks }, { data: issues }, { data: milestones }, { data: benefits }, { data: updates }] = await Promise.all([
        supabase.from("programmes").select("name,status,progress,description").eq("id", body.scope_id).maybeSingle(),
        supabase.from("projects").select("name,stage,health,priority").eq("programme_id", body.scope_id),
        supabase.from("risks").select("title,score,status,owner_id").eq("programme_id", body.scope_id).in("status", ["open", "mitigating"]).order("score", { ascending: false }).limit(15),
        supabase.from("issues").select("title,priority,status").eq("programme_id", body.scope_id).in("status", ["open", "investigating", "pending"]).limit(15),
        supabase.from("milestones").select("name,status,target_date,actual_date").eq("programme_id", body.scope_id).order("target_date").limit(15),
        supabase.from("benefits").select("name,realization,status").eq("programme_id", body.scope_id).limit(15),
        supabase.from("entity_updates").select("update_text,created_at").eq("entity_type", "programme").eq("entity_id", body.scope_id).order("created_at", { ascending: false }).limit(20),
      ]);
      Object.assign(ctx, { programme: prog, projects, risks, issues, milestones, benefits, recent_updates: updates });
    } else if (body.scope_type === "project") {
      const [{ data: proj }, { data: tasks }, { data: risks }, { data: issues }, { data: milestones }, { data: updates }] = await Promise.all([
        supabase.from("projects").select("name,stage,health,priority,description").eq("id", body.scope_id).maybeSingle(),
        supabase.from("tasks").select("name,status,priority,planned_end").eq("project_id", body.scope_id).limit(30),
        supabase.from("risks").select("title,score,status").eq("project_id", body.scope_id).in("status", ["open", "mitigating"]).limit(15),
        supabase.from("issues").select("title,priority,status").eq("project_id", body.scope_id).limit(15),
        supabase.from("milestones").select("name,status,target_date").eq("project_id", body.scope_id).limit(10),
        supabase.from("entity_updates").select("update_text,created_at").eq("entity_type", "project").eq("entity_id", body.scope_id).order("created_at", { ascending: false }).limit(20),
      ]);
      Object.assign(ctx, { project: proj, tasks, risks, issues, milestones, recent_updates: updates });
    } else if (body.scope_type === "product") {
      const [{ data: prod }, { data: features }, { data: risks }, { data: issues }, { data: updates }] = await Promise.all([
        supabase.from("products").select("name,status,stage,description").eq("id", body.scope_id).maybeSingle(),
        supabase.from("product_features").select("name,status,priority").eq("product_id", body.scope_id).limit(30),
        supabase.from("risks").select("title,score,status").eq("product_id", body.scope_id).limit(15),
        supabase.from("issues").select("title,priority,status").eq("product_id", body.scope_id).limit(15),
        supabase.from("entity_updates").select("update_text,created_at").eq("entity_type", "product").eq("entity_id", body.scope_id).order("created_at", { ascending: false }).limit(20),
      ]);
      Object.assign(ctx, { product: prod, features, risks, issues, recent_updates: updates });
    } else if (body.scope_type === "portfolio") {
      const [{ data: programmes }, { data: projects }, { data: risks }, { data: issues }] = await Promise.all([
        supabase.from("programmes").select("name,status,progress").eq("organization_id", body.organization_id),
        supabase.from("projects").select("name,stage,health").eq("organization_id", body.organization_id),
        supabase.from("risks").select("title,score,status").eq("organization_id", body.organization_id).order("score", { ascending: false }).limit(20),
        supabase.from("issues").select("title,priority,status").eq("organization_id", body.organization_id).limit(20),
      ]);
      Object.assign(ctx, { programmes, projects, risks, issues });
    } else if (body.scope_type === "meeting" || body.scope_type === "search") {
      Object.assign(ctx, body.inputs ?? {});
    }

    const systemPrompt = `You are a senior PMO analyst. ${KIND_INSTRUCTIONS[body.summary_kind]} Output clear markdown. Be specific; cite numbers.${langDirective}`;
    const userPrompt = `Context (JSON):\n\n${JSON.stringify(ctx).slice(0, 60_000)}\n\nUser inputs: ${JSON.stringify(body.inputs ?? {})}`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${lovableKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Try again in a moment." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Add funds in Settings → Workspace → Usage." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const t = await aiResponse.text();
      console.error("AI gateway", aiResponse.status, t);
      throw new Error("AI gateway error");
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content ?? "";

    // Audit log entry
    const { data: audit } = await supabase
      .from("ai_audit_log")
      .insert({
        action_type: `summarize:${body.summary_kind}`,
        entity_type: body.scope_type,
        entity_id: body.scope_id,
        organization_id: body.organization_id,
        user_id: user.id,
        model: MODEL,
        prompt_version: PROMPT_VERSION,
        prompt_summary: KIND_INSTRUCTIONS[body.summary_kind],
        output_summary: content.slice(0, 500),
        target_language: outputLanguage,
        draft_payload: { content, inputs: body.inputs ?? {}, summary_kind: body.summary_kind } as never,
        status: requireApproval ? "pending" : "approved",
        reviewed_by: requireApproval ? null : user.id,
        reviewed_at: requireApproval ? null : new Date().toISOString(),
      })
      .select()
      .single();

    // Upsert ai_summaries row (only persistent for non-search/meeting kinds with concrete scope)
    const persistentKinds: SummaryKind[] = ["entity_overview", "weekly_status", "risk_issue_digest", "stakeholder_exec"];
    let summaryRow: { id: string } | null = null;
    if (persistentKinds.includes(body.summary_kind)) {
      const upsertPayload = {
        organization_id: body.organization_id,
        scope_type: body.scope_type,
        scope_id: body.scope_id,
        summary_kind: body.summary_kind,
        draft_content: { content } as never,
        published_content: requireApproval ? null : ({ content } as never),
        status: requireApproval ? "pending" : "published",
        is_stale: false,
        change_count_at_generation: 0,
        last_audit_id: audit?.id ?? null,
        generated_by: user.id,
        generated_at: new Date().toISOString(),
        approved_by: requireApproval ? null : user.id,
        approved_at: requireApproval ? null : new Date().toISOString(),
        model: MODEL,
        prompt_version: PROMPT_VERSION,
      };
      const { data } = await supabase
        .from("ai_summaries")
        .upsert(upsertPayload, { onConflict: "scope_type,scope_id,summary_kind" })
        .select("id")
        .single();
      summaryRow = data;
    }

    return new Response(
      JSON.stringify({
        success: true,
        content,
        audit_id: audit?.id ?? null,
        summary_id: summaryRow?.id ?? null,
        status: requireApproval ? "pending" : "approved",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("ai-summarize error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
