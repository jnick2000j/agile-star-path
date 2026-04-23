// Suggest KB articles for an in-progress ticket (subject + description).
// Body: { subject: string, description?: string, organization_id: string }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EMBED_MODEL = "google/text-embedding-004";

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
    const { subject, description, organization_id } = await req.json();
    if (!subject || !organization_id) {
      return new Response(JSON.stringify({ error: "subject and organization_id required" }), {
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

    const queryText = [subject, description].filter(Boolean).join("\n").slice(0, 2000);
    const queryVec = await embedOne(queryText);

    const { data: matches, error } = await supabase.rpc("match_kb_chunks", {
      _org_id: organization_id,
      _query_embedding: queryVec as any,
      _match_threshold: 0.5,
      _match_count: 6,
    });

    if (error) throw new Error(error.message);

    const seen = new Set<string>();
    const articles: any[] = [];
    for (const c of matches ?? []) {
      if (seen.has(c.article_id)) continue;
      seen.add(c.article_id);
      articles.push({
        id: c.article_id,
        title: c.title,
        summary: c.summary,
        category: c.category,
        similarity: Number(c.similarity?.toFixed(3) ?? 0),
      });
      if (articles.length >= 4) break;
    }

    return new Response(JSON.stringify({ articles }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("kb-suggest error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
