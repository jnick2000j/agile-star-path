import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Briefcase, ArrowLeft, ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Org {
  id: string;
  name: string;
  slug: string;
  industry_vertical?: string | null;
}

interface VerticalConfig {
  id: string;
  name: string;
  description: string | null;
  enabled_modules: string[];
  terminology_overrides: Record<string, string>;
  default_dashboards: string[];
  ai_context_prompt: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Optional preselected org. If omitted, the wizard lets the admin pick one. */
  organization?: Org | null;
  onSuccess?: () => void;
}

type Step = "org" | "terminology" | "modules" | "seed" | "confirm" | "done";

const STEPS: Array<{ id: Step; label: string }> = [
  { id: "org", label: "Account" },
  { id: "terminology", label: "Terminology" },
  { id: "modules", label: "Modules & Dashboards" },
  { id: "seed", label: "Initial Content" },
  { id: "confirm", label: "Apply" },
];

export function PSOnboardingWizard({ open, onOpenChange, organization, onSuccess }: Props) {
  const [step, setStep] = useState<Step>("org");
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string>("");
  const [vertical, setVertical] = useState<VerticalConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [seedWelcome, setSeedWelcome] = useState(true);
  const [seedSampleEngagement, setSeedSampleEngagement] = useState(false);

  // Reset on open
  useEffect(() => {
    if (!open) return;
    setStep(organization ? "terminology" : "org");
    setSelectedOrgId(organization?.id ?? "");
    setSeedWelcome(true);
    setSeedSampleEngagement(false);
  }, [open, organization]);

  // Load PS&C vertical config + orgs list
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    Promise.all([
      supabase
        .from("industry_verticals")
        .select("id, name, description, enabled_modules, terminology_overrides, default_dashboards, ai_context_prompt")
        .eq("id", "professional_services")
        .maybeSingle(),
      organization
        ? Promise.resolve({ data: [organization], error: null })
        : supabase.from("organizations").select("id, name, slug, industry_vertical").order("name"),
    ]).then(([vRes, oRes]) => {
      if (vRes.data) {
        setVertical({
          ...(vRes.data as VerticalConfig),
          terminology_overrides: (vRes.data.terminology_overrides as Record<string, string>) ?? {},
        });
      }
      if (oRes && "data" in oRes && oRes.data) {
        setOrgs(oRes.data as Org[]);
      }
      setLoading(false);
    });
  }, [open, organization]);

  const currentOrg = useMemo(
    () => orgs.find((o) => o.id === selectedOrgId) ?? organization ?? null,
    [orgs, selectedOrgId, organization],
  );

  const stepIndex = STEPS.findIndex((s) => s.id === step);

  const next = () => {
    const order: Step[] = ["org", "terminology", "modules", "seed", "confirm"];
    const idx = order.indexOf(step);
    if (idx < order.length - 1) setStep(order[idx + 1]);
  };
  const back = () => {
    const order: Step[] = ["org", "terminology", "modules", "seed", "confirm"];
    const idx = order.indexOf(step);
    if (idx > 0) setStep(order[idx - 1]);
  };

  const apply = async () => {
    if (!currentOrg || !vertical) return;
    setApplying(true);
    try {
      // 1) Assign vertical to organization
      const { error: orgErr } = await supabase
        .from("organizations")
        .update({ industry_vertical: vertical.id })
        .eq("id", currentOrg.id);
      if (orgErr) throw orgErr;

      // 2) Optionally seed a welcome knowledge entry / sample engagement
      if (seedWelcome) {
        await supabase.from("knowledge_articles").insert({
          organization_id: currentOrg.id,
          title: "Welcome to your Professional Services workspace",
          summary:
            "Your account has been configured for consulting delivery: engagements, SOWs, MSAs, retainers, WIP, billing realisation, CSAT/NPS and more.",
          body:
            "This workspace is now set up for Professional Services & Consulting.\n\n" +
            "Key terminology in your account:\n" +
            Object.entries(vertical.terminology_overrides)
              .map(([k, v]) => `  • ${k} → ${v}`)
              .join("\n") +
            "\n\nDefault dashboards available:\n" +
            vertical.default_dashboards.map((d) => `  • ${d}`).join("\n") +
            "\n\nNext steps:\n" +
            "  1. Create your first Engagement (use the Engagement Setup wizard).\n" +
            "  2. Draft your MSA and SOWs from the AI wizards under Wizards → Pro Services.\n" +
            "  3. Configure your rate card and resource pool under Settings.\n",
          category: "Onboarding",
          tags: ["onboarding", "professional_services"],
        }).then(({ error }) => {
          if (error) console.warn("Welcome article insert failed", error);
        });
      }

      if (seedSampleEngagement) {
        await supabase.from("vertical_entity_records").insert({
          organization_id: currentOrg.id,
          vertical_entity_slug: "client_engagements",
          data: {
            name: "Sample Engagement — Internal demo",
            client_name: "Acme Corp (sample)",
            engagement_type: "time_and_materials",
            status: "draft",
            start_date: new Date().toISOString().slice(0, 10),
            account_manager: "TBD",
            value: 0,
            notes: "Sample engagement created by the onboarding wizard. Safe to delete.",
          },
        }).then(({ error }) => {
          if (error) console.warn("Sample engagement insert failed", error);
        });
      }

      toast.success(`Professional Services configured for ${currentOrg.name}`);
      setStep("done");
      onSuccess?.();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to apply configuration");
    } finally {
      setApplying(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Briefcase className="h-5 w-5" />
            Professional Services Onboarding
          </DialogTitle>
          <DialogDescription>
            Configure an account for Professional Services & Consulting — terminology, modules, dashboards and starter content.
          </DialogDescription>
        </DialogHeader>

        {/* Stepper */}
        {step !== "done" && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            {STEPS.map((s, i) => (
              <div key={s.id} className="flex items-center gap-1">
                <span
                  className={`px-2 py-1 rounded ${
                    i === stepIndex
                      ? "bg-primary text-primary-foreground"
                      : i < stepIndex
                        ? "bg-muted"
                        : "bg-transparent"
                  }`}
                >
                  {i + 1}. {s.label}
                </span>
                {i < STEPS.length - 1 && <span>›</span>}
              </div>
            ))}
          </div>
        )}

        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading vertical configuration…
          </div>
        )}

        {!loading && vertical && (
          <ScrollArea className="max-h-[55vh] pr-2">
            {step === "org" && (
              <div className="space-y-3">
                <Label>Account to configure</Label>
                <Select value={selectedOrgId} onValueChange={setSelectedOrgId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose an account…" />
                  </SelectTrigger>
                  <SelectContent>
                    {orgs.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.name}{" "}
                        {o.industry_vertical === "professional_services" && (
                          <span className="text-xs text-muted-foreground">— already PS&C</span>
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  Re-running this wizard on an account already configured for PS&C is safe — it will
                  re-apply the same vertical settings.
                </p>
              </div>
            )}

            {step === "terminology" && (
              <div className="space-y-3">
                <p className="text-sm">
                  These terminology overrides will be applied across the UI for this account
                  (sourced from the <strong>{vertical.name}</strong> vertical).
                </p>
                <div className="rounded-md border divide-y">
                  {Object.entries(vertical.terminology_overrides).length === 0 && (
                    <div className="p-3 text-sm text-muted-foreground">No overrides defined.</div>
                  )}
                  {Object.entries(vertical.terminology_overrides).map(([k, v]) => (
                    <div key={k} className="flex items-center justify-between px-3 py-2 text-sm">
                      <code className="text-muted-foreground">{k}</code>
                      <ArrowRight className="h-3 w-3 text-muted-foreground" />
                      <span className="font-medium">{v}</span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Need to change a term? Update the vertical pack under Industry Verticals — changes
                  apply to all accounts on this vertical.
                </p>
              </div>
            )}

            {step === "modules" && (
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-semibold mb-2">Enabled modules ({vertical.enabled_modules.length})</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {vertical.enabled_modules.map((m) => (
                      <Badge key={m} variant="secondary" className="text-xs">
                        {m}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-semibold mb-2">Default dashboards ({vertical.default_dashboards.length})</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {vertical.default_dashboards.map((d) => (
                      <Badge key={d} variant="outline" className="text-xs">
                        {d}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {step === "seed" && (
              <div className="space-y-4">
                <p className="text-sm">Optional starter content to help the team get going:</p>
                <label className="flex items-start gap-3 rounded-md border p-3 cursor-pointer">
                  <Checkbox
                    checked={seedWelcome}
                    onCheckedChange={(v) => setSeedWelcome(!!v)}
                    className="mt-0.5"
                  />
                  <div>
                    <div className="text-sm font-medium">Add a Welcome knowledge article</div>
                    <div className="text-xs text-muted-foreground">
                      Posts a short overview of the new terminology, dashboards and recommended next
                      steps to the account's knowledge base.
                    </div>
                  </div>
                </label>
                <label className="flex items-start gap-3 rounded-md border p-3 cursor-pointer">
                  <Checkbox
                    checked={seedSampleEngagement}
                    onCheckedChange={(v) => setSeedSampleEngagement(!!v)}
                    className="mt-0.5"
                  />
                  <div>
                    <div className="text-sm font-medium">Create a sample Engagement</div>
                    <div className="text-xs text-muted-foreground">
                      Adds a "Sample Engagement" so the team can explore SOW, deliverables and WIP.
                      Safe to delete later.
                    </div>
                  </div>
                </label>
              </div>
            )}

            {step === "confirm" && currentOrg && (
              <div className="space-y-3 text-sm">
                <p>
                  Apply <strong>{vertical.name}</strong> configuration to{" "}
                  <strong>{currentOrg.name}</strong>?
                </p>
                <ul className="list-disc list-inside text-muted-foreground space-y-1">
                  <li>Industry vertical → professional_services</li>
                  <li>{Object.keys(vertical.terminology_overrides).length} terminology overrides applied</li>
                  <li>{vertical.enabled_modules.length} modules enabled</li>
                  <li>{vertical.default_dashboards.length} default dashboards available</li>
                  {seedWelcome && <li>Welcome knowledge article will be added</li>}
                  {seedSampleEngagement && <li>Sample engagement record will be created</li>}
                </ul>
              </div>
            )}
          </ScrollArea>
        )}

        {step === "done" && currentOrg && (
          <div className="flex flex-col items-center text-center py-6 gap-3">
            <CheckCircle2 className="h-12 w-12 text-primary" />
            <h3 className="text-lg font-semibold">All set!</h3>
            <p className="text-sm text-muted-foreground max-w-md">
              <strong>{currentOrg.name}</strong> is now configured for Professional Services &
              Consulting. The team can start with the PS Wizards under <em>Wizards → Pro Services</em>.
            </p>
          </div>
        )}

        <DialogFooter className="gap-2">
          {step === "done" ? (
            <Button onClick={() => onOpenChange(false)}>Close</Button>
          ) : (
            <>
              {stepIndex > 0 && (
                <Button variant="outline" onClick={back} disabled={applying}>
                  <ArrowLeft className="h-4 w-4 mr-1" /> Back
                </Button>
              )}
              {step !== "confirm" ? (
                <Button
                  onClick={next}
                  disabled={
                    loading ||
                    !vertical ||
                    (step === "org" && !selectedOrgId)
                  }
                >
                  Next <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              ) : (
                <Button onClick={apply} disabled={applying || !currentOrg}>
                  {applying ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
                  Apply configuration
                </Button>
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
