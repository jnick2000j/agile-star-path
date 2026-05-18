import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, ensureFreshToken, type Provider } from "../_shared/calendar.ts";

function toIso(d: string | null, fallbackHour: number): string | null {
  if (!d) return null;
  // If already has time component
  if (d.includes("T")) return new Date(d).toISOString();
  const dt = new Date(`${d}T${String(fallbackHour).padStart(2, "0")}:00:00Z`);
  return dt.toISOString();
}

async function pushOne(supabase: any, conn: any, task: any) {
  const token = await ensureFreshToken(supabase, conn);
  if (!token) return;
  const start = toIso(task.planned_start, 9);
  const end = toIso(task.planned_end || task.planned_start, 17);
  if (!start) return;

  // Find existing event link
  const { data: link } = await supabase
    .from("task_calendar_event_links")
    .select("*")
    .eq("task_id", task.id)
    .eq("user_id", conn.user_id)
    .eq("provider", conn.provider)
    .maybeSingle();

  if (conn.provider === "google") {
    const calId = encodeURIComponent(conn.target_calendar_id || "primary");
    const body = {
      summary: task.name,
      description: task.description || "",
      start: { dateTime: start },
      end: { dateTime: end },
    };
    if (link?.google_event_id) {
      const r = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${calId}/events/${link.google_event_id}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (r.ok) await supabase.from("task_calendar_event_links").update({ last_pushed_at: new Date().toISOString() }).eq("id", link.id);
    } else {
      const r = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${calId}/events`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (r.ok) {
        const j = await r.json();
        await supabase.from("task_calendar_event_links").insert({
          task_id: task.id, user_id: conn.user_id, provider: "google",
          google_event_id: j.id, last_pushed_at: new Date().toISOString(),
        });
      }
    }
  } else {
    const body = {
      subject: task.name,
      body: { contentType: "Text", content: task.description || "" },
      start: { dateTime: start.replace("Z", ""), timeZone: "UTC" },
      end: { dateTime: end.replace("Z", ""), timeZone: "UTC" },
    };
    if (link?.google_event_id) {
      const r = await fetch(`https://graph.microsoft.com/v1.0/me/events/${link.google_event_id}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (r.ok) await supabase.from("task_calendar_event_links").update({ last_pushed_at: new Date().toISOString() }).eq("id", link.id);
    } else {
      const r = await fetch(`https://graph.microsoft.com/v1.0/me/events`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (r.ok) {
        const j = await r.json();
        await supabase.from("task_calendar_event_links").insert({
          task_id: task.id, user_id: conn.user_id, provider: "microsoft",
          google_event_id: j.id, last_pushed_at: new Date().toISOString(),
        });
      }
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: claims } = await userClient.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (!claims?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const user_id = claims.claims.sub as string;
    const { provider } = await req.json() as { provider: Provider };

    const svc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: conn } = await svc.from("user_calendar_connections").select("*")
      .eq("user_id", user_id).eq("provider", provider).maybeSingle();
    if (!conn || !conn.sync_enabled) {
      return new Response(JSON.stringify({ pushed: 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const { data: tasks } = await svc.from("tasks")
      .select("id, name, description, planned_start, planned_end, status, assigned_to")
      .eq("assigned_to", user_id)
      .not("planned_start", "is", null)
      .limit(500);

    let pushed = 0;
    for (const t of (tasks || [])) {
      try { await pushOne(svc, conn, t); pushed++; } catch { /* per-task continue */ }
    }
    await svc.from("user_calendar_connections").update({ last_synced_at: new Date().toISOString(), last_error: null }).eq("id", conn.id);
    return new Response(JSON.stringify({ pushed }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
