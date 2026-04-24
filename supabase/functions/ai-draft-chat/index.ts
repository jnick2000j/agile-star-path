// Conversational AI drafting endpoint.
// Unlike `ai-draft` (one-shot form → draft), this function runs a back-and-forth
// chat where the AI acts like an intake specialist: it asks ONE clarifying
// question at a time until it has enough to produce a final, industry-grade
// draft. When ready, it calls the `produce_draft` tool with the final markdown
// content — the client reads that signal to switch into "draft ready" mode.
//
// Streams SSE so tokens arrive in the chat as they're generated.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { evaluateResidency } from "../_shared/residency.ts";
import { consumeAiCredits } from "../_shared/credits.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MODEL = "google/gemini-2.5-pro";
const PROMPT_VERSION = "chat-v1.0";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface RequestBody {
  wizard: string;
  /** Domain-specific system prompt for the wizard (sourced from ai-draft prompts). */
  system_prompt: string;
  /** Friendly title shown in the chat (e.g. "Statement of Work"). */
  title: string;
  /** Hint of fields the AI should make sure to capture before producing a draft. */
  required_fields?: Array<{ key: string; label: string; required?: boolean }>;
  messages: ChatMessage[];
  organization_id?: string | null;
  entity_type?: string | null;
  entity_id?: string | null;
  output_language?: string | null;
}

const INTAKE_INSTRUCTIONS = `
You are now operating in CONVERSATIONAL INTAKE MODE.

Your job is to gather just enough information from the user to produce a high-quality, industry-grade document, like a great help-desk agent or consultant on a discovery call.

Rules:
1. Ask ONE focused question at a time. Never bullet-list multiple questions in a single turn.
2. Be warm, concise and professional. Two short sentences max per question.
3. Validate and reflect back briefly when the user gives you something important ("Got it — fixed price, $120k cap.").
4. If the user gives you a vague or incomplete answer, gently ask a follow-up to sharpen it.
5. Use the REQUIRED FIELDS list as your minimum coverage — but feel free to ask additional questions that would meaningfully improve the document quality.
6. When you have enough to write a strong first draft, call the \`produce_draft\` tool with the full Markdown document. Do NOT also send the document as a normal chat message — the tool call IS the delivery mechanism.
7. If the user explicitly asks you to "draft now", "just generate it", "go", or similar, respect that and produce the draft with whatever you have, making reasonable assumptions and clearly marking them as [ASSUMPTION] in the draft.
8. Never invent facts. If you're unsure of something material (e.g. a name, a date, a number), ask.
9. Never apologise for asking questions — that's the job.

When you do produce the draft (via the tool call), make it production-quality, fully structured Markdown with clear headings, ready for an approver to review and publish.
`.trim();

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableKey) {
      return new Response(JSON.stringify({ error: "AI gateway not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

    const body = (await req.json()) as RequestBody;
    if (!body.wizard || !body.system_prompt || !Array.isArray(body.messages)) {
      return new Response(JSON.stringify({ error: "invalid request" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const orgId = body.organization_id ?? null;

    // Residency policy check.
    const residency = await evaluateResidency({
      supabase,
      organizationId: orgId,
      userId: userData.user.id,
      operation: `ai-draft-chat:${body.wizard}`,
      resourceType: body.entity_type ?? undefined,
      resourceId: body.entity_id ?? undefined,
    });
    if (!residency.ok) {
      return new Response(
        JSON.stringify({ error: residency.message, code: "residency_blocked", org_region: residency.org_region }),
        { status: residency.status ?? 451, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Credits guard — one credit per turn.
    const credits = await consumeAiCredits({
      supabase,
      organizationId: orgId,
      userId: userData.user.id,
      actionType: `ai-draft-chat:${body.wizard}`,
      model: MODEL,
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

    // Pick up the user's preferred output language.
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
        ? `\n\nIMPORTANT: Respond in ${outputLanguage}. Preserve product names, code, and terminology in their original form.`
        : "";

    const requiredList =
      body.required_fields && body.required_fields.length
        ? "\n\nREQUIRED FIELDS to cover before producing the draft:\n" +
          body.required_fields
            .map((f) => `  - ${f.label} (${f.key})${f.required ? " [REQUIRED]" : ""}`)
            .join("\n")
        : "";

    const fullSystem =
      `You are drafting a "${body.title}".\n\n` +
      body.system_prompt +
      "\n\n" +
      INTAKE_INSTRUCTIONS +
      requiredList +
      langDirective;

    // First turn? Have the AI greet + ask the first question.
    const messages = body.messages.length
      ? body.messages
      : [{ role: "user" as const, content: "Let's start." }];

    const tools = [
      {
        type: "function",
        function: {
          name: "produce_draft",
          description:
            "Call this when you have gathered enough information to write the final document. Pass the full, production-ready Markdown document as `content`. After this call, the conversation is over.",
          parameters: {
            type: "object",
            properties: {
              content: {
                type: "string",
                description: "Full Markdown of the final document.",
              },
              summary: {
                type: "string",
                description: "One-sentence summary of the document for the audit log.",
              },
            },
            required: ["content"],
            additionalProperties: false,
          },
        },
      },
    ];

    const upstream = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "system", content: fullSystem }, ...messages],
        tools,
        tool_choice: "auto",
        stream: true,
      }),
    });

    if (!upstream.ok) {
      const status = upstream.status;
      const text = await upstream.text();
      console.error("AI gateway error", status, text);
      if (status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limited — please try again shortly.", code: "rate_limited" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted.", code: "credits_exhausted" }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Tee the stream: forward to client, but also accumulate so we can persist
    // a final draft to ai_audit_log when the model emits the produce_draft tool call.
    const [streamA, streamB] = upstream.body!.tee();

    // Background task: parse the stream and, when complete, write the audit log.
    (async () => {
      const reader = streamB.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let assistantText = "";
      let toolArgs = "";
      let toolName = "";
      let done = false;
      while (!done) {
        const { value, done: d } = await reader.read();
        if (d) break;
        buf += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) !== -1) {
          let line = buf.slice(0, nl);
          buf = buf.slice(nl + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") { done = true; break; }
          try {
            const parsed = JSON.parse(json);
            const delta = parsed.choices?.[0]?.delta;
            if (delta?.content) assistantText += delta.content;
            const tcs = delta?.tool_calls;
            if (Array.isArray(tcs)) {
              for (const tc of tcs) {
                if (tc?.function?.name) toolName = tc.function.name;
                if (tc?.function?.arguments) toolArgs += tc.function.arguments;
              }
            }
          } catch { /* partial chunk — ignore */ }
        }
      }
      // If the model produced a draft, log it for approval.
      if (toolName === "produce_draft" && toolArgs) {
        try {
          const args = JSON.parse(toolArgs);
          const draftContent = args.content ?? "";
          const summary = args.summary ?? draftContent.slice(0, 200);
          await supabase.from("ai_audit_log").insert({
            organization_id: orgId,
            user_id: userData.user.id,
            action_type: `wizard_chat:${body.wizard}`,
            entity_type: body.entity_type ?? null,
            entity_id: body.entity_id ?? null,
            model: MODEL,
            prompt_version: PROMPT_VERSION,
            prompt_summary: messages.slice(-4).map((m) => `${m.role}: ${m.content}`).join("\n").slice(0, 500),
            output_summary: summary.slice(0, 500),
            target_field: body.wizard,
            target_language: outputLanguage,
            draft_payload: { content: draftContent, conversation: messages },
            status: "pending",
          });
        } catch (e) {
          console.error("Failed to log draft", e);
        }
      }
    })().catch((e) => console.error("Background tee error", e));

    return new Response(streamA, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("ai-draft-chat error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
