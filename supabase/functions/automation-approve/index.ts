// Approve or reject an automation approval; resumes or cancels the run.
// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization") ?? "";
    const token = auth.replace("Bearer ", "");
    const { data: userData } = await createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    }).auth.getUser();
    const userId = userData?.user?.id;
    if (!userId) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const body = await req.json();
    const { approval_id, decision, comment } = body;
    if (!approval_id || !["approved", "rejected"].includes(decision)) {
      return new Response(JSON.stringify({ error: "Invalid input" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: approval, error: aErr } = await supabase.from("automation_approvals").select("*").eq("id", approval_id).single();
    if (aErr || !approval) return new Response(JSON.stringify({ error: "Approval not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (approval.decision !== "pending") return new Response(JSON.stringify({ error: "Already decided" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    await supabase.from("automation_approvals").update({
      decision,
      decided_by: userId,
      decided_at: new Date().toISOString(),
      decision_comment: comment ?? null,
    }).eq("id", approval_id);

    if (decision === "approved") {
      // Resume run
      await fetch(`${SUPABASE_URL}/functions/v1/automation-runner/run/${approval.run_id}/resume`, {
        method: "POST",
        headers: { Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
    } else {
      await supabase.from("automation_runs").update({
        status: "rejected",
        completed_at: new Date().toISOString(),
        error_message: `Approval rejected${comment ? `: ${comment}` : ""}`,
      }).eq("id", approval.run_id);
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error(e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
