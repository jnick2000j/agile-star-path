// Helpdesk workflow runner.
// - POST /dispatch: invoked by triggers (ticket_created, status_changed, etc.).
//   Finds matching enabled workflows for the org+event and starts a run for each.
// - POST /run/:id/resume: resumes a paused (awaiting_approval) run after an approval.
// - POST /workflow/:id/test: dry-run a workflow against a synthetic payload (admin).
//
// Step types supported:
//   condition, ai_triage, ai_summarize, ai_suggest_reply, ai_draft_reply, ai_sentiment,
//   assign, set_field, add_tag, internal_note, send_email, notify, request_approval,
//   escalate, create_cab
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
  ticket_id?: string;
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

function matchesConditions(conditions: any[], ticket: any, payload: any): boolean {
  if (!Array.isArray(conditions) || conditions.length === 0) return true;
  for (const c of conditions) {
    const field = c.field as string;
    const fromTicket = ticket?.[field];
    const fromPayload = payload?.[field];
    const left = fromTicket !== undefined ? fromTicket : fromPayload;
    if (!compare(left, c.op, c.value)) return false;
  }
  return true;
}

// ---------- Variable interpolation: {{ticket.subject}}, {{context.ai_summary}} ----------
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

// ---------- AI gateway call ----------
async function callAI(opts: {
  system: string;
  user: string;
  schema?: any;
  model?: string;
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
      function: {
        name: opts.schema.name,
        description: opts.schema.description,
        parameters: opts.schema.parameters,
      },
    }];
    body.tool_choice = { type: "function", function: { name: opts.schema.name } };
  }
  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`AI gateway ${resp.status}: ${t}`);
  }
  const data = await resp.json();
  const choice = data.choices?.[0];
  const tokens = data.usage?.total_tokens;
  if (opts.schema) {
    const args = choice?.message?.tool_calls?.[0]?.function?.arguments;
    return { data: args ? JSON.parse(args) : null, model, tokens };
  }
  return { text: choice?.message?.content ?? "", model, tokens };
}

// ---------- Step handlers ----------
async function executeStep(
  step: any,
  ctx: { run: any; ticket: any | null; context: Record<string, any> },
  stepIndex: number,
): Promise<{ status: string; output: any; aiModel?: string; aiTokens?: number; pause?: { approvalId: string } }> {
  const stepType = step.type as string;
  const config = interpolate(step.config ?? {}, { ticket: ctx.ticket, context: ctx.context, payload: ctx.run.trigger_payload });

  switch (stepType) {
    // ---- Conditions ----
    case "condition": {
      const ok = matchesConditions(config.conditions ?? [], ctx.ticket, ctx.run.trigger_payload);
      if (!ok) return { status: "skipped", output: { matched: false, halted: !!config.halt_on_false } };
      return { status: "completed", output: { matched: true } };
    }

    // ---- AI ----
    case "ai_triage": {
      const result = await callAI({
        model: step.model,
        system: "You are a helpdesk triage assistant. Categorize and prioritize the ticket.",
        user: `Subject: ${ctx.ticket?.subject ?? ""}\n\nDescription: ${ctx.ticket?.description ?? ""}`,
        schema: {
          name: "triage_ticket",
          description: "Triage a helpdesk ticket.",
          parameters: {
            type: "object",
            properties: {
              category: { type: "string", description: "Suggested category" },
              priority: { type: "string", enum: ["low", "medium", "high", "urgent"] },
              ticket_type: { type: "string", enum: ["support", "incident", "service_request", "question", "problem"] },
              reasoning: { type: "string" },
            },
            required: ["category", "priority", "ticket_type", "reasoning"],
          },
        },
      });
      ctx.context.ai_triage = result.data;
      ctx.context.ai_category = result.data?.category;
      ctx.context.ai_priority = result.data?.priority;
      ctx.context.ai_ticket_type = result.data?.ticket_type;
      if (config.apply_to_ticket && ctx.ticket) {
        const updates: any = {};
        if (result.data?.category) updates.category = result.data.category;
        if (result.data?.priority) updates.priority = result.data.priority;
        if (result.data?.ticket_type) updates.ticket_type = result.data.ticket_type;
        if (Object.keys(updates).length) {
          await supabase.from("helpdesk_tickets").update(updates).eq("id", ctx.ticket.id);
        }
      }
      return { status: "completed", output: result.data, aiModel: result.model, aiTokens: result.tokens };
    }

    case "ai_summarize": {
      const result = await callAI({
        model: step.model,
        system: "Summarize this helpdesk ticket concisely (2-3 sentences) for an agent picking it up.",
        user: `Subject: ${ctx.ticket?.subject}\nDescription: ${ctx.ticket?.description}`,
      });
      ctx.context.ai_summary = result.text;
      return { status: "completed", output: { summary: result.text }, aiModel: result.model, aiTokens: result.tokens };
    }

    case "ai_suggest_reply":
    case "ai_draft_reply": {
      const result = await callAI({
        model: step.model,
        system: config.tone
          ? `You are a helpdesk agent. Draft a ${config.tone} reply to the user.`
          : "You are a helpdesk agent. Draft a clear, professional reply to the user.",
        user: `Subject: ${ctx.ticket?.subject}\n\nUser said:\n${ctx.ticket?.description}\n\n${config.instructions ?? ""}`,
      });
      ctx.context.ai_reply = result.text;
      return { status: "completed", output: { reply: result.text }, aiModel: result.model, aiTokens: result.tokens };
    }

    case "ai_sentiment": {
      const result = await callAI({
        model: step.model,
        system: "Analyze the sentiment of this helpdesk ticket.",
        user: `Subject: ${ctx.ticket?.subject}\nDescription: ${ctx.ticket?.description}`,
        schema: {
          name: "analyze_sentiment",
          description: "Analyze ticket sentiment.",
          parameters: {
            type: "object",
            properties: {
              sentiment: { type: "string", enum: ["positive", "neutral", "negative", "frustrated", "angry"] },
              urgency_signal: { type: "string", enum: ["low", "medium", "high"] },
              key_phrases: { type: "array", items: { type: "string" } },
            },
            required: ["sentiment", "urgency_signal"],
          },
        },
      });
      ctx.context.ai_sentiment = result.data?.sentiment;
      ctx.context.ai_urgency_signal = result.data?.urgency_signal;
      return { status: "completed", output: result.data, aiModel: result.model, aiTokens: result.tokens };
    }

    // ---- Core helpdesk actions ----
    case "assign": {
      if (!ctx.ticket) return { status: "skipped", output: { reason: "no_ticket" } };
      const assignee = config.user_id;
      if (!assignee) return { status: "failed", output: { error: "missing user_id" } };
      await supabase.from("helpdesk_tickets").update({ assignee_id: assignee }).eq("id", ctx.ticket.id);
      return { status: "completed", output: { assigned_to: assignee } };
    }

    case "set_field": {
      if (!ctx.ticket) return { status: "skipped", output: { reason: "no_ticket" } };
      const updates: Record<string, any> = {};
      const allowed = ["status", "priority", "category", "ticket_type", "due_at", "resolution"];
      for (const f of allowed) {
        if (config[f] !== undefined && config[f] !== "") updates[f] = config[f];
      }
      if (!Object.keys(updates).length) return { status: "skipped", output: { reason: "no_fields" } };
      await supabase.from("helpdesk_tickets").update(updates).eq("id", ctx.ticket.id);
      return { status: "completed", output: { updates } };
    }

    case "add_tag": {
      if (!ctx.ticket) return { status: "skipped", output: { reason: "no_ticket" } };
      const newTags = Array.isArray(config.tags) ? config.tags : (config.tag ? [config.tag] : []);
      if (!newTags.length) return { status: "skipped", output: {} };
      const merged = Array.from(new Set([...(ctx.ticket.tags ?? []), ...newTags]));
      await supabase.from("helpdesk_tickets").update({ tags: merged }).eq("id", ctx.ticket.id);
      return { status: "completed", output: { tags: merged } };
    }

    case "internal_note": {
      if (!ctx.ticket) return { status: "skipped", output: { reason: "no_ticket" } };
      const body = String(config.body ?? "").trim();
      if (!body) return { status: "skipped", output: { reason: "empty" } };
      // Best-effort: insert into ticket comments table if it exists
      try {
        await supabase.from("helpdesk_ticket_comments").insert({
          organization_id: ctx.run.organization_id,
          ticket_id: ctx.ticket.id,
          body,
          is_internal: true,
          author_user_id: null,
        });
      } catch (_e) {
        // ignore if table differs
      }
      return { status: "completed", output: { body } };
    }

    case "send_email":
    case "notify": {
      if (!ctx.ticket) return { status: "skipped", output: { reason: "no_ticket" } };
      const recipient = config.recipient_email
        || (config.recipient === "reporter" ? ctx.ticket.reporter_email : null);
      if (!recipient) return { status: "skipped", output: { reason: "no_recipient" } };
      try {
        const resp = await fetch(`${SUPABASE_URL}/functions/v1/helpdesk-notify`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}` },
          body: JSON.stringify({
            ticket_id: ctx.ticket.id,
            notification_type: config.notification_type ?? "reply",
            recipient_email: recipient,
            metadata: { workflow_run_id: ctx.run.id, body: config.body, subject: config.subject },
          }),
        });
        return { status: resp.ok ? "completed" : "failed", output: { recipient, status: resp.status } };
      } catch (e: any) {
        return { status: "failed", output: { error: e.message } };
      }
    }

    // ---- Approvals & escalation ----
    case "request_approval": {
      const stepExecId = ctx.context._current_step_execution_id;
      const { data: approval, error } = await supabase
        .from("helpdesk_workflow_approvals")
        .insert({
          organization_id: ctx.run.organization_id,
          run_id: ctx.run.id,
          step_execution_id: stepExecId,
          ticket_id: ctx.ticket?.id ?? null,
          title: config.title ?? `Approval needed for "${ctx.ticket?.subject ?? "workflow"}"`,
          description: config.description ?? null,
          context: { step_index: stepIndex, ai: ctx.context },
          assigned_to_user_id: config.approver_user_id ?? null,
          assigned_to_role: config.approver_role ?? null,
          due_at: config.due_at ?? null,
        })
        .select("id")
        .single();
      if (error) return { status: "failed", output: { error: error.message } };
      if (approval?.id && (config.approver_user_id || ctx.run.triggered_by)) {
        await fetch(`${SUPABASE_URL}/functions/v1/notification-dispatcher`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}` },
          body: JSON.stringify({
            event_type: "helpdesk_workflow_pending",
            recipient_user_id: config.approver_user_id ?? ctx.run.triggered_by,
            actor_user_id: ctx.run.triggered_by ?? null,
            organization_id: ctx.run.organization_id,
            helpdesk_approval_id: approval.id,
            entity_type: "helpdesk_ticket",
            entity_id: ctx.ticket?.id ?? null,
            link: "/support/workflows",
            extra: { ticket_reference: ctx.ticket?.reference_number ?? ctx.ticket?.subject ?? null },
          }),
        }).catch((e) => console.error("helpdesk pending approval notification failed", e));
      }
      return { status: "awaiting_approval", output: { approval_id: approval.id }, pause: { approvalId: approval.id } };
    }

    case "escalate": {
      // Notify a manager / role; reuses notify pipeline
      const subject = `[Escalation] ${ctx.ticket?.subject ?? "Workflow escalation"}`;
      const body = config.body ?? "A workflow has escalated this item for your attention.";
      if (config.recipient_email) {
        await fetch(`${SUPABASE_URL}/functions/v1/helpdesk-notify`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}` },
          body: JSON.stringify({
            ticket_id: ctx.ticket?.id,
            notification_type: "sla_warning",
            recipient_email: config.recipient_email,
            metadata: { subject, body, workflow_run_id: ctx.run.id },
          }),
        });
      }
      // Also bump priority if requested
      if (config.bump_priority && ctx.ticket) {
        await supabase.from("helpdesk_tickets").update({ priority: config.bump_priority }).eq("id", ctx.ticket.id);
      }
      return { status: "completed", output: { escalated: true } };
    }

    case "create_cab": {
      // Stub: create a change_management_request linked to the ticket if asked
      if (!ctx.ticket) return { status: "skipped", output: { reason: "no_ticket" } };
      const { data, error } = await supabase
        .from("change_management_requests")
        .insert({
          organization_id: ctx.run.organization_id,
          title: config.title ?? `CAB review for ${ctx.ticket.reference_number ?? "ticket"}`,
          description: config.description ?? ctx.ticket.description,
          impact: config.impact ?? "medium",
          urgency: config.urgency ?? "medium",
          change_type: config.change_type ?? "normal",
          status: "submitted",
          related_ticket_id: ctx.ticket.id,
          requested_by: ctx.run.triggered_by,
        })
        .select("id, reference_number")
        .maybeSingle();
      if (error) return { status: "failed", output: { error: error.message } };
      return { status: "completed", output: { change_id: data?.id, reference: data?.reference_number } };
    }

    default:
      return { status: "skipped", output: { reason: `unknown_step_type:${stepType}` } };
  }
}

// ---------- Run executor ----------
async function executeRun(runId: string): Promise<{ ok: boolean; status: string; pausedOnApproval?: string }> {
  const { data: run } = await supabase.from("helpdesk_workflow_runs").select("*").eq("id", runId).single();
  if (!run) return { ok: false, status: "not_found" };
  const { data: workflow } = await supabase.from("helpdesk_workflows").select("steps").eq("id", run.workflow_id).single();
  if (!workflow) return { ok: false, status: "workflow_missing" };

  const steps: any[] = workflow.steps ?? [];
  let ticket: any = null;
  if (run.ticket_id) {
    const { data } = await supabase.from("helpdesk_tickets").select("*").eq("id", run.ticket_id).maybeSingle();
    ticket = data;
  }
  const context: Record<string, any> = { ...(run.context ?? {}) };

  for (let i = run.current_step_index; i < steps.length; i++) {
    const step = steps[i];
    // Insert step execution row
    const { data: stepExec } = await supabase
      .from("helpdesk_workflow_step_executions")
      .insert({
        run_id: run.id,
        organization_id: run.organization_id,
        step_index: i,
        step_type: step.type,
        step_label: step.label ?? step.type,
        status: "running",
        input: step.config ?? {},
        started_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    context._current_step_execution_id = stepExec?.id;

    let result: any;
    try {
      result = await executeStep(step, { run, ticket, context }, i);
    } catch (e: any) {
      result = { status: "failed", output: { error: e.message ?? String(e) } };
    }

    await supabase.from("helpdesk_workflow_step_executions").update({
      status: result.status,
      output: result.output ?? {},
      ai_model: result.aiModel ?? null,
      ai_tokens: result.aiTokens ?? null,
      error_message: result.status === "failed" ? (result.output?.error ?? null) : null,
      completed_at: new Date().toISOString(),
    }).eq("id", stepExec!.id);

    if (result.status === "failed") {
      await supabase.from("helpdesk_workflow_runs").update({
        status: "failed",
        error_message: result.output?.error ?? "Step failed",
        completed_at: new Date().toISOString(),
        context,
      }).eq("id", run.id);
      await supabase.rpc as any; // no-op
      await supabase.from("helpdesk_workflows").update({
        failure_count: (await getWfCount(run.workflow_id, "failure_count")) + 1,
        last_run_at: new Date().toISOString(),
      }).eq("id", run.workflow_id);
      return { ok: false, status: "failed" };
    }

    if (result.status === "skipped" && result.output?.halted) {
      await supabase.from("helpdesk_workflow_runs").update({
        status: "completed",
        completed_at: new Date().toISOString(),
        current_step_index: i + 1,
        context,
      }).eq("id", run.id);
      return { ok: true, status: "completed_halted" };
    }

    if (result.status === "awaiting_approval") {
      await supabase.from("helpdesk_workflow_runs").update({
        status: "awaiting_approval",
        current_step_index: i + 1, // resume after approval
        context,
      }).eq("id", run.id);
      return { ok: true, status: "awaiting_approval", pausedOnApproval: result.pause?.approvalId };
    }
  }

  await supabase.from("helpdesk_workflow_runs").update({
    status: "completed",
    completed_at: new Date().toISOString(),
    current_step_index: steps.length,
    step_count: steps.length,
    context,
  }).eq("id", run.id);

  await supabase.from("helpdesk_workflows").update({
    success_count: (await getWfCount(run.workflow_id, "success_count")) + 1,
    last_run_at: new Date().toISOString(),
  }).eq("id", run.workflow_id);

  return { ok: true, status: "completed" };
}

async function getWfCount(id: string, col: string): Promise<number> {
  const { data } = await supabase.from("helpdesk_workflows").select(col).eq("id", id).single();
  return (data as any)?.[col] ?? 0;
}

// ---------- Dispatch ----------
async function dispatch(req: DispatchPayload): Promise<{ runs: string[] }> {
  const { data: workflows } = await supabase
    .from("helpdesk_workflows")
    .select("*")
    .eq("organization_id", req.organization_id)
    .eq("trigger_event", req.trigger_event)
    .eq("is_enabled", true);

  if (!workflows?.length) return { runs: [] };

  let ticket: any = null;
  if (req.ticket_id) {
    const { data } = await supabase.from("helpdesk_tickets").select("*").eq("id", req.ticket_id).maybeSingle();
    ticket = data;
  }

  const runs: string[] = [];
  for (const wf of workflows) {
    if (!matchesConditions(wf.match_conditions ?? [], ticket, req.payload ?? {})) continue;

    const steps: any[] = wf.steps ?? [];
    const { data: run } = await supabase
      .from("helpdesk_workflow_runs")
      .insert({
        organization_id: req.organization_id,
        workflow_id: wf.id,
        ticket_id: req.ticket_id ?? null,
        trigger_event: req.trigger_event,
        trigger_payload: req.payload ?? {},
        triggered_by: req.triggered_by ?? null,
        step_count: steps.length,
        context: {},
      })
      .select("id")
      .single();

    if (!run) continue;
    runs.push(run.id);

    await supabase.from("helpdesk_workflows").update({
      run_count: (wf.run_count ?? 0) + 1,
    }).eq("id", wf.id);

    // Fire and forget execution
    executeRun(run.id).catch((e) => console.error("Run failed", run.id, e));
  }

  return { runs };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  const url = new URL(req.url);
  const path = url.pathname.replace(/^.*\/helpdesk-workflow-runner/, "");

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
    console.error("workflow-runner error", e);
    return json(500, { error: e.message ?? String(e) });
  }
});
