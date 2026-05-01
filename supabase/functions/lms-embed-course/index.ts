// Embed a published LMS course into the shared KB vector index so the same
// semantic search (match_kb_chunks) returns LMS hits alongside KB articles.
// Body: { course_id: string }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EMBED_MODEL = "google/text-embedding-004"; // 768 dim
const CHUNK_SIZE = 900;
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
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
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
    const { course_id } = await req.json();
    if (!course_id) {
      return new Response(JSON.stringify({ error: "course_id required" }), {
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

    const { data: course, error: cErr } = await supabase
      .from("lms_courses")
      .select("id, organization_id, title, description, category, status")
      .eq("id", course_id)
      .single();
    if (cErr || !course) throw new Error(cErr?.message || "Course not found");

    // Wipe existing chunks
    await supabase.from("lms_course_chunks").delete().eq("course_id", course.id);

    // If unpublished, just disable indexing and stop
    if (course.status !== "published") {
      await supabase
        .from("lms_courses")
        .update({ kb_index_status: "disabled", kb_indexed_at: new Date().toISOString() })
        .eq("id", course.id);
      return new Response(JSON.stringify({ ok: true, chunks: 0, status: "disabled" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Pull modules & lessons (only document/quiz lessons carry searchable text).
    const { data: modules } = await supabase
      .from("lms_modules")
      .select("id, title, description, position")
      .eq("course_id", course.id)
      .order("position");

    const { data: lessons } = await supabase
      .from("lms_lessons")
      .select("id, module_id, title, lesson_type, content_md, position")
      .eq("course_id", course.id)
      .order("position");

    // Build chunked rows tagged with source_kind for traceability.
    type Pending = { kind: "course" | "module" | "lesson"; sourceId: string; chunks: string[] };
    const pending: Pending[] = [];

    const courseHeader = [
      `Course: ${course.title}`,
      course.category ? `Category: ${course.category}` : "",
      course.description ?? "",
    ].filter(Boolean).join("\n");
    pending.push({ kind: "course", sourceId: course.id, chunks: chunkText(courseHeader) });

    for (const m of modules ?? []) {
      const txt = [`Module: ${m.title}`, m.description ?? ""].filter(Boolean).join("\n");
      const cs = chunkText(txt);
      if (cs.length) pending.push({ kind: "module", sourceId: m.id, chunks: cs });
    }
    for (const l of lessons ?? []) {
      const body =
        l.lesson_type === "document" || l.lesson_type === "quiz"
          ? l.content_md ?? ""
          : ""; // video chunks have no text body to embed
      const txt = [`Lesson: ${l.title}`, body].filter(Boolean).join("\n");
      const cs = chunkText(txt);
      if (cs.length) pending.push({ kind: "lesson", sourceId: l.id, chunks: cs });
    }

    // Flatten + embed
    const flat: { kind: string; sourceId: string; chunkIndex: number; content: string }[] = [];
    let runningIdx = 0;
    for (const p of pending) {
      for (const c of p.chunks) {
        flat.push({ kind: p.kind, sourceId: p.sourceId, chunkIndex: runningIdx++, content: c });
      }
    }

    if (flat.length === 0) {
      await supabase
        .from("lms_courses")
        .update({ kb_index_status: "indexed", kb_indexed_at: new Date().toISOString() })
        .eq("id", course.id);
      return new Response(JSON.stringify({ ok: true, chunks: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const embeddings: number[][] = [];
    for (let i = 0; i < flat.length; i += 16) {
      const batch = flat.slice(i, i + 16).map((x) => x.content);
      const vecs = await embed(batch);
      embeddings.push(...vecs);
    }

    const rows = flat.map((x, idx) => ({
      course_id: course.id,
      organization_id: course.organization_id,
      source_kind: x.kind,
      source_id: x.sourceId,
      chunk_index: x.chunkIndex,
      content: x.content,
      embedding: embeddings[idx] as any,
      token_estimate: Math.ceil(x.content.length / 4),
    }));

    const { error: insErr } = await supabase.from("lms_course_chunks").insert(rows);
    if (insErr) throw new Error(insErr.message);

    await supabase
      .from("lms_courses")
      .update({ kb_index_status: "indexed", kb_indexed_at: new Date().toISOString() })
      .eq("id", course.id);

    return new Response(JSON.stringify({ ok: true, chunks: rows.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("lms-embed-course error:", e);
    // Best-effort: mark error so UI/cron can retry
    try {
      const body = await req.clone().json();
      if (body?.course_id) {
        const supabase = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        );
        await supabase
          .from("lms_courses")
          .update({ kb_index_status: "error" })
          .eq("id", body.course_id);
      }
    } catch { /* ignore */ }
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
