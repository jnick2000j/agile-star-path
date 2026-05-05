import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Check, ArrowLeft, Loader2, Headphones, GitBranch, Layers } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import { StripeEmbeddedCheckout } from "@/components/StripeEmbeddedCheckout";
import { usePlanFeatures } from "@/hooks/usePlanFeatures";

interface AddonPlan {
  id: string;
  name: string;
  description: string | null;
  price_monthly: number;
  price_yearly: number;
  highlight: boolean;
  sort_order: number;
  stripe_lookup_key_monthly: string | null;
  stripe_lookup_key_yearly: string | null;
}

const ICON_MAP: Record<string, any> = {
  "Helpdesk Add-on": Headphones,
  "Change Management Add-on": GitBranch,
  "ITSM Suite Add-on": Layers,
};

const FEATURE_HIGHLIGHTS: Record<string, string[]> = {
  "Helpdesk Add-on": [
    "Unlimited tickets and agents",
    "SLA policies + email intake",
    "Customer portal",
    "Entity linking (projects, programmes, products)",
  ],
  "Change Management Add-on": [
    "Full CAB workflow",
    "Multi-stage approvals",
    "Risk scoring + rollback plans",
    "Audit trail + compliance reporting",
  ],
  "ITSM Suite Add-on": [
    "Everything in Helpdesk + Change Management",
    "Save ~20% vs buying separately",
    "Unified ticket → change workflow",
    "Best for IT-heavy operations",
  ],
};

export default function AddonsCatalog() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentOrganization } = useOrganization();
  const { hasFeature } = usePlanFeatures();
  const [addons, setAddons] = useState<AddonPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [cycle, setCycle] = useState<"monthly" | "yearly">("monthly");
  const [checkoutPriceId, setCheckoutPriceId] = useState<string | null>(null);
  const [purchasingAddon, setPurchasingAddon] = useState<AddonPlan | null>(null);

  useEffect(() => {
    supabase
      .from("subscription_plans")
      .select("*")
      .eq("is_addon", true)
      .eq("is_active", true)
      .eq("is_archived", false)
      .order("sort_order")
      .then(({ data }) => {
        setAddons((data || []) as AddonPlan[]);
        setLoading(false);
      });
  }, []);

  const handlePurchase = (addon: AddonPlan) => {
    const lookupKey = cycle === "monthly" ? addon.stripe_lookup_key_monthly : addon.stripe_lookup_key_yearly;
    if (!lookupKey) return;
    setPurchasingAddon(addon);
    setCheckoutPriceId(lookupKey);
  };

  const addonReturnUrl = () => {
    const base = `${window.location.origin}/checkout/return?session_id={CHECKOUT_SESSION_ID}&purchase_type=addon`;
    if (!purchasingAddon) return base;
    const key = purchasingAddon.name.toLowerCase().includes("itsm")
      ? "itsm"
      : purchasingAddon.name.toLowerCase().includes("helpdesk")
      ? "helpdesk"
      : purchasingAddon.name.toLowerCase().includes("change")
      ? "change_management"
      : "addon";
    return `${base}&addon=${key}&addon_name=${encodeURIComponent(purchasingAddon.name)}`;
  };

  const isAlreadyActive = (addon: AddonPlan) => {
    if (addon.name.includes("ITSM")) {
      return hasFeature("feature_helpdesk") && hasFeature("feature_change_management");
    }
    if (addon.name.includes("Helpdesk")) return hasFeature("feature_helpdesk");
    if (addon.name.includes("Change Management")) return hasFeature("feature_change_management");
    return false;
  };

  return (
    <AppLayout title="Add-ons">
      <div className="max-w-6xl mx-auto p-6">
        <Button variant="ghost" size="sm" className="gap-2 mb-4" onClick={() => navigate("/billing")}>
          <ArrowLeft className="h-4 w-4" /> Back to Billing
        </Button>

        <div className="text-center mb-10">
          <Badge variant="secondary" className="mb-3">14-day free trial • Cancel anytime</Badge>
          <h1 className="text-3xl md:text-4xl font-bold mb-3 tracking-tight">
            Power up with Helpdesk &amp; Change Management
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Add ITSM modules to your existing plan. They unlock automatically the moment your subscription is active.
          </p>

          <div className="inline-flex gap-1 p-1 bg-muted rounded-lg mt-6">
            <button
              className={`px-4 py-2 text-sm rounded-md transition-colors ${
                cycle === "monthly" ? "bg-background shadow-sm" : "text-muted-foreground"
              }`}
              onClick={() => setCycle("monthly")}
            >
              Monthly
            </button>
            <button
              className={`px-4 py-2 text-sm rounded-md transition-colors ${
                cycle === "yearly" ? "bg-background shadow-sm" : "text-muted-foreground"
              }`}
              onClick={() => setCycle("yearly")}
            >
              Yearly <span className="text-xs text-primary ml-1">Save ~20%</span>
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-3">
            {addons.map((addon) => {
              const Icon = ICON_MAP[addon.name] || Layers;
              const price = cycle === "monthly" ? addon.price_monthly : addon.price_yearly;
              const highlights = FEATURE_HIGHLIGHTS[addon.name] || [];
              const active = isAlreadyActive(addon);
              return (
                <Card
                  key={addon.id}
                  className={`p-6 relative flex flex-col ${
                    addon.highlight ? "border-primary ring-2 ring-primary/20 shadow-lg" : ""
                  }`}
                >
                  {addon.highlight && (
                    <Badge className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-primary">
                      Best value
                    </Badge>
                  )}
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="text-xl font-bold">{addon.name}</h3>
                  <p className="text-sm text-muted-foreground mb-4 min-h-[40px]">{addon.description}</p>
                  <div className="mb-4">
                    <span className="text-4xl font-bold">${(price / 100).toFixed(0)}</span>
                    <span className="text-muted-foreground">/{cycle === "monthly" ? "mo" : "yr"}</span>
                    <div className="text-xs text-muted-foreground mt-1">per organization</div>
                  </div>
                  <Button
                    className="w-full gap-2 mb-6"
                    variant={addon.highlight ? "default" : "outline"}
                    onClick={() => handlePurchase(addon)}
                    disabled={active || !currentOrganization}
                  >
                    {active ? "Already active" : "Start 14-day trial"}
                  </Button>
                  <ul className="space-y-2 text-sm mt-auto">
                    {highlights.map((h, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                        <span>{h}</span>
                      </li>
                    ))}
                  </ul>
                </Card>
              );
            })}
          </div>
        )}

        <div className="text-center mt-12 p-6 bg-muted/30 rounded-lg">
          <h3 className="font-semibold mb-2">Looking for standalone Helpdesk or ITSM (without the PPM suite)?</h3>
          <div className="flex gap-3 justify-center">
            <Button variant="outline" size="sm" onClick={() => navigate("/helpdesk-pricing")}>
              Helpdesk standalone pricing
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate("/itsm-pricing")}>
              ITSM standalone pricing
            </Button>
          </div>
        </div>

        <Dialog open={!!checkoutPriceId} onOpenChange={(o) => { if (!o) { setCheckoutPriceId(null); setPurchasingAddon(null); } }}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Complete your add-on subscription</DialogTitle>
            </DialogHeader>
            {checkoutPriceId && (
              <StripeEmbeddedCheckout
                priceId={checkoutPriceId}
                customerEmail={user?.email}
                organizationId={currentOrganization?.id}
                purchaseType="addon"
                returnUrl={addonReturnUrl()}
              />
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
