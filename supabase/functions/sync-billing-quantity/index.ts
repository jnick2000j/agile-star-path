// Adjusts the Stripe subscription's "extra organization" line-item quantity
// to match (active_orgs - included_orgs) for a given billing account.
//
// Called from the client after attach_org_to_billing_account /
// detach_org_from_billing_account so Stripe charges follow the in-app state.
//
// Safe to call repeatedly — it is idempotent. If the plan has no
// stripe_extra_org_lookup_key configured, or the account has no Stripe
// subscription, the function returns { skipped: true } without erroring.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.89.0";
import { type StripeEnv, createStripeClient } from "../_shared/stripe.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const authHeader = req.headers.get("authorization")?.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader);
    if (authError || !user) {
      return json({ error: "Unauthorized" }, 401);
    }

    const { billingAccountId } = await req.json();
    if (!billingAccountId) return json({ error: "billingAccountId required" }, 400);

    // Authorisation: caller must be admin in owner-org or platform admin.
    const { data: acct } = await supabase
      .from("billing_accounts")
      .select("owner_organization_id")
      .eq("id", billingAccountId)
      .maybeSingle();
    if (!acct) return json({ error: "Billing account not found" }, 404);

    const [{ data: isAdmin }, { data: hasAccess }] = await Promise.all([
      supabase.rpc("is_admin", { _user_id: user.id }),
      supabase.rpc("has_org_access", {
        _user_id: user.id,
        _org_id: acct.owner_organization_id,
        _required: "admin",
      }),
    ]);
    if (!isAdmin && !hasAccess) return json({ error: "Forbidden" }, 403);

    // Pull everything we need to sync in one shot.
    const { data: infoRows, error: infoErr } = await supabase.rpc(
      "get_billing_account_sync_info",
      { _account_id: billingAccountId },
    );
    if (infoErr) throw infoErr;
    const info = Array.isArray(infoRows) ? infoRows[0] : infoRows;
    if (!info) return json({ skipped: true, reason: "no_subscription" });

    const includedOrgs = info.included_orgs ?? 1;
    const activeCount = info.active_org_count ?? 0;
    const extras = includedOrgs === -1 ? 0 : Math.max(0, activeCount - includedOrgs);

    if (!info.stripe_subscription_id) {
      return json({ skipped: true, reason: "no_stripe_subscription", extras });
    }
    if (!info.extra_org_lookup_key) {
      return json({ skipped: true, reason: "no_extra_price_configured", extras });
    }

    const env = (info.environment || "sandbox") as StripeEnv;
    const stripe = createStripeClient(env);

    // Resolve the Stripe price ID via lookup_key.
    const prices = await stripe.prices.list({ lookup_keys: [info.extra_org_lookup_key], limit: 1 });
    const stripePrice = prices.data[0];
    if (!stripePrice) {
      return json({ skipped: true, reason: "lookup_key_not_found_in_stripe", extras });
    }

    // Find the existing subscription item for this price (if any).
    const sub = await stripe.subscriptions.retrieve(info.stripe_subscription_id);
    const existingItem = sub.items.data.find((it: any) => it.price.id === stripePrice.id);

    if (extras === 0) {
      // Remove the line item if present (no extras means no charge).
      if (existingItem) {
        await stripe.subscriptionItems.del(existingItem.id, { proration_behavior: "create_prorations" });
      }
      return json({ ok: true, action: "removed", extras: 0 });
    }

    if (existingItem) {
      if (existingItem.quantity === extras) {
        return json({ ok: true, action: "noop", extras });
      }
      await stripe.subscriptionItems.update(existingItem.id, {
        quantity: extras,
        proration_behavior: "create_prorations",
      });
      return json({ ok: true, action: "updated", extras });
    }

    await stripe.subscriptionItems.create({
      subscription: info.stripe_subscription_id,
      price: stripePrice.id,
      quantity: extras,
      proration_behavior: "create_prorations",
    });
    return json({ ok: true, action: "added", extras });
  } catch (e: any) {
    console.error("sync-billing-quantity error:", e);
    return json({ error: e.message || "Unknown error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
