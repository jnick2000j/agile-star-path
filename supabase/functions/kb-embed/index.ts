// Embed a KB article: split body into chunks, call Lovable AI Gateway embeddings,
// store vectors in kb_article_chunks, mark article as indexed.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EMBED_MODEL = "google/text-embedding-004"; // 768 dim
const CHUNK_SIZE = 900; // chars
const CHUNK_OVERLAP = 150;

function chunkText(text: string): string[] {
  const clean = (text || "").replace(/\s+/g, " ").trim();
  if (!clean) return [];
  const chunks: string[] = [];
  let i = 0;
  while (i < clean.length) {
    chunks.push(clean.slice(i, i + CHUNK_SIZE));
    i += CHUNK_SIZE - CHUNK_OVERLAP;
  }
  return chunks;
}

async function embed(texts: string[]): Promise<number[][]> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) throw new Error("LOVABLE_API_KEY missing");

  const resp = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: EMBED_MODEL, input: texts }),
  });

  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`Embedding failed (${resp.status}): ${t.slice(0, 300)}`);
  }
  const json = await resp.json();
  return (json.data ?? []).map((d: any) => d.embedding);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { article_id } = await req.json();
    if (!article_id) {
      return new Response(JSON.stringify({ error: "article_id required" }), {
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

    const { data: article, error: aErr } = await supabase
      .from("kb_articles")
      .select("id, organization_id, title, summary, body")
      .eq("id", article_id)
      .single();

    if (aErr || !article) throw new Error(aErr?.message || "Article not found");

    // Compose source text: title + summary + body
    const source = [article.title, article.summary, article.body].filter(Boolean).join("\n\n");
    const chunks = chunkText(source);

    // Wipe old chunks
    await supabase.from("kb_article_chunks").delete().eq("article_id", article.id);

    if (chunks.length === 0) {
      await supabase
        .from("kb_articles")
        .update({ embedding_status: "indexed", embedding_updated_at: new Date().toISOString() })
        .eq("id", article.id);
      return new Response(JSON.stringify({ ok: true, chunks: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Embed in batches of 16
    const allEmbeddings: number[][] = [];
    for (let i = 0; i < chunks.length; i += 16) {
      const batch = chunks.slice(i, i + 16);
      const vecs = await embed(batch);
      allEmbeddings.push(...vecs);
    }

    const rows = chunks.map((content, idx) => ({
      article_id: article.id,
      organization_id: article.organization_id,
      chunk_index: idx,
      content,
      embedding: allEmbeddings[idx] as any,
      token_estimate: Math.ceil(content.length / 4),
    }));

    const { error: insErr } = await supabase.from("kb_article_chunks").insert(rows);
    if (insErr) throw new Error(insErr.message);

    await supabase
      .from("kb_articles")
      .update({ embedding_status: "indexed", embedding_updated_at: new Date().toISOString() })
      .eq("id", article.id);

    return new Response(JSON.stringify({ ok: true, chunks: chunks.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("kb-embed error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
