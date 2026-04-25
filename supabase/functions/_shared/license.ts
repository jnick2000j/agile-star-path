// Shared license-mode helpers.
//
// On-prem / PO-billed customers operate via organization_licenses rows
// instead of Stripe subscriptions. Edge functions that gate on billing
// (create-checkout, cancel-subscription, payments-webhook) should call
// `isLicenseMode(supabase, orgId)` first and skip Stripe operations when true.

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export interface LicenseEntitlements {
  has_license: boolean;
  license_id?: string;
  deployment_mode?: "cloud" | "on_prem" | "hybrid";
  plan_id?: string | null;
  plan_tier?: string | null;
  seats?: number;
  ai_credits_monthly?: number;
  features_override?: Record<string, unknown>;
  valid_from?: string;
  valid_until?: string | null;
  customer_reference?: string | null;
}

export async function getLicenseEntitlements(
  supabase: SupabaseClient,
  orgId: string,
): Promise<LicenseEntitlements> {
  const { data, error } = await supabase.rpc("get_license_entitlements", { _org_id: orgId });
  if (error || !data) return { has_license: false };
  return data as LicenseEntitlements;
}

export async function isLicenseMode(
  supabase: SupabaseClient,
  orgId: string,
): Promise<boolean> {
  const { data, error } = await supabase.rpc("has_active_license", { _org_id: orgId });
  if (error) return false;
  return Boolean(data);
}

/** Global deployment hint — operators set DEPLOYMENT_MODE=on_prem to disable
 *  Stripe-only flows entirely (e.g. when running air-gapped). */
export function deploymentMode(): "cloud" | "on_prem" | "hybrid" {
  const m = (Deno.env.get("DEPLOYMENT_MODE") || "cloud").toLowerCase();
  if (m === "on_prem" || m === "on-prem" || m === "onprem") return "on_prem";
  if (m === "hybrid") return "hybrid";
  return "cloud";
}

export function isStripeAvailable(): boolean {
  return (
    deploymentMode() !== "on_prem" &&
    Boolean(Deno.env.get("STRIPE_SANDBOX_API_KEY") || Deno.env.get("STRIPE_LIVE_API_KEY"))
  );
}

/** Build a 409 response signalling that a Stripe-only operation is unavailable
 *  because the org is running in license mode (or Stripe is not configured at all). */
export function licenseModeBlockedResponse(
  reason: "license_mode" | "stripe_unavailable",
  corsHeaders: Record<string, string>,
  details?: { organization_id?: string },
): Response {
  const message =
    reason === "license_mode"
      ? "Billing operations are managed via your license — Stripe checkout is disabled for this organization."
      : "Stripe is not available in this deployment.";
  return new Response(
    JSON.stringify({
      error: message,
      code: reason === "license_mode" ? "LICENSE_MODE" : "STRIPE_UNAVAILABLE",
      ...(details || {}),
    }),
    { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

/** Convenience helper for edge functions — returns true when the function should
 *  short-circuit (org is in license mode OR Stripe is not configured). */
export async function shouldSkipStripe(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  orgId: string | null | undefined,
): Promise<{ skip: boolean; reason: "license_mode" | "stripe_unavailable" | null }> {
  if (!isStripeAvailable()) return { skip: true, reason: "stripe_unavailable" };
  if (!orgId) return { skip: false, reason: null };
  const { data } = await supabase.rpc("has_active_license", { _org_id: orgId });
  return data ? { skip: true, reason: "license_mode" } : { skip: false, reason: null };
}
