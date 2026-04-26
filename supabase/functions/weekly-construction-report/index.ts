// Weekly Construction Progress Report
// Generates a per-project weekly digest covering RFIs, submittals, daily logs and punch-list items
// for every active construction-vertical project, and emails it to configured stakeholders.
//
// Scheduled weekly via pg_cron. Can also be triggered manually with `{ project_id: "..." }`.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendEmail, isEmailConfigured } from "../_shared/email.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ProjectRow {
  id: string;
  name: string;
  organization_id: string;
  stage: string | null;
  health: string | null;
  start_date: string | null;
  end_date: string | null;
}

function fmtDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function htmlEscape(s: string | null | undefined) {
  if (!s) return "";
  return String(s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function buildHtml(opts: {
  project: ProjectRow;
  periodStart: string;
  periodEnd: string;
  rfis: any[];
  submittals: any[];
  dailyLogs: any[];
  punch: any[];
}) {
  const { project, periodStart, periodEnd, rfis, submittals, dailyLogs, punch } = opts;

  const rfisOpen = rfis.filter((r) => ["open", "draft"].includes(r.status)).length;
  const rfisAnswered = rfis.filter((r) => r.status === "answered" || r.status === "closed").length;
  const subPending = submittals.filter((s) => ["pending", "under_review"].includes(s.status)).length;
  const subApproved = submittals.filter((s) => s.status === "approved").length;
  const subRejected = submittals.filter((s) => ["rejected", "revise_resubmit"].includes(s.status)).length;
  const punchOpen = punch.filter((p) => ["open", "in_progress"].includes(p.status)).length;
  const punchClosed = punch.filter((p) => ["complete", "verified"].includes(p.status)).length;
  const totalCrew = dailyLogs.reduce((a: number, l: any) => a + (l.crew_count || 0), 0);
  const totalHours = dailyLogs.reduce((a: number, l: any) => a + Number(l.hours_worked || 0), 0);
  const safetyIncidents = dailyLogs
    .filter((l) => l.safety_incidents && String(l.safety_incidents).trim())
    .map((l) => l.safety_incidents);

  const renderList = (items: string[]) =>
    items.length === 0
      ? `<li style="color:#6b7280;">None</li>`
      : items.map((i) => `<li>${htmlEscape(i)}</li>`).join("");

  return `<!doctype html>
<html><body style="font-family:Inter,Arial,sans-serif;background:#f9fafb;margin:0;padding:24px;color:#111827;">
  <div style="max-width:680px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
    <div style="padding:24px 28px;background:linear-gradient(135deg,#1f2937,#111827);color:#fff;">
      <div style="font-size:12px;letter-spacing:0.06em;text-transform:uppercase;opacity:0.8;">Weekly Construction Progress</div>
      <div style="font-size:22px;font-weight:700;margin-top:4px;">${htmlEscape(project.name)}</div>
      <div style="font-size:13px;opacity:0.85;margin-top:4px;">${periodStart} → ${periodEnd}</div>
    </div>

    <div style="padding:20px 28px;">
      <h3 style="margin:0 0 8px;font-size:14px;color:#374151;text-transform:uppercase;letter-spacing:0.04em;">Headline</h3>
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
        <tr>
          <td style="padding:10px;background:#f3f4f6;border-radius:8px;width:25%;text-align:center;">
            <div style="font-size:22px;font-weight:700;">${rfisOpen}</div>
            <div style="font-size:11px;color:#6b7280;">Open RFIs</div>
          </td>
          <td style="width:8px;"></td>
          <td style="padding:10px;background:#f3f4f6;border-radius:8px;width:25%;text-align:center;">
            <div style="font-size:22px;font-weight:700;">${subPending}</div>
            <div style="font-size:11px;color:#6b7280;">Submittals in Review</div>
          </td>
          <td style="width:8px;"></td>
          <td style="padding:10px;background:#f3f4f6;border-radius:8px;width:25%;text-align:center;">
            <div style="font-size:22px;font-weight:700;">${punchOpen}</div>
            <div style="font-size:11px;color:#6b7280;">Punch List Open</div>
          </td>
          <td style="width:8px;"></td>
          <td style="padding:10px;background:#f3f4f6;border-radius:8px;width:25%;text-align:center;">
            <div style="font-size:22px;font-weight:700;">${dailyLogs.length}</div>
            <div style="font-size:11px;color:#6b7280;">Daily Logs</div>
          </td>
        </tr>
      </table>

      <h3 style="margin:0 0 6px;font-size:14px;color:#374151;text-transform:uppercase;letter-spacing:0.04em;">RFIs</h3>
      <p style="margin:0 0 12px;color:#4b5563;font-size:13px;">
        ${rfisAnswered} answered/closed, ${rfisOpen} still open this week.
      </p>
      <ul style="margin:0 0 18px 20px;padding:0;font-size:13px;line-height:1.6;">
        ${renderList(rfis.slice(0, 5).map((r) => `${r.rfi_number}: ${r.subject} (${r.status})`))}
      </ul>

      <h3 style="margin:0 0 6px;font-size:14px;color:#374151;text-transform:uppercase;letter-spacing:0.04em;">Submittals</h3>
      <p style="margin:0 0 12px;color:#4b5563;font-size:13px;">
        ${subApproved} approved · ${subPending} in review · ${subRejected} need revision.
      </p>
      <ul style="margin:0 0 18px 20px;padding:0;font-size:13px;line-height:1.6;">
        ${renderList(submittals.slice(0, 5).map((s) => `${s.submittal_number}: ${s.title} (${s.status})`))}
      </ul>

      <h3 style="margin:0 0 6px;font-size:14px;color:#374151;text-transform:uppercase;letter-spacing:0.04em;">Punch List</h3>
      <p style="margin:0 0 12px;color:#4b5563;font-size:13px;">
        ${punchClosed} cleared · ${punchOpen} still outstanding.
      </p>
      <ul style="margin:0 0 18px 20px;padding:0;font-size:13px;line-height:1.6;">
        ${renderList(punch.slice(0, 5).map((p) => `${p.item_number ?? "—"}: ${p.description} (${p.status})`))}
      </ul>

      <h3 style="margin:0 0 6px;font-size:14px;color:#374151;text-transform:uppercase;letter-spacing:0.04em;">Site Activity</h3>
      <p style="margin:0 0 8px;color:#4b5563;font-size:13px;">
        Crew hours logged: <strong>${totalHours.toFixed(1)}</strong> across <strong>${totalCrew}</strong> crew check-ins.
      </p>
      ${safetyIncidents.length > 0
        ? `<p style="background:#fef2f2;color:#991b1b;padding:10px;border-radius:8px;font-size:13px;"><strong>Safety incidents:</strong> ${htmlEscape(safetyIncidents.join("; "))}</p>`
        : `<p style="color:#065f46;font-size:13px;">No safety incidents reported this week.</p>`}
    </div>

    <div style="padding:14px 28px;background:#f9fafb;font-size:11px;color:#6b7280;text-align:center;border-top:1px solid #e5e7eb;">
      Generated automatically by TaskMaster · ${new Date().toUTCString()}
    </div>
  </div>
</body></html>`;
}

async function generateForProject(supabase: any, project: ProjectRow, periodStartIso: string, periodEndIso: string) {
  const [rfisRes, subRes, logsRes, punchRes, recipientsRes] = await Promise.all([
    supabase.from("rfis").select("*")
      .eq("project_id", project.id).gte("created_at", periodStartIso).lte("created_at", periodEndIso),
    supabase.from("submittals").select("*")
      .eq("project_id", project.id).gte("created_at", periodStartIso).lte("created_at", periodEndIso),
    supabase.from("daily_logs").select("*")
      .eq("project_id", project.id).gte("log_date", periodStartIso.slice(0, 10)).lte("log_date", periodEndIso.slice(0, 10)),
    supabase.from("punch_list_items").select("*")
      .eq("project_id", project.id).gte("updated_at", periodStartIso).lte("updated_at", periodEndIso),
    supabase.from("project_report_recipients").select("*")
      .eq("project_id", project.id).eq("is_active", true).eq("report_kind", "weekly_construction_progress"),
  ]);

  const rfis = rfisRes.data || [];
  const submittals = subRes.data || [];
  const dailyLogs = logsRes.data || [];
  const punch = punchRes.data || [];
  const recipients = recipientsRes.data || [];

  const summary = {
    rfis_total: rfis.length,
    rfis_open: rfis.filter((r: any) => ["open", "draft"].includes(r.status)).length,
    submittals_total: submittals.length,
    submittals_pending: submittals.filter((s: any) => ["pending", "under_review"].includes(s.status)).length,
    daily_logs_total: dailyLogs.length,
    punch_open: punch.filter((p: any) => ["open", "in_progress"].includes(p.status)).length,
    punch_closed: punch.filter((p: any) => ["complete", "verified"].includes(p.status)).length,
  };

  if (recipients.length === 0) {
    await supabase.from("construction_report_log").insert({
      organization_id: project.organization_id,
      project_id: project.id,
      period_start: periodStartIso.slice(0, 10),
      period_end: periodEndIso.slice(0, 10),
      recipients_count: 0, delivered_count: 0, failed_count: 0,
      summary, status: "no_recipients",
    });
    return { project_id: project.id, status: "no_recipients", recipients: 0 };
  }

  const html = buildHtml({
    project,
    periodStart: periodStartIso.slice(0, 10),
    periodEnd: periodEndIso.slice(0, 10),
    rfis, submittals, dailyLogs, punch,
  });

  let delivered = 0;
  let failed = 0;
  if (isEmailConfigured()) {
    for (const r of recipients) {
      const res = await sendEmail({
        to: r.email,
        subject: `[${project.name}] Weekly construction progress · ${periodStartIso.slice(0, 10)}`,
        html,
      });
      if (res.ok) {
        delivered++;
        await supabase.from("project_report_recipients")
          .update({ last_sent_at: new Date().toISOString() })
          .eq("id", r.id);
      } else {
        failed++;
        console.error("[weekly-construction-report] send failed", r.email, res.error);
      }
    }
  } else {
    failed = recipients.length;
    console.warn("[weekly-construction-report] email not configured — skipping send");
  }

  const status = failed === 0 ? "sent" : delivered === 0 ? "failed" : "partial";
  await supabase.from("construction_report_log").insert({
    organization_id: project.organization_id,
    project_id: project.id,
    period_start: periodStartIso.slice(0, 10),
    period_end: periodEndIso.slice(0, 10),
    recipients_count: recipients.length,
    delivered_count: delivered,
    failed_count: failed,
    summary,
    status,
  });

  return { project_id: project.id, status, recipients: recipients.length, delivered, failed };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let body: any = {};
    try { body = await req.json(); } catch (_) { /* cron call has no body */ }

    const periodEnd = new Date();
    const periodStart = new Date();
    periodStart.setUTCDate(periodEnd.getUTCDate() - 7);
    const periodStartIso = periodStart.toISOString();
    const periodEndIso = periodEnd.toISOString();

    let projects: ProjectRow[] = [];

    if (body?.project_id) {
      const { data, error } = await supabase
        .from("projects")
        .select("id, name, organization_id, stage, health, start_date, end_date")
        .eq("id", body.project_id)
        .maybeSingle();
      if (error) throw error;
      if (data) projects = [data as ProjectRow];
    } else {
      // All construction-vertical orgs, all non-archived projects
      const { data: orgs } = await supabase
        .from("organizations")
        .select("id")
        .eq("industry_vertical", "construction");
      const orgIds = (orgs ?? []).map((o: any) => o.id);
      if (orgIds.length > 0) {
        const { data, error } = await supabase
          .from("projects")
          .select("id, name, organization_id, stage, health, start_date, end_date")
          .in("organization_id", orgIds)
          .neq("stage", "closed");
        if (error) throw error;
        projects = (data || []) as ProjectRow[];
      }
    }

    const results = [];
    for (const p of projects) {
      try {
        results.push(await generateForProject(supabase, p, periodStartIso, periodEndIso));
      } catch (e) {
        console.error("[weekly-construction-report] project failed", p.id, e);
        results.push({ project_id: p.id, status: "error", error: String(e) });
      }
    }

    return new Response(JSON.stringify({
      ok: true,
      processed: results.length,
      period_start: periodStartIso.slice(0, 10),
      period_end: periodEndIso.slice(0, 10),
      results,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("[weekly-construction-report] fatal", e);
    return new Response(JSON.stringify({ ok: false, error: e.message ?? String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
