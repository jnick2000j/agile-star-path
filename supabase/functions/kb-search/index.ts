// Knowledgebase semantic search + AI-grounded answer.
// Body: { query: string, organization_id: string, surface?: 'portal'|'agent'|'ticket_create'|'standalone', ticket_id?: string }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EMBED_MODEL = "google/text-embedding-004";
const CHAT_MODEL = "google/gemini-3-flash-preview";

async function embedOne(text: string): Promise<number[]> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) throw new Error("LOVABLE_API_KEY missing");
  const resp = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: EMBED_MODEL, input: [text] }),
  });
  if (!resp.ok) throw new Error(`Embed failed (${resp.status})`);
  const json = await resp.json();
  return json.data[0].embedding;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { query, organization_id, surface = "portal", ticket_id } = body || {};

    if (!query || typeof query !== "string" || !organization_id) {
      return new Response(JSON.stringify({ error: "query and organization_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user } } = await supabase.auth.getUser();

    // 1. Embed query
    const queryVec = await embedOne(query);

    // 2. Vector search
    const { data: matches, error: mErr } = await supabase.rpc("match_kb_chunks", {
      _org_id: organization_id,
      _query_embedding: queryVec as any,
      _match_threshold: 0.55,
      _match_count: 8,
    });

    if (mErr) {
      console.error("match_kb_chunks error:", mErr);
    }

    const chunks = matches ?? [];

    // Group into unique articles
    const articleMap = new Map<string, any>();
    for (const c of chunks) {
      if (!articleMap.has(c.article_id)) {
        articleMap.set(c.article_id, {
          id: c.article_id,
          title: c.title,
          summary: c.summary,
          category: c.category,
          visibility: c.visibility,
          similarity: c.similarity,
          chunks: [c.content],
        });
      } else {
        articleMap.get(c.article_id).chunks.push(c.content);
      }
    }
    const articles = Array.from(articleMap.values()).slice(0, 5);

    let aiAnswer = "";

    if (articles.length > 0) {
      // 3. Generate grounded answer
      const apiKey = Deno.env.get("LOVABLE_API_KEY");
      const context = articles
        .map((a, i) => `[${i + 1}] ${a.title}\n${a.chunks.join("\n")}`)
        .join("\n\n---\n\n");

      const systemPrompt = `You are a helpful support assistant. Answer the user's question using ONLY the knowledgebase articles provided in the context below. 
- Be concise (2-4 short paragraphs max).
- Cite sources inline like [1], [2] referring to article numbers.
- If the context does not contain the answer, say so plainly and suggest opening a ticket.
- Use markdown for formatting (lists, code blocks where helpful).`;

      const userPrompt = `Question: ${query}\n\nContext:\n${context}`;

      const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: CHAT_MODEL,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
        }),
      });

      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, please try again." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResp.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Add funds in Settings → Workspace → Usage." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResp.ok) {
        const aiJson = await aiResp.json();
        aiAnswer = aiJson?.choices?.[0]?.message?.content ?? "";
      }
    }

    // 4. Log search
    await supabase.from("kb_search_log").insert({
      organization_id,
      user_id: user?.id ?? null,
      query,
      surface,
      matched_article_ids: articles.map((a) => a.id),
      ai_answer: aiAnswer || null,
      ticket_id: ticket_id ?? null,
    });

    return new Response(
      JSON.stringify({
        answer: aiAnswer,
        articles: articles.map((a) => ({
          id: a.id,
          title: a.title,
          summary: a.summary,
          category: a.category,
          similarity: a.similarity,
        })),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("kb-search error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
