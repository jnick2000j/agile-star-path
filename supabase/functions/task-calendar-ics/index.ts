import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function fmtDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    "T" +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    "Z"
  );
}

function escapeIcs(s: string): string {
  return (s ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function toEvent(t: any, baseUrl: string): string {
  const start = t.planned_start ? new Date(t.planned_start) : null;
  const end = t.planned_end ? new Date(t.planned_end) : (start ? new Date(start.getTime() + 60 * 60 * 1000) : null);
  if (!start) return "";
  const status = t.status === "completed" ? "COMPLETED" : t.status === "cancelled" ? "CANCELLED" : "CONFIRMED";
  const url = `${baseUrl}/tasks?taskId=${t.id}`;
  return [
    "BEGIN:VEVENT",
    `UID:task-${t.id}@pimp`,
    `DTSTAMP:${fmtDate(new Date())}`,
    `DTSTART:${fmtDate(start)}`,
    end ? `DTEND:${fmtDate(end)}` : "",
    `SUMMARY:${escapeIcs(t.name ?? "Task")}`,
    `DESCRIPTION:${escapeIcs((t.description ?? "") + "\n\n" + url)}`,
    `URL:${url}`,
    `STATUS:${status}`,
    `PRIORITY:${t.priority === "high" || t.priority === "critical" ? 1 : t.priority === "low" ? 9 : 5}`,
    "END:VEVENT",
  ].filter(Boolean).join("\r\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  if (!token) {
    return new Response("Missing token", { status: 400, headers: corsHeaders });
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: tokenRow } = await admin
    .from("task_calendar_tokens")
    .select("user_id, organization_id, scope, revoked_at")
    .eq("token", token)
    .maybeSingle();

  if (!tokenRow || tokenRow.revoked_at) {
    return new Response("Invalid or revoked token", { status: 404, headers: corsHeaders });
  }

  let q = admin
    .from("tasks")
    .select("id, name, description, status, priority, planned_start, planned_end, assigned_to")
    .eq("organization_id", tokenRow.organization_id)
    .not("planned_start", "is", null)
    .limit(2000);

  if (tokenRow.scope === "my_tasks") {
    q = q.eq("assigned_to", tokenRow.user_id);
  }

  const { data: tasks, error } = await q;
  if (error) {
    return new Response(`Error: ${error.message}`, { status: 500, headers: corsHeaders });
  }

  // Best-effort access stamp
  await admin
    .from("task_calendar_tokens")
    .update({ last_accessed_at: new Date().toISOString() })
    .eq("token", token);

  const origin = req.headers.get("origin") || `https://${url.host}`;
  const baseUrl = origin.includes("supabase.co") ? "https://thetaskmaster.lovable.app" : origin;

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//PIMP//Task Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:PIMP Tasks`,
    "X-WR-TIMEZONE:UTC",
    ...(tasks ?? []).map((t) => toEvent(t, baseUrl)).filter(Boolean),
    "END:VCALENDAR",
  ].join("\r\n");

  return new Response(ics, {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="pimp-tasks.ics"',
      "Cache-Control": "no-cache, max-age=0",
    },
  });
});
