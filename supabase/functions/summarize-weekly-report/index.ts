import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Validate JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { report_id, week_ending, programme_id } = await req.json();
    
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    
    if (!lovableKey) throw new Error("LOVABLE_API_KEY not configured");

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Calculate week start (7 days before week_ending)
    const weekEnd = new Date(week_ending);
    const weekStart = new Date(weekEnd);
    weekStart.setDate(weekStart.getDate() - 7);
    const startISO = weekStart.toISOString();
    const endISO = weekEnd.toISOString();

    // Fetch tasks due/updated this week
    const { data: tasks } = await supabase
      .from("tasks")
      .select("name, status, priority, planned_end, programme_id, project_id, product_id")
      .or(`planned_end.gte.${startISO},planned_end.lte.${endISO},updated_at.gte.${startISO}`);

    // Fetch milestones due this week
    const { data: milestones } = await supabase
      .from("milestones")
      .select("name, status, target_date, actual_date, programme_id, project_id")
      .gte("target_date", week_ending)
      .lte("target_date", new Date(weekEnd.getTime() + 14 * 86400000).toISOString().split("T")[0]);

    // Fetch entity updates from this week
    const { data: entityUpdates } = await supabase
      .from("entity_updates")
      .select("entity_type, update_text, created_at")
      .gte("created_at", startISO)
      .lte("created_at", endISO)
      .order("created_at", { ascending: false })
      .limit(100);

    // Fetch projects and programmes for context
    const { data: projects } = await supabase
      .from("projects")
      .select("name, stage, health, priority")
      .eq("programme_id", programme_id);

    const { data: programme } = await supabase
      .from("programmes")
      .select("name, status, progress")
      .eq("id", programme_id)
      .single();

    // Fetch products
    const { data: products } = await supabase
      .from("products")
      .select("name, status, stage")
      .eq("programme_id", programme_id);

    // Fetch open risks/issues
    const { data: risks } = await supabase
      .from("risks")
      .select("title, score, status")
      .eq("programme_id", programme_id)
      .in("status", ["open", "mitigating"])
      .order("score", { ascending: false })
      .limit(10);

    const { data: issues } = await supabase
      .from("issues")
      .select("title, priority, status")
      .eq("programme_id", programme_id)
      .in("status", ["open", "investigating", "pending"])
      .limit(10);

    const taskUpdates = entityUpdates?.filter(u => u.entity_type === "task") || [];
    const projectUpdates = entityUpdates?.filter(u => u.entity_type === "project") || [];
    const programmeUpdates = entityUpdates?.filter(u => u.entity_type === "programme") || [];
    const productUpdates = entityUpdates?.filter(u => u.entity_type === "product") || [];

    const prompt = `Generate a concise weekly status report summary for the programme "${programme?.name || "Unknown"}".

Week ending: ${week_ending}

PROGRAMME STATUS: ${programme?.status || "N/A"}, Progress: ${programme?.progress || 0}%

PROJECTS (${projects?.length || 0}):
${projects?.map(p => `- ${p.name}: Stage=${p.stage}, Health=${p.health}, Priority=${p.priority}`).join("\n") || "None"}

PRODUCTS (${products?.length || 0}):
${products?.map(p => `- ${p.name}: Status=${p.status}, Stage=${p.stage}`).join("\n") || "None"}

TASKS DUE/UPDATED THIS WEEK (${tasks?.length || 0}):
${tasks?.slice(0, 20).map(t => `- ${t.name}: Status=${t.status}, Priority=${t.priority}, Due=${t.planned_end || "N/A"}`).join("\n") || "None"}

UPCOMING MILESTONES:
${milestones?.map(m => `- ${m.name}: Status=${m.status}, Target=${m.target_date}, Actual=${m.actual_date || "Pending"}`).join("\n") || "None"}

TOP RISKS:
${risks?.map(r => `- ${r.title} (Score: ${r.score}, Status: ${r.status})`).join("\n") || "None"}

OPEN ISSUES:
${issues?.map(i => `- ${i.title} (Priority: ${i.priority}, Status: ${i.status})`).join("\n") || "None"}

RECENT PROGRESS UPDATES:
Task updates: ${taskUpdates.map(u => u.update_text).join("; ") || "None"}
Project updates: ${projectUpdates.map(u => u.update_text).join("; ") || "None"}
Programme updates: ${programmeUpdates.map(u => u.update_text).join("; ") || "None"}
Product updates: ${productUpdates.map(u => u.update_text).join("; ") || "None"}

Please provide:
1. **ai_summary**: A 2-3 paragraph executive summary of the overall programme status
2. **task_summary**: A brief summary of task progress and upcoming deadlines
3. **project_summary**: A brief summary of project health and milestones
4. **programme_summary**: A brief summary of programme-level progress
5. **product_summary**: A brief summary of product development status

Return as a JSON object with those 5 keys.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You are a programme management assistant. Generate professional status report summaries. Always respond with valid JSON." },
          { role: "user", content: prompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "generate_summary",
            description: "Generate weekly report summaries",
            parameters: {
              type: "object",
              properties: {
                ai_summary: { type: "string", description: "Executive summary" },
                task_summary: { type: "string", description: "Task progress summary" },
                project_summary: { type: "string", description: "Project health summary" },
                programme_summary: { type: "string", description: "Programme progress summary" },
                product_summary: { type: "string", description: "Product development summary" },
              },
              required: ["ai_summary", "task_summary", "project_summary", "programme_summary", "product_summary"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "generate_summary" } },
      }),
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Please try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway error: ${status}`);
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    let summaries;
    
    if (toolCall?.function?.arguments) {
      summaries = JSON.parse(toolCall.function.arguments);
    } else {
      const content = aiData.choices?.[0]?.message?.content || "";
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      summaries = jsonMatch ? JSON.parse(jsonMatch[0]) : {
        ai_summary: content,
        task_summary: "No task data available.",
        project_summary: "No project data available.",
        programme_summary: "No programme data available.",
        product_summary: "No product data available.",
      };
    }

    // Update the weekly report with summaries
    if (report_id) {
      await supabase.from("weekly_reports").update({
        ai_summary: summaries.ai_summary,
        task_summary: summaries.task_summary,
        project_summary: summaries.project_summary,
        programme_summary: summaries.programme_summary,
        product_summary: summaries.product_summary,
      }).eq("id", report_id);
    }

    return new Response(JSON.stringify({ success: true, summaries }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: "An error occurred" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
