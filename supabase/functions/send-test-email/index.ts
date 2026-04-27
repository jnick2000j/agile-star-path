import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendEmail, resolveTransport } from "../_shared/email.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsErr } = await authClient.auth.getClaims(token);
    if (claimsErr || !claims?.claims?.sub) return json({ error: "Invalid token" }, 401);

    const userId = claims.claims.sub as string;

    const body = await req.json().catch(() => ({}));
    const recipient: string = body.recipient || claims.claims.email;
    const organizationId: string | undefined = body.organization_id;

    if (!organizationId) return json({ error: "organization_id required" }, 400);
    if (!recipient) return json({ error: "recipient required" }, 400);

    const sb = createClient(supabaseUrl, serviceKey);

    // Verify caller is admin of this org
    const { data: isAdmin } = await sb.rpc("is_org_admin", {
      _user_id: userId,
      _org_id: organizationId,
    });
    if (!isAdmin) return json({ error: "Forbidden" }, 403);

    const transport = await resolveTransport(organizationId);

    const result = await sendEmail({
      to: recipient,
      subject: "TaskMaster — Test Email",
      html: `<div style="font-family:system-ui,sans-serif;padding:24px">
        <h2>Test email delivered ✅</h2>
        <p>This message was sent via the <strong>${transport}</strong> transport from TaskMaster.</p>
        <p style="color:#64748b;font-size:12px">Sent at ${new Date().toISOString()}</p>
      </div>`,
      organizationId,
    });

    // Record test result
    await sb
      .from("email_settings")
      .update({
        last_test_status: result.ok ? "success" : "failed",
        last_test_at: new Date().toISOString(),
        last_test_error: result.error ?? null,
        updated_by: userId,
      })
      .eq("organization_id", organizationId);

    return json({ ok: result.ok, transport: result.transport, error: result.error }, result.ok ? 200 : 500);
  } catch (e) {
    console.error("send-test-email error", e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
