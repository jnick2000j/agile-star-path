// Change Management workflow runner.
// - POST /dispatch: invoked by triggers (change_created, status_changed, urgency_changed,
//   impact_changed, assigned, approval_requested, approval_decided, scheduled,
//   implementation_started, implemented, failed, cancelled, idle_timeout, manual).
// - POST /run/:id/resume: resumes paused (awaiting_approval) run.
//
// Step types supported:
//   condition,
//   ai_risk_assessment, ai_summarize, ai_generate_rollback, ai_communication_plan,
//   set_field, assign, schedule, request_cab_approval, notify, send_email,
//   create_helpdesk_ticket, link_evidence, escalate
//
// AI calls go via the Lovable AI Gateway (LOVABLE_API_KEY).

// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

interface DispatchPayload {
  organization_id: string;
  trigger_event: string;
  change_request_id?: string;
  payload?: Record<string, any>;
  triggered_by?: string;
}

const json = (status: number, body: any) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// ---------- Condition matching ----------
function compare(left: any, op: string, right: any): boolean {
  if (left == null && (op === "is_empty" || op === "not_set")) return true;
  if (left != null && (op === "is_set" || op === "not_empty")) return true;
  switch (op) {
    case "eq": return String(left) === String(right);
    case "neq": return String(left) !== String(right);
    case "in": return Array.isArray(right) && right.map(String).includes(String(left));
    case "not_in": return Array.isArray(right) && !right.map(String).includes(String(left));
    case "contains":
      return typeof left === "string" && typeof right === "string" && left.toLowerCase().includes(right.toLowerCase());
    case "starts_with":
      return typeof left === "string" && typeof right === "string" && left.toLowerCase().startsWith(right.toLowerCase());
    case "gt": return Number(left) > Number(right);
    case "lt": return Number(left) < Number(right);
    case "gte": return Number(left) >= Number(right);
    case "lte": return Number(left) <= Number(right);
    default: return false;
  }
}

function matchesConditions(conditions: any[], change: any, payload: any): boolean {
  if (!Array.isArray(conditions) || conditions.length === 0) return true;
  for (const c of conditions) {
    const left = change?.[c.field] !== undefined ? change?.[c.field] : payload?.[c.field];
    if (!compare(left, c.op, c.value)) return false;
  }
  return true;
}

function interpolate(value: any, scope: Record<string, any>): any {
  if (typeof value === "string") {
    return value.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, path) => {
      const parts = String(path).split(".");
      let cur: any = scope;
      for (const p of parts) {
        if (cur == null) return "";
        cur = cur[p];
      }
      return cur == null ? "" : String(cur);
    });
  }
  if (Array.isArray(value)) return value.map((v) => interpolate(v, scope));
  if (value && typeof value === "object") {
    const out: Record<string, any> = {};
    for (const k of Object.keys(value)) out[k] = interpolate(value[k], scope);
    return out;
  }
  return value;
}

async function callAI(opts: {
  system: string; user: string; schema?: any; model?: string;
}): Promise<{ text?: string; data?: any; model: string; tokens?: number }> {
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");
  const model = opts.model ?? "google/gemini-3-flash-preview";
  const body: any = {
    model,
    messages: [
      { role: "system", content: opts.system },
      { role: "user", content: opts.user },
    ],
  };
  if (opts.schema) {
    body.tools = [{
      type: "function",
      function: { name: opts.schema.name, description: opts.schema.description, parameters: opts.schema.parameters },
    }];
    body.tool_choice = { type: "function", function: { name: opts.schema.name } };
  }
  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!resp.ok) throw new Error(`AI gateway ${resp.status}: ${await resp.text()}`);
  const data = await resp.json();
  const choice = data.choices?.[0];
  const tokens = data.usage?.total_tokens;
  if (opts.schema) {
    const args = choice?.message?.tool_calls?.[0]?.function?.arguments;
    return { data: args ? JSON.parse(args) : null, model, tokens };
  }
  return { text: choice?.message?.content ?? "", model, tokens };
}

const changeSummary = (c: any) =>
  `Title: ${c?.title}\nType: ${c?.change_type}\nUrgency: ${c?.urgency} | Impact: ${c?.impact}\n` +
  `Description: ${c?.description ?? ""}\nImplementation Plan: ${c?.implementation_plan ?? "(none)"}\n` +
  `Affected Services: ${(c?.affected_services ?? []).join(", ")}`;

async function executeStep(
  step: any,
  ctx: { run: any; change: any | null; context: Record<string, any> },
  stepIndex: number,
): Promise<{ status: string; output: any; aiModel?: string; aiTokens?: number; pause?: { approvalId: string } }> {
  const stepType = step.type as string;
  const config = interpolate(step.config ?? {}, { change: ctx.change, context: ctx.context, payload: ctx.run.trigger_payload });

  switch (stepType) {
    case "condition": {
      const ok = matchesConditions(config.conditions ?? [], ctx.change, ctx.run.trigger_payload);
      if (!ok) return { status: "skipped", output: { matched: false, halted: !!config.halt_on_false } };
      return { status: "completed", output: { matched: true } };
    }

    case "ai_risk_assessment": {
      const result = await callAI({
        model: step.model,
        system: "You assess change-management requests against ITIL best practice. Score risk and recommend gates.",
        user: changeSummary(ctx.change),
        schema: {
          name: "assess_change_risk",
          description: "Assess the risk of a change request.",
          parameters: {
            type: "object",
            properties: {
              risk_score: { type: "integer", minimum: 0, maximum: 100 },
              recommended_change_type: { type: "string", enum: ["standard","normal","emergency","operational"] },
              cab_required: { type: "boolean" },
              justification: { type: "string" },
              top_risks: { type: "array", items: { type: "string" } },
            },
            required: ["risk_score","recommended_change_type","cab_required","justification"],
          },
        },
      });
      ctx.context.ai_risk = result.data;
      if (config.apply_to_change && ctx.change) {
        const updates: any = { risk_score: result.data?.risk_score };
        if (config.update_change_type && result.data?.recommended_change_type) {
          updates.change_type = result.data.recommended_change_type;
        }
        await supabase.from("change_management_requests").update(updates).eq("id", ctx.change.id);
      }
      return { status: "completed", output: result.data, aiModel: result.model, aiTokens: result.tokens };
    }

    case "ai_summarize": {
      const result = await callAI({
        model: step.model,
        system: "Summarize this change request in 2-3 sentences for an approver.",
        user: changeSummary(ctx.change),
      });
      ctx.context.ai_summary = result.text;
      return { status: "completed", output: { summary: result.text }, aiModel: result.model, aiTokens: result.tokens };
    }

    case "ai_generate_rollback": {
      const result = await callAI({
        model: step.model,
        system: "Draft a clear, step-by-step rollback plan for the following change.",
        user: changeSummary(ctx.change),
      });
      ctx.context.ai_rollback = result.text;
      if (config.apply_to_change && ctx.change && result.text) {
        await supabase.from("change_management_requests").update({ rollback_plan: result.text }).eq("id", ctx.change.id);
      }
      return { status: "completed", output: { rollback_plan: result.text }, aiModel: result.model, aiTokens: result.tokens };
    }

    case "ai_communication_plan": {
      const result = await callAI({
        model: step.model,
        system: "Draft a stakeholder communication plan: who to inform, channels, timing.",
        user: changeSummary(ctx.change),
      });
      ctx.context.ai_communication = result.text;
      if (config.apply_to_change && ctx.change && result.text) {
        await supabase.from("change_management_requests").update({ communication_plan: result.text }).eq("id", ctx.change.id);
      }
      return { status: "completed", output: { communication_plan: result.text }, aiModel: result.model, aiTokens: result.tokens };
    }

    case "set_field": {
      if (!ctx.change) return { status: "skipped", output: { reason: "no_change" } };
      const updates: Record<string, any> = {};
      const allowed = ["status","urgency","impact","change_type","category","risk_score","planned_start_at","planned_end_at","downtime_required","downtime_minutes"];
      for (const f of allowed) {
        if (config[f] !== undefined && config[f] !== "") updates[f] = config[f];
      }
      if (!Object.keys(updates).length) return { status: "skipped", output: { reason: "no_fields" } };
      await supabase.from("change_management_requests").update(updates).eq("id", ctx.change.id);
      return { status: "completed", output: { updates } };
    }

    case "assign": {
      if (!ctx.change) return { status: "skipped", output: { reason: "no_change" } };
      const updates: any = {};
      if (config.owner_id) updates.owner_id = config.owner_id;
      if (config.implementer_id) updates.implementer_id = config.implementer_id;
      if (!Object.keys(updates).length) return { status: "failed", output: { error: "missing assignee" } };
      await supabase.from("change_management_requests").update(updates).eq("id", ctx.change.id);
      return { status: "completed", output: updates };
    }

    case "schedule": {
      if (!ctx.change) return { status: "skipped", output: { reason: "no_change" } };
      const updates: any = { status: "scheduled" };
      if (config.planned_start_at) updates.planned_start_at = config.planned_start_at;
      if (config.planned_end_at) updates.planned_end_at = config.planned_end_at;
      await supabase.from("change_management_requests").update(updates).eq("id", ctx.change.id);
      return { status: "completed", output: updates };
    }

    case "request_cab_approval": {
      const stepExecId = ctx.context._current_step_execution_id;
      const { data: approval, error } = await supabase
        .from("cm_workflow_approvals")
        .insert({
          organization_id: ctx.run.organization_id,
          run_id: ctx.run.id,
          step_execution_id: stepExecId,
          change_request_id: ctx.change?.id ?? null,
          title: config.title ?? `CAB approval: ${ctx.change?.title ?? "change"}`,
          description: config.description ?? null,
          context: { step_index: stepIndex, ai: ctx.context, kind: config.kind ?? "cab" },
          assigned_to_user_id: config.approver_user_id ?? null,
          assigned_to_role: config.approver_role ?? "cab",
        })
        .select("id")
        .single();
      if (error) return { status: "failed", output: { error: error.message } };

      // Mirror in change_management_approvals if present so the CM detail page reflects it
      if (ctx.change?.id) {
        await supabase.from("change_management_approvals").insert({
          organization_id: ctx.run.organization_id,
          change_request_id: ctx.change.id,
          kind: config.kind ?? "cab",
          assigned_to: config.approver_user_id ?? null,
          decision: "pending",
          requested_by: ctx.run.triggered_by ?? null,
        }).then(() => {}, () => {}); // best-effort; ignore if schema differs
      }

      return { status: "awaiting_approval", output: { approval_id: approval.id }, pause: { approvalId: approval.id } };
    }

    case "notify":
    case "send_email": {
      const recipientUser = config.recipient_user_id;
      if (!recipientUser) return { status: "skipped", output: { reason: "no_recipient" } };
      try {
        const resp = await fetch(`${SUPABASE_URL}/functions/v1/notification-dispatcher`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}` },
          body: JSON.stringify({
            event_type: config.event_type ?? "cm_workflow_update",
            recipient_user_id: recipientUser,
            actor_user_id: ctx.run.triggered_by ?? null,
            organization_id: ctx.run.organization_id,
            entity_type: "cm_request",
            entity_id: ctx.change?.id ?? null,
            link: ctx.change?.id ? `/change-management/${ctx.change.id}` : "/change-management",
            extra: { subject: config.subject, body: config.body, workflow_run_id: ctx.run.id },
          }),
        });
        return { status: resp.ok ? "completed" : "failed", output: { recipient: recipientUser, status: resp.status } };
      } catch (e: any) {
        return { status: "failed", output: { error: e.message } };
      }
    }

    case "create_helpdesk_ticket": {
      const { data, error } = await supabase
        .from("helpdesk_tickets")
        .insert({
          organization_id: ctx.run.organization_id,
          subject: config.subject ?? `Follow-up for change ${ctx.change?.reference_number ?? ""}`.trim(),
          description: config.description ?? changeSummary(ctx.change),
          ticket_type: config.ticket_type ?? "service_request",
          priority: config.priority ?? "medium",
          source: "internal" as any,
          reporter_user_id: ctx.run.triggered_by ?? null,
          created_by: ctx.run.triggered_by ?? null,
        })
        .select("id, reference_number")
        .single();
      if (error) return { status: "failed", output: { error: error.message } };
      return { status: "completed", output: { ticket_id: data?.id, reference: data?.reference_number } };
    }

    case "escalate": {
      if (!ctx.change) return { status: "skipped", output: { reason: "no_change" } };
      const updates: any = {};
      if (config.bump_urgency) updates.urgency = config.bump_urgency;
      if (config.bump_impact) updates.impact = config.bump_impact;
      if (Object.keys(updates).length) {
        await supabase.from("change_management_requests").update(updates).eq("id", ctx.change.id);
      }
      if (config.recipient_user_id) {
        await fetch(`${SUPABASE_URL}/functions/v1/notification-dispatcher`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}` },
          body: JSON.stringify({
            event_type: "cm_escalation",
            recipient_user_id: config.recipient_user_id,
            organization_id: ctx.run.organization_id,
            entity_type: "cm_request",
            entity_id: ctx.change.id,
            link: `/change-management/${ctx.change.id}`,
            extra: { subject: `[Escalation] ${ctx.change.title}`, body: config.body ?? "Escalated by workflow" },
          }),
        }).catch(() => {});
      }
      return { status: "completed", output: { escalated: true, ...updates } };
    }

    case "link_evidence": {
      if (!ctx.change) return { status: "skipped", output: { reason: "no_change" } };
      const note = String(config.note ?? "").trim() ||
        `Workflow ${ctx.run.id} step ${stepIndex} – ${step.label ?? step.type}`;
      try {
        await supabase.from("change_management_activity").insert({
          organization_id: ctx.run.organization_id,
          change_request_id: ctx.change.id,
          activity_type: "workflow",
          notes: note,
          metadata: { workflow_run_id: ctx.run.id, step_index: stepIndex },
        });
      } catch (_e) { /* best-effort */ }
      return { status: "completed", output: { note } };
    }

    default:
      return { status: "skipped", output: { reason: `unknown_step_type:${stepType}` } };
  }
}

async function getWfCount(id: string, col: string): Promise<number> {
  const { data } = await supabase.from("cm_workflows").select(col).eq("id", id).single();
  return (data as any)?.[col] ?? 0;
}

async function executeRun(runId: string): Promise<{ ok: boolean; status: string; pausedOnApproval?: string }> {
  const { data: run } = await supabase.from("cm_workflow_runs").select("*").eq("id", runId).single();
  if (!run) return { ok: false, status: "not_found" };
  const { data: workflow } = await supabase.from("cm_workflows").select("steps").eq("id", run.workflow_id).single();
  if (!workflow) return { ok: false, status: "workflow_missing" };

  const steps: any[] = workflow.steps ?? [];
  let change: any = null;
  if (run.change_request_id) {
    const { data } = await supabase.from("change_management_requests").select("*").eq("id", run.change_request_id).maybeSingle();
    change = data;
  }
  const context: Record<string, any> = { ...(run.context ?? {}) };

  for (let i = run.current_step_index; i < steps.length; i++) {
    const step = steps[i];
    const { data: stepExec } = await supabase
      .from("cm_workflow_step_executions")
      .insert({
        run_id: run.id, organization_id: run.organization_id,
        step_index: i, step_type: step.type, step_label: step.label ?? step.type,
        status: "running", input: step.config ?? {}, started_at: new Date().toISOString(),
      })
      .select("id").single();

    context._current_step_execution_id = stepExec?.id;

    let result: any;
    try {
      result = await executeStep(step, { run, change, context }, i);
    } catch (e: any) {
      result = { status: "failed", output: { error: e.message ?? String(e) } };
    }

    await supabase.from("cm_workflow_step_executions").update({
      status: result.status,
      output: result.output ?? {},
      ai_model: result.aiModel ?? null,
      ai_tokens: result.aiTokens ?? null,
      error_message: result.status === "failed" ? (result.output?.error ?? null) : null,
      completed_at: new Date().toISOString(),
    }).eq("id", stepExec!.id);

    if (result.status === "failed") {
      await supabase.from("cm_workflow_runs").update({
        status: "failed", error_message: result.output?.error ?? "Step failed",
        completed_at: new Date().toISOString(), context,
      }).eq("id", run.id);
      await supabase.from("cm_workflows").update({
        failure_count: (await getWfCount(run.workflow_id, "failure_count")) + 1,
        last_run_at: new Date().toISOString(),
      }).eq("id", run.workflow_id);
      return { ok: false, status: "failed" };
    }

    if (result.status === "skipped" && result.output?.halted) {
      await supabase.from("cm_workflow_runs").update({
        status: "completed", completed_at: new Date().toISOString(),
        current_step_index: i + 1, context,
      }).eq("id", run.id);
      return { ok: true, status: "completed_halted" };
    }

    if (result.status === "awaiting_approval") {
      await supabase.from("cm_workflow_runs").update({
        status: "awaiting_approval", current_step_index: i + 1, context,
      }).eq("id", run.id);
      return { ok: true, status: "awaiting_approval", pausedOnApproval: result.pause?.approvalId };
    }
  }

  await supabase.from("cm_workflow_runs").update({
    status: "completed", completed_at: new Date().toISOString(),
    current_step_index: steps.length, step_count: steps.length, context,
  }).eq("id", run.id);
  await supabase.from("cm_workflows").update({
    success_count: (await getWfCount(run.workflow_id, "success_count")) + 1,
    last_run_at: new Date().toISOString(),
  }).eq("id", run.workflow_id);
  return { ok: true, status: "completed" };
}

async function dispatch(req: DispatchPayload): Promise<{ runs: string[] }> {
  const { data: workflows } = await supabase
    .from("cm_workflows")
    .select("*")
    .eq("organization_id", req.organization_id)
    .eq("trigger_event", req.trigger_event)
    .eq("is_enabled", true);

  if (!workflows?.length) return { runs: [] };

  let change: any = null;
  if (req.change_request_id) {
    const { data } = await supabase.from("change_management_requests").select("*").eq("id", req.change_request_id).maybeSingle();
    change = data;
  }

  const runs: string[] = [];
  for (const wf of workflows) {
    if (!matchesConditions(wf.match_conditions ?? [], change, req.payload ?? {})) continue;
    const steps: any[] = wf.steps ?? [];
    const { data: run } = await supabase.from("cm_workflow_runs").insert({
      organization_id: req.organization_id, workflow_id: wf.id,
      change_request_id: req.change_request_id ?? null,
      trigger_event: req.trigger_event, trigger_payload: req.payload ?? {},
      triggered_by: req.triggered_by ?? null, step_count: steps.length, context: {},
    }).select("id").single();
    if (!run) continue;
    runs.push(run.id);
    await supabase.from("cm_workflows").update({ run_count: (wf.run_count ?? 0) + 1 }).eq("id", wf.id);
    executeRun(run.id).catch((e) => console.error("CM run failed", run.id, e));
  }
  return { runs };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  const url = new URL(req.url);
  const path = url.pathname.replace(/^.*\/cm-workflow-runner/, "");

  let body: any = {};
  try { body = await req.json(); } catch { /* allow empty */ }

  try {
    if (path === "" || path === "/" || path === "/dispatch") {
      const result = await dispatch(body);
      return json(200, { ok: true, ...result });
    }
    const resumeMatch = path.match(/^\/run\/([^/]+)\/resume$/);
    if (resumeMatch) {
      const result = await executeRun(resumeMatch[1]);
      return json(200, { ok: true, ...result });
    }
    return json(404, { error: "not_found" });
  } catch (e: any) {
    console.error("cm-workflow-runner error", e);
    return json(500, { error: e.message ?? String(e) });
  }
});
