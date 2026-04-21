import { createClient } from "npm:@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { type StripeEnv, verifyWebhook } from "../_shared/stripe.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  // Air-gapped / on-prem deployments don't accept webhooks at all.
  if (!isStripeAvailable()) {
    console.log("payments-webhook: Stripe not available in this deployment — ignoring");
    return new Response(JSON.stringify({ received: true, skipped: "stripe_unavailable" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const url = new URL(req.url);
  const env = (url.searchParams.get("env") || "sandbox") as StripeEnv;

  try {
    const event = await verifyWebhook(req, env);
    console.log("Stripe event:", event.type, "env:", env);

    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object, env);
        break;
      case "customer.subscription.created":
      case "customer.subscription.updated":
        await upsertSubscription(event.data.object, env);
        break;
      case "customer.subscription.deleted":
        await cancelSubscription(event.data.object, env);
        break;
      default:
        console.log("Unhandled event:", event.type);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("Webhook error:", e.message);
    return new Response(`Webhook error: ${e.message}`, { status: 400 });
  }
});

async function handleCheckoutCompleted(session: any, env: StripeEnv) {
  console.log("Checkout completed:", session.id, "mode:", session.mode);

  // Only act on one-time payments here. Subscription provisioning is handled by
  // customer.subscription.* events.
  if (session.mode !== "payment") return;

  const meta = session.metadata || {};
  if (meta.purchaseType !== "ai_credits") {
    console.log("One-time payment is not an AI credit pack — skipping.");
    return;
  }

  const orgId = meta.organizationId;
  const userId = meta.userId || null;
  const packId = meta.packId || "ai_credits_pack";
  const credits = parseInt(meta.credits ?? "0", 10);

  if (!orgId || !credits || credits < 1) {
    console.error("Missing organizationId or credits on AI-credit checkout", meta);
    return;
  }

  if (session.payment_status && session.payment_status !== "paid") {
    console.log("Payment not yet paid:", session.payment_status);
    return;
  }

  const { data, error } = await supabase.rpc("grant_ai_credits", {
    _org_id: orgId,
    _credits: credits,
    _pack_id: packId,
    _amount_cents: session.amount_total ?? 0,
    _currency: session.currency ?? "usd",
    _stripe_session_id: session.id,
    _stripe_payment_intent: session.payment_intent ?? null,
    _environment: env,
    _user_id: userId,
    _metadata: { mode: session.mode, customer_email: session.customer_email ?? null },
  });

  if (error) {
    console.error("grant_ai_credits failed:", error.message);
    throw error;
  }
  console.log("AI credits granted:", data);
}

async function upsertSubscription(sub: any, env: StripeEnv) {
  const orgId = sub.metadata?.organizationId;
  if (!orgId) {
    console.error("No organizationId in subscription metadata");
    return;
  }

  const item = sub.items?.data?.[0];
  const lookupKey = item?.price?.lookup_key as string | undefined;
  const interval = item?.price?.recurring?.interval === "year" ? "yearly" : "monthly";

  // Find matching plan via lookup key
  let planId: string | null = null;
  if (lookupKey) {
    const col =
      interval === "yearly" ? "stripe_lookup_key_yearly" : "stripe_lookup_key_monthly";
    const { data: plan } = await supabase
      .from("subscription_plans")
      .select("id")
      .eq(col, lookupKey)
      .maybeSingle();
    planId = plan?.id ?? null;
  }

  if (!planId) {
    console.error("Could not match Stripe price to a plan:", lookupKey);
    return;
  }

  const periodStart = sub.current_period_start;
  const periodEnd = sub.current_period_end;

  await supabase
    .from("organization_subscriptions")
    .upsert(
      {
        organization_id: orgId,
        plan_id: planId,
        stripe_subscription_id: sub.id,
        stripe_customer_id: sub.customer,
        stripe_price_id: item?.price?.id,
        billing_interval: interval,
        status: sub.status,
        environment: env,
        current_period_start: periodStart ? new Date(periodStart * 1000).toISOString() : null,
        current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
        cancel_at_period_end: sub.cancel_at_period_end || false,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "organization_id" },
    );
}

async function cancelSubscription(sub: any, env: StripeEnv) {
  await supabase
    .from("organization_subscriptions")
    .update({
      status: "canceled",
      canceled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_subscription_id", sub.id)
    .eq("environment", env);
}
