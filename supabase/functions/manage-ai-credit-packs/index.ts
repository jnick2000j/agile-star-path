// Platform-admin-only CRUD for AI credit packs, with Stripe product/price sync.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { type StripeEnv, createStripeClient } from "../_shared/stripe.ts";

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 48) || "pack";

interface PackInput {
  id?: string;
  name: string;
  description?: string | null;
  credits: number;
  amount_usd: number;
  highlight?: boolean;
  sort_order?: number;
  is_active?: boolean;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const token = req.headers.get("authorization")?.replace("Bearer ", "");
    const { data: userData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !userData.user) {
      return json({ error: "Unauthorized" }, 401);
    }

    // Platform-admin gate
    const { data: isAdmin } = await supabase.rpc("is_admin", { _user_id: userData.user.id });
    if (!isAdmin) return json({ error: "Forbidden" }, 403);

    const body = await req.json();
    const action = body?.action as "create" | "update" | "archive" | "restore";
    const env = (body?.environment || "sandbox") as StripeEnv;

    // Archive/restore are local DB operations; only block Stripe-touching create/update.
    const needsStripe = action === "create" || action === "update";
    if (needsStripe && !isStripeAvailable()) {
      return licenseModeBlockedResponse("stripe_unavailable", corsHeaders);
    }
    const stripe = needsStripe ? createStripeClient(env) : (null as any);

    if (action === "archive" || action === "restore") {
      const id = body?.id as string;
      if (!id) return json({ error: "Missing pack id" }, 400);
      const { data, error } = await supabase
        .from("ai_credit_packs")
        .update({ is_active: action === "restore" })
        .eq("id", id)
        .select()
        .maybeSingle();
      if (error) throw error;
      return json({ pack: data });
    }

    const input = body?.pack as PackInput | undefined;
    if (!input) return json({ error: "Missing pack data" }, 400);
    if (!input.name?.trim()) return json({ error: "Name is required" }, 400);
    if (!Number.isInteger(input.credits) || input.credits < 1) {
      return json({ error: "Credits must be a positive integer" }, 400);
    }
    if (!Number.isFinite(input.amount_usd) || input.amount_usd < 0.5) {
      return json({ error: "Amount must be at least $0.50" }, 400);
    }

    const amountCents = Math.round(input.amount_usd * 100);

    if (action === "create") {
      // Generate stable pack_key
      const baseKey = `ai_credits_${slugify(input.name)}_${input.credits}`;
      let packKey = baseKey;
      let suffix = 0;
      while (true) {
        const { data: existing } = await supabase
          .from("ai_credit_packs")
          .select("id").eq("pack_key", packKey).maybeSingle();
        if (!existing) break;
        suffix += 1;
        packKey = `${baseKey}_${suffix}`;
      }
      const lookupKey = `${packKey}_price`;

      // Create Stripe product + one-time price with lookup_key
      const product = await stripe.products.create({
        name: input.name,
        description: input.description || `One-time top-up of ${input.credits} AI credits.`,
        metadata: { pack_key: packKey, credits: String(input.credits), lovable_external_id: packKey },
      });
      const price = await stripe.prices.create({
        product: product.id,
        unit_amount: amountCents,
        currency: "usd",
        lookup_key: lookupKey,
        metadata: { pack_key: packKey, lovable_external_id: lookupKey },
      });

      const { data, error } = await supabase
        .from("ai_credit_packs")
        .insert({
          pack_key: packKey,
          name: input.name.trim(),
          description: input.description?.trim() || null,
          credits: input.credits,
          amount_usd: input.amount_usd,
          stripe_product_id: product.id,
          stripe_price_lookup_key: lookupKey,
          highlight: !!input.highlight,
          sort_order: input.sort_order ?? 100,
          is_active: input.is_active ?? true,
          created_by: userData.user.id,
        })
        .select()
        .single();
      if (error) throw error;
      return json({ pack: data, stripe: { product: product.id, price: price.id } });
    }

    if (action === "update") {
      if (!input.id) return json({ error: "Missing pack id" }, 400);
      const { data: existing, error: existingErr } = await supabase
        .from("ai_credit_packs").select("*").eq("id", input.id).maybeSingle();
      if (existingErr || !existing) return json({ error: "Pack not found" }, 404);

      // If amount changed, create a new Stripe price and transfer the lookup key.
      let newLookupKey = existing.stripe_price_lookup_key;
      const amountChanged = Math.round(Number(existing.amount_usd) * 100) !== amountCents;
      if (amountChanged && existing.stripe_product_id) {
        const lookupKey = existing.stripe_price_lookup_key || `${existing.pack_key}_price`;
        // Stripe transfers lookup_key automatically when transfer_lookup_key is true.
        const newPrice = await stripe.prices.create({
          product: existing.stripe_product_id,
          unit_amount: amountCents,
          currency: "usd",
          lookup_key: lookupKey,
          transfer_lookup_key: true,
          metadata: { pack_key: existing.pack_key, lovable_external_id: lookupKey },
        });
        newLookupKey = lookupKey;
        // Best-effort: archive old prices via list+update
        try {
          const oldPrices = await stripe.prices.list({ product: existing.stripe_product_id, active: true, limit: 20 });
          for (const p of oldPrices.data) {
            if (p.id !== newPrice.id) {
              await stripe.prices.update(p.id, { active: false });
            }
          }
        } catch (_) { /* non-fatal */ }
      }

      // Update Stripe product metadata if name/description changed
      if (existing.stripe_product_id) {
        try {
          await stripe.products.update(existing.stripe_product_id, {
            name: input.name,
            description: input.description || `One-time top-up of ${input.credits} AI credits.`,
          });
        } catch (_) { /* non-fatal */ }
      }

      const { data, error } = await supabase
        .from("ai_credit_packs")
        .update({
          name: input.name.trim(),
          description: input.description?.trim() || null,
          credits: input.credits,
          amount_usd: input.amount_usd,
          stripe_price_lookup_key: newLookupKey,
          highlight: !!input.highlight,
          sort_order: input.sort_order ?? existing.sort_order,
          is_active: input.is_active ?? existing.is_active,
        })
        .eq("id", input.id)
        .select()
        .single();
      if (error) throw error;
      return json({ pack: data });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e: any) {
    console.error("manage-ai-credit-packs error:", e);
    return json({ error: e.message || String(e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
