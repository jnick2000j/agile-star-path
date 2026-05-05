import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.89.0";
import { type StripeEnv, createStripeClient } from "../_shared/stripe.ts";
import { licenseModeBlockedResponse, shouldSkipStripe } from "../_shared/license.ts";

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
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { organizationId, returnUrl, environment } = await req.json();
    if (!organizationId) {
      return new Response(JSON.stringify({ error: "organizationId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const skip = await shouldSkipStripe(supabase, organizationId);
    if (skip.skip) return licenseModeBlockedResponse(skip.reason!, corsHeaders, { organization_id: organizationId });

    const env = (environment || "sandbox") as StripeEnv;

    // Resolve Stripe customer: prefer this org's own subscription; otherwise look up via
    // the org's billing account (where the owner-org of the account holds the subscription).
    let stripeCustomerId: string | null = null;

    const { data: ownSub } = await supabase
      .from("organization_subscriptions")
      .select("stripe_customer_id")
      .eq("organization_id", organizationId)
      .eq("environment", env)
      .maybeSingle();

    if (ownSub?.stripe_customer_id) {
      stripeCustomerId = ownSub.stripe_customer_id;
    } else {
      const { data: orgRow } = await supabase
        .from("organizations")
        .select("billing_account_id")
        .eq("id", organizationId)
        .maybeSingle();

      if (orgRow?.billing_account_id) {
        const { data: acct } = await supabase
          .from("billing_accounts")
          .select("owner_organization_id, stripe_customer_id")
          .eq("id", orgRow.billing_account_id)
          .maybeSingle();

        if (acct?.stripe_customer_id) {
          stripeCustomerId = acct.stripe_customer_id;
        } else if (acct?.owner_organization_id) {
          const { data: ownerSub } = await supabase
            .from("organization_subscriptions")
            .select("stripe_customer_id")
            .eq("organization_id", acct.owner_organization_id)
            .eq("environment", env)
            .maybeSingle();
          stripeCustomerId = ownerSub?.stripe_customer_id ?? null;
        }
      }
    }

    if (!stripeCustomerId) {
      // Return 200 so the client receives the JSON body. supabase.functions.invoke
      // discards the body on non-2xx responses, which would prevent the UI from
      // showing a friendly "no subscription yet" message.
      return new Response(
        JSON.stringify({
          error: "No subscription found for this organization",
          fallback: true,
          code: "no_subscription",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const stripe = createStripeClient(env);
    const portal = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      ...(returnUrl && { return_url: returnUrl }),
    });

    return new Response(JSON.stringify({ url: portal.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("portal error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
