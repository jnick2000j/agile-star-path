// AI-powered KB article suggestions for tickets/queries.
// Uses Lovable AI to extract key terms, then ranks articles by keyword + recency + helpfulness.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (status: number, body: any) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

interface Body {
  organization_id: string;
  query: string;          // ticket subject + description, or partial reply text
  ticket_id?: string;
  context?: "agent_reply" | "ticket_create" | "search";
  limit?: number;
}

async function extractKeywords(text: string, apiKey: string): Promise<string[]> {
  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: "Extract 3-7 highly relevant search keywords or short phrases from the user's text. Focus on technical terms, error messages, product names, and the core problem. Ignore filler." },
        { role: "user", content: text.slice(0, 4000) },
      ],
      tools: [{
        type: "function",
        function: {
          name: "return_keywords",
          description: "Return search keywords",
          parameters: {
            type: "object",
            properties: {
              keywords: { type: "array", items: { type: "string" } },
              intent: { type: "string", description: "One-line summary of what the user wants" },
            },
            required: ["keywords"],
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "return_keywords" } },
    }),
  });
  if (!resp.ok) {
    if (resp.status === 429 || resp.status === 402) {
      throw new Error(resp.status === 402 ? "ai_credits_exhausted" : "ai_rate_limited");
    }
    throw new Error(`AI gateway ${resp.status}`);
  }
  const data = await resp.json();
  const args = data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  if (!args) return [];
  try {
    const parsed = JSON.parse(args);
    return Array.isArray(parsed.keywords) ? parsed.keywords : [];
  } catch {
    return [];
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) return json(500, { error: "ai_not_configured" });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Auth
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json(401, { error: "unauthorized" });
  const { data: claims } = await supabase.auth.getClaims(authHeader.slice(7));
  if (!claims?.claims) return json(401, { error: "unauthorized" });

  let body: Body;
  try { body = await req.json(); } catch { return json(400, { error: "invalid_json" }); }
  if (!body.query || body.query.length < 5) return json(400, { error: "query_too_short" });
  if (!body.organization_id) return json(400, { error: "missing_org" });

  const limit = Math.min(body.limit || 5, 10);

  let keywords: string[] = [];
  try {
    keywords = await extractKeywords(body.query, apiKey);
  } catch (e: any) {
    if (e.message === "ai_credits_exhausted") return json(402, { error: "AI credits exhausted. Please add funds to your workspace." });
    if (e.message === "ai_rate_limited") return json(429, { error: "AI rate limit reached. Try again shortly." });
    console.error("keyword extraction failed:", e);
    // Fallback: take longest words
    keywords = body.query
      .toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 4)
      .slice(0, 5);
  }

  if (!keywords.length) return json(200, { suggestions: [], keywords: [] });

  // Search published, internally visible articles via OR of ILIKE on title/summary/body/tags
  // Build OR filter for title/summary
  const orFilter = keywords
    .slice(0, 6)
    .map((k) => `title.ilike.%${k.replace(/[%,]/g, "")}%,summary.ilike.%${k.replace(/[%,]/g, "")}%`)
    .join(",");

  const { data: articles, error } = await supabase
    .from("kb_articles")
    .select("id, title, slug, summary, category, tags, view_count, helpful_count, not_helpful_count, published_at")
    .eq("organization_id", body.organization_id)
    .eq("status", "published")
    .or(orFilter)
    .limit(30);

  if (error) {
    console.error("kb search error:", error);
    return json(500, { error: "search_failed", message: error.message });
  }

  // Rank: keyword match count + helpfulness ratio + log(view_count)
  const ranked = (articles || []).map((a: any) => {
    const haystack = `${a.title} ${a.summary || ""} ${(a.tags || []).join(" ")}`.toLowerCase();
    let matches = 0;
    for (const k of keywords) {
      if (haystack.includes(k.toLowerCase())) matches++;
    }
    const totalVotes = (a.helpful_count || 0) + (a.not_helpful_count || 0);
    const helpfulRatio = totalVotes > 0 ? a.helpful_count / totalVotes : 0.5;
    const popularity = Math.log10((a.view_count || 0) + 10);
    const score = matches * 10 + helpfulRatio * 3 + popularity;
    return { ...a, _score: score, _matches: matches };
  })
    .filter((a) => a._matches > 0)
    .sort((a, b) => b._score - a._score)
    .slice(0, limit);

  // Log query for analytics
  if (ranked.length) {
    try {
      await supabase.from("kb_search_log").insert({
        organization_id: body.organization_id,
        query: body.query.slice(0, 500),
        surface: body.context || "ai_suggest",
        matched_article_ids: ranked.map((a) => a.id),
        ticket_id: body.ticket_id || null,
        user_id: claims.claims.sub,
      });
    } catch (e) { /* best-effort */ }
  }

  return json(200, {
    suggestions: ranked.map(({ _score, _matches, ...a }) => a),
    keywords,
  });
});
