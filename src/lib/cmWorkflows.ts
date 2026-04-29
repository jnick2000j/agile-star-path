// Helper to fire change-management workflow dispatches from the client.
// Best-effort, never blocks UI.
import { supabase } from "@/integrations/supabase/client";

export type CMTriggerEvent =
  | "change_created"
  | "status_changed"
  | "urgency_changed"
  | "impact_changed"
  | "assigned"
  | "approval_requested"
  | "approval_decided"
  | "scheduled"
  | "implementation_started"
  | "implemented"
  | "failed"
  | "cancelled"
  | "idle_timeout"
  | "manual";

export function dispatchCMWorkflow(args: {
  organization_id: string;
  trigger_event: CMTriggerEvent;
  change_request_id?: string;
  payload?: Record<string, unknown>;
  triggered_by?: string;
}) {
  supabase.functions
    .invoke("cm-workflow-runner/dispatch", { body: args })
    .catch(() => {
      supabase.functions.invoke("cm-workflow-runner", { body: args }).catch(() => {});
    });
}
