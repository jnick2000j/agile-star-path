import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, ArrowRight, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useDeploymentMode } from "@/hooks/useDeploymentMode";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { KeyRound } from "lucide-react";
import { formatPrice } from "@/lib/currency";

interface Plan {
  id: string;
  name: string;
  description: string | null;
  price_monthly: number;
  price_yearly: number;
  currency: string;
  trial_days: number;
  highlight: boolean;
  cta_label: string | null;
  sort_order: number;
}

interface FeatureMeta {
  feature_key: string;
  name: string;
  category: string;
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
  if (key.includes("storage_mb")) return n >= 1024 ? `${(n / 1024).toFixed(0)} GB storage` : `${n} MB storage`;
  return n.toString();
};

export default function Pricing() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isLicenseMode, entitlements, loading: licenseLoading } = useDeploymentMode();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [featureMeta, setFeatureMeta] = useState<FeatureMeta[]>([]);
  const [planValues, setPlanValues] = useState<PlanFeatureValue[]>([]);
  const [loading, setLoading] = useState(true);
  const [cycle, setCycle] = useState<"monthly" | "yearly">("monthly");

  useEffect(() => {
    Promise.all([
      supabase
        .from("subscription_plans")
        .select("*")
        .eq("is_active", true)
        .eq("is_public", true)
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
  }, []);

  const handleStart = (planId?: string) => {
    if (user) navigate(planId ? `/billing` : "/");
    else navigate(`/auth?mode=signup${planId ? `&plan=${planId}` : ""}`);
  };

  const planFeatureLines = (planId: string): { label: string; included: boolean }[] => {
    const lines: { label: string; included: boolean }[] = [];
    featureMeta.forEach((f) => {
      const pv = planValues.find((v) => v.plan_id === planId && v.feature_key === f.feature_key);
      const val = pv?.value;
      if (f.feature_type === "numeric") {
        if (val !== undefined && val !== null) {
          const formatted = formatLimit(f.feature_key, val);
          const niceName = f.name.toLowerCase().replace(/^maximum\s+/, "");
          lines.push({
            label: f.feature_key.includes("storage") || f.feature_key.includes("ai_credits") || f.feature_key.includes("custom_roles")
              ? `${formatted}${f.feature_key.includes("ai_credits") ? " AI credits/mo" : f.feature_key.includes("custom_roles") ? " custom roles" : ""}`
              : `${formatted} ${niceName}`,
            included: true,
          });
        }
      } else if (f.feature_type === "boolean") {
        const isOn = val === true || val === "true";
        if (isOn) lines.push({ label: f.name, included: true });
      }
    });
    return lines;
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="font-bold text-lg">TaskMaster</Link>
          <div className="flex gap-2">
            {user ? (
              <Button onClick={() => navigate("/")} variant="outline">Go to Dashboard</Button>
            ) : (
              <>
                <Button variant="ghost" onClick={() => navigate("/auth")}>Sign in</Button>
                <Button onClick={() => navigate("/auth?mode=signup")}>Get started</Button>
              </>
            )}
          </div>
        </div>
      </header>

      <section className="max-w-4xl mx-auto px-6 py-16 text-center">
        {user && isLicenseMode && !licenseLoading && (
          <Alert className="mb-8 text-left border-primary/40 bg-primary/5">
            <KeyRound className="h-4 w-4" />
            <AlertTitle>Your organization runs on a license</AlertTitle>
            <AlertDescription>
              {entitlements?.customer_reference
                ? `License ${entitlements.customer_reference} is active — `
                : "An active license is in place — "}
              plan and seat changes are managed by your account team. The plans below are for informational purposes only.
            </AlertDescription>
          </Alert>
        )}
        <Badge variant="secondary" className="mb-4">Free trial • No card required</Badge>
        <h1 className="text-4xl md:text-5xl font-bold mb-4 tracking-tight">
          Pricing that scales with your portfolio
        </h1>
        <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
          PRINCE2 governance, MSP programmes, agile products — one platform for your entire delivery organization.
        </p>
        <div className="inline-flex gap-1 p-1 bg-muted rounded-lg">
          <button
            className={`px-4 py-2 text-sm rounded-md transition-colors ${cycle === "monthly" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
            onClick={() => setCycle("monthly")}
          >Monthly</button>
          <button
            className={`px-4 py-2 text-sm rounded-md transition-colors ${cycle === "yearly" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
            onClick={() => setCycle("yearly")}
          >Yearly <span className="text-xs text-primary ml-1">Save ~17%</span></button>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 pb-16">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-3">
            {plans.map((plan) => {
              const price = cycle === "monthly" ? plan.price_monthly : plan.price_yearly;
              const lines = planFeatureLines(plan.id);
              return (
                <Card
                  key={plan.id}
                  className={`p-6 relative ${plan.highlight ? "border-primary ring-2 ring-primary/20 shadow-lg" : ""}`}
                >
                  {plan.highlight && (
                    <Badge className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-primary">
                      Most popular
                    </Badge>
                  )}
                  <h3 className="text-xl font-bold">{plan.name}</h3>
                  <p className="text-sm text-muted-foreground mb-4 min-h-[40px]">{plan.description}</p>
                  <div className="mb-6">
                    <span className="text-4xl font-bold">{formatPrice(plan.currency, price)}</span>
                    <span className="text-muted-foreground">/{cycle === "monthly" ? "mo" : "yr"}</span>
                  </div>
                  <Button
                    className="w-full gap-2 mb-6"
                    variant={plan.highlight ? "default" : "outline"}
                    onClick={() => handleStart(plan.id)}
                    disabled={!!user && isLicenseMode}
                  >
                    {user && isLicenseMode
                      ? "Managed via license"
                      : (plan.cta_label || (plan.price_monthly === 0 ? "Start free" : "Start free trial"))}
                    {!(user && isLicenseMode) && <ArrowRight className="h-4 w-4" />}
                  </Button>
                  <ul className="space-y-2 text-sm">
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

      <section className="max-w-5xl mx-auto px-6 pb-12">
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="p-5">
            <h3 className="font-bold mb-1">Helpdesk Add-on</h3>
            <p className="text-sm text-muted-foreground mb-3">Tickets, SLAs, customer portal — linked to your projects.</p>
            <Button variant="outline" size="sm" onClick={() => navigate("/addons")}>Explore add-on</Button>
          </Card>
          <Card className="p-5">
            <h3 className="font-bold mb-1">Change Management Add-on</h3>
            <p className="text-sm text-muted-foreground mb-3">Full CAB workflow, risk scoring, and audit trail.</p>
            <Button variant="outline" size="sm" onClick={() => navigate("/addons")}>Explore add-on</Button>
          </Card>
          <Card className="p-5 border-primary/40">
            <Badge variant="secondary" className="mb-2">New</Badge>
            <h3 className="font-bold mb-1">Learning Management Add-on</h3>
            <p className="text-sm text-muted-foreground mb-3">Courses, quizzes, certifications, and role-based learning paths.</p>
            <Button size="sm" onClick={() => navigate("/addons")}>Explore LMS</Button>
          </Card>
        </div>
      </section>

      <section className="max-w-3xl mx-auto px-6 pb-16 text-center">
        <h2 className="text-2xl font-bold mb-3">Need something custom?</h2>
        <p className="text-muted-foreground mb-6">
          Enterprise plans with SSO, dedicated support, and custom integrations are available on request.
        </p>
        <Button variant="outline" onClick={() => navigate("/auth?mode=signup")}>
          Get started — it's free to try
        </Button>
      </section>
    </div>
  );
}
