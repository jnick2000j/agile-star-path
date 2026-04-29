import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const ticketId: string = body.ticketId;
    const tone: string = body.tone || "professional";
    const length: string = body.length || "medium";
    const intent: string = body.intent || "reply";
    const customInstructions: string = body.customInstructions || "";

    if (!ticketId) {
      return new Response(JSON.stringify({ error: "ticketId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: ticket, error: terr } = await supabase
      .from("helpdesk_tickets")
      .select("id, subject, description, status, priority, type, reference_number, organization_id")
      .eq("id", ticketId)
      .maybeSingle();

    if (terr || !ticket) {
      return new Response(JSON.stringify({ error: "Ticket not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: comments = [] } = await supabase
      .from("helpdesk_ticket_comments")
      .select("body, is_internal, created_at, author_id")
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: true })
      .limit(20);

    // Search for relevant KB articles using simple keyword overlap
    const searchText = `${ticket.subject} ${ticket.description ?? ""}`.toLowerCase();
    const keywords = Array.from(new Set(
      searchText.split(/\W+/).filter((w) => w.length > 4)
    )).slice(0, 6);

    let kbArticles: any[] = [];
    if (keywords.length > 0) {
      const orFilter = keywords
        .map((k) => `title.ilike.%${k}%,summary.ilike.%${k}%,content.ilike.%${k}%`)
        .join(",");
      const { data: arts } = await supabase
        .from("kb_articles")
        .select("id, title, summary, content")
        .eq("organization_id", ticket.organization_id)
        .eq("status", "published")
        .or(orFilter)
        .limit(3);
      kbArticles = arts ?? [];
    }

    const kbContext = kbArticles.length > 0
      ? kbArticles.map((a, i) => `KB Article ${i + 1}: ${a.title}\nSummary: ${a.summary ?? ""}\n${(a.content ?? "").slice(0, 800)}`).join("\n\n---\n\n")
      : "No relevant KB articles found.";

    const conversationContext = comments
      .filter((c: any) => !c.is_internal)
      .map((c: any) => `[${c.created_at}] ${c.body}`)
      .join("\n\n");

    const lengthGuide: Record<string, string> = {
      short: "1-2 short paragraphs, under 80 words",
      medium: "2-3 paragraphs, 100-180 words",
      long: "3-5 paragraphs, 200-350 words with detailed steps",
    };

    const toneGuide: Record<string, string> = {
      professional: "Polite, clear, business-formal",
      friendly: "Warm, conversational, uses contractions",
      empathetic: "Acknowledge frustration, show understanding, then resolve",
      technical: "Precise technical language, step-by-step instructions",
      apologetic: "Apologize sincerely for the issue, take ownership, then resolve",
    };

    const intentGuide: Record<string, string> = {
      reply: "Respond to the customer's latest message with a helpful answer",
      acknowledge: "Acknowledge receipt and set expectations for next steps",
      request_info: "Politely request additional information needed to proceed",
      resolve: "Provide a complete resolution and ask the customer to confirm",
      escalate: "Inform the customer that the issue is being escalated",
    };

    const systemPrompt = `You are an expert customer support agent drafting a reply.
Tone: ${toneGuide[tone] || toneGuide.professional}
Length: ${lengthGuide[length] || lengthGuide.medium}
Intent: ${intentGuide[intent] || intentGuide.reply}

Guidelines:
- Address the customer directly. Do NOT include subject lines or "Hi [Name]" unless natural.
- Reference KB articles only when directly relevant; do NOT mention "KB Article" by number.
- Never invent facts. If unsure, ask for clarification.
- End with a clear next step or question.
- Output plain text only — no markdown headings.`;

    const userPrompt = `Ticket Reference: ${ticket.reference_number || ticket.id}
Subject: ${ticket.subject}
Priority: ${ticket.priority} | Type: ${ticket.type} | Status: ${ticket.status}

Original Description:
${ticket.description ?? "(none)"}

Conversation so far:
${conversationContext || "(no replies yet)"}

Relevant Knowledge Base:
${kbContext}

${customInstructions ? `Additional instructions from agent: ${customInstructions}` : ""}

Draft the reply now.`;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!aiResp.ok) {
      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResp.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Add credits in Settings → Workspace → Usage." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await aiResp.text();
      console.error("AI error:", aiResp.status, errText);
      return new Response(JSON.stringify({ error: "AI generation failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResp.json();
    const draft = aiData.choices?.[0]?.message?.content ?? "";

    return new Response(
      JSON.stringify({
        draft,
        kbArticlesUsed: kbArticles.map((a) => ({ id: a.id, title: a.title })),
        tone,
        length,
        intent,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("ai-reply-draft error:", e);
    return new Response(JSON.stringify({ error: e?.message ?? "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
