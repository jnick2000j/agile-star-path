// Public ticket intake endpoint — no JWT required.
// Authenticates via channel public_token. Rate-limits per IP per hour.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-channel-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (status: number, body: any) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

interface SubmissionBody {
  token?: string;
  subject?: string;
  description?: string;
  email?: string;
  name?: string;
  priority?: "low" | "medium" | "high" | "urgent";
  category?: string;
  metadata?: Record<string, unknown>;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let body: SubmissionBody;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "invalid_json" });
  }

  const token = body.token || req.headers.get("x-channel-token") || "";
  if (!token) return json(401, { error: "missing_token" });

  // Validate
  if (!body.subject || body.subject.length < 3 || body.subject.length > 500) {
    return json(400, { error: "subject_required", message: "Subject must be 3–500 characters" });
  }
  if (body.description && body.description.length > 10000) {
    return json(400, { error: "description_too_long" });
  }

  // Look up channel
  const { data: channel, error: chErr } = await supabase
    .from("helpdesk_intake_channels")
    .select("*")
    .eq("public_token", token)
    .eq("is_active", true)
    .maybeSingle();

  if (chErr || !channel) return json(401, { error: "invalid_token" });

  // Origin check
  const origin = req.headers.get("origin") || "";
  const allowed: string[] = channel.allowed_origins || ["*"];
  if (!allowed.includes("*") && origin && !allowed.includes(origin)) {
    return json(403, { error: "origin_not_allowed" });
  }

  // Email requirement
  if (channel.require_email && !body.email) {
    return json(400, { error: "email_required" });
  }
  if (body.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
    return json(400, { error: "invalid_email" });
  }

  const ip =
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    "unknown";
  const userAgent = req.headers.get("user-agent") || "";

  // Rate limit: count successes in last hour from this IP+channel
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count: recent } = await supabase
    .from("helpdesk_intake_submissions")
    .select("id", { count: "exact", head: true })
    .eq("channel_id", channel.id)
    .eq("ip_address", ip)
    .eq("status", "success")
    .gte("created_at", since);

  if ((recent ?? 0) >= channel.rate_limit_per_hour) {
    await supabase.from("helpdesk_intake_submissions").insert({
      organization_id: channel.organization_id,
      channel_id: channel.id,
      submitter_email: body.email,
      submitter_name: body.name,
      subject: body.subject,
      ip_address: ip,
      user_agent: userAgent,
      status: "rate_limited",
      error_message: "Hourly rate limit exceeded",
    });
    return json(429, { error: "rate_limited", retry_after: 3600 });
  }

  // Generate reference number
  const refSuffix = Math.random().toString(36).slice(2, 8).toUpperCase();
  const reference = `T-${Date.now().toString(36).toUpperCase()}-${refSuffix}`;

  const { data: ticket, error: tErr } = await supabase
    .from("helpdesk_tickets")
    .insert({
      organization_id: channel.organization_id,
      reference_number: reference,
      subject: body.subject,
      description: body.description || null,
      ticket_type: "incident",
      category: body.category || null,
      priority: body.priority || channel.default_priority,
      status: "new",
      source: channel.channel_type === "api" ? "api" : "web",
      reporter_email: body.email || null,
      reporter_name: body.name || null,
      assignee_id: channel.default_assignee_id || null,
      metadata: {
        intake_channel_id: channel.id,
        intake_channel_name: channel.name,
        ...(body.metadata || {}),
      },
    })
    .select("id, reference_number")
    .single();

  if (tErr) {
    await supabase.from("helpdesk_intake_submissions").insert({
      organization_id: channel.organization_id,
      channel_id: channel.id,
      submitter_email: body.email,
      submitter_name: body.name,
      subject: body.subject,
      ip_address: ip,
      user_agent: userAgent,
      status: "error",
      error_message: tErr.message,
    });
    return json(500, { error: "ticket_creation_failed", message: tErr.message });
  }

  await supabase.from("helpdesk_intake_submissions").insert({
    organization_id: channel.organization_id,
    channel_id: channel.id,
    ticket_id: ticket.id,
    submitter_email: body.email,
    submitter_name: body.name,
    subject: body.subject,
    ip_address: ip,
    user_agent: userAgent,
    status: "success",
  });

  return json(200, {
    success: true,
    ticket_id: ticket.id,
    reference_number: ticket.reference_number,
  });
});
