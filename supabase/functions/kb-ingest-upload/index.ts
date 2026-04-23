// Parse an uploaded file (text/markdown) from the kb-attachments bucket and create a draft article.
// Body: { storage_path: string, file_name: string, organization_id: string, mime_type?: string }
// For PDF/DOCX: stores attachment metadata; the user can then paste/edit text or supply text.
//
// To keep the implementation lightweight in-edge, this function:
//   - extracts text from .txt, .md, .markdown, .html (basic strip), .json directly
//   - for binary types (.pdf, .docx) it returns success with a hint that text body should be entered manually
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function isTextual(mime: string | undefined, name: string): boolean {
  const lower = (name || "").toLowerCase();
  return (
    /^text\//.test(mime || "") ||
    lower.endsWith(".md") ||
    lower.endsWith(".markdown") ||
    lower.endsWith(".txt") ||
    lower.endsWith(".html") ||
    lower.endsWith(".htm") ||
    lower.endsWith(".json")
  );
}

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { storage_path, file_name, organization_id, mime_type } = await req.json();
    if (!storage_path || !file_name || !organization_id) {
      return new Response(JSON.stringify({ error: "storage_path, file_name, organization_id required" }), {
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

    let extractedText = "";
    let parsed = false;

    if (isTextual(mime_type, file_name)) {
      const { data: file, error: dlErr } = await supabase.storage
        .from("kb-attachments")
        .download(storage_path);
      if (dlErr) throw new Error("Download failed: " + dlErr.message);

      const raw = await file.text();
      extractedText = file_name.toLowerCase().endsWith(".html") || file_name.toLowerCase().endsWith(".htm")
        ? htmlToText(raw)
        : raw;
      parsed = true;
    }

    const title = file_name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim();

    const { data: article, error: insErr } = await supabase
      .from("kb_articles")
      .insert({
        organization_id,
        title,
        body: extractedText || `(Original file: ${file_name})\n\nAdd article content here based on the uploaded document.`,
        status: "draft",
        visibility: "internal",
        source: "uploaded",
        author_user_id: user?.id ?? null,
        last_edited_by: user?.id ?? null,
      })
      .select()
      .single();

    if (insErr) throw new Error(insErr.message);

    await supabase.from("kb_attachments").insert({
      article_id: article.id,
      organization_id,
      storage_path,
      file_name,
      mime_type: mime_type ?? null,
      uploaded_by: user?.id ?? null,
      parsed,
    });

    return new Response(JSON.stringify({ article, parsed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("kb-ingest-upload error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
