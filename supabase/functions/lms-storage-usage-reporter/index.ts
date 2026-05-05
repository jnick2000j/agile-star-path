// Monthly LMS storage overage reporter.
// For each org with an active Helpdesk+Learning / ITSM+Learning add-on subscription,
// computes overage GB above the 5GB included quota for the previous calendar month,
// records it in lms_storage_overage, and pushes a one-shot invoice item to Stripe at
// $0.25/GB so it bills on the next invoice.
//
// Designed to be invoked by pg_cron once per day; it skips if already reported for the
// current period, and only "closes" the period after the period_end date has passed.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.89.0";
import { type StripeEnv, createStripeClient } from "../_shared/stripe.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const OVERAGE_PRICE_LOOKUP_KEY = "lms_storage_overage_per_gb";

interface RunSummary {
  scanned: number;
  reported: number;
  skipped: number;
  errors: { org_id: string; error: string }[];
}

function previousMonthRange(now = new Date()) {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth(); // 0-indexed; previous month = m-1
  const periodStart = new Date(Date.UTC(y, m - 1, 1));
  const periodEnd = new Date(Date.UTC(y, m, 0)); // last day of prev month
  return {
    period_start: periodStart.toISOString().slice(0, 10),
    period_end: periodEnd.toISOString().slice(0, 10),
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const summary: RunSummary = { scanned: 0, reported: 0, skipped: 0, errors: [] };

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const url = new URL(req.url);
    const env = (url.searchParams.get("env") || "live") as StripeEnv;
    const dryRun = url.searchParams.get("dry_run") === "true";

    const { period_start, period_end } = previousMonthRange();

    // Find all active addon subscriptions that include feature_lms.
    const { data: subs, error: subsErr } = await supabase
      .from("organization_addon_subscriptions")
      .select("organization_id, stripe_subscription_id, stripe_customer_id, status, environment, feature_keys")
      .in("status", ["active", "trialing", "past_due"])
      .contains("feature_keys", ["feature_lms"]);

    if (subsErr) throw subsErr;

    const orgs = (subs ?? []).filter((s: any) => s.environment === env);
    summary.scanned = orgs.length;

    if (orgs.length === 0) {
      return new Response(JSON.stringify({ ok: true, period_start, period_end, summary }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stripe = createStripeClient(env);

    // Resolve the metered overage price by lookup_key (created during the rebrand migration).
    const prices = await stripe.prices.list({ lookup_keys: [OVERAGE_PRICE_LOOKUP_KEY], active: true, limit: 1 });
    const overagePrice = prices.data[0];
    if (!overagePrice) {
      throw new Error(`Stripe price with lookup_key=${OVERAGE_PRICE_LOOKUP_KEY} not found in ${env}`);
    }

    for (const sub of orgs) {
      try {
        // Skip if we've already reported this period for this org.
        const { data: existing } = await supabase
          .from("lms_storage_overage")
          .select("id, reported_at")
          .eq("organization_id", sub.organization_id)
          .eq("period_start", period_start)
          .maybeSingle();

        if (existing?.reported_at) {
          summary.skipped++;
          continue;
        }

        // Get current usage snapshot (real-time tracker — usage at month close).
        const { data: usage } = await supabase
          .from("lms_storage_usage")
          .select("bytes_used, included_gb")
          .eq("organization_id", sub.organization_id)
          .maybeSingle();

        const bytes = Number(usage?.bytes_used ?? 0);
        const includedGb = Number(usage?.included_gb ?? 5);
        const usedGb = bytes / (1024 ** 3);
        const overageGb = Math.max(0, usedGb - includedGb);
        const unitPriceCents = 25;
        const amountCents = Math.round(overageGb * unitPriceCents);

        let stripeInvoiceItemId: string | null = null;

        if (overageGb > 0 && !dryRun && sub.stripe_customer_id) {
          // Create a one-shot invoice item billed on the next subscription invoice.
          const item = await stripe.invoiceItems.create({
            customer: sub.stripe_customer_id,
            price: overagePrice.id,
            quantity: Math.ceil(overageGb), // billed per whole GB
            description: `LMS storage overage ${period_start} – ${period_end} (${overageGb.toFixed(2)} GB over ${includedGb} GB)`,
            subscription: sub.stripe_subscription_id ?? undefined,
            metadata: {
              organization_id: sub.organization_id,
              period_start,
              period_end,
              bytes_used: String(bytes),
            },
          });
          stripeInvoiceItemId = item.id;
        }

        await supabase.from("lms_storage_overage").upsert(
          {
            organization_id: sub.organization_id,
            period_start,
            period_end,
            bytes_used: bytes,
            overage_gb: overageGb,
            unit_price_cents: unitPriceCents,
            amount_cents: amountCents,
            stripe_invoice_item_id: stripeInvoiceItemId,
            reported_at: dryRun ? null : new Date().toISOString(),
          },
          { onConflict: "organization_id,period_start" },
        );

        summary.reported++;
      } catch (err: any) {
        console.error("LMS overage report failed for org", sub.organization_id, err);
        summary.errors.push({ org_id: sub.organization_id, error: err?.message ?? String(err) });
      }
    }

    return new Response(JSON.stringify({ ok: true, period_start, period_end, dry_run: dryRun, summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("lms-storage-usage-reporter error", err);
    return new Response(JSON.stringify({ ok: false, error: err?.message ?? String(err), summary }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
