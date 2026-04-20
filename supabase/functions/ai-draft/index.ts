// Phase 2 — Unified AI drafting endpoint.
// Routes "field" requests to gemini-2.5-flash and "wizard" requests to gemini-2.5-pro.
// Logs every call to ai_audit_log with status = 'pending' (human approval required).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { evaluateResidency } from "../_shared/residency.ts";
import { consumeAiCredits } from "../_shared/credits.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FIELD_MODEL = "google/gemini-2.5-flash";
const WIZARD_MODEL = "google/gemini-2.5-pro";
const PROMPT_VERSION = "v1.0";

type FieldMode = "improve" | "shorten" | "expand" | "translate" | "formal";

interface FieldRequest {
  kind: "field";
  mode: FieldMode;
  text: string;
  context?: string;
  language?: string;
  field?: string;
  entity_type?: string;
  entity_id?: string;
}

type WizardKind =
  | "project_brief"
  | "pid"
  | "programme_mandate"
  | "benefit_profile"
  | "change_request"
  | "exception_report"
  | "risk_suggestions"
  | "issue_suggestions"
  | "user_story"
  | "status_update";

interface WizardRequest {
  kind: "wizard";
  wizard: WizardKind;
  inputs: Record<string, unknown>;
  entity_type?: string;
  entity_id?: string;
}

type DraftRequest = FieldRequest | WizardRequest;

const FIELD_SYSTEM_PROMPTS: Record<FieldMode, string> = {
  improve:
    "You are an editorial assistant for a programme/project management platform. Rewrite the user's text so it reads more clearly and professionally without changing the meaning. Return ONLY the rewritten text — no preamble, no quotes, no explanations.",
  shorten:
    "Compress the user's text by ~50% while keeping every key fact. Return ONLY the shorter text.",
  expand:
    "Expand the user's text with helpful context, structure, and concrete detail suitable for a PRINCE2 / MSP audience. Do not invent facts. Return ONLY the expanded text.",
  translate:
    "Translate the user's text into the target language. Preserve tone, terminology and any product names. Return ONLY the translation.",
  formal:
    "Rewrite the user's text in a formal executive tone suitable for a steering committee report. Return ONLY the rewritten text.",
};

const WIZARD_SYSTEM_PROMPTS: Record<WizardKind, string> = {
  project_brief:
    "You are a PRINCE2-trained project consultant. Draft a Project Brief covering: Background, Project Definition (objectives, scope, deliverables, exclusions, constraints, assumptions), Outline Business Case, Project Approach, and Project Management Team Structure. Use clear headings.",
  pid: "You are a PRINCE2 PID author. Produce a complete Project Initiation Document with sections: Project Definition, Business Case, Organisation Structure, Quality Management Approach, Configuration Management Approach, Risk Management Approach, Communication Management Approach, Project Plan, Project Controls, Tailoring.",
  programme_mandate:
    "You are an MSP-trained programme manager. Draft a Programme Mandate with: Strategic Objectives, Vision Statement (one paragraph), Drivers for Change, Expected Benefits, Outline Scope, Constraints, Assumptions, Initial Risks.",
  benefit_profile:
    "You are an MSP benefits manager. Draft a Benefit Profile with: Description, Category (cashable / non-cashable), Owner, Measurement Method, Baseline, Target, Realisation Timeline (with milestones), Dependencies, Dis-benefits.",
  change_request:
    "You are a PRINCE2 change authority. Draft a Change Request covering: Summary, Reason for Change, Description of Change, Impact Analysis (cost, time, quality, scope, benefits, risk), Options Considered, Recommendation.",
  exception_report:
    "You are a PRINCE2 project manager raising an Exception Report. Sections: Exception Title, Cause, Consequences, Options (with pros/cons), Recommendation, Lessons.",
  risk_suggestions:
    "Based on the entity provided, suggest 3-5 likely risks. For each: title, description (1-2 sentences), category, probability (low/medium/high), impact (low/medium/high), suggested mitigation.",
  issue_suggestions:
    "Based on the entity provided, suggest 3-5 likely issues that could surface. For each: title, description, type (problem/concern/question), priority, suggested action.",
  user_story:
    "Convert the user's one-liner into a complete user story with: Title, As a / I want / So that, Acceptance Criteria (3-6 bullets, Given/When/Then format), MoSCoW classification with one-line rationale, and a RICE estimate (reach 1-10, impact 1-10, confidence 0-100%, effort in story points).",
  status_update:
    "Synthesise a concise status update from the supplied recent activity. Structure: Headline (one sentence), Progress (3-5 bullets), Risks & Issues (highlight new/elevated), Next Week.",
};

async function callGateway(model: string, system: string, user: string) {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) throw new Error("LOVABLE_API_KEY is not configured");

  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });

  if (resp.status === 429) {
    return { error: "rate_limited", status: 429 } as const;
  }
  if (resp.status === 402) {
    return { error: "payment_required", status: 402 } as const;
  }
  if (!resp.ok) {
    const t = await resp.text();
    console.error("AI gateway error", resp.status, t);
    return { error: "gateway_error", status: 500 } as const;
  }

  const json = await resp.json();
  const content: string = json?.choices?.[0]?.message?.content ?? "";
  return { content } as const;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as DraftRequest & { organization_id?: string; output_language?: string };
    const orgId = body.organization_id ?? null;

    // Residency policy check (org-level, hybrid: warn or block).
    const residency = await evaluateResidency({
      supabase,
      organizationId: orgId,
      userId: userData.user.id,
      operation: `ai-draft:${body.kind}`,
      resourceType: body.entity_type,
      resourceId: body.entity_id,
    });
    if (!residency.ok) {
      return new Response(
        JSON.stringify({ error: residency.message, code: "residency_blocked", org_region: residency.org_region }),
        { status: residency.status ?? 451, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // AI credits guard — atomically check + reserve one credit before calling the model.
    const credits = await consumeAiCredits({
      supabase,
      organizationId: orgId,
      userId: userData.user.id,
      actionType: `ai-draft:${body.kind}`,
      model: body.kind === "wizard" ? WIZARD_MODEL : FIELD_MODEL,
      metadata: { entity_type: body.entity_type ?? null, entity_id: body.entity_id ?? null },
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

    // Phase 5 — Look up the user's preferred language so AI output matches their UI language,
    // unless the request explicitly overrides it (e.g. translate field assist).
    let outputLanguage: string | null = body.output_language ?? null;
    if (!outputLanguage) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("preferred_language")
        .eq("user_id", userData.user.id)
        .maybeSingle();
      outputLanguage = (profile?.preferred_language as string | undefined) ?? null;
    }
    const langDirective =
      outputLanguage && outputLanguage !== "en"
        ? `\n\nIMPORTANT: Respond in ${outputLanguage}. Preserve any product names, code, and terminology in their original form.`
        : "";

    let model = FIELD_MODEL;
    let system = "";
    let userPrompt = "";
    let actionType = "";
    let targetField: string | null = null;

    if (body.kind === "field") {
      model = FIELD_MODEL;
      // For an explicit "translate" mode, the body.language wins over the user's preference.
      system =
        FIELD_SYSTEM_PROMPTS[body.mode] + (body.mode === "translate" ? "" : langDirective);
      const lang = body.language ? `Target language: ${body.language}.\n\n` : "";
      const ctx = body.context ? `Context: ${body.context}\n\n` : "";
      userPrompt = `${lang}${ctx}Text:\n${body.text}`;
      actionType = `field_assist:${body.mode}`;
      targetField = body.field ?? null;
    } else if (body.kind === "wizard") {
      model = WIZARD_MODEL;
      system = WIZARD_SYSTEM_PROMPTS[body.wizard] + langDirective;
      userPrompt = `Inputs:\n${JSON.stringify(body.inputs, null, 2)}\n\nProduce the document in clean Markdown.`;
      actionType = `wizard:${body.wizard}`;
      targetField = body.wizard;
    } else {
      return new Response(JSON.stringify({ error: "invalid kind" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await callGateway(model, system, userPrompt);
    if ("error" in result) {
      return new Response(JSON.stringify({ error: result.error }), {
        status: result.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Audit log entry — pending approval.
    const { data: audit, error: auditErr } = await supabase
      .from("ai_audit_log")
      .insert({
        organization_id: orgId,
        user_id: userData.user.id,
        action_type: actionType,
        entity_type: body.entity_type ?? null,
        entity_id: body.entity_id ?? null,
        model,
        prompt_version: PROMPT_VERSION,
        prompt_summary: userPrompt.slice(0, 500),
        output_summary: result.content.slice(0, 500),
        target_field: targetField,
        target_language:
          body.kind === "field" && body.mode === "translate" ? body.language ?? null : outputLanguage,
        draft_payload: { content: result.content, inputs: body.kind === "wizard" ? body.inputs : undefined },
        status: "pending",
      })
      .select()
      .single();

    if (auditErr) console.error("Audit insert failed", auditErr);

    return new Response(
      JSON.stringify({ content: result.content, audit_id: audit?.id ?? null, model }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("ai-draft error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
