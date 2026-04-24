// Helper to fire helpdesk workflow dispatches from the client.
// Best-effort, never blocks UI.
import { supabase } from "@/integrations/supabase/client";

export type HelpdeskTriggerEvent =
  | "ticket_created"
  | "status_changed"
  | "priority_changed"
  | "assigned"
  | "replied"
  | "internal_note_added"
  | "sla_warning"
  | "sla_breached"
  | "idle_timeout"
  | "manual";

export function dispatchHelpdeskWorkflow(args: {
  organization_id: string;
  trigger_event: HelpdeskTriggerEvent;
  ticket_id?: string;
  payload?: Record<string, unknown>;
  triggered_by?: string;
}) {
  // fire and forget
  supabase.functions
    .invoke("helpdesk-workflow-runner/dispatch", { body: args })
    .catch(() => {
      // also try the bare path in case path routing differs
      supabase.functions.invoke("helpdesk-workflow-runner", { body: args }).catch(() => {});
    });
}
