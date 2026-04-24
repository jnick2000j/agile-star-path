import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
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
import { Rocket, ArrowLeft, ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
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
  /** If omitted, the wizard lets the user pick an org they admin. */
  organization?: Org | null;
  /** Force a specific vertical (otherwise uses the org's industry_vertical, or the first enabled vertical). */
  verticalId?: string;
  /** When true (e.g. first-org wizard), the org-picker step is skipped. */
  hideOrgPicker?: boolean;
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

export function OrgOnboardingWizard({
  open,
  onOpenChange,
  organization,
  verticalId,
  hideOrgPicker,
  onSuccess,
}: Props) {
  const { userRole } = useAuth();
  const isPlatformAdmin = userRole === "admin";
  const [step, setStep] = useState<Step>("org");
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string>("");
  const [vertical, setVertical] = useState<VerticalConfig | null>(null);
  const [enabledVerticals, setEnabledVerticals] = useState<VerticalConfig[]>([]);
  const [chosenVerticalId, setChosenVerticalId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [seedWelcome, setSeedWelcome] = useState(true);
  const [seedSampleEntity, setSeedSampleEntity] = useState(false);

  // Reset on open
  useEffect(() => {
    if (!open) return;
    setStep(organization || hideOrgPicker ? "terminology" : "org");
    setSelectedOrgId(organization?.id ?? "");
    setSeedWelcome(true);
    setSeedSampleEntity(false);
    setChosenVerticalId(verticalId ?? organization?.industry_vertical ?? null);
  }, [open, organization, hideOrgPicker, verticalId]);

  // Load enabled verticals + (if needed) orgs the user can administer
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    Promise.all([
      supabase
        .from("industry_verticals")
        .select("id, name, description, enabled_modules, terminology_overrides, default_dashboards, ai_context_prompt, is_active, sort_order")
        .eq("is_active", true)
        .order("sort_order"),
      organization || hideOrgPicker
        ? Promise.resolve({ data: organization ? [organization] : [], error: null })
        : supabase
            .from("user_organization_access")
            .select("organization_id, access_level, organizations(id, name, slug, industry_vertical, is_archived)")
            .eq("access_level", "admin"),
    ]).then(([vRes, oRes]: any) => {
      const list: VerticalConfig[] = (vRes.data ?? []).map((v: any) => ({
        ...v,
        terminology_overrides: (v.terminology_overrides as Record<string, string>) ?? {},
      }));
      setEnabledVerticals(list);

      const targetId =
        verticalId ??
        organization?.industry_vertical ??
        chosenVerticalId ??
        list[0]?.id ??
        null;
      setChosenVerticalId(targetId);
      const found = list.find((v) => v.id === targetId) ?? null;
      setVertical(found);

      if (oRes && Array.isArray(oRes.data)) {
        // map either direct orgs (preselected) or join rows
        const mapped: Org[] = oRes.data
          .map((row: any) => row.organizations ?? row)
          .filter((o: any) => o && !o.is_archived);
        setOrgs(mapped);
      }
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, organization, hideOrgPicker, verticalId]);

  // Recompute when chosen vertical changes
  useEffect(() => {
    if (!chosenVerticalId) return;
    const v = enabledVerticals.find((x) => x.id === chosenVerticalId) ?? null;
    setVertical(v);
  }, [chosenVerticalId, enabledVerticals]);

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

      // 2) Optional welcome KB article
      if (seedWelcome) {
        const { error: kbErr } = await supabase.from("kb_articles").insert({
          organization_id: currentOrg.id,
          title: `Welcome to ${vertical.name}`,
          summary: `Your account is configured for ${vertical.name}. ${vertical.description ?? ""}`,
          body:
            `This workspace is set up for **${vertical.name}**.\n\n` +
            (Object.keys(vertical.terminology_overrides).length
              ? "Terminology in your account:\n" +
                Object.entries(vertical.terminology_overrides)
                  .map(([k, v]) => `  • ${k} → ${v}`)
                  .join("\n") +
                "\n\n"
              : "") +
            (vertical.default_dashboards.length
              ? "Default dashboards:\n" + vertical.default_dashboards.map((d) => `  • ${d}`).join("\n") + "\n\n"
              : "") +
            "Next steps:\n  1. Invite your team.\n  2. Open Wizards to draft your first artefacts with AI.\n  3. Configure roles & branding under Settings.\n",
          category: "Onboarding",
          tags: ["onboarding", vertical.id],
          status: "published",
          visibility: "internal",
        });
        if (kbErr) console.warn("Welcome article insert failed", kbErr);
      }

      // 3) Optional sample vertical entity record
      if (seedSampleEntity) {
        const { data: ent } = await supabase
          .from("vertical_entities")
          .select("id, slug, name")
          .eq("vertical_id", vertical.id)
          .order("sort_order")
          .limit(1)
          .maybeSingle();
        if (ent?.id) {
          const { error: recErr } = await supabase.from("vertical_entity_records").insert({
            entity_id: ent.id,
            organization_id: currentOrg.id,
            title: `Sample ${ent.name ?? "record"} — created by setup wizard`,
            status: "draft",
            priority: "medium",
            data: { source: "onboarding_wizard", notes: "Safe to delete." },
          });
          if (recErr) console.warn("Sample record insert failed", recErr);
        }
      }

      toast.success(`${vertical.name} configured for ${currentOrg.name}`);
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
            <Rocket className="h-5 w-5" />
            Organization Setup Wizard
          </DialogTitle>
          <DialogDescription>
            Configure your account — pick an industry vertical, review terminology, modules, dashboards and seed starter content.
          </DialogDescription>
        </DialogHeader>

        {/* Stepper */}
        {step !== "done" && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground flex-wrap">
            {STEPS.filter((s) => !(hideOrgPicker && s.id === "org")).map((s, i, arr) => {
              const visualIdx = STEPS.findIndex((x) => x.id === s.id);
              return (
                <div key={s.id} className="flex items-center gap-1">
                  <span
                    className={`px-2 py-1 rounded ${
                      visualIdx === stepIndex
                        ? "bg-primary text-primary-foreground"
                        : visualIdx < stepIndex
                          ? "bg-muted"
                          : "bg-transparent"
                    }`}
                  >
                    {i + 1}. {s.label}
                  </span>
                  {i < arr.length - 1 && <span>›</span>}
                </div>
              );
            })}
          </div>
        )}

        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading vertical configuration…
          </div>
        )}

        {!loading && (
          <ScrollArea className="max-h-[55vh] pr-2">
            {step === "org" && !hideOrgPicker && (
              <div className="space-y-3">
                <Label>Account to configure</Label>
                <Select value={selectedOrgId} onValueChange={setSelectedOrgId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose an account…" />
                  </SelectTrigger>
                  <SelectContent>
                    {orgs.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.name}
                        {o.industry_vertical && (
                          <span className="text-xs text-muted-foreground"> — {o.industry_vertical}</span>
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {orgs.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    You don't administer any organizations yet.
                  </p>
                )}
              </div>
            )}

            {step === "terminology" && vertical && (
              <div className="space-y-3">
                <div>
                  <Label>Industry vertical</Label>
                  <Select value={chosenVerticalId ?? ""} onValueChange={setChosenVerticalId}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Choose vertical…" />
                    </SelectTrigger>
                    <SelectContent>
                      {enabledVerticals.map((v) => (
                        <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-sm">
                  Terminology overrides for <strong>{vertical.name}</strong>:
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
              </div>
            )}

            {step === "modules" && vertical && (
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-semibold mb-2">
                    Enabled modules ({vertical.enabled_modules.length})
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {vertical.enabled_modules.map((m) => (
                      <Badge key={m} variant="secondary" className="text-xs">{m}</Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-semibold mb-2">
                    Default dashboards ({vertical.default_dashboards.length})
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {vertical.default_dashboards.map((d) => (
                      <Badge key={d} variant="outline" className="text-xs">{d}</Badge>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {step === "seed" && vertical && (
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
                      Posts a short overview of terminology, dashboards and recommended next steps.
                    </div>
                  </div>
                </label>
                <label className="flex items-start gap-3 rounded-md border p-3 cursor-pointer">
                  <Checkbox
                    checked={seedSampleEntity}
                    onCheckedChange={(v) => setSeedSampleEntity(!!v)}
                    className="mt-0.5"
                  />
                  <div>
                    <div className="text-sm font-medium">Create a sample record</div>
                    <div className="text-xs text-muted-foreground">
                      Adds a sample entity for this vertical so the team can explore the data model.
                    </div>
                  </div>
                </label>
              </div>
            )}

            {step === "confirm" && currentOrg && vertical && (
              <div className="space-y-3 text-sm">
                <p>
                  Apply <strong>{vertical.name}</strong> configuration to{" "}
                  <strong>{currentOrg.name}</strong>?
                </p>
                <ul className="list-disc list-inside text-muted-foreground space-y-1">
                  <li>Industry vertical → {vertical.id}</li>
                  <li>{Object.keys(vertical.terminology_overrides).length} terminology overrides applied</li>
                  <li>{vertical.enabled_modules.length} modules enabled</li>
                  <li>{vertical.default_dashboards.length} default dashboards available</li>
                  {seedWelcome && <li>Welcome knowledge article will be added</li>}
                  {seedSampleEntity && <li>Sample record will be created</li>}
                </ul>
              </div>
            )}
          </ScrollArea>
        )}

        {step === "done" && currentOrg && vertical && (
          <div className="flex flex-col items-center text-center py-6 gap-3">
            <CheckCircle2 className="h-12 w-12 text-primary" />
            <h3 className="text-lg font-semibold">All set!</h3>
            <p className="text-sm text-muted-foreground max-w-md">
              <strong>{currentOrg.name}</strong> is now configured for <strong>{vertical.name}</strong>.
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
                    (step === "org" && !hideOrgPicker && !selectedOrgId)
                  }
                >
                  Next <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              ) : (
                <Button onClick={apply} disabled={applying || !currentOrg || !vertical}>
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
