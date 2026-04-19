import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Plus, Paperclip, CheckCircle2, Trash2, FileText } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { DocumentUpload } from "@/components/DocumentUpload";

interface Props {
  approvalType: "stage_gate" | "exception" | "quality_review";
  approvalId: string;
  organizationId: string | null;
  canEdit?: boolean;
}

interface EvidenceRow {
  id: string;
  evidence_label: string;
  description: string | null;
  is_required: boolean;
  document_id: string | null;
  attested_by: string | null;
  attested_at: string | null;
  created_by: string | null;
  created_at: string;
}

export function EvidenceChecklist({ approvalType, approvalId, organizationId, canEdit = true }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newRequired, setNewRequired] = useState(true);

  const { data: evidence = [] } = useQuery({
    queryKey: ["approval-evidence", approvalType, approvalId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("approval_evidence")
        .select("*")
        .eq("approval_type", approvalType)
        .eq("approval_id", approvalId)
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as EvidenceRow[];
    },
    enabled: !!approvalId,
  });

  const addEvidence = useMutation({
    mutationFn: async () => {
      if (!newLabel.trim()) throw new Error("Label required");
      const { error } = await supabase.from("approval_evidence").insert({
        approval_type: approvalType,
        approval_id: approvalId,
        evidence_label: newLabel.trim(),
        description: newDesc.trim() || null,
        is_required: newRequired,
        organization_id: organizationId,
        created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["approval-evidence", approvalType, approvalId] });
      setNewLabel("");
      setNewDesc("");
      setNewRequired(true);
      setAdding(false);
      toast.success("Evidence requirement added");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const attestEvidence = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("approval_evidence")
        .update({ attested_by: user?.id, attested_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["approval-evidence", approvalType, approvalId] });
      toast.success("Evidence attested");
    },
  });

  const removeEvidence = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("approval_evidence").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["approval-evidence", approvalType, approvalId] }),
  });

  const requiredCount = evidence.filter((e) => e.is_required).length;
  const attestedRequired = evidence.filter((e) => e.is_required && e.attested_at).length;
  const allRequiredMet = requiredCount > 0 && attestedRequired === requiredCount;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-semibold">Evidence checklist</h4>
          <p className="text-xs text-muted-foreground">
            {requiredCount > 0
              ? `${attestedRequired}/${requiredCount} required items attested`
              : "No evidence requirements defined"}
          </p>
        </div>
        {allRequiredMet && (
          <Badge className="bg-success/20 text-success">All required evidence attached</Badge>
        )}
      </div>

      <div className="space-y-2">
        {evidence.map((ev) => (
          <div
            key={ev.id}
            className="flex items-start gap-3 rounded-md border border-border bg-card p-3"
          >
            <div className="mt-1">
              {ev.attested_at ? (
                <CheckCircle2 className="h-4 w-4 text-success" />
              ) : (
                <FileText className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium">{ev.evidence_label}</span>
                {ev.is_required && <Badge variant="outline" className="text-xs">Required</Badge>}
                {ev.attested_at && (
                  <span className="text-xs text-muted-foreground">
                    Attested {format(new Date(ev.attested_at), "PP")}
                  </span>
                )}
              </div>
              {ev.description && (
                <p className="text-xs text-muted-foreground mt-1">{ev.description}</p>
              )}
              {canEdit && !ev.attested_at && (
                <div className="mt-2 flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => attestEvidence.mutate(ev.id)}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                    Mark attested
                  </Button>
                </div>
              )}
            </div>
            {canEdit && (
              <Button
                size="icon"
                variant="ghost"
                onClick={() => removeEvidence.mutate(ev.id)}
                aria-label="Remove evidence requirement"
              >
                <Trash2 className="h-4 w-4 text-muted-foreground" />
              </Button>
            )}
          </div>
        ))}

        {evidence.length === 0 && (
          <p className="text-xs text-muted-foreground italic px-1">
            No evidence requirements yet.
          </p>
        )}
      </div>

      {canEdit && (
        <>
          {adding ? (
            <div className="space-y-2 rounded-md border border-dashed border-border p-3">
              <div>
                <Label className="text-xs">Evidence label</Label>
                <Input
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  placeholder="e.g. Sponsor sign-off email"
                />
              </div>
              <div>
                <Label className="text-xs">Description (optional)</Label>
                <Textarea
                  rows={2}
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="What evidence demonstrates this control?"
                />
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="ev-required"
                  checked={newRequired}
                  onCheckedChange={(v) => setNewRequired(v === true)}
                />
                <Label htmlFor="ev-required" className="text-xs cursor-pointer">
                  Required for approval
                </Label>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => addEvidence.mutate()}>
                  Add
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add evidence requirement
            </Button>
          )}
        </>
      )}

      {/* Reuse generic document upload anchored to the approval entity */}
      <div className="pt-2">
        <Label className="text-xs flex items-center gap-1.5 mb-1.5">
          <Paperclip className="h-3.5 w-3.5" />
          Supporting documents
        </Label>
        <DocumentUpload entityType={approvalType as any} entityId={approvalId} />
      </div>
    </div>
  );
}
