import {
  EmbeddedCheckoutProvider,
  EmbeddedCheckout,
} from "@stripe/react-stripe-js";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  priceId: string;
  customerEmail?: string;
  organizationId?: string;
  returnUrl?: string;
  /** Optional metadata for one-time purchases (e.g. AI credit packs) */
  purchaseType?: string;
  packId?: string;
  credits?: number;
}

export function StripeEmbeddedCheckout({
  priceId,
  customerEmail,
  organizationId,
  returnUrl,
  purchaseType,
  packId,
  credits,
}: Props) {
  const fetchClientSecret = async (): Promise<string> => {
    const { data, error } = await supabase.functions.invoke("create-checkout", {
      body: {
        priceId,
        customerEmail,
        organizationId,
        returnUrl,
        environment: getStripeEnvironment(),
        purchaseType,
        packId,
        credits,
      },
    });
    if (error || !data?.clientSecret) {
      throw new Error(error?.message || "Failed to create checkout session");
    }
    return data.clientSecret as string;
  };

  return (
    <div id="checkout" className="min-h-[500px]">
      <EmbeddedCheckoutProvider
        stripe={getStripe()}
        options={{ fetchClientSecret }}
      >
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  );
}
