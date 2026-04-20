// Shared AI-credits helper used by every AI edge function.
// Uses the SECURITY DEFINER `consume_ai_credits` RPC so we get atomic
// check-and-increment semantics (no double-spend on concurrent calls).
//
// Behaviour:
//  - No org id supplied → unmetered, allowed (e.g. anonymous tooling calls).
//  - Quota = -1         → unlimited tier, logged but not counted.
//  - Quota exceeded     → returns ok:false with HTTP 402 ("payment required")
//                          style payload that callers should surface.

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export interface ConsumeCreditsParams {
  supabase: SupabaseClient;
  organizationId: string | null | undefined;
  userId?: string | null;
  amount?: number;
  actionType: string;
  model?: string | null;
  metadata?: Record<string, unknown>;
}

export interface CreditResult {
  ok: boolean;
  status?: number;
  message?: string;
  quota: number;
  used: number;
  remaining: number;
  unlimited: boolean;
  period_start?: string;
}

export async function consumeAiCredits(params: ConsumeCreditsParams): Promise<CreditResult> {
  const { supabase, organizationId, userId, amount = 1, actionType, model, metadata } = params;

  // Unmetered call (no org context).
  if (!organizationId) {
    return { ok: true, quota: -1, used: 0, remaining: -1, unlimited: true };
  }

  const { data, error } = await supabase.rpc("consume_ai_credits", {
    _org_id: organizationId,
    _amount: amount,
    _action_type: actionType,
    _model: model ?? null,
    _user_id: userId ?? null,
    _metadata: metadata ?? {},
  });

  if (error) {
    console.error("consume_ai_credits RPC failed", error);
    // Fail-open so a transient DB error doesn't break the AI feature, but log loudly.
    return { ok: true, quota: -1, used: 0, remaining: -1, unlimited: true };
  }

  const result = (data ?? {}) as Record<string, unknown>;
  const allowed = Boolean(result.allowed);
  const quota = Number(result.quota ?? 0);
  const used = Number(result.used ?? 0);
  const remaining = Number(result.remaining ?? 0);
  const unlimited = Boolean(result.unlimited);

  if (!allowed) {
    return {
      ok: false,
      status: 402,
      message:
        quota === 0
          ? "AI credits are not enabled on this plan. Upgrade to access AI features."
          : `Monthly AI credit allowance reached (${used}/${quota}). Upgrade your plan or wait for the next cycle.`,
      quota,
      used,
      remaining,
      unlimited,
      period_start: result.period_start as string | undefined,
    };
  }

  return {
    ok: true,
    quota,
    used,
    remaining,
    unlimited,
    period_start: result.period_start as string | undefined,
  };
}
