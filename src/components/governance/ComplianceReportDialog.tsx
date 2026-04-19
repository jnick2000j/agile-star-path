import { useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { CheckCircle2, XCircle, Download, Printer } from "lucide-react";
import { format } from "date-fns";

type Check = {
  key: string;
  pillar: "controls" | "cadence" | "hygiene";
  label: string;
  passed: boolean;
  weight?: number;
  value?: number;
  recommendation?: string | null;
};

type ScoreDetails = {
  checks?: Check[];
  weights?: { controls: number; cadence: number; hygiene: number };
  thresholds?: { pass: number; warn: number };
  cadence_window_days?: number;
  stale_window_days?: number;
};

export type ScoreData = {
  score: number;
  controls_score: number;
  cadence_score: number;
  hygiene_score: number;
  details: ScoreDetails;
  computed_at: string;
  scope_name: string;
  scope_type: string;
};

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  data: ScoreData | null;
  organizationName?: string;
}

function getStatus(score: number, t: { pass: number; warn: number }): { label: string; color: string } {
  if (score >= t.pass) return { label: "Pass", color: "bg-success text-success-foreground" };
  if (score >= t.warn) return { label: "Warn", color: "bg-warning text-warning-foreground" };
  return { label: "Fail", color: "bg-destructive text-destructive-foreground" };
}

export function ComplianceReportDialog({ open, onOpenChange, data, organizationName }: Props) {
  const thresholds = data?.details?.thresholds ?? { pass: 80, warn: 60 };
  const weights = data?.details?.weights ?? { controls: 40, cadence: 30, hygiene: 30 };
  const checks = useMemo(() => data?.details?.checks ?? [], [data]);

  const handlePrint = () => window.print();

  const handleDownload = () => {
    if (!data) return;
    const lines: string[] = [];
    lines.push(`COMPLIANCE REPORT — ${data.scope_name}`);
    lines.push(`Organization: ${organizationName ?? ""}`);
    lines.push(`Scope type: ${data.scope_type}`);
    lines.push(`Generated: ${format(new Date(data.computed_at), "PPpp")}`);
    lines.push("");
    lines.push(`OVERALL SCORE: ${data.score}/100 (${getStatus(data.score, thresholds).label})`);
    lines.push(`  Controls: ${data.controls_score} (weight ${weights.controls}%)`);
    lines.push(`  Cadence:  ${data.cadence_score} (weight ${weights.cadence}%)`);
    lines.push(`  Hygiene:  ${data.hygiene_score} (weight ${weights.hygiene}%)`);
    lines.push("");
    lines.push("CHECK RESULTS");
    for (const c of checks) {
      lines.push(`[${c.passed ? "PASS" : "FAIL"}] (${c.pillar}) ${c.label}${c.value !== undefined ? ` — value: ${c.value}` : ""}`);
      if (!c.passed && c.recommendation) lines.push(`        → ${c.recommendation}`);
    }
    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `compliance-${data.scope_name.replace(/\s+/g, "-")}-${format(new Date(), "yyyyMMdd")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!data) return null;
  const overallStatus = getStatus(data.score, thresholds);
  const failedChecks = checks.filter((c) => !c.passed);
  const passedChecks = checks.filter((c) => c.passed);

  const pillars = [
    { key: "controls" as const, label: "Controls completeness", score: data.controls_score, weight: weights.controls,
      desc: "Are all PRINCE2/MSP control registers in place (risks, issues, milestones, benefits, stakeholders)?" },
    { key: "cadence" as const, label: "Update cadence", score: data.cadence_score, weight: weights.cadence,
      desc: `How recently the team has posted progress updates (window: ${data.details?.cadence_window_days ?? 14} days).` },
    { key: "hygiene" as const, label: "Register hygiene", score: data.hygiene_score, weight: weights.hygiene,
      desc: `Are open items owned and reviewed? Stale > ${data.details?.stale_window_days ?? 30} days flags risk.` },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto print:max-w-none print:overflow-visible">
        <DialogHeader>
          <DialogTitle>Compliance report — {data.scope_name}</DialogTitle>
          <DialogDescription>
            {data.scope_type} · Computed {format(new Date(data.computed_at), "PPpp")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Headline */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-start justify-between gap-6">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Overall compliance score</p>
                  <div className="flex items-baseline gap-3">
                    <span className="text-5xl font-bold">{data.score}</span>
                    <span className="text-lg text-muted-foreground">/ 100</span>
                    <Badge className={overallStatus.color}>{overallStatus.label}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    Weighted composite of three pillars. Pass ≥ {thresholds.pass}, warn ≥ {thresholds.warn}.
                  </p>
                </div>
                <div className="text-right text-sm">
                  <p className="text-muted-foreground">Checks passed</p>
                  <p className="text-2xl font-semibold">{passedChecks.length}/{checks.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Pillars */}
          <div>
            <h3 className="font-semibold text-sm mb-3">Pillar breakdown</h3>
            <div className="space-y-3">
              {pillars.map((p) => {
                const status = getStatus(p.score, thresholds);
                return (
                  <Card key={p.key}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="font-medium">{p.label}</p>
                          <p className="text-xs text-muted-foreground">{p.desc}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold">{p.score}</p>
                          <p className="text-xs text-muted-foreground">weight {p.weight}%</p>
                        </div>
                      </div>
                      <Progress value={p.score} />
                      <Badge className={`${status.color} mt-2`} variant="outline">{status.label}</Badge>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          <Separator />

          {/* Failed checks first */}
          {failedChecks.length > 0 && (
            <div>
              <h3 className="font-semibold text-sm mb-3 text-destructive">
                Action needed ({failedChecks.length})
              </h3>
              <div className="space-y-2">
                {failedChecks.map((c) => (
                  <div key={c.key} className="flex items-start gap-3 rounded-md border border-destructive/30 bg-destructive/5 p-3">
                    <XCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{c.label}</p>
                      <p className="text-xs text-muted-foreground capitalize">Pillar: {c.pillar}{c.value !== undefined ? ` · current: ${c.value}` : ""}</p>
                      {c.recommendation && (
                        <p className="text-xs text-foreground mt-1">→ {c.recommendation}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Passed checks */}
          {passedChecks.length > 0 && (
            <div>
              <h3 className="font-semibold text-sm mb-3 text-success">
                Passing ({passedChecks.length})
              </h3>
              <div className="space-y-1">
                {passedChecks.map((c) => (
                  <div key={c.key} className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-success" />
                    <span>{c.label}</span>
                    <span className="text-xs text-muted-foreground capitalize">· {c.pillar}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="print:hidden">
          <Button variant="outline" onClick={handleDownload}>
            <Download className="h-4 w-4 mr-2" />
            Download .txt
          </Button>
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-2" />
            Print / PDF
          </Button>
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
