import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Sparkles, Check, Loader2, CreditCard, ExternalLink, XCircle, RotateCcw } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { useOrgAccessLevel } from "@/hooks/useOrgAccessLevel";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { StripeEmbeddedCheckout } from "@/components/StripeEmbeddedCheckout";
import { getStripeEnvironment } from "@/lib/stripe";

interface Plan {
  id: string;
  name: string;
  description: string | null;
  price_monthly: number;
  price_yearly: number;
  max_users: number;
  max_programmes: number;
  max_projects: number;
  max_products: number;
  max_storage_mb: number;
  features: any;
  sort_order: number | null;
  stripe_lookup_key_monthly: string | null;
  stripe_lookup_key_yearly: string | null;
}

export default function Billing() {
  const { currentOrganization } = useOrganization();
  const { accessLevel } = useOrgAccessLevel();
  const { limits, usage, loading: limitsLoading } = usePlanLimits();
  const { user } = useAuth();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState<string | null>(null);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const [subscription, setSubscription] = useState<any>(null);
  const [checkoutPriceId, setCheckoutPriceId] = useState<string | null>(null);
  const [openingPortal, setOpeningPortal] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [reactivating, setReactivating] = useState(false);

  const isAdmin = accessLevel === "admin";

  const handleCancelSubscription = async () => {
    if (!currentOrganization?.id) return;
    setCancelling(true);
    try {
      const { data, error } = await supabase.functions.invoke("cancel-subscription", {
        body: {
          organizationId: currentOrganization.id,
          action: "cancel",
          environment: getStripeEnvironment(),
        },
      });
      if (error || data?.error) throw new Error(error?.message || data?.error);
      const endDate = data?.cancel_at ? format(new Date(data.cancel_at), "MMM d, yyyy") : "the end of your billing period";
      toast.success(`Subscription will end on ${endDate}. You'll keep access until then.`);
      setCancelOpen(false);
      await fetchData();
    } catch (e: any) {
      toast.error(e.message || "Failed to cancel");
    } finally {
      setCancelling(false);
    }
  };

  const handleReactivate = async () => {
    if (!currentOrganization?.id) return;
    setReactivating(true);
    try {
      const { data, error } = await supabase.functions.invoke("cancel-subscription", {
        body: {
          organizationId: currentOrganization.id,
          action: "reactivate",
          environment: getStripeEnvironment(),
        },
      });
      if (error || data?.error) throw new Error(error?.message || data?.error);
      toast.success("Subscription reactivated — it will continue to renew.");
      await fetchData();
    } catch (e: any) {
      toast.error(e.message || "Failed to reactivate");
    } finally {
      setReactivating(false);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    const [plansRes, subRes] = await Promise.all([
      supabase
        .from("subscription_plans")
        .select("*")
        .eq("is_active", true)
        .order("sort_order"),
      currentOrganization?.id
        ? supabase
            .from("organization_subscriptions")
            .select("*")
            .eq("organization_id", currentOrganization.id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    if (plansRes.data) setPlans(plansRes.data as any);
    setSubscription(subRes.data);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [currentOrganization?.id]);

  const handleSelectPlan = async (planId: string) => {
    if (!currentOrganization?.id || !isAdmin) return;
    const plan = plans.find((p) => p.id === planId);
    if (!plan) return;

    // Free plan = direct switch
    if (plan.price_monthly === 0 && plan.price_yearly === 0) {
      setSwitching(planId);
      try {
        if (subscription?.id) {
          await supabase
            .from("organization_subscriptions")
            .update({ plan_id: planId, status: "active", trial_ends_at: null })
            .eq("id", subscription.id);
        } else {
          await supabase.from("organization_subscriptions").insert({
            organization_id: currentOrganization.id,
            plan_id: planId,
            status: "active",
          });
        }
        toast.success(`Switched to ${plan.name}`);
        await fetchData();
      } catch (err: any) {
        toast.error(err.message || "Failed to switch plan");
      } finally {
        setSwitching(null);
      }
      return;
    }

    // Paid plan: open Stripe checkout
    const lookupKey =
      billingCycle === "monthly"
        ? plan.stripe_lookup_key_monthly
        : plan.stripe_lookup_key_yearly;
    if (!lookupKey) {
      toast.error("This plan isn't connected to Stripe yet. Ask a platform admin to sync it.");
      return;
    }
    setCheckoutPriceId(lookupKey);
  };

  const handleOpenPortal = async () => {
    if (!currentOrganization?.id) return;
    setOpeningPortal(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-portal-session", {
        body: {
          organizationId: currentOrganization.id,
          environment: getStripeEnvironment(),
          returnUrl: `${window.location.origin}/billing`,
        },
      });
      if (error || !data?.url) throw new Error(error?.message || "Could not open portal");
      window.open(data.url, "_blank");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setOpeningPortal(false);
    }
  };

  if (loading || limitsLoading) {
    return (
      <AppLayout title="Billing">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  const isTrial = subscription?.status === "trialing";
  const trialEndsAt = subscription?.trial_ends_at ? new Date(subscription.trial_ends_at) : null;
  const trialExpired = trialEndsAt && trialEndsAt < new Date();
  const hasStripeSubscription = !!subscription?.stripe_subscription_id;

  const usageItems = limits
    ? [
        { label: "Users", current: usage.users, max: limits.maxUsers },
        { label: "Programs", current: usage.programmes, max: limits.maxProgrammes },
        { label: "Projects", current: usage.projects, max: limits.maxProjects },
        { label: "Products", current: usage.products, max: limits.maxProducts },
      ]
    : [];

  return (
    <AppLayout title="Billing & Plans" subtitle="Manage your subscription and view usage.">
      <div className="space-y-6 max-w-6xl mx-auto">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Billing & Plans</h1>
            <p className="text-muted-foreground">
              Manage your subscription and view usage for {currentOrganization?.name}.
            </p>
          </div>
          {isAdmin && hasStripeSubscription && (
            <div className="flex flex-wrap gap-2">
              <Button onClick={handleOpenPortal} disabled={openingPortal} variant="outline">
                {openingPortal ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <ExternalLink className="h-4 w-4 mr-2" />
                )}
                Manage billing
              </Button>
              {subscription?.cancel_at_period_end ? (
                <Button onClick={handleReactivate} disabled={reactivating} variant="default">
                  {reactivating ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <RotateCcw className="h-4 w-4 mr-2" />
                  )}
                  Reactivate subscription
                </Button>
              ) : (
                <Button onClick={() => setCancelOpen(true)} variant="outline" className="text-destructive hover:text-destructive">
                  <XCircle className="h-4 w-4 mr-2" />
                  Cancel subscription
                </Button>
              )}
            </div>
          )}
        </div>

        {!isAdmin && (
          <Card className="p-4 border-warning/30 bg-warning/5">
            <p className="text-sm">
              Only organization admins can change the billing plan. You can view current usage below.
            </p>
          </Card>
        )}

        {limits && (
          <Card className="p-6">
            <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
              <div>
                <p className="text-sm text-muted-foreground">Current plan</p>
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  {limits.planName}
                  {isTrial && (
                    <Badge variant={trialExpired ? "destructive" : "secondary"}>
                      {trialExpired ? "Trial expired" : "Trial"}
                    </Badge>
                  )}
                  {subscription?.status === "active" && <Badge variant="default">Active</Badge>}
                  {subscription?.cancel_at_period_end && (
                    <Badge variant="outline">Cancels at period end</Badge>
                  )}
                </h2>
                {trialEndsAt && !trialExpired && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Trial ends {formatDistanceToNow(trialEndsAt, { addSuffix: true })}
                  </p>
                )}
                {subscription?.current_period_end && !isTrial && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Renews {formatDistanceToNow(new Date(subscription.current_period_end), { addSuffix: true })}
                  </p>
                )}
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold">${limits.priceMonthly}</p>
                <p className="text-sm text-muted-foreground">per month</p>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {usageItems.map((item) => {
                const unlimited = item.max === -1;
                const pct = unlimited ? 0 : Math.round((item.current / item.max) * 100);
                const over = !unlimited && item.current >= item.max;
                return (
                  <div key={item.label}>
                    <div className="flex justify-between text-sm mb-1.5">
                      <span className="text-muted-foreground">{item.label}</span>
                      <span className={over ? "text-destructive font-medium" : "font-medium"}>
                        {item.current} / {unlimited ? "∞" : item.max}
                      </span>
                    </div>
                    <Progress value={unlimited ? 0 : Math.min(pct, 100)} className="h-2" />
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold">Choose your plan</h2>
            <div className="flex gap-1 p-1 bg-muted rounded-lg">
              <button
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  billingCycle === "monthly" ? "bg-background shadow-sm" : "text-muted-foreground"
                }`}
                onClick={() => setBillingCycle("monthly")}
              >
                Monthly
              </button>
              <button
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  billingCycle === "yearly" ? "bg-background shadow-sm" : "text-muted-foreground"
                }`}
                onClick={() => setBillingCycle("yearly")}
              >
                Yearly <span className="text-xs text-primary ml-1">Save ~17%</span>
              </button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {plans.map((plan) => {
              const isCurrent = subscription?.plan_id === plan.id;
              const price = billingCycle === "monthly" ? plan.price_monthly : plan.price_yearly;
              const period = billingCycle === "monthly" ? "mo" : "yr";
              const isPaid = plan.price_monthly > 0;
              const isMid = plan.sort_order === 2;
              const features: string[] = Array.isArray(plan.features) ? plan.features : [];

              return (
                <Card
                  key={plan.id}
                  className={`p-6 relative ${isMid ? "border-primary ring-2 ring-primary/20" : ""}`}
                >
                  {isMid && (
                    <Badge className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-primary">
                      Most popular
                    </Badge>
                  )}
                  <h3 className="text-xl font-bold">{plan.name}</h3>
                  <p className="text-sm text-muted-foreground mb-4 min-h-[40px]">
                    {plan.description}
                  </p>
                  <div className="mb-4">
                    <span className="text-4xl font-bold">${price}</span>
                    <span className="text-muted-foreground">/{period}</span>
                  </div>
                  <ul className="space-y-2 mb-6 text-sm">
                    <li className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                      <span>{plan.max_users === -1 ? "Unlimited" : plan.max_users} users</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                      <span>{plan.max_programmes === -1 ? "Unlimited" : plan.max_programmes} programs</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                      <span>{plan.max_projects === -1 ? "Unlimited" : plan.max_projects} projects</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                      <span>{plan.max_products === -1 ? "Unlimited" : plan.max_products} products</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                      <span>
                        {plan.max_storage_mb === -1
                          ? "Unlimited"
                          : `${(plan.max_storage_mb / 1024).toFixed(1)} GB`}{" "}
                        storage
                      </span>
                    </li>
                    {features.map((f, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    className="w-full gap-2"
                    variant={isCurrent ? "outline" : isMid ? "default" : "outline"}
                    disabled={isCurrent || !isAdmin || switching === plan.id}
                    onClick={() => handleSelectPlan(plan.id)}
                  >
                    {switching === plan.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : isCurrent ? (
                      "Current plan"
                    ) : isPaid ? (
                      <>
                        <CreditCard className="h-4 w-4" />
                        {hasStripeSubscription ? "Switch plan" : "Subscribe"}
                      </>
                    ) : (
                      "Select"
                    )}
                  </Button>
                </Card>
              );
            })}
          </div>
        </div>

        <Card className="p-6 bg-muted/30">
          <div className="flex items-start gap-3">
            <Sparkles className="h-5 w-5 text-primary mt-0.5 shrink-0" />
            <div>
              <h3 className="font-semibold">Secure checkout by Stripe</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Card details are handled directly by Stripe. After payment your plan
                activates instantly. Use the "Manage billing" button above to update
                payment methods, download invoices, or cancel.
              </p>
            </div>
          </div>
        </Card>
      </div>

      <Dialog
        open={!!checkoutPriceId}
        onOpenChange={(o) => !o && setCheckoutPriceId(null)}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Complete your subscription</DialogTitle>
            <DialogDescription>
              Enter your payment details below. Your plan activates as soon as the
              payment succeeds.
            </DialogDescription>
          </DialogHeader>
          {checkoutPriceId && (
            <StripeEmbeddedCheckout
              priceId={checkoutPriceId}
              customerEmail={user?.email || undefined}
              organizationId={currentOrganization?.id}
              returnUrl={`${window.location.origin}/checkout/return?session_id={CHECKOUT_SESSION_ID}`}
            />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel subscription?</AlertDialogTitle>
            <AlertDialogDescription>
              Your subscription will remain active until the end of your current billing period
              {subscription?.current_period_end && (
                <> (<strong>{format(new Date(subscription.current_period_end), "MMMM d, yyyy")}</strong>)</>
              )}
              . After that, your organization will be moved to the Free plan and premium features will become unavailable.
              You can reactivate any time before then.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelling}>Keep subscription</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelSubscription}
              disabled={cancelling}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {cancelling && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Yes, cancel at period end
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
