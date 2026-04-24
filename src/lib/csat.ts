// Helper invoked client-side when a ticket transitions to "closed".
// Creates a csat_responses row (with a unique token) and sends the survey email
// via the existing helpdesk-notify edge function. Safe to call multiple times —
// the unique constraint on (ticket_id) prevents duplicates.

import { supabase } from "@/integrations/supabase/client";

function generateToken(): string {
  const arr = new Uint8Array(24);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function triggerCSATForClosedTicket(ticket: {
  id: string;
  organization_id: string;
  reporter_email?: string | null;
  reference_number?: string | null;
  subject?: string | null;
}): Promise<void> {
  if (!ticket.reporter_email) return;

  // Check survey is enabled and ticket type/priority eligible
  const { data: survey } = await supabase
    .from("csat_surveys")
    .select("enabled, ticket_types, min_priority")
    .eq("organization_id", ticket.organization_id)
    .maybeSingle();

  if (!survey || !survey.enabled) return;

  // Eligibility check (defensive — fetch full ticket for type/priority)
  const { data: full } = await supabase
    .from("helpdesk_tickets")
    .select("ticket_type, priority")
    .eq("id", ticket.id)
    .maybeSingle();
  if (!full) return;
  if (survey.ticket_types?.length && !survey.ticket_types.includes(full.ticket_type)) return;
  if (survey.min_priority) {
    const order = ["low", "medium", "high", "urgent"];
    if (order.indexOf(full.priority) < order.indexOf(survey.min_priority)) return;
  }

  // Already exists?
  const { data: existing } = await supabase
    .from("csat_responses")
    .select("id, sent_at")
    .eq("ticket_id", ticket.id)
    .maybeSingle();

  if (existing?.sent_at) return;

  const token = generateToken();
  const expires = new Date();
  expires.setDate(expires.getDate() + 30);

  let finalToken = token;
  if (!existing) {
    const { data: inserted, error: insErr } = await supabase
      .from("csat_responses")
      .insert({
        organization_id: ticket.organization_id,
        ticket_id: ticket.id,
        reporter_email: ticket.reporter_email,
        token,
        expires_at: expires.toISOString(),
        sent_at: new Date().toISOString(),
      })
      .select("token")
      .single();
    if (insErr || !inserted) return;
    finalToken = inserted.token;
  } else {
    const { data: row } = await supabase
      .from("csat_responses")
      .update({ sent_at: new Date().toISOString() })
      .eq("id", existing.id)
      .select("token")
      .single();
    if (row) finalToken = row.token;
  }

  const finalUrl = `${window.location.origin}/csat/${finalToken}`;

  // Send notification (best-effort)
  await supabase.functions.invoke("helpdesk-notify", {
    body: {
      ticket_id: ticket.id,
      notification_type: "csat_survey",
      recipient_email: ticket.reporter_email,
      metadata: { survey_url: finalUrl },
    },
  }).catch(() => {});
}
