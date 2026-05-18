import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, ensureFreshToken, type Provider } from "../_shared/calendar.ts";

// Pulls changes from provider for previously-linked task events; updates planned_start/end if changed.
async function pullOne(supabase: any, conn: any) {
  const token = await ensureFreshToken(supabase, conn);
  if (!token) return;

  // Load all links for this user+provider
  const { data: links } = await supabase
    .from("task_calendar_event_links")
    .select("id, task_id, google_event_id")
    .eq("user_id", conn.user_id)
    .eq("provider", conn.provider);
  if (!links?.length) return;

  for (const l of links) {
    let evStart: string | null = null;
    let evEnd: string | null = null;
    let deleted = false;
    if (conn.provider === "google") {
      const calId = encodeURIComponent(conn.target_calendar_id || "primary");
      const r = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${calId}/events/${l.google_event_id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.status === 404 || r.status === 410) deleted = true;
      else if (r.ok) {
        const j = await r.json();
        if (j.status === "cancelled") deleted = true;
        else {
          evStart = j.start?.dateTime || j.start?.date || null;
          evEnd = j.end?.dateTime || j.end?.date || null;
        }
      }
    } else {
      const r = await fetch(`https://graph.microsoft.com/v1.0/me/events/${l.google_event_id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.status === 404 || r.status === 410) deleted = true;
      else if (r.ok) {
        const j = await r.json();
        evStart = j.start?.dateTime ? `${j.start.dateTime}Z` : null;
        evEnd = j.end?.dateTime ? `${j.end.dateTime}Z` : null;
      }
    }
    if (deleted) {
      await supabase.from("task_calendar_event_links").delete().eq("id", l.id);
      continue;
    }
    if (evStart) {
      await supabase.from("tasks").update({
        planned_start: evStart,
        planned_end: evEnd,
      }).eq("id", l.task_id);
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
    if (!conn) return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    await pullOne(svc, conn);
    await svc.from("user_calendar_connections").update({ last_synced_at: new Date().toISOString() }).eq("id", conn.id);
    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
