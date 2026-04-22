import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";

interface MilestoneStatusChangeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  milestone: {
    id: string;
    name: string;
    status: string;
    target_date: string;
    original_target_date: string | null;
    revised_target_date: string | null;
  } | null;
  newStatus: string;
  onSuccess?: () => void;
}

const statusLabels: Record<string, string> = {
  planned: "Planned",
  in_progress: "In Progress",
  achieved: "Achieved",
  missed: "Missed",
  deferred: "Deferred",
};

export function MilestoneStatusChangeDialog({
  open,
  onOpenChange,
  milestone,
  newStatus,
  onSuccess,
}: MilestoneStatusChangeDialogProps) {
  const [comment, setComment] = useState("");
  const [revisedDate, setRevisedDate] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && milestone) {
      setComment("");
      setRevisedDate(milestone.revised_target_date || "");
      setReason("");
    }
  }, [open, milestone]);

  if (!milestone) return null;

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const updateData: Record<string, unknown> = { status: newStatus };

      // Preserve original target date
      if (!milestone.original_target_date) {
        updateData.original_target_date = milestone.target_date;
      }

      // Set revised date if provided
      if (revisedDate && revisedDate !== milestone.target_date) {
        updateData.revised_target_date = revisedDate;
        updateData.revision_reason = reason || comment || null;
      }

      if (newStatus === "achieved") {
        updateData.actual_date = new Date().toISOString().split("T")[0];
      }

      const { error } = await supabase
        .from("milestones")
        .update(updateData)
        .eq("id", milestone.id);

      if (error) throw error;

      // Add comment as separate history entry if provided
      if (comment.trim()) {
        await supabase.from("milestone_history").insert({
          milestone_id: milestone.id,
          event_type: "comment",
          comment: comment.trim(),
          to_value: newStatus,
          changed_by: (await supabase.auth.getUser()).data.user?.id,
        });
      }

      // Fire notification (best-effort)
      try {
        await supabase.functions.invoke("notify-milestone-change", {
          body: {
            milestone_id: milestone.id,
            event_type: "status_change",
            from_value: milestone.status,
            to_value: newStatus,
            comment: comment || null,
            revised_target_date: revisedDate || null,
          },
        });
      } catch (e) {
        console.warn("Notification dispatch failed:", e);
      }

      toast.success("Milestone updated");
      onOpenChange(false);
      onSuccess?.();
    } catch (e: any) {
      toast.error(e.message || "Failed to update milestone");
    } finally {
      setSaving(false);
    }
  };

  const originalDate = milestone.original_target_date || milestone.target_date;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            Change status: {statusLabels[milestone.status] || milestone.status} →{" "}
            {statusLabels[newStatus] || newStatus}
          </DialogTitle>
          <DialogDescription>
            Add a comment and optionally revise the target date. The original
            target date will be preserved.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="rounded-md border bg-muted/40 p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Milestone</span>
              <span className="font-medium">{milestone.name}</span>
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-muted-foreground">Original target</span>
              <span>{format(parseISO(originalDate), "MMM d, yyyy")}</span>
            </div>
            {milestone.revised_target_date && (
              <div className="flex justify-between mt-1">
                <span className="text-muted-foreground">Current revised</span>
                <span>
                  {format(parseISO(milestone.revised_target_date), "MMM d, yyyy")}
                </span>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="comment">Comment</Label>
            <Textarea
              id="comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Why is the status changing? What's the context?"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="revised-date">Revised target date (optional)</Label>
            <Input
              id="revised-date"
              type="date"
              value={revisedDate}
              onChange={(e) => setRevisedDate(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Leave blank to keep the current target. The original target date
              ({format(parseISO(originalDate), "MMM d, yyyy")}) will always be
              preserved for audit.
            </p>
          </div>

          {revisedDate && revisedDate !== milestone.target_date && (
            <div className="space-y-2">
              <Label htmlFor="reason">Reason for date revision</Label>
              <Input
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. dependency slipped, scope expanded"
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? "Saving…" : "Save Change"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
