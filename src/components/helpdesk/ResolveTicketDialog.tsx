import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export const RESOLUTION_CODES: { value: string; label: string; description: string }[] = [
  { value: "fixed", label: "Fixed", description: "Issue resolved as expected" },
  { value: "not_fixed", label: "Not Fixed", description: "Closing without resolution" },
  { value: "duplicate", label: "Duplicate", description: "Same as another ticket" },
  { value: "wont_fix", label: "Won't Fix", description: "By design or out of scope" },
  { value: "cannot_reproduce", label: "Cannot Reproduce", description: "Unable to recreate the issue" },
  { value: "known_error", label: "Known Error", description: "Logged as a known issue" },
  { value: "workaround_provided", label: "Workaround Provided", description: "Temporary workaround supplied" },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultCode?: string | null;
  defaultNotes?: string | null;
  submitting?: boolean;
  onConfirm: (payload: { resolution_code: string; resolution: string }) => void | Promise<void>;
}

export function ResolveTicketDialog({
  open, onOpenChange, defaultCode, defaultNotes, submitting, onConfirm,
}: Props) {
  const [code, setCode] = useState<string>(defaultCode || "");
  const [notes, setNotes] = useState<string>(defaultNotes || "");

  useEffect(() => {
    if (open) {
      setCode(defaultCode || "");
      setNotes(defaultNotes || "");
    }
  }, [open, defaultCode, defaultNotes]);

  const canSubmit = !!code && notes.trim().length > 0 && !submitting;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Resolve ticket</DialogTitle>
          <DialogDescription>
            Capture the outcome before marking this ticket as resolved.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Resolution *</Label>
            <Select value={code} onValueChange={setCode}>
              <SelectTrigger><SelectValue placeholder="Select an outcome" /></SelectTrigger>
              <SelectContent>
                {RESOLUTION_CODES.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    <div className="flex flex-col">
                      <span>{r.label}</span>
                      <span className="text-xs text-muted-foreground">{r.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Resolution notes *</Label>
            <Textarea
              rows={5}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Describe what was done, root cause, and any follow-up..."
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button
            disabled={!canSubmit}
            onClick={() => onConfirm({ resolution_code: code, resolution: notes.trim() })}
          >
            {submitting ? "Resolving..." : "Mark as Resolved"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function resolutionCodeLabel(code?: string | null): string | null {
  if (!code) return null;
  return RESOLUTION_CODES.find((r) => r.value === code)?.label ?? code;
}
