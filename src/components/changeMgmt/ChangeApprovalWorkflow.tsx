import { useMemo, useState } from "react";
import { CheckCircle2, Circle, Clock, FileText, Plus, ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/**
 * 6-stage ITIL change-enablement workflow.
 * Stage gating is determined from the change record + approvals + evidence.
 * Audit-trail is provided by change_management_activity (already wired in detail page).
 */
const STAGES = [
  { key: "requester", label: "Requester", description: "Change raised & sponsored" },
  { key: "assessed", label: "Assessed", description: "Impact, risk, plan reviewed" },
  { key: "cab", label: "CAB / ECAB", description: "Authority approval" },
  { key: "scheduled", label: "Scheduled", description: "Window booked" },
  { key: "implemented", label: "Implemented", description: "Deployed & verified" },
  { key: "pir", label: "PIR", description: "Post-implementation review" },
] as const;

type StageKey = (typeof STAGES)[number]["key"];

const STAGE_FROM_STATUS: Record<string, StageKey> = {
  draft: "requester",
  submitted: "assessed",
  in_review: "assessed",
  needs_information: "assessed",
  cab_review: "cab",
  approved: "scheduled",
  rejected: "cab",
  scheduled: "scheduled",
  in_progress: "implemented",
  implemented: "pir",
  closed: "pir",
  cancelled: "requester",
  failed: "implemented",
};

interface Props {
  changeId: string;
  organizationId: string;
  changeStatus: string;
}

export function ChangeApprovalWorkflow({ changeId, organizationId, changeStatus }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [newLabel, setNewLabel] = useState("");
  const [newRequired, setNewRequired] = useState(true);

  const { data: approvals = [] } = useQuery({
    queryKey: ["cm-approvals", changeId],
    queryFn: async () => {
      const { data } = await supabase
        .from("change_management_approvals")
        .select("*")
        .eq("change_id", changeId)
        .order("sequence");
      return data ?? [];
    },
  });

  const { data: evidence = [] } = useQuery({
    queryKey: ["cm-evidence", changeId],
    queryFn: async () => {
      const { data } = await supabase
        .from("approval_evidence")
        .select("*")
        .eq("approval_id", changeId)
        .eq("approval_type", "change_management")
        .order("created_at");
      return data ?? [];
    },
  });

  const currentStage: StageKey = STAGE_FROM_STATUS[changeStatus] ?? "requester";
  const currentIdx = STAGES.findIndex((s) => s.key === currentStage);

  // CAB stage requires at least one CAB or ECAB approval to be "approved".
  const cabApproved = useMemo(() => {
    return (approvals as any[]).some(
      (a) => ["cab", "ecab"].includes(a.approval_kind) && a.decision === "approved",
    );
  }, [approvals]);

  // Evidence completeness: every required item must have either an attestation or a document.
  const requiredEvidence = (evidence as any[]).filter((e) => e.is_required);
  const evidenceComplete =
    requiredEvidence.length === 0 ||
    requiredEvidence.every((e) => e.attested_at || e.document_id);

  const addEvidence = async () => {
    if (!newLabel.trim()) {
      toast.error("Enter an evidence label");
      return;
    }
    const { error } = await supabase.from("approval_evidence").insert({
      approval_id: changeId,
      approval_type: "change_management",
      organization_id: organizationId,
      evidence_label: newLabel.trim(),
      is_required: newRequired,
      created_by: user?.id ?? null,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    setNewLabel("");
    setNewRequired(true);
    qc.invalidateQueries({ queryKey: ["cm-evidence", changeId] });
    // Audit trail
    await supabase.from("change_management_activity").insert({
      change_id: changeId,
      organization_id: organizationId,
      actor_user_id: user?.id ?? null,
      event_type: "evidence_added",
      to_value: { label: newLabel.trim(), required: newRequired },
      notes: `Evidence requirement added${newRequired ? " (required)" : ""}`,
    });
    toast.success("Evidence requirement added");
  };

  const attest = async (id: string, label: string) => {
    const { error } = await supabase
      .from("approval_evidence")
      .update({ attested_at: new Date().toISOString(), attested_by: user?.id ?? null })
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["cm-evidence", changeId] });
    await supabase.from("change_management_activity").insert({
      change_id: changeId,
      organization_id: organizationId,
      actor_user_id: user?.id ?? null,
      event_type: "evidence_attested",
      to_value: { evidence_id: id, label },
      notes: `Attested evidence: ${label}`,
    });
    toast.success("Attested");
  };

  const removeEvidence = async (id: string) => {
    const { error } = await supabase.from("approval_evidence").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["cm-evidence", changeId] });
  };

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Approval workflow
          </h3>
          <p className="text-xs text-muted-foreground">
            Requester → Assessed → CAB/ECAB → Scheduled → Implemented → PIR
          </p>
        </div>
        <Badge variant="outline" className="text-xs">
          Current: {STAGES[currentIdx]?.label ?? "—"}
        </Badge>
      </div>

      {/* Stepper */}
      <div className="grid grid-cols-6 gap-1">
        {STAGES.map((s, i) => {
          const done = i < currentIdx;
          const active = i === currentIdx;
          return (
            <div key={s.key} className="flex flex-col items-center text-center">
              <div
                className={cn(
                  "h-7 w-7 rounded-full flex items-center justify-center border-2 transition-colors",
                  done && "bg-success/15 border-success text-success",
                  active && "bg-primary/15 border-primary text-primary animate-pulse",
                  !done && !active && "bg-muted border-muted-foreground/30 text-muted-foreground",
                )}
              >
                {done ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : active ? (
                  <Clock className="h-4 w-4" />
                ) : (
                  <Circle className="h-3 w-3" />
                )}
              </div>
              <p
                className={cn(
                  "text-[10px] mt-1 font-medium leading-tight",
                  active && "text-primary",
                  done && "text-success",
                  !done && !active && "text-muted-foreground",
                )}
              >
                {s.label}
              </p>
            </div>
          );
        })}
      </div>

      {/* Gating signals */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div
          className={cn(
            "rounded-md border p-2",
            cabApproved
              ? "border-success/30 bg-success/5 text-success"
              : "border-muted bg-muted/30 text-muted-foreground",
          )}
        >
          <p className="font-medium">CAB authority</p>
          <p>{cabApproved ? "Approved by CAB/ECAB" : "Awaiting CAB / ECAB approval"}</p>
        </div>
        <div
          className={cn(
            "rounded-md border p-2",
            evidenceComplete
              ? "border-success/30 bg-success/5 text-success"
              : "border-warning/30 bg-warning/5 text-warning",
          )}
        >
          <p className="font-medium">Required evidence</p>
          <p>
            {requiredEvidence.length === 0
              ? "No required evidence configured"
              : evidenceComplete
                ? "All required evidence attested"
                : `${requiredEvidence.filter((e) => !e.attested_at && !e.document_id).length} outstanding`}
          </p>
        </div>
      </div>

      {/* Evidence checklist */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-semibold">Evidence checklist</Label>
          <Badge variant="outline" className="text-xs">
            {(evidence as any[]).filter((e) => e.attested_at || e.document_id).length}/
            {(evidence as any[]).length} complete
          </Badge>
        </div>
        {(evidence as any[]).length === 0 ? (
          <p className="text-xs text-muted-foreground italic">
            No evidence items yet. Add the artifacts your governance requires (test results, change
            communications, rollback verification, etc.).
          </p>
        ) : (
          <div className="space-y-1.5">
            {(evidence as any[]).map((e) => {
              const satisfied = !!(e.attested_at || e.document_id);
              return (
                <div
                  key={e.id}
                  className={cn(
                    "flex items-center justify-between gap-2 rounded-md border p-2 text-xs",
                    satisfied
                      ? "border-success/30 bg-success/5"
                      : e.is_required
                        ? "border-warning/30 bg-warning/5"
                        : "border-muted bg-muted/20",
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {satisfied ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" />
                    ) : (
                      <Circle className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    )}
                    <span className="truncate">{e.evidence_label}</span>
                    {e.is_required && (
                      <Badge
                        variant="outline"
                        className="text-[10px] bg-destructive/10 text-destructive border-destructive/30"
                      >
                        Required
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {!satisfied && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 text-xs"
                        onClick={() => attest(e.id, e.evidence_label)}
                      >
                        <FileText className="h-3 w-3 mr-1" />
                        Attest
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 text-xs text-muted-foreground"
                      onClick={() => removeEvidence(e.id)}
                    >
                      ✕
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex items-end gap-2 pt-2 border-t">
          <div className="flex-1 space-y-1">
            <Label className="text-xs">Add evidence requirement</Label>
            <Input
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="e.g. Test report attached, Stakeholders notified"
              className="h-8 text-xs"
            />
          </div>
          <div className="flex items-center gap-2 pb-1">
            <Switch checked={newRequired} onCheckedChange={setNewRequired} id="ev-req" />
            <Label htmlFor="ev-req" className="text-xs">
              Required
            </Label>
          </div>
          <Button size="sm" onClick={addEvidence} className="h-8">
            <Plus className="h-3.5 w-3.5 mr-1" />
            Add
          </Button>
        </div>
      </div>
    </Card>
  );
}
