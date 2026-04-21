import { useEffect, useState } from "react";
import { Sparkles, Plus, Loader2, CheckCircle2 } from "lucide-react";
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
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { useAuth } from "@/hooks/useAuth";
import { useDeploymentMode } from "@/hooks/useDeploymentMode";
import { toast } from "sonner";

interface DBPack {
  id: string;
  pack_key: string;
  name: string;
  description: string | null;
  credits: number;
  amount_usd: number;
  highlight: boolean;
  sort_order: number;
  is_active: boolean;
  stripe_price_lookup_key: string | null;
}

interface Props {
  /** Only org admins should see the buy button. */
  canPurchase: boolean;
}

export function AICreditPacks({ canPurchase }: Props) {
  const { currentOrganization } = useOrganization();
  const { user } = useAuth();
  const { isLicenseMode } = useDeploymentMode();
  const [packs, setPacks] = useState<DBPack[]>([]);
  const [loading, setLoading] = useState(true);
  const [activePack, setActivePack] = useState<DBPack | null>(null);
  const [justPurchased, setJustPurchased] = useState(false);

  // License-managed orgs don't buy AI credits via Stripe — capacity is in the license.
  if (isLicenseMode) return null;

  // Detect a successful return from Stripe (?purchase=ai_credits)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("purchase") === "ai_credits" && params.get("session_id")) {
      setJustPurchased(true);
      window.dispatchEvent(new Event("ai-credits-changed"));
      // Clean the URL so the banner doesn't reappear on refresh
      const url = new URL(window.location.href);
      url.searchParams.delete("purchase");
      url.searchParams.delete("session_id");
      window.history.replaceState({}, "", url.toString());
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("ai_credit_packs")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      if (!cancelled) {
        if (!error && data) setPacks(data as DBPack[]);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const open = (pack: DBPack) => {
    if (!currentOrganization?.id) {
      toast.error("Select an organization before purchasing credits.");
      return;
    }
    if (!canPurchase) {
      toast.error("Only organization admins can purchase AI credits.");
      return;
    }
    if (!pack.stripe_price_lookup_key) {
      toast.error("This pack isn't connected to Stripe yet. Ask a platform admin to sync it.");
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
            of the calendar month.
          </p>
        </div>
      </div>

      {justPurchased && (
        <div className="flex items-start gap-2 rounded-md border border-primary/40 bg-primary/5 p-3 text-sm">
          <CheckCircle2 className="h-4 w-4 text-primary mt-0.5" />
          <div>
            <p className="font-medium">Payment received — credits are being added now.</p>
            <p className="text-muted-foreground text-xs">
              Your balance updates automatically as soon as Stripe confirms the payment.
            </p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading credit packs…
        </div>
      ) : packs.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6">
          No credit packs are available right now.
        </p>
      ) : (
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
                <p className="text-2xl font-bold">${Number(pack.amount_usd).toFixed(0)}</p>
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
      )}

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
          {activePack && currentOrganization?.id && activePack.stripe_price_lookup_key && (
            <StripeEmbeddedCheckout
              priceId={activePack.stripe_price_lookup_key}
              customerEmail={user?.email || undefined}
              organizationId={currentOrganization.id}
              purchaseType="ai_credits"
              packId={activePack.pack_key}
              credits={activePack.credits}
              returnUrl={`${window.location.origin}/billing?purchase=ai_credits&session_id={CHECKOUT_SESSION_ID}`}
            />
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
