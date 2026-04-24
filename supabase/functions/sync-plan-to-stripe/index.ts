import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "npm:@supabase/supabase-js@2.95.0/cors";
import { createClient } from "npm:@supabase/supabase-js@2.95.0";
import { type StripeEnv, createStripeClient } from "../_shared/stripe.ts";

/**
 * Sync a plan's prices to Stripe.
 * Strategy: create new Stripe price (transfers lookup_key from old to new),
 * archive the old Stripe price. Existing subscribers grandfather to old price
 * unless `migrationStrategy === 'migrate_all'`, in which case all active
 * subscribers are updated to the new price (proration handled by Stripe).
 */
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
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify platform admin
    const { data: isAdminData } = await supabase.rpc("is_admin", { _user_id: user.id });
    if (!isAdminData) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const {
      planId,
      environment,
      migrationStrategy = "grandfather", // 'grandfather' | 'migrate_all'
      notes,
    } = await req.json();

    if (!planId) {
      return new Response(JSON.stringify({ error: "planId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const env = (environment || "sandbox") as StripeEnv;
    if (!isStripeAvailable()) {
      return licenseModeBlockedResponse("stripe_unavailable", corsHeaders);
    }
    const stripe = createStripeClient(env);

    // Load plan
    const { data: plan, error: planErr } = await supabase
      .from("subscription_plans")
      .select("*")
      .eq("id", planId)
      .single();
    if (planErr || !plan) {
      return new Response(JSON.stringify({ error: "Plan not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (Number(plan.price_monthly) <= 0 && Number(plan.price_yearly) <= 0) {
      return new Response(
        JSON.stringify({ error: "Free plans don't need Stripe sync" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Ensure product exists in Stripe
    let stripeProductId = plan.stripe_product_id as string | null;
    if (!stripeProductId) {
      const slug = (plan.name as string).toLowerCase().replace(/[^a-z0-9]+/g, "_");
      stripeProductId = `plan_${slug}`;
      try {
        await stripe.products.retrieve(stripeProductId);
      } catch {
        await stripe.products.create({
          id: stripeProductId,
          name: plan.name,
          description: plan.description || undefined,
        });
      }
    }

    const results: Array<{ interval: string; lookup_key: string; new_price_id: string; old_price_id: string | null }> = [];

    for (const interval of ["monthly", "yearly"] as const) {
      const amount = Number(interval === "monthly" ? plan.price_monthly : plan.price_yearly);
      if (amount <= 0) continue;

      const lookupKey =
        (interval === "monthly"
          ? plan.stripe_lookup_key_monthly
          : plan.stripe_lookup_key_yearly) ||
        `plan_${(plan.name as string).toLowerCase().replace(/[^a-z0-9]+/g, "_")}_${interval}`;

      // Find existing price under this lookup_key
      const existing = await stripe.prices.list({ lookup_keys: [lookupKey], limit: 1 });
      const oldPrice = existing.data[0] || null;

      // If amount unchanged, no-op
      if (oldPrice && oldPrice.unit_amount === Math.round(amount * 100)) {
        results.push({
          interval,
          lookup_key: lookupKey,
          new_price_id: oldPrice.id,
          old_price_id: null,
        });
        continue;
      }

      // Create new price (transfers lookup_key automatically when transfer_lookup_key=true)
      const newPrice = await stripe.prices.create({
        product: stripeProductId,
        currency: (plan.currency || "USD").toLowerCase(),
        unit_amount: Math.round(amount * 100),
        recurring: { interval: interval === "monthly" ? "month" : "year" },
        lookup_key: lookupKey,
        transfer_lookup_key: !!oldPrice,
        metadata: { plan_id: plan.id, lovable_external_id: lookupKey },
      });

      // Archive old price
      let affectedSubscribers = 0;
      if (oldPrice) {
        await stripe.prices.update(oldPrice.id, { active: false });

        if (migrationStrategy === "migrate_all") {
          // List active subs on the old price and migrate them
          const subs = await stripe.subscriptions.list({
            price: oldPrice.id,
            status: "active",
            limit: 100,
          });
          for (const s of subs.data) {
            const item = s.items.data.find((i) => i.price.id === oldPrice.id);
            if (!item) continue;
            await stripe.subscriptions.update(s.id, {
              items: [{ id: item.id, price: newPrice.id }],
              proration_behavior: "create_prorations",
            });
            affectedSubscribers++;
          }
        } else {
          // grandfather — count for reporting
          const subs = await stripe.subscriptions.list({
            price: oldPrice.id,
            status: "active",
            limit: 100,
          });
          affectedSubscribers = subs.data.length;
        }
      }

      // Record history
      await supabase.from("plan_price_sync_history").insert({
        plan_id: plan.id,
        interval,
        old_amount: oldPrice ? oldPrice.unit_amount! / 100 : null,
        new_amount: amount,
        currency: plan.currency || "USD",
        old_stripe_price_id: oldPrice?.id || null,
        new_stripe_price_id: newPrice.id,
        lookup_key: lookupKey,
        migration_strategy: migrationStrategy,
        affected_subscribers: affectedSubscribers,
        performed_by: user.id,
        notes: notes || null,
      });

      results.push({
        interval,
        lookup_key: lookupKey,
        new_price_id: newPrice.id,
        old_price_id: oldPrice?.id || null,
      });
    }

    // Update plan record
    await supabase
      .from("subscription_plans")
      .update({
        stripe_product_id: stripeProductId,
        stripe_lookup_key_monthly:
          results.find((r) => r.interval === "monthly")?.lookup_key ||
          plan.stripe_lookup_key_monthly,
        stripe_lookup_key_yearly:
          results.find((r) => r.interval === "yearly")?.lookup_key ||
          plan.stripe_lookup_key_yearly,
        stripe_price_id_monthly:
          results.find((r) => r.interval === "monthly")?.new_price_id ||
          plan.stripe_price_id_monthly,
        stripe_price_id_yearly:
          results.find((r) => r.interval === "yearly")?.new_price_id ||
          plan.stripe_price_id_yearly,
        last_synced_at: new Date().toISOString(),
        sync_status: "synced",
      })
      .eq("id", plan.id);

    return new Response(JSON.stringify({ ok: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("sync-plan-to-stripe error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
