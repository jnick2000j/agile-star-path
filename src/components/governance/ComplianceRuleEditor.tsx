import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Loader2, Settings2 } from "lucide-react";

interface Props {
  organizationId: string;
  onSaved?: () => void;
}

type Cfg = {
  weight_controls: number;
  weight_cadence: number;
  weight_hygiene: number;
  threshold_pass: number;
  threshold_warn: number;
  cadence_window_days: number;
  stale_window_days: number;
  check_has_risks: boolean;
  check_has_issues: boolean;
  check_has_milestones: boolean;
  check_has_benefits: boolean;
  check_has_stakeholders: boolean;
  check_recent_updates: boolean;
  check_orphan_risks: boolean;
  check_stale_risks: boolean;
  check_orphan_issues: boolean;
  check_stale_issues: boolean;
};

const DEFAULTS: Cfg = {
  weight_controls: 40,
  weight_cadence: 30,
  weight_hygiene: 30,
  threshold_pass: 80,
  threshold_warn: 60,
  cadence_window_days: 14,
  stale_window_days: 30,
  check_has_risks: true,
  check_has_issues: true,
  check_has_milestones: true,
  check_has_benefits: true,
  check_has_stakeholders: true,
  check_recent_updates: true,
  check_orphan_risks: true,
  check_stale_risks: true,
  check_orphan_issues: true,
  check_stale_issues: true,
};

const CHECK_LABELS: Record<keyof Cfg, string> = {
  check_has_risks: "Risk register populated",
  check_has_issues: "Issue register populated",
  check_has_milestones: "Milestones defined",
  check_has_benefits: "Benefits identified",
  check_has_stakeholders: "Stakeholders mapped",
  check_recent_updates: "Recent updates posted",
  check_orphan_risks: "Open risks have an owner",
  check_stale_risks: "No stale risks",
  check_orphan_issues: "Open issues have an owner",
  check_stale_issues: "No stale issues",
} as Record<keyof Cfg, string>;

export function ComplianceRuleEditor({ organizationId, onSaved }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [cfg, setCfg] = useState<Cfg>(DEFAULTS);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    supabase
      .from("compliance_rule_configs")
      .select("*")
      .eq("organization_id", organizationId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setCfg({ ...DEFAULTS, ...data } as Cfg);
        else setCfg(DEFAULTS);
        setLoading(false);
      });
  }, [open, organizationId]);

  const totalWeight = cfg.weight_controls + cfg.weight_cadence + cfg.weight_hygiene;
  const weightsValid = totalWeight === 100;
  const thresholdsValid = cfg.threshold_pass > cfg.threshold_warn;

  const handleSave = async () => {
    if (!weightsValid) { toast.error("Weights must total 100"); return; }
    if (!thresholdsValid) { toast.error("Pass threshold must exceed warn threshold"); return; }
    setSaving(true);
    const { error } = await supabase
      .from("compliance_rule_configs")
      .upsert({ organization_id: organizationId, ...cfg }, { onConflict: "organization_id" });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Compliance rules saved");
    setOpen(false);
    onSaved?.();
  };

  const checkKeys: (keyof Cfg)[] = [
    "check_has_risks","check_has_issues","check_has_milestones","check_has_benefits","check_has_stakeholders",
    "check_recent_updates","check_orphan_risks","check_stale_risks","check_orphan_issues","check_stale_issues",
  ];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Settings2 className="h-4 w-4 mr-2" />
        Customize rules
      </Button>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Customize compliance scoring</DialogTitle>
          <DialogDescription>
            Adjust pillar weights, status thresholds, and which checks run. Defaults match PRINCE2/MSP best practice.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-center text-muted-foreground">Loading…</div>
        ) : (
          <div className="space-y-6">
            <section>
              <h3 className="font-semibold text-sm mb-3">Pillar weights (must total 100)</h3>
              <div className="grid grid-cols-3 gap-3">
                {(["controls","cadence","hygiene"] as const).map((p) => (
                  <div key={p} className="space-y-1">
                    <Label className="capitalize">{p}</Label>
                    <Input type="number" min={0} max={100}
                      value={cfg[`weight_${p}` as keyof Cfg] as number}
                      onChange={(e) => setCfg({ ...cfg, [`weight_${p}`]: Number(e.target.value) || 0 })}
                    />
                  </div>
                ))}
              </div>
              <p className={`text-xs mt-1 ${weightsValid ? "text-muted-foreground" : "text-destructive"}`}>
                Total: {totalWeight} {weightsValid ? "✓" : "(must equal 100)"}
              </p>
            </section>

            <Separator />

            <section>
              <h3 className="font-semibold text-sm mb-3">Status thresholds</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Pass (green) ≥</Label>
                  <Input type="number" min={0} max={100} value={cfg.threshold_pass}
                    onChange={(e) => setCfg({ ...cfg, threshold_pass: Number(e.target.value) || 0 })} />
                </div>
                <div className="space-y-1">
                  <Label>Warn (amber) ≥</Label>
                  <Input type="number" min={0} max={100} value={cfg.threshold_warn}
                    onChange={(e) => setCfg({ ...cfg, threshold_warn: Number(e.target.value) || 0 })} />
                </div>
              </div>
              <p className="text-xs mt-1 text-muted-foreground">
                Below warn threshold = red (fail).
              </p>
            </section>

            <Separator />

            <section>
              <h3 className="font-semibold text-sm mb-3">Time windows</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Cadence window (days)</Label>
                  <Input type="number" min={1} value={cfg.cadence_window_days}
                    onChange={(e) => setCfg({ ...cfg, cadence_window_days: Number(e.target.value) || 14 })} />
                </div>
                <div className="space-y-1">
                  <Label>Stale threshold (days)</Label>
                  <Input type="number" min={1} value={cfg.stale_window_days}
                    onChange={(e) => setCfg({ ...cfg, stale_window_days: Number(e.target.value) || 30 })} />
                </div>
              </div>
            </section>

            <Separator />

            <section>
              <h3 className="font-semibold text-sm mb-3">Individual checks</h3>
              <div className="space-y-2">
                {checkKeys.map((k) => (
                  <div key={k} className="flex items-center justify-between rounded-md border p-2">
                    <Label htmlFor={k} className="text-sm font-normal">{CHECK_LABELS[k]}</Label>
                    <Switch id={k} checked={cfg[k] as boolean}
                      onCheckedChange={(v) => setCfg({ ...cfg, [k]: v })} />
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !weightsValid || !thresholdsValid}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save rules
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
