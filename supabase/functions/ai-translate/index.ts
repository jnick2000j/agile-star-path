// Phase 5 — On-demand AI translation for any text snippet.
// Used by the AISummaryPanel language switcher and by ai-summarize after approval.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { evaluateResidency } from "../_shared/residency.ts";
import { consumeAiCredits } from "../_shared/credits.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MODEL = "google/gemini-2.5-flash";

const LANGUAGE_NAMES: Record<string, string> = {
  en: "English",
  es: "Spanish",
  fr: "French",
  de: "German",
  pt: "Portuguese",
};

interface Body {
  text: string;
  target_language: string; // ISO code, e.g. "es"
  // Optional: cache the result on an ai_summaries row.
  summary_id?: string;
  organization_id?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authClient = createClient(supabaseUrl, anon, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await authClient.auth.getUser();
    if (!userData?.user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as Body;
    if (!body?.text || !body?.target_language) {
      return new Response(JSON.stringify({ error: "Missing text or target_language" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Residency policy check (skip if no org context — global op).
    if (body.organization_id) {
      const residency = await evaluateResidency({
        supabase: authClient,
        organizationId: body.organization_id,
        userId: userData.user.id,
        operation: "ai-translate",
        resourceType: "ai_summary",
        resourceId: body.summary_id,
        metadata: { target_language: body.target_language },
      });
      if (!residency.ok) {
        return new Response(
          JSON.stringify({ error: residency.message, code: "residency_blocked", org_region: residency.org_region }),
          { status: residency.status ?? 451, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // AI credits guard (only when there's an org context).
      const credits = await consumeAiCredits({
        supabase: authClient,
        organizationId: body.organization_id,
        userId: userData.user.id,
        actionType: "ai-translate",
        metadata: { target_language: body.target_language, summary_id: body.summary_id ?? null },
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
    }

    const langName = LANGUAGE_NAMES[body.target_language] ?? body.target_language;

    // Cache hit — return early if we already have this translation stored.
    const supabase = createClient(supabaseUrl, serviceKey);
    if (body.summary_id) {
      const { data: existing } = await supabase
        .from("ai_summaries")
        .select("translations")
        .eq("id", body.summary_id)
        .maybeSingle();
      const cached = (existing?.translations as Record<string, { content: string }> | null)?.[
        body.target_language
      ];
      if (cached?.content) {
        return new Response(JSON.stringify({ content: cached.content, cached: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: "system",
            content: `You are a professional translator for a project & programme management platform.
Translate the user's text into ${langName}. Preserve markdown formatting, headings, bullet points, terminology and any product names.
Return ONLY the translated text — no preamble.`,
          },
          { role: "user", content: body.text },
        ],
      }),
    });

    if (aiResp.status === 429) {
      return new Response(JSON.stringify({ error: "rate_limited" }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (aiResp.status === 402) {
      return new Response(JSON.stringify({ error: "payment_required" }), {
        status: 402,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!aiResp.ok) {
      const t = await aiResp.text();
      console.error("ai-translate gateway", aiResp.status, t);
      return new Response(JSON.stringify({ error: "gateway_error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const aiData = await aiResp.json();
    const content: string = aiData?.choices?.[0]?.message?.content ?? "";

    // Persist translation in cache if we have a summary id.
    if (body.summary_id && content) {
      const { data: row } = await supabase
        .from("ai_summaries")
        .select("translations")
        .eq("id", body.summary_id)
        .maybeSingle();
      const merged = {
        ...((row?.translations as Record<string, unknown>) ?? {}),
        [body.target_language]: { content, translated_at: new Date().toISOString() },
      };
      await supabase.from("ai_summaries").update({ translations: merged }).eq("id", body.summary_id);
    }

    return new Response(JSON.stringify({ content, cached: false }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-translate error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
