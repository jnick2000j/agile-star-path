// Promote a release into an environment.
// - Creates/updates a release_promotions row
// - If the target environment has auto_create_change_request=true, also creates a change_management_requests row
//   and links it back via release_promotions.change_request_id and change_management_requests.release_id
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
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization") ?? "";
    const token = auth.replace("Bearer ", "");
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData } = await userClient.auth.getUser();
    const userId = userData?.user?.id;
    if (!userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { release_id, environment_id, notes, status: requestedStatus } = body ?? {};
    if (!release_id || !environment_id) {
      return new Response(JSON.stringify({ error: "release_id and environment_id are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Authorize via RLS by checking the release through the user client
    const { data: release, error: relErr } = await userClient
      .from("releases").select("*").eq("id", release_id).maybeSingle();
    if (relErr || !release) {
      return new Response(JSON.stringify({ error: "Release not found or no access" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: env, error: envErr } = await admin
      .from("release_environments").select("*").eq("id", environment_id).maybeSingle();
    if (envErr || !env || env.product_id !== release.product_id) {
      return new Response(JSON.stringify({ error: "Environment not found for this release's product" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const status = requestedStatus ?? "succeeded";
    const now = new Date().toISOString();

    // Upsert promotion row (one per release+environment+attempt — we always insert a new attempt)
    const { data: promo, error: promoErr } = await admin
      .from("release_promotions")
      .insert({
        organization_id: release.organization_id,
        release_id,
        environment_id,
        status,
        started_at: now,
        completed_at: ["succeeded", "failed", "rolled_back", "skipped"].includes(status) ? now : null,
        promoted_by: userId,
        notes: notes ?? null,
      })
      .select("*").single();
    if (promoErr) throw promoErr;

    let changeRequestId: string | null = null;

    // Auto-create change request if env requires it and promotion succeeded (or in_progress to production)
    if (env.auto_create_change_request && (status === "in_progress" || status === "succeeded")) {
      const { data: cr, error: crErr } = await admin
        .from("change_management_requests")
        .insert({
          organization_id: release.organization_id,
          title: `Release ${release.version} → ${env.name}`,
          description: `Auto-created for promotion of release "${release.name}" (${release.version}) to ${env.name}.\n\n${release.release_notes ?? ""}`,
          change_type: env.is_production ? "normal" : "standard",
          status: "pending",
          urgency: release.is_hotfix ? "high" : "medium",
          impact: env.is_production ? "high" : "medium",
          reason: `Software release promotion to ${env.name}`,
          implementation_plan: release.release_notes ?? null,
          rollback_plan: release.rollback_plan ?? null,
          product_id: release.product_id,
          release_id: release.id,
          requested_by: userId,
          owner_id: release.release_manager_id ?? userId,
          planned_start_at: now,
        })
        .select("id").single();
      if (crErr) {
        console.error("CR create failed", crErr);
      } else {
        changeRequestId = cr.id;
        await admin.from("release_promotions")
          .update({ change_request_id: cr.id })
          .eq("id", promo.id);
      }
    }

    // If promoted to production successfully, mark the release as released
    if (env.is_production && status === "succeeded") {
      await admin.from("releases")
        .update({ status: "released", released_at: now })
        .eq("id", release.id);
    }

    return new Response(
      JSON.stringify({ ok: true, promotion: { ...promo, change_request_id: changeRequestId } }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
