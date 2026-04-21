import { useState } from "react";
import { Sparkles, Plus, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StripeEmbeddedCheckout } from "@/components/StripeEmbeddedCheckout";
import { useOrganization } from "@/hooks/useOrganization";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface CreditPack {
  id: string;
  /** Stripe price lookup key created via create_price (e.g. "ai_credits_pack_500_price") */
  priceId: string;
  name: string;
  credits: number;
  amountUsd: number;
  highlight?: boolean;
  description?: string;
}

const DEFAULT_PACKS: CreditPack[] = [
  {
    id: "ai_credits_pack_500",
    priceId: "ai_credits_pack_500_price",
    name: "Starter top-up",
    credits: 500,
    amountUsd: 25,
    highlight: true,
    description: "500 extra AI credits added to this month's allowance.",
  },
];

interface Props {
  /** Only org admins should see this. */
  canPurchase: boolean;
  /** Optional override for displayed packs. */
  packs?: CreditPack[];
}

export function AICreditPacks({ canPurchase, packs = DEFAULT_PACKS }: Props) {
  const { currentOrganization } = useOrganization();
  const { user } = useAuth();
  const [activePack, setActivePack] = useState<CreditPack | null>(null);

  const open = (pack: CreditPack) => {
    if (!currentOrganization?.id) {
      toast.error("Select an organization before purchasing credits.");
      return;
    }
    if (!canPurchase) {
      toast.error("Only organization admins can purchase AI credits.");
      return;
    }
    setActivePack(pack);
  };

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Top up AI credits
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Need more AI than your plan allows this month? Buy a one-time pack —
            credits add to your current monthly allowance and expire at the end
            of the month.
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {packs.map((pack) => (
          <Card
            key={pack.id}
            className={`p-5 flex flex-col gap-3 ${
              pack.highlight ? "border-primary ring-2 ring-primary/20" : ""
            }`}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">{pack.name}</h3>
              {pack.highlight && (
                <Badge variant="default" className="text-[10px]">Best value</Badge>
              )}
            </div>
            <div>
              <p className="text-3xl font-bold">{pack.credits.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">AI credits</p>
            </div>
            <div className="flex items-end justify-between mt-auto">
              <p className="text-2xl font-bold">${pack.amountUsd}</p>
              <Button size="sm" onClick={() => open(pack)} disabled={!canPurchase}>
                <Plus className="h-4 w-4 mr-1" />
                Buy pack
              </Button>
            </div>
            {pack.description && (
              <p className="text-xs text-muted-foreground">{pack.description}</p>
            )}
          </Card>
        ))}
      </div>

      {!canPurchase && (
        <p className="text-xs text-muted-foreground">
          Only organization admins can purchase AI credits.
        </p>
      )}

      <Dialog
        open={!!activePack}
        onOpenChange={(o) => !o && setActivePack(null)}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Buy {activePack?.credits.toLocaleString()} AI credits
            </DialogTitle>
            <DialogDescription>
              Credits are added to your organization as soon as payment succeeds
              and are valid for the current calendar month.
            </DialogDescription>
          </DialogHeader>
          {activePack && currentOrganization?.id && (
            <StripeEmbeddedCheckout
              priceId={activePack.priceId}
              customerEmail={user?.email || undefined}
              organizationId={currentOrganization.id}
              purchaseType="ai_credits"
              packId={activePack.id}
              credits={activePack.credits}
              returnUrl={`${window.location.origin}/checkout/return?session_id={CHECKOUT_SESSION_ID}&purchase=ai_credits`}
            />
          )}
          {!currentOrganization?.id && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading organization…
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
