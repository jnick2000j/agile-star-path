import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

    const body = await req.json().catch(() => ({}));
    const {
      scope = "org",
      organization_id,
      from_date,
      to_date,
      category,
      status,
      format = "csv",
    } = body;

    // Authorization
    if (scope === "platform") {
      const { data: isAdmin } = await supabase.rpc("is_admin", { _user_id: user.id });
      if (!isAdmin) {
        return new Response(JSON.stringify({ error: "Platform admin required" }), { status: 403, headers: corsHeaders });
      }
    } else if (organization_id) {
      const { data: hasAccess } = await supabase.rpc("has_org_access", {
        _user_id: user.id, _org_id: organization_id, _min_level: "admin",
      });
      if (!hasAccess) {
        return new Response(JSON.stringify({ error: "Org admin required" }), { status: 403, headers: corsHeaders });
      }
    }

    let q = supabase.from("auth_audit_log").select("*").order("created_at", { ascending: false }).limit(50000);
    if (scope === "org" && organization_id) q = q.eq("organization_id", organization_id);
    if (from_date) q = q.gte("created_at", from_date);
    if (to_date) q = q.lte("created_at", to_date);
    if (category && category !== "all") q = q.eq("event_category", category);
    if (status && status !== "all") q = q.eq("status", status);

    const { data: logs, error } = await q;
    if (error) throw error;

    // Log the export itself
    await supabase.rpc("log_audit_event", {
      _event_type: "audit_log_exported",
      _event_category: "data",
      _organization_id: organization_id ?? null,
      _status: "success",
      _metadata: {
        scope, format, row_count: logs?.length ?? 0,
        from_date, to_date, category, status,
      },
    });

    if (format === "json") {
      return new Response(JSON.stringify({ logs, exported_at: new Date().toISOString(), row_count: logs?.length ?? 0 }, null, 2), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // CSV
    const headers = ["timestamp", "event_type", "event_category", "user_email", "status", "organization_id", "target_entity_type", "target_entity_id", "ip_address", "user_agent", "metadata"];
    const rows = (logs ?? []).map((l: any) => [
      l.created_at, l.event_type, l.event_category, l.user_email ?? "",
      l.status, l.organization_id ?? "", l.target_entity_type ?? "", l.target_entity_id ?? "",
      l.ip_address ?? "", (l.user_agent ?? "").replace(/"/g, '""'),
      JSON.stringify(l.metadata ?? {}),
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");

    return new Response(csv, {
      headers: { ...corsHeaders, "Content-Type": "text/csv", "Content-Disposition": `attachment; filename="audit-log-${new Date().toISOString().slice(0,10)}.csv"` },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: corsHeaders });
  }
});
