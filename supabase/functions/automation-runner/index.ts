// Generic automation runner for any module.
// POST /dispatch  → start runs for matching workflows
// POST /run/:id/resume → resume after approval
// POST /workflow/:id/test → dry-run

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

// Maps module → DB table name for entity loading & field updates
const MODULE_TABLE: Record<string, string> = {
  project: "projects",
  programme: "programmes",
  product: "products",
  risk: "risks",
  issue: "issues",
  benefit: "benefits",
  change: "change_management_requests",
  task: "tasks",
  milestone: "milestones",
  stakeholder: "stakeholders",
  lesson: "lessons_learned",
  quality: "quality_criteria",
  exception: "exceptions",
  kb_article: "kb_articles",
  helpdesk: "helpdesk_tickets",
};

const json = (status: number, body: any) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

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
    case "gt": return Number(left) > Number(right);
    case "lt": return Number(left) < Number(right);
    case "gte": return Number(left) >= Number(right);
    case "lte": return Number(left) <= Number(right);
    default: return false;
  }
}

function matchesConditions(conditions: any[], entity: any, payload: any): boolean {
  if (!Array.isArray(conditions) || conditions.length === 0) return true;
  for (const c of conditions) {
    const left = entity?.[c.field] ?? payload?.[c.field];
    if (!compare(left, c.op, c.value)) return false;
  }
  return true;
}

function interpolate(value: any, scope: Record<string, any>): any {
  if (typeof value === "string") {
    return value.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, path) => {
      const parts = String(path).split(".");
      let v: any = scope;
      for (const p of parts) v = v?.[p];
      return v == null ? "" : typeof v === "string" ? v : JSON.stringify(v);
    });
  }
  if (Array.isArray(value)) return value.map(v => interpolate(v, scope));
  if (value && typeof value === "object") {
    const out: any = {};
    for (const [k, v] of Object.entries(value)) out[k] = interpolate(v, scope);
    return out;
  }
  return value;
}

async function callLovableAI(opts: {
  model?: string;
  system: string;
  user: string;
  json_schema?: any;
}): Promise<{ content: string; model: string; tokens?: number }> {
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");
  const model = opts.model || "google/gemini-2.5-flash";
  const body: any = {
    model,
    messages: [
      { role: "system", content: opts.system },
      { role: "user", content: opts.user },
    ],
  };
  if (opts.json_schema) {
    body.tools = [{
      type: "function",
      function: {
        name: "respond",
        description: "Return structured response",
        parameters: opts.json_schema,
      },
    }];
    body.tool_choice = { type: "function", function: { name: "respond" } };
  }
  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`AI gateway ${resp.status}: ${t.substring(0, 200)}`);
  }
  const data = await resp.json();
  const choice = data?.choices?.[0];
  let content = choice?.message?.content || "";
  const toolCall = choice?.message?.tool_calls?.[0];
  if (toolCall?.function?.arguments) content = toolCall.function.arguments;
  return { content, model, tokens: data?.usage?.total_tokens };
}

async function loadEntity(module: string, entity_id?: string): Promise<any> {
  if (!entity_id) return null;
  const table = MODULE_TABLE[module];
  if (!table) return null;
  const { data } = await supabase.from(table).select("*").eq("id", entity_id).maybeSingle();
  return data;
}

async function executeStep(args: {
  run: any;
  step: any;
  step_index: number;
  scope: Record<string, any>;
}): Promise<{ status: "success" | "failed" | "awaiting_approval"; output: any; error?: string; ai_model?: string; ai_tokens?: number }> {
  const { run, step, step_index, scope } = args;
  const cfg = interpolate(step.config || {}, scope);

  switch (step.type) {
    case "condition": {
      const ok = matchesConditions(cfg.conditions || [], scope.entity, scope.payload);
      return { status: "success", output: { matched: ok, ...(ok ? {} : { halt: true }) } };
    }

    case "ai_analyze":
    case "ai_triage":
    case "ai_summarize":
    case "ai_draft":
    case "ai_sentiment":
    case "ai_score":
    case "ai_suggest": {
      const system = cfg.system || `You are an expert assistant for ${run.module}. Return concise, actionable output.`;
      const user = cfg.prompt || `Analyze this ${run.module}: ${JSON.stringify(scope.entity || {}).substring(0, 4000)}`;
      const r = await callLovableAI({ model: cfg.model, system, user, json_schema: cfg.schema });
      return { status: "success", output: { result: r.content, output_var: cfg.output_var || "ai_result" }, ai_model: r.model, ai_tokens: r.tokens };
    }

    case "set_field":
    case "update_entity": {
      const table = MODULE_TABLE[run.module];
      if (!table || !run.entity_id) return { status: "failed", output: null, error: "No entity to update" };
      const updates = cfg.updates || (cfg.field ? { [cfg.field]: cfg.value } : {});
      if (!Object.keys(updates).length) return { status: "success", output: { skipped: true } };
      const { error } = await supabase.from(table).update(updates).eq("id", run.entity_id);
      if (error) return { status: "failed", output: null, error: error.message };
      return { status: "success", output: { updated: updates } };
    }

    case "assign": {
      const table = MODULE_TABLE[run.module];
      if (!table || !run.entity_id) return { status: "failed", output: null, error: "No entity" };
      const field = cfg.assignee_field || "owner_id";
      const { error } = await supabase.from(table).update({ [field]: cfg.user_id }).eq("id", run.entity_id);
      if (error) return { status: "failed", output: null, error: error.message };
      return { status: "success", output: { assigned: cfg.user_id, field } };
    }

    case "add_tag": {
      const table = MODULE_TABLE[run.module];
      if (!table || !run.entity_id) return { status: "failed", output: null, error: "No entity" };
      const current = scope.entity?.tags || [];
      const tags = Array.from(new Set([...current, ...(Array.isArray(cfg.tags) ? cfg.tags : [cfg.tag])])).filter(Boolean);
      const { error } = await supabase.from(table).update({ tags }).eq("id", run.entity_id);
      if (error) return { status: "failed", output: null, error: error.message };
      return { status: "success", output: { tags } };
    }

    case "notify":
    case "send_email": {
      // Insert notification rows
      const recipients = Array.isArray(cfg.recipients) ? cfg.recipients : [];
      const inserts = recipients.map((uid: string) => ({
        user_id: uid,
        organization_id: run.organization_id,
        title: cfg.title || `Automation: ${run.trigger_event}`,
        message: cfg.message || "",
        link: cfg.link || null,
        notification_type: "automation",
      }));
      if (inserts.length) {
        await supabase.from("notifications").insert(inserts);
      }
      return { status: "success", output: { notified: inserts.length } };
    }

    case "request_approval": {
      const { data: appr, error } = await supabase.from("automation_approvals").insert({
        organization_id: run.organization_id,
        run_id: run.id,
        module: run.module,
        entity_type: run.entity_type,
        entity_id: run.entity_id,
        title: cfg.title || `Approval needed for ${run.module}`,
        description: cfg.description || "",
        context: { entity: scope.entity, ai: scope.context },
        assigned_to_user_id: cfg.assignee_user_id || null,
        assigned_to_role: cfg.assignee_role || null,
        due_at: cfg.due_at || null,
      }).select().single();
      if (error) return { status: "failed", output: null, error: error.message };
      // Notify approver
      if (cfg.assignee_user_id) {
        await supabase.from("notifications").insert({
          user_id: cfg.assignee_user_id,
          organization_id: run.organization_id,
          title: `Approval requested: ${cfg.title || run.module}`,
          message: cfg.description || "Please review.",
          notification_type: "approval_request",
          link: `/admin/automations?approval=${appr.id}`,
        });
      }
      return { status: "awaiting_approval", output: { approval_id: appr.id } };
    }

    case "create_task": {
      const { data, error } = await supabase.from("tasks").insert({
        organization_id: run.organization_id,
        title: cfg.title || `Task from automation`,
        description: cfg.description,
        status: cfg.status || "todo",
        priority: cfg.priority || "medium",
        assignee_id: cfg.assignee_id,
        project_id: cfg.project_id || (run.module === "project" ? run.entity_id : null),
      }).select().single();
      if (error) return { status: "failed", output: null, error: error.message };
      return { status: "success", output: { task_id: data?.id } };
    }

    case "log_note": {
      // Add an entity update
      await supabase.from("entity_updates").insert({
        organization_id: run.organization_id,
        entity_type: run.entity_type || run.module,
        entity_id: run.entity_id,
        update_type: "automation",
        content: cfg.message || cfg.note || "Automation note",
      });
      return { status: "success", output: { logged: true } };
    }

    default:
      return { status: "failed", output: null, error: `Unknown step type: ${step.type}` };
  }
}

async function executeRun(run_id: string) {
  const { data: run } = await supabase.from("automation_runs").select("*, automation_workflows(*)").eq("id", run_id).single();
  if (!run) return;
  const workflow = run.automation_workflows;
  const steps = (workflow?.steps || []) as any[];

  await supabase.from("automation_runs").update({
    status: "running",
    started_at: run.started_at || new Date().toISOString(),
    step_count: steps.length,
  }).eq("id", run_id);

  const entity = await loadEntity(run.module, run.entity_id);
  const ctx: Record<string, any> = run.context || {};
  const scope = { entity, payload: run.trigger_payload, context: ctx };

  for (let i = run.current_step_index; i < steps.length; i++) {
    const step = steps[i];
    const { data: exec } = await supabase.from("automation_step_executions").insert({
      run_id,
      organization_id: run.organization_id,
      step_index: i,
      step_type: step.type,
      step_label: step.label || step.type,
      status: "running",
      started_at: new Date().toISOString(),
      input: step.config || {},
    }).select().single();

    let result;
    try {
      result = await executeStep({ run, step, step_index: i, scope });
    } catch (e: any) {
      result = { status: "failed" as const, output: null, error: e.message };
    }

    await supabase.from("automation_step_executions").update({
      status: result.status,
      output: result.output,
      error_message: result.error,
      ai_model: result.ai_model,
      ai_tokens: result.ai_tokens,
      completed_at: new Date().toISOString(),
    }).eq("id", exec.id);

    if (result.status === "failed") {
      await supabase.from("automation_runs").update({
        status: "failed",
        error_message: result.error,
        current_step_index: i,
        completed_at: new Date().toISOString(),
      }).eq("id", run_id);
      return;
    }

    // Stash AI output into context
    if (result.output?.output_var && result.output?.result) {
      ctx[result.output.output_var] = result.output.result;
      scope.context = ctx;
    }

    if (result.status === "awaiting_approval") {
      await supabase.from("automation_runs").update({
        status: "awaiting_approval",
        current_step_index: i,
        context: ctx,
      }).eq("id", run_id);
      return;
    }

    // Halt if a condition step said so
    if (result.output?.halt) {
      await supabase.from("automation_runs").update({
        status: "completed",
        current_step_index: i + 1,
        context: ctx,
        completed_at: new Date().toISOString(),
      }).eq("id", run_id);
      return;
    }
  }

  await supabase.from("automation_runs").update({
    status: "completed",
    current_step_index: steps.length,
    context: ctx,
    completed_at: new Date().toISOString(),
  }).eq("id", run_id);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/automation-runner/, "");

  try {
    if (path === "/dispatch" && req.method === "POST") {
      const body = await req.json();
      const { organization_id, module, trigger_event, entity_type, entity_id, payload, triggered_by } = body;

      const { data: workflows } = await supabase
        .from("automation_workflows")
        .select("*")
        .eq("organization_id", organization_id)
        .eq("module", module)
        .eq("trigger_event", trigger_event)
        .eq("is_active", true)
        .order("priority", { ascending: true });

      const entity = await loadEntity(module, entity_id);
      const started: string[] = [];
      for (const wf of workflows || []) {
        if (!matchesConditions((wf as any).match_conditions, entity, payload || {})) continue;
        const { data: run } = await supabase.from("automation_runs").insert({
          organization_id,
          workflow_id: wf.id,
          module,
          entity_type: entity_type || module,
          entity_id,
          trigger_event,
          trigger_payload: payload || {},
          triggered_by,
          status: "pending",
          step_count: ((wf as any).steps || []).length,
        }).select().single();
        if (run) {
          started.push(run.id);
          // Fire and forget
          executeRun(run.id).catch(e => console.error("run error", run.id, e));
        }
      }
      return json(200, { started, count: started.length });
    }

    const resumeMatch = path.match(/^\/run\/([0-9a-f-]+)\/resume$/);
    if (resumeMatch && req.method === "POST") {
      const run_id = resumeMatch[1];
      const { data: run } = await supabase.from("automation_runs").select("*").eq("id", run_id).single();
      if (run && run.status === "awaiting_approval") {
        await supabase.from("automation_runs").update({
          current_step_index: run.current_step_index + 1,
        }).eq("id", run_id);
        executeRun(run_id).catch(e => console.error("resume error", e));
      }
      return json(200, { resumed: true });
    }

    return json(404, { error: "Not found" });
  } catch (e: any) {
    console.error(e);
    return json(500, { error: e.message || "Server error" });
  }
});
