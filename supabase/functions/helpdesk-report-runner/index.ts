// Helpdesk Report Runner — runs a saved report, returns CSV, optionally emails recipients
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendEmail } from "../_shared/email.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface Report {
  id: string;
  organization_id: string;
  name: string;
  dataset: string;
  filters: Record<string, any>;
  columns: string[];
  sort_by?: string | null;
  sort_dir?: string | null;
  recipients?: string[] | null;
  schedule_interval?: string | null;
}

const DATASET_TABLES: Record<string, { table: string; defaultColumns: string[] }> = {
  tickets: {
    table: "helpdesk_tickets",
    defaultColumns: ["reference_number", "subject", "status", "priority", "ticket_type", "assignee_id", "created_at", "resolved_at"],
  },
  csat: {
    table: "helpdesk_csat_responses",
    defaultColumns: ["ticket_id", "score", "comment", "created_at"],
  },
  approvals: {
    table: "service_catalog_request_approvals",
    defaultColumns: ["ticket_id", "step_order", "step_name", "status", "approver_user_id", "decided_at"],
  },
  sla_breaches: {
    table: "helpdesk_tickets",
    defaultColumns: ["reference_number", "subject", "priority", "sla_response_breached", "sla_resolution_breached", "sla_response_due_at", "sla_resolution_due_at"],
  },
};

function csvEscape(v: any): string {
  if (v === null || v === undefined) return "";
  let s: string;
  if (typeof v === "object") s = JSON.stringify(v);
  else s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(cols: string[], rows: any[]): string {
  const head = cols.map(csvEscape).join(",");
  const body = rows.map((r) => cols.map((c) => csvEscape(r[c])).join(",")).join("\n");
  return head + "\n" + body;
}

async function runReport(supabase: any, report: Report) {
  const ds = DATASET_TABLES[report.dataset] || DATASET_TABLES.tickets;
  const cols = report.columns?.length ? report.columns : ds.defaultColumns;

  let query = supabase.from(ds.table).select("*").eq("organization_id", report.organization_id).limit(5000);

  const f = report.filters || {};
  if (f.status) query = query.eq("status", f.status);
  if (f.priority) query = query.eq("priority", f.priority);
  if (f.ticket_type) query = query.eq("ticket_type", f.ticket_type);
  if (f.assignee_id) query = query.eq("assignee_id", f.assignee_id);
  if (f.created_after) query = query.gte("created_at", f.created_after);
  if (f.created_before) query = query.lte("created_at", f.created_before);
  if (report.dataset === "sla_breaches") {
    query = query.or("sla_response_breached.eq.true,sla_resolution_breached.eq.true");
  }
  if (report.sort_by) {
    query = query.order(report.sort_by, { ascending: report.sort_dir !== "desc" });
  } else {
    query = query.order("created_at", { ascending: false });
  }

  const { data, error } = await query;
  if (error) throw error;
  return { cols, rows: data ?? [] };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    const body = await req.json().catch(() => ({}));
    const { reportId, source = "manual", scheduledOnly = false } = body as any;

    let reportIds: string[] = [];
    if (reportId) {
      reportIds = [reportId];
    } else if (scheduledOnly) {
      const { data } = await supabase
        .from("helpdesk_reports")
        .select("id")
        .eq("is_enabled", true)
        .not("schedule_interval", "is", null)
        .lte("next_run_at", new Date().toISOString());
      reportIds = (data ?? []).map((r: any) => r.id);
    } else {
      return new Response(JSON.stringify({ error: "reportId or scheduledOnly required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: any[] = [];
    for (const id of reportIds) {
      const { data: report } = await supabase.from("helpdesk_reports").select("*").eq("id", id).single();
      if (!report) continue;

      const { data: runRow } = await supabase
        .from("helpdesk_report_runs")
        .insert({
          report_id: report.id,
          organization_id: report.organization_id,
          status: "running",
          trigger_source: source,
        })
        .select("id")
        .single();

      try {
        const { cols, rows } = await runReport(supabase, report);
        const csv = toCsv(cols, rows);
        const sizeBytes = new TextEncoder().encode(csv).length;

        // Email if recipients configured
        let emailed = 0;
        if (report.recipients?.length) {
          const filename = `${report.name.replace(/[^a-z0-9]/gi, "_")}_${new Date().toISOString().slice(0, 10)}.csv`;
          const b64 = btoa(unescape(encodeURIComponent(csv)));
          const res = await sendEmail({
            to: report.recipients,
            subject: `Report: ${report.name} (${rows.length} rows)`,
            html: `<p>Your scheduled helpdesk report <strong>${report.name}</strong> is attached.</p><p><strong>${rows.length}</strong> rows, generated ${new Date().toUTCString()}.</p>`,
            attachments: [{ filename, content: b64, contentType: "text/csv" }],
            organizationId: report.organization_id,
            triggerKey: "helpdesk_report",
          });
          if (res.ok) emailed = report.recipients.length;
        }

        await supabase
          .from("helpdesk_report_runs")
          .update({
            status: "success",
            row_count: rows.length,
            file_size_bytes: sizeBytes,
            completed_at: new Date().toISOString(),
          })
          .eq("id", runRow.id);

        // Update next_run_at if scheduled
        const updates: any = { last_run_at: new Date().toISOString() };
        if (report.schedule_interval) {
          const { data: nr } = await supabase.rpc("helpdesk_report_compute_next_run", {
            _interval: report.schedule_interval,
          });
          updates.next_run_at = nr;
        }
        await supabase.from("helpdesk_reports").update(updates).eq("id", report.id);

        results.push({ reportId: report.id, ok: true, rows: rows.length, emailed, csv: reportId ? csv : undefined });
      } catch (e: any) {
        await supabase
          .from("helpdesk_report_runs")
          .update({
            status: "failed",
            error_message: e.message,
            completed_at: new Date().toISOString(),
          })
          .eq("id", runRow.id);
        results.push({ reportId: report.id, ok: false, error: e.message });
      }
    }

    return new Response(JSON.stringify({ ok: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("report runner error", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
