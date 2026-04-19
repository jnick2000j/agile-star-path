import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, ArrowRight, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export default function Pricing() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [cycle, setCycle] = useState<"monthly" | "yearly">("monthly");

  useEffect(() => {
    supabase
      .from("subscription_plans")
      .select("*")
      .eq("is_active", true)
      .order("sort_order")
      .then(({ data }) => {
        setPlans(data || []);
        setLoading(false);
      });
  }, []);

  const handleStart = (planId?: string) => {
    if (user) {
      navigate(planId ? `/billing` : "/");
    } else {
      navigate(`/auth?mode=signup${planId ? `&plan=${planId}` : ""}`);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="font-bold text-lg">
            PIMP
          </Link>
          <div className="flex gap-2">
            {user ? (
              <Button onClick={() => navigate("/")} variant="outline">
                Go to Dashboard
              </Button>
            ) : (
              <>
                <Button variant="ghost" onClick={() => navigate("/auth")}>
                  Sign in
                </Button>
                <Button onClick={() => navigate("/auth?mode=signup")}>
                  Get started
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 py-16 text-center">
        <Badge variant="secondary" className="mb-4">30-day free trial • No card required</Badge>
        <h1 className="text-4xl md:text-5xl font-bold mb-4 tracking-tight">
          Pricing that scales with your portfolio
        </h1>
        <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
          PRINCE2 governance, MSP programmes, agile products — one platform for your
          entire delivery organization.
        </p>
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
            Yearly <span className="text-xs text-primary ml-1">Save ~17%</span>
          </button>
        </div>
      </section>

      {/* Plans */}
      <section className="max-w-6xl mx-auto px-6 pb-16">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-3">
            {plans.map((plan) => {
              const isMid = plan.sort_order === 2;
              const price = cycle === "monthly" ? plan.price_monthly : plan.price_yearly;
              const features: string[] = Array.isArray(plan.features) ? plan.features : [];
              return (
                <Card
                  key={plan.id}
                  className={`p-6 relative ${isMid ? "border-primary ring-2 ring-primary/20 shadow-lg" : ""}`}
                >
                  {isMid && (
                    <Badge className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-primary">
                      Most popular
                    </Badge>
                  )}
                  <h3 className="text-xl font-bold">{plan.name}</h3>
                  <p className="text-sm text-muted-foreground mb-4 min-h-[40px]">{plan.description}</p>
                  <div className="mb-6">
                    <span className="text-4xl font-bold">${price}</span>
                    <span className="text-muted-foreground">/{cycle === "monthly" ? "mo" : "yr"}</span>
                  </div>
                  <Button
                    className="w-full gap-2 mb-6"
                    variant={isMid ? "default" : "outline"}
                    onClick={() => handleStart(plan.id)}
                  >
                    {plan.price_monthly === 0 ? "Start free" : "Start free trial"}
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                  <ul className="space-y-2 text-sm">
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
                    {features.map((f, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* FAQ teaser */}
      <section className="max-w-3xl mx-auto px-6 pb-16 text-center">
        <h2 className="text-2xl font-bold mb-3">Need something custom?</h2>
        <p className="text-muted-foreground mb-6">
          Enterprise plans with SSO, dedicated support, and custom integrations are
          available on request.
        </p>
        <Button variant="outline" onClick={() => navigate("/auth?mode=signup")}>
          Get started — it's free for 30 days
        </Button>
      </section>
    </div>
  );
}
