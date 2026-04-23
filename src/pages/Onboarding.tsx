import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, Users, Rocket, Check, ArrowRight, ArrowLeft, Mail, Headphones, GitBranch, Layers } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

type Intent = "ppm" | "helpdesk" | "itsm";
type Step = "intent" | "org" | "invite" | "plan" | "done";

export default function Onboarding() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const initialIntent = (searchParams.get("plan_kind") as Intent | null) || null;
  const [step, setStep] = useState<Step>(initialIntent ? "org" : "intent");
  const [intent, setIntent] = useState<Intent>(initialIntent || "ppm");
  const [loading, setLoading] = useState(false);
  const [orgName, setOrgName] = useState("");
  const [orgId, setOrgId] = useState<string | null>(null);
  const [inviteEmails, setInviteEmails] = useState("");
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [plans, setPlans] = useState<any[]>([]);

  const generateSlug = (name: string) =>
    name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

  const handleCreateOrg = async () => {
    if (!user || !orgName.trim()) return;
    setLoading(true);
    try {
      const { data: org, error: orgError } = await supabase
        .from("organizations")
        .insert({ name: orgName.trim(), slug: generateSlug(orgName), created_by: user.id })
        .select()
        .single();

      if (orgError) throw orgError;

      await supabase
        .from("user_organization_access")
        .insert({ user_id: user.id, organization_id: org.id, access_level: "admin" });

      await supabase.from("branding_settings").insert({ organization_id: org.id });

      setOrgId(org.id);
      localStorage.setItem("currentOrganizationId", org.id);

      // Fetch plans for next step — filter to the intent the user picked
      const planKinds = intent === "ppm" ? ["core"] : intent === "helpdesk" ? ["helpdesk"] : ["itsm"];
      const { data: plansData } = await supabase
        .from("subscription_plans")
        .select("*")
        .eq("is_active", true)
        .eq("is_archived", false)
        .in("plan_kind", planKinds)
        .order("sort_order");

      setPlans(plansData || []);

      // Auto-assign free plan if available (PPM Free, Helpdesk Free)
      const freePlan = plansData?.find(p => p.price_monthly === 0 && p.price_yearly === 0);
      if (freePlan && org.id) {
        await supabase.from("organization_subscriptions").insert({
          organization_id: org.id,
          plan_id: freePlan.id,
          status: "trialing",
          trial_ends_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        });
        setSelectedPlan(freePlan.id);
      }

      setStep("invite");
    } catch (err: any) {
      toast.error(err.message || "Failed to create organization");
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async () => {
    // For now, just show a toast — actual invite sending would go through an edge function
    const emails = inviteEmails.split(/[,\n]/).map(e => e.trim()).filter(Boolean);
    if (emails.length > 0) {
      toast.success(`Invitations will be sent to ${emails.length} team member(s)`);
    }
    setStep("plan");
  };

  const handleSelectPlan = async (planId: string) => {
    if (!orgId) return;
    setLoading(true);
    try {
      await supabase
        .from("organization_subscriptions")
        .update({ plan_id: planId, status: "trialing", trial_ends_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() })
        .eq("organization_id", orgId);

      setSelectedPlan(planId);
      toast.success("Plan selected!");
      setStep("done");
    } catch (err: any) {
      toast.error(err.message || "Failed to update plan");
    } finally {
      setLoading(false);
    }
  };

  const handleFinish = () => {
    navigate("/");
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Progress */}
        <div className="flex items-center gap-2 mb-8 justify-center">
          {(["intent", "org", "invite", "plan", "done"] as Step[]).map((s, i, arr) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step === s ? "bg-primary text-primary-foreground" :
                arr.indexOf(step) > i
                  ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
              }`}>
                {arr.indexOf(step) > i ? (
                  <Check className="h-4 w-4" />
                ) : i + 1}
              </div>
              {i < arr.length - 1 && <div className="w-10 h-0.5 bg-muted" />}
            </div>
          ))}
        </div>

        {/* Step: Choose Intent */}
        {step === "intent" && (
          <Card className="p-8">
            <div className="text-center mb-6">
              <Rocket className="h-12 w-12 mx-auto text-primary mb-4" />
              <h2 className="text-2xl font-bold mb-2">What brings you to TaskMaster?</h2>
              <p className="text-muted-foreground">
                Pick the area you want to focus on. You can add more later.
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {[
                { id: "ppm" as Intent, icon: Layers, title: "Full PPM", desc: "PRINCE2, MSP programmes, projects, products, agile" },
                { id: "helpdesk" as Intent, icon: Headphones, title: "Helpdesk only", desc: "Tickets, SLA, customer portal, email intake" },
                { id: "itsm" as Intent, icon: GitBranch, title: "ITSM", desc: "Helpdesk + Change Management, CAB workflow" },
              ].map(({ id, icon: Icon, title, desc }) => (
                <Card
                  key={id}
                  className={`p-4 cursor-pointer transition-all hover:border-primary text-left ${
                    intent === id ? "border-primary ring-2 ring-primary/20" : ""
                  }`}
                  onClick={() => setIntent(id)}
                >
                  <Icon className="h-6 w-6 text-primary mb-2" />
                  <div className="font-semibold mb-1">{title}</div>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                </Card>
              ))}
            </div>
            <div className="flex justify-center mt-6">
              <Button onClick={() => setStep("org")} className="gap-2">
                Continue <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </Card>
        )}

        {/* Step: Create Organization */}
        {step === "org" && (
          <Card className="p-8 text-center">
            <Building2 className="h-12 w-12 mx-auto text-primary mb-4" />
            <h2 className="text-2xl font-bold mb-2">Create Your Organization</h2>
            <p className="text-muted-foreground mb-6">
              Set up your workspace to start managing programmes and projects.
            </p>
            <div className="max-w-sm mx-auto space-y-4">
              <div className="text-left">
                <Label htmlFor="orgName">Organization Name</Label>
                <Input
                  id="orgName"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  placeholder="Acme Corporation"
                />
              </div>
              <Button onClick={handleCreateOrg} disabled={!orgName.trim() || loading} className="w-full gap-2">
                {loading ? "Creating..." : "Create & Continue"} <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </Card>
        )}

        {/* Step: Invite Team */}
        {step === "invite" && (
          <Card className="p-8 text-center">
            <Users className="h-12 w-12 mx-auto text-primary mb-4" />
            <h2 className="text-2xl font-bold mb-2">Invite Your Team</h2>
            <p className="text-muted-foreground mb-6">
              Add team members by email. You can always add more later.
            </p>
            <div className="max-w-sm mx-auto space-y-4">
              <div className="text-left">
                <Label htmlFor="emails">Email addresses (comma-separated)</Label>
                <Input
                  id="emails"
                  value={inviteEmails}
                  onChange={(e) => setInviteEmails(e.target.value)}
                  placeholder="jane@acme.com, john@acme.com"
                />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep("org")} className="gap-2">
                  <ArrowLeft className="h-4 w-4" /> Back
                </Button>
                <Button onClick={handleInvite} className="flex-1 gap-2">
                  {inviteEmails.trim() ? "Send Invites" : "Skip"} <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Step: Choose Plan */}
        {step === "plan" && (
          <div>
            <div className="text-center mb-6">
              <Rocket className="h-12 w-12 mx-auto text-primary mb-4" />
              <h2 className="text-2xl font-bold mb-2">Choose Your Plan</h2>
              <p className="text-muted-foreground">
                Start with a 30-day free trial. Upgrade anytime.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {plans.map((plan) => (
                <Card
                  key={plan.id}
                  className={`p-6 cursor-pointer transition-all hover:border-primary ${
                    selectedPlan === plan.id ? "border-primary ring-2 ring-primary/20" : ""
                  }`}
                  onClick={() => handleSelectPlan(plan.id)}
                >
                  <h3 className="text-lg font-bold mb-1">{plan.name}</h3>
                  <p className="text-sm text-muted-foreground mb-3">{plan.description}</p>
                  <div className="text-2xl font-bold mb-3">
                    ${plan.price_monthly}<span className="text-sm font-normal text-muted-foreground">/mo</span>
                  </div>
                  <div className="space-y-1 text-sm">
                    <p>{plan.max_users === -1 ? "Unlimited" : plan.max_users} users</p>
                    <p>{plan.max_programmes === -1 ? "Unlimited" : plan.max_programmes} programmes</p>
                    <p>{plan.max_projects === -1 ? "Unlimited" : plan.max_projects} projects</p>
                  </div>
                  {selectedPlan === plan.id && (
                    <Badge className="mt-3 bg-primary">Selected</Badge>
                  )}
                </Card>
              ))}
            </div>
            <div className="flex justify-center mt-6">
              <Button variant="outline" onClick={() => setStep("invite")} className="gap-2">
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
            </div>
          </div>
        )}

        {/* Step: Done */}
        {step === "done" && (
          <Card className="p-8 text-center">
            <div className="h-16 w-16 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4">
              <Check className="h-8 w-8 text-success" />
            </div>
            <h2 className="text-2xl font-bold mb-2">You're All Set!</h2>
            <p className="text-muted-foreground mb-6">
              Your organization is ready. Start creating programmes and projects.
            </p>
            <Button onClick={handleFinish} className="gap-2">
              Go to Dashboard <ArrowRight className="h-4 w-4" />
            </Button>
          </Card>
        )}
      </div>
    </div>
  );
}
