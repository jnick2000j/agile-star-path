import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organization: { id: string; name: string; is_suspended?: boolean | null };
  onSuccess?: () => void;
}

const KIND_OPTIONS = [
  { value: "non_payment", label: "Non-payment" },
  { value: "admin_action", label: "Administrative action" },
  { value: "license_expired", label: "License expired" },
  { value: "security", label: "Security incident" },
  { value: "other", label: "Other" },
];

export function OrgSuspensionDialog({ open, onOpenChange, organization, onSuccess }: Props) {
  const [kind, setKind] = useState("non_payment");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isSuspending = !organization.is_suspended;

  const handleSubmit = async () => {
    setSubmitting(true);
    const { error } = await supabase.rpc("set_organization_suspension", {
      _org_id: organization.id,
      _suspend: isSuspending,
      _kind: isSuspending ? kind : null,
      _reason: isSuspending ? (reason || null) : null,
    });
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success(isSuspending ? "Organization suspended" : "Organization reinstated");
    setReason("");
    onSuccess?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isSuspending && <AlertTriangle className="h-4 w-4 text-warning" />}
            {isSuspending ? "Suspend organization" : "Reinstate organization"}
          </DialogTitle>
          <DialogDescription>
            {isSuspending ? (
              <>
                Suspending <strong>{organization.name}</strong> immediately blocks user access for everyone in the
                organization. Existing data is preserved. Use this for non-payment, security incidents, or
                administrative holds.
              </>
            ) : (
              <>
                Reinstate <strong>{organization.name}</strong>? Users will be able to sign in immediately.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {isSuspending && (
          <div className="space-y-3">
            <div>
              <Label>Reason category</Label>
              <Select value={kind} onValueChange={setKind}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {KIND_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Notes (visible to other platform admins)</Label>
              <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Invoice INV-2024-001 unpaid 60+ days" />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
          <Button
            variant={isSuspending ? "destructive" : "default"}
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isSuspending ? "Suspend organization" : "Reinstate organization"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
