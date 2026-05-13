// Reconcile imported users.
//
// Scans migration_items.payload.external for { assignee_email | reporter_email }
// recorded during a previous migration run, looks up matching profiles by email,
// and back-fills the corresponding entity's assignee/owner column when empty.
//
// Body:
//   { organization_id: string, dry_run?: boolean }
// Response:
//   { matched: N, updated: N, by_entity: { task: {...}, issue: {...}, risk: {...} } }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const ENTITY_TARGETS: Record<string, { table: string; column: string }> = {
  task: { table: "tasks", column: "assigned_to" },
  issue: { table: "issues", column: "owner_id" },
  risk: { table: "risks", column: "owner_id" },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Auth caller
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.replace("Bearer ", "");
    const { data: { user: caller } } = await admin.auth.getUser(token);
    if (!caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const orgId: string = body?.organization_id;
    const dryRun: boolean = !!body?.dry_run;
    if (!orgId) {
      return new Response(JSON.stringify({ error: "organization_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Caller must be platform admin or org admin for the target org.
    const { data: platformRoles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("role", "admin");
    const isPlatformAdmin = (platformRoles?.length ?? 0) > 0;
    if (!isPlatformAdmin) {
      const { data: access } = await admin
        .from("user_organization_access")
        .select("access_level")
        .eq("user_id", caller.id)
        .eq("organization_id", orgId)
        .maybeSingle();
      if (access?.access_level !== "admin") {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Pull candidate items.
    const { data: items, error } = await admin
      .from("migration_items")
      .select("id, entity_type, internal_id, payload")
      .eq("organization_id", orgId)
      .eq("status", "created")
      .not("internal_id", "is", null)
      .not("payload", "is", null)
      .limit(5000);
    if (error) throw error;

    // Collect distinct emails to resolve in one pass.
    interface Candidate {
      itemId: string;
      entityType: string;
      internalId: string;
      email: string;
    }
    const candidates: Candidate[] = [];
    for (const it of items ?? []) {
      const ext = (it as any).payload?.external;
      if (!ext) continue;
      const e = String(ext.assignee_email ?? ext.reporter_email ?? "").trim().toLowerCase();
      if (!e) continue;
      candidates.push({
        itemId: (it as any).id,
        entityType: (it as any).entity_type,
        internalId: (it as any).internal_id,
        email: e,
      });
    }

    if (!candidates.length) {
      return new Response(
        JSON.stringify({ matched: 0, updated: 0, by_entity: {} }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const distinctEmails = Array.from(new Set(candidates.map((c) => c.email)));
    const { data: profiles } = await admin
      .from("profiles")
      .select("user_id, email")
      .in("email", distinctEmails);
    const emailToUser = new Map<string, string>();
    for (const p of profiles ?? []) {
      emailToUser.set(String((p as any).email).toLowerCase(), (p as any).user_id);
    }

    const byEntity: Record<string, { matched: number; updated: number; skipped_filled: number }> = {};
    let totalMatched = 0;
    let totalUpdated = 0;

    for (const c of candidates) {
      const target = ENTITY_TARGETS[c.entityType];
      if (!target) continue;
      const userId = emailToUser.get(c.email);
      if (!userId) continue;
      totalMatched += 1;
      const e = (byEntity[c.entityType] ??= { matched: 0, updated: 0, skipped_filled: 0 });
      e.matched += 1;

      if (dryRun) continue;

      // Only update when target column is currently null.
      const { data: row } = await admin
        .from(target.table)
        .select(`id, ${target.column}, organization_id`)
        .eq("id", c.internalId)
        .eq("organization_id", orgId)
        .maybeSingle();
      if (!row) continue;
      if ((row as any)[target.column]) {
        e.skipped_filled += 1;
        continue;
      }
      const { error: updErr } = await admin
        .from(target.table)
        .update({ [target.column]: userId })
        .eq("id", c.internalId)
        .eq("organization_id", orgId);
      if (!updErr) {
        e.updated += 1;
        totalUpdated += 1;
      }
    }

    return new Response(
      JSON.stringify({
        matched: totalMatched,
        updated: totalUpdated,
        candidates: candidates.length,
        by_entity: byEntity,
        dry_run: dryRun,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
