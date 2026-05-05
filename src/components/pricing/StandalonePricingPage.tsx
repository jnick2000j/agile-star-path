import { Fragment, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Check, ArrowRight, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { StripeEmbeddedCheckout } from "@/components/StripeEmbeddedCheckout";
import { useOrganization } from "@/hooks/useOrganization";

interface Plan {
  id: string;
  name: string;
  description: string | null;
  price_monthly: number;
  price_yearly: number;
  currency: string;
  highlight: boolean;
  cta_label: string | null;
  sort_order: number;
  plan_kind: string;
  stripe_lookup_key_monthly: string | null;
  stripe_lookup_key_yearly: string | null;
}

interface FeatureMeta {
  feature_key: string;
  name: string;
  feature_type: string;
  display_order: number;
}

interface PlanFeatureValue {
  plan_id: string;
  feature_key: string;
  value: any;
}

const formatLimit = (key: string, val: any) => {
  const n = Number(val);
  if (n === -1) return "Unlimited";
  if (key === "helpdesk_max_agents") return `${n} agent${n === 1 ? "" : "s"}`;
  if (key === "helpdesk_max_tickets_per_month") return `${n} tickets/mo`;
  if (key === "cm_max_approvers") return `${n} approver${n === 1 ? "" : "s"}`;
  return String(val);
};

const formatCellValue = (meta: FeatureMeta, value: any): { display: string; isCheck: boolean; isDash: boolean } => {
  if (value === undefined || value === null) return { display: "—", isCheck: false, isDash: true };
  if (meta.feature_type === "boolean") {
    const on = value === true || value === "true";
    return { display: on ? "✓" : "—", isCheck: on, isDash: !on };
  }
  if (meta.feature_type === "numeric") {
    const n = Number(value);
    if (n === -1) return { display: "Unlimited", isCheck: false, isDash: false };
    if (meta.feature_key === "helpdesk_max_tickets_per_month") return { display: `${n.toLocaleString()}/mo`, isCheck: false, isDash: false };
    return { display: n.toLocaleString(), isCheck: false, isDash: false };
  }
  return { display: String(value), isCheck: false, isDash: false };
};

interface Props {
  kind: "helpdesk" | "itsm";
  heroBadge: string;
  heroTitle: string;
  heroDescription: string;
  brandName: string;
  productHomeLink?: { label: string; href: string };
}

export function StandalonePricingPage({
  kind,
  heroBadge,
  heroTitle,
  heroDescription,
  brandName,
  productHomeLink,
}: Props) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentOrganization } = useOrganization();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [featureMeta, setFeatureMeta] = useState<FeatureMeta[]>([]);
  const [planValues, setPlanValues] = useState<PlanFeatureValue[]>([]);
  const [loading, setLoading] = useState(true);
  const [cycle, setCycle] = useState<"monthly" | "yearly">("monthly");
  const [checkoutPriceId, setCheckoutPriceId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      supabase
        .from("subscription_plans")
        .select("*")
        .eq("plan_kind", kind)
        .eq("is_active", true)
        .eq("is_archived", false)
        .order("sort_order"),
      supabase.from("plan_features").select("*").eq("is_active", true).order("display_order"),
      supabase.from("plan_feature_values").select("*"),
    ]).then(([p, f, v]) => {
      setPlans((p.data || []) as Plan[]);
      setFeatureMeta((f.data || []) as FeatureMeta[]);
      setPlanValues((v.data || []) as PlanFeatureValue[]);
      setLoading(false);
    });
  }, [kind]);

  const planFeatureLines = useMemo(() => (planId: string) => {
    const lines: { label: string; included: boolean }[] = [];
    const relevantKeys =
      kind === "helpdesk"
        ? ["feature_helpdesk", "helpdesk_max_agents", "helpdesk_max_tickets_per_month"]
        : ["feature_helpdesk", "feature_change_management", "helpdesk_max_agents", "cm_max_approvers"];

    relevantKeys.forEach((key) => {
      const meta = featureMeta.find((f) => f.feature_key === key);
      const pv = planValues.find((v) => v.plan_id === planId && v.feature_key === key);
      if (!meta || pv === undefined) return;
      const val = pv.value;
      if (meta.feature_type === "numeric") {
        if (val !== undefined && val !== null) {
          lines.push({ label: formatLimit(key, val), included: true });
        }
      } else if (meta.feature_type === "boolean") {
        const isOn = val === true || val === "true";
        if (isOn) lines.push({ label: meta.name, included: true });
      }
    });
    return lines;
  }, [featureMeta, planValues, kind]);

  // Comparison table row config — labels and feature_keys to look up per plan
  const comparisonGroups = useMemo(() => {
    if (kind === "helpdesk") {
      return [
        {
          group: "Limits",
          rows: [
            { label: "Agents included", featureKey: "helpdesk_max_agents" },
            { label: "Tickets per month", featureKey: "helpdesk_max_tickets_per_month" },
          ],
        },
        {
          group: "Capabilities",
          rows: [
            { label: "Helpdesk module", featureKey: "feature_helpdesk" },
            { label: "Public API access", featureKey: "feature_api_access" },
          ],
        },
      ];
    }
    return [
      {
        group: "Limits",
        rows: [
          { label: "Users included", featureKey: "helpdesk_max_agents" },
          { label: "Change approvers", featureKey: "cm_max_approvers" },
        ],
      },
      {
        group: "Modules",
        rows: [
          { label: "Helpdesk", featureKey: "feature_helpdesk" },
          { label: "Change Management", featureKey: "feature_change_management" },
          { label: "Public API access", featureKey: "feature_api_access" },
        ],
      },
    ];
  }, [kind]);

  const getCellFor = (planId: string, featureKey: string) => {
    const meta = featureMeta.find((f) => f.feature_key === featureKey);
    const pv = planValues.find((v) => v.plan_id === planId && v.feature_key === featureKey);
    if (!meta) return { display: "—", isCheck: false, isDash: true };
    return formatCellValue(meta, pv?.value);
  };

  const handleStart = (plan: Plan) => {
    const lookupKey = cycle === "monthly" ? plan.stripe_lookup_key_monthly : plan.stripe_lookup_key_yearly;
    // Free / contact-sales plans: route to signup or contact
    if (!lookupKey) {
      if (plan.price_monthly === 0 && plan.price_yearly === 0) {
        // Free or Enterprise (custom)
        if (plan.name.toLowerCase().includes("enterprise")) {
          window.location.href = "mailto:sales@thetaskmaster.app?subject=ITSM%20Enterprise%20enquiry";
          return;
        }
        if (!user) navigate(`/auth?mode=signup&plan_kind=${kind}`);
        else navigate("/billing");
        return;
      }
    }
    if (!user) {
      navigate(`/auth?mode=signup&plan_kind=${kind}&priceId=${lookupKey}`);
      return;
    }
    setCheckoutPriceId(lookupKey);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="font-bold text-lg">
            {brandName}
          </Link>
          <div className="flex items-center gap-3">
            {productHomeLink && (
              <Link to={productHomeLink.href} className="text-sm text-muted-foreground hover:text-foreground">
                {productHomeLink.label}
              </Link>
            )}
            <Link to="/pricing" className="text-sm text-muted-foreground hover:text-foreground">
              Full PPM pricing
            </Link>
            {user ? (
              <Button onClick={() => navigate("/")} variant="outline" size="sm">
                Dashboard
              </Button>
            ) : (
              <>
                <Button variant="ghost" size="sm" onClick={() => navigate("/auth")}>
                  Sign in
                </Button>
                <Button size="sm" onClick={() => navigate(`/auth?mode=signup&plan_kind=${kind}`)}>
                  Get started
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <section className="max-w-4xl mx-auto px-6 py-16 text-center">
        <Badge variant="secondary" className="mb-4">
          {heroBadge}
        </Badge>
        <h1 className="text-4xl md:text-5xl font-bold mb-4 tracking-tight">{heroTitle}</h1>
        <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">{heroDescription}</p>
        <div className="inline-flex gap-1 p-1 bg-muted rounded-lg">
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
      </section>

      <section className="max-w-6xl mx-auto px-6 pb-16">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className={`grid gap-6 ${plans.length === 4 ? "md:grid-cols-2 lg:grid-cols-4" : "md:grid-cols-3"}`}>
            {plans.map((plan) => {
              const isContact = plan.price_monthly === 0 && plan.price_yearly === 0 && plan.name.toLowerCase().includes("enterprise");
              const price = cycle === "monthly" ? plan.price_monthly : plan.price_yearly;
              const lines = planFeatureLines(plan.id);
              return (
                <Card
                  key={plan.id}
                  className={`p-6 relative flex flex-col ${
                    plan.highlight ? "border-primary ring-2 ring-primary/20 shadow-lg" : ""
                  }`}
                >
                  {plan.highlight && (
                    <Badge className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-primary">
                      Most popular
                    </Badge>
                  )}
                  <h3 className="text-xl font-bold">{plan.name}</h3>
                  <p className="text-sm text-muted-foreground mb-4 min-h-[40px]">{plan.description}</p>
                  <div className="mb-6">
                    {isContact ? (
                      <span className="text-3xl font-bold">Custom</span>
                    ) : (
                      <>
                        <span className="text-4xl font-bold">${(price / 100).toFixed(0)}</span>
                        <span className="text-muted-foreground">
                          {price === 0 ? " forever" : `/${cycle === "monthly" ? "mo" : "yr"}`}
                        </span>
                        {kind === "helpdesk" && price > 0 && (
                          <div className="text-xs text-muted-foreground mt-1">per agent</div>
                        )}
                        {kind === "itsm" && price > 0 && (
                          <div className="text-xs text-muted-foreground mt-1">per user</div>
                        )}
                      </>
                    )}
                  </div>
                  <Button
                    className="w-full gap-2 mb-6"
                    variant={plan.highlight ? "default" : "outline"}
                    onClick={() => handleStart(plan)}
                  >
                    {isContact ? "Contact sales" : plan.cta_label || (price === 0 ? "Start free" : "Start free trial")}
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                  <ul className="space-y-2 text-sm mt-auto">
                    {lines.map((l, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                        <span>{l.label}</span>
                      </li>
                    ))}
                  </ul>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {!loading && plans.length > 0 && (
        <section className="max-w-6xl mx-auto px-6 pb-16">
          <div className="text-center mb-8">
            <h2 className="text-2xl md:text-3xl font-bold mb-2">Compare plans</h2>
            <p className="text-muted-foreground">Side-by-side limits and capabilities for every tier.</p>
          </div>
          <div className="border rounded-lg overflow-x-auto bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="text-left font-medium p-4 min-w-[180px]">Feature</th>
                  {plans.map((p) => (
                    <th key={p.id} className="text-center font-medium p-4 min-w-[140px]">
                      <div className="flex flex-col items-center gap-1">
                        <span className={p.highlight ? "text-primary" : ""}>{p.name}</span>
                        {p.highlight && (
                          <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                            Popular
                          </Badge>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {comparisonGroups.map((group) => (
                  <Fragment key={`g-${group.group}`}>
                    <tr className="bg-muted/20 border-b">
                      <td
                        colSpan={plans.length + 1}
                        className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                      >
                        {group.group}
                      </td>
                    </tr>
                    {group.rows.map((row) => (
                      <tr key={`${group.group}-${row.featureKey}`} className="border-b last:border-0">
                        <td className="p-4 font-medium">{row.label}</td>
                        {plans.map((p) => {
                          const cell = getCellFor(p.id, row.featureKey);
                          return (
                            <td key={p.id} className="p-4 text-center">
                              {cell.isCheck ? (
                                <Check className="h-4 w-4 text-primary mx-auto" />
                              ) : cell.isDash ? (
                                <span className="text-muted-foreground">—</span>
                              ) : (
                                <span className="font-medium">{cell.display}</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </Fragment>
                ))}
                <tr className="border-t bg-muted/10">
                  <td className="p-4 font-medium">Starting price</td>
                  {plans.map((p) => {
                    const isContact =
                      p.price_monthly === 0 && p.price_yearly === 0 && p.name.toLowerCase().includes("enterprise");
                    const price = cycle === "monthly" ? p.price_monthly : p.price_yearly;
                    return (
                      <td key={p.id} className="p-4 text-center">
                        {isContact ? (
                          <span className="font-semibold">Custom</span>
                        ) : price === 0 ? (
                          <span className="font-semibold">Free</span>
                        ) : (
                          <span className="font-semibold">
                            ${(price / 100).toFixed(0)}
                            <span className="text-xs text-muted-foreground font-normal">
                              /{cycle === "monthly" ? "mo" : "yr"}
                            </span>
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="max-w-3xl mx-auto px-6 pb-10 text-center">
        <h2 className="text-2xl font-bold mb-3">Need the full PPM platform?</h2>
        <p className="text-muted-foreground mb-6">
          Our flagship plans bundle PRINCE2, MSP programmes, agile products, AND {kind === "helpdesk" ? "Helpdesk" : "ITSM"} together.
        </p>
        <Button variant="outline" onClick={() => navigate("/pricing")}>
          View full PPM pricing
        </Button>
      </section>

      <section className="max-w-3xl mx-auto px-6 pb-16 text-center">
        <Card className="p-6 bg-muted/30">
          <Badge variant="secondary" className="mb-2">New</Badge>
          <h3 className="text-xl font-bold mb-2">Train your team with the LMS Add-on</h3>
          <p className="text-muted-foreground mb-4">
            Author courses, run quizzes, issue certifications, and embed learning into projects and onboarding.
          </p>
          <Button onClick={() => navigate("/addons")}>Explore the LMS Add-on</Button>
        </Card>
      </section>

      <Dialog open={!!checkoutPriceId} onOpenChange={(o) => !o && setCheckoutPriceId(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Complete your subscription</DialogTitle>
          </DialogHeader>
          {checkoutPriceId && (
            <StripeEmbeddedCheckout
              priceId={checkoutPriceId}
              customerEmail={user?.email}
              organizationId={currentOrganization?.id}
              returnUrl={`${window.location.origin}/checkout/return?session_id={CHECKOUT_SESSION_ID}`}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
