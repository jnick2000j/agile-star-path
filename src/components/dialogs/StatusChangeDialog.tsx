import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, Clock, RefreshCw, Archive } from "lucide-react";

export type StatusAction = "approved" | "rejected" | "deferred" | "reopened" | "closed" | "on_hold";

interface StatusChangeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityType: "project" | "programme" | "product";
  entityName: string;
  currentStatus: string;
  action: StatusAction;
  onConfirm: (reason: string) => Promise<void>;
}

const actionConfig: Record<StatusAction, { 
  label: string; 
  description: string; 
  newStatus: string;
  icon: React.ReactNode;
  variant: "default" | "destructive" | "outline" | "secondary";
}> = {
  approved: {
    label: "Approve",
    description: "This will mark the item as approved and active.",
    newStatus: "active",
    icon: <CheckCircle className="h-5 w-5 text-green-500" />,
    variant: "default",
  },
  rejected: {
    label: "Reject",
    description: "This will mark the item as rejected. You can provide a reason below.",
    newStatus: "rejected",
    icon: <XCircle className="h-5 w-5 text-red-500" />,
    variant: "destructive",
  },
  deferred: {
    label: "Defer",
    description: "This will defer the item for later review.",
    newStatus: "deferred",
    icon: <Clock className="h-5 w-5 text-yellow-500" />,
    variant: "secondary",
  },
  reopened: {
    label: "Reopen",
    description: "This will reactivate the item and set it back to active status.",
    newStatus: "active",
    icon: <RefreshCw className="h-5 w-5 text-blue-500" />,
    variant: "default",
  },
  closed: {
    label: "Close",
    description: "This will close the item. It can be reopened later if needed.",
    newStatus: "closed",
    icon: <Archive className="h-5 w-5 text-gray-500" />,
    variant: "outline",
  },
  on_hold: {
    label: "Put On Hold",
    description: "This will pause the item temporarily.",
    newStatus: "on-hold",
    icon: <Clock className="h-5 w-5 text-orange-500" />,
    variant: "secondary",
  },
};

export function StatusChangeDialog({
  open,
  onOpenChange,
  entityType,
  entityName,
  currentStatus,
  action,
  onConfirm,
}: StatusChangeDialogProps) {
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  const config = actionConfig[action];

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm(reason);
      setReason("");
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setReason("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {config.icon}
            {config.label} {entityType.charAt(0).toUpperCase() + entityType.slice(1)}
          </DialogTitle>
          <DialogDescription>{config.description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label className="text-muted-foreground">Item</Label>
            <p className="font-medium">{entityName}</p>
          </div>

          <div className="flex items-center gap-2">
            <Label className="text-muted-foreground">Status Change:</Label>
            <Badge variant="outline">{currentStatus}</Badge>
            <span>→</span>
            <Badge variant="secondary">{config.newStatus}</Badge>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">
              Reason / Notes {action !== "approved" && action !== "reopened" && "(recommended)"}
            </Label>
            <Textarea
              id="reason"
              placeholder="Enter reason or notes for this status change..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant={config.variant} onClick={handleConfirm} disabled={loading}>
            {loading ? "Processing..." : config.label}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
