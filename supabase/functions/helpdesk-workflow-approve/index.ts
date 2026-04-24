// Approver action endpoint: approve or reject a pending workflow approval.
// Uses caller's JWT to verify they are the assignee or a helpdesk admin.
// On approve: resumes the run via helpdesk-workflow-runner.
// On reject: marks run as cancelled.

// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), { status: 405, headers: corsHeaders });
  }

  const auth = req.headers.get("Authorization");
  if (!auth) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: corsHeaders });
  }

  const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: auth } } });
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  const { data: u } = await userClient.auth.getUser();
  if (!u?.user) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: corsHeaders });
  }

  let body: any;
  try { body = await req.json(); } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), { status: 400, headers: corsHeaders });
  }

  const { approval_id, decision, comment } = body;
  if (!approval_id || !["approved", "rejected"].includes(decision)) {
    return new Response(JSON.stringify({ error: "invalid_input" }), { status: 400, headers: corsHeaders });
  }

  const { data: approval } = await admin.from("helpdesk_workflow_approvals")
    .select("*").eq("id", approval_id).single();
  if (!approval) {
    return new Response(JSON.stringify({ error: "not_found" }), { status: 404, headers: corsHeaders });
  }
  if (approval.decision !== "pending") {
    return new Response(JSON.stringify({ error: "already_decided" }), { status: 409, headers: corsHeaders });
  }

  // Authorization: assignee or helpdesk admin
  const isAssignee = approval.assigned_to_user_id === u.user.id;
  let isAdmin = false;
  if (!isAssignee) {
    const { data: roleCheck } = await admin.rpc("is_helpdesk_admin", {
      _user_id: u.user.id, _org_id: approval.organization_id,
    });
    isAdmin = !!roleCheck;
  }
  if (!isAssignee && !isAdmin) {
    return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: corsHeaders });
  }

  await admin.from("helpdesk_workflow_approvals").update({
    decision,
    decided_by: u.user.id,
    decided_at: new Date().toISOString(),
    decision_comment: comment ?? null,
  }).eq("id", approval_id);

  if (decision === "approved") {
    // Resume the run
    await fetch(`${SUPABASE_URL}/functions/v1/helpdesk-workflow-runner/run/${approval.run_id}/resume`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}` },
      body: JSON.stringify({}),
    });
  } else {
    // Cancel the run
    await admin.from("helpdesk_workflow_runs").update({
      status: "cancelled",
      completed_at: new Date().toISOString(),
      error_message: `Rejected by approver: ${comment ?? "no comment"}`,
    }).eq("id", approval.run_id);
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
