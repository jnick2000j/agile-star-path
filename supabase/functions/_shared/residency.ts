// Shared residency-policy helper for edge functions.
// Lovable AI gateway processes in us-east. Storage / DB are pinned to the project's region.
// We expose a single helper that:
//   1) Looks up the caller-org's residency settings.
//   2) Decides allow / warn / block.
//   3) Writes an entry to residency_audit_log.
// Returns { ok, decision, status, message } where ok=false should short-circuit the caller.

// deno-lint-ignore-file no-explicit-any
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export const AI_PROCESSING_REGION = "us"; // Lovable AI gateway region.

export interface ResidencyDecision {
  ok: boolean;
  decision: "allowed" | "warned" | "blocked";
  org_region: string;
  enforcement_mode: "warn" | "block";
  message?: string;
  status?: number;
}

/**
 * Evaluate residency policy for an AI / cross-region operation and log it.
 * Pass the *user-scoped* supabase client (so RLS-protected audit insert works).
 */
export async function evaluateResidency(opts: {
  supabase: SupabaseClient;
  organizationId: string | null | undefined;
  userId: string | null | undefined;
  operation: string;
  processingRegion?: string;
  resourceType?: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
}): Promise<ResidencyDecision> {
  const processing = opts.processingRegion ?? AI_PROCESSING_REGION;

  if (!opts.organizationId) {
    // No org context — treat as global, allow.
    return {
      ok: true,
      decision: "allowed",
      org_region: "global",
      enforcement_mode: "warn",
    };
  }

  const { data, error } = await opts.supabase.rpc("check_residency_policy", {
    _org_id: opts.organizationId,
    _processing_region: processing,
  });

  if (error) {
    console.error("[residency] check_residency_policy failed", error);
    // Fail-open in warn mode (don't block users on infra error), but record metadata.
    return {
      ok: true,
      decision: "warned",
      org_region: "unknown",
      enforcement_mode: "warn",
      message: "residency_check_failed",
    };
  }

  const decision = (data?.decision ?? "allowed") as ResidencyDecision["decision"];
  const orgRegion = (data?.org_region ?? "global") as string;
  const mode = (data?.enforcement_mode ?? "warn") as "warn" | "block";

  // Log every region-relevant decision for evidence packs.
  await opts.supabase.from("residency_audit_log").insert({
    organization_id: opts.organizationId,
    user_id: opts.userId ?? null,
    operation: opts.operation,
    org_region: orgRegion,
    processing_region: processing,
    decision,
    enforcement_mode: mode,
    resource_type: opts.resourceType ?? null,
    resource_id: opts.resourceId ?? null,
    metadata: opts.metadata ?? {},
  });

  if (decision === "blocked") {
    return {
      ok: false,
      decision,
      org_region: orgRegion,
      enforcement_mode: mode,
      status: 451, // Unavailable For Legal Reasons
      message: `Operation blocked by data-residency policy: org region "${orgRegion}" does not allow processing in "${processing}".`,
    };
  }

  return { ok: true, decision, org_region: orgRegion, enforcement_mode: mode };
}

/** Convenience: build a service-role client when caller can't supply one. */
export function serviceClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}
