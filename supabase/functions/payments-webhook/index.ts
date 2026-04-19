import { createClient } from "npm:@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { type StripeEnv, verifyWebhook } from "../_shared/stripe.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

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

async function handleCheckoutCompleted(session: any, _env: StripeEnv) {
  console.log("Checkout completed:", session.id);
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
