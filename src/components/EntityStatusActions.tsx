import { useState, forwardRef } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CheckCircle, XCircle, Clock, RefreshCw, Archive, History, MoreHorizontal } from "lucide-react";
import { StatusChangeDialog, StatusAction } from "@/components/dialogs/StatusChangeDialog";
import { StatusHistoryDialog } from "@/components/dialogs/StatusHistoryDialog";
import { useStatusChange } from "@/hooks/useStatusChange";

interface EntityStatusActionsProps {
  entityType: "project" | "program" | "product" | "work_package";
  entityId: string;
  entityName: string;
  currentStatus: string;
  onStatusChange?: () => void;
  compact?: boolean;
}

export const EntityStatusActions = forwardRef<HTMLDivElement, EntityStatusActionsProps>(
  function EntityStatusActions({
    entityType,
    entityId,
    entityName,
    currentStatus,
    onStatusChange,
    compact = false,
  }, ref) {
  const [action, setAction] = useState<StatusAction | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const { changeStatus } = useStatusChange();

  const normalizedStatus = currentStatus?.toLowerCase().replace(/[^a-z]/g, "") || "";
  
  const isActive = normalizedStatus === "active";
  const isClosed = normalizedStatus === "closed" || normalizedStatus === "completed";
  const isRejected = normalizedStatus === "rejected";
  const isDeferred = normalizedStatus === "deferred";
  const isOnHold = normalizedStatus === "onhold";
  const isPending = normalizedStatus === "pending" || normalizedStatus === "draft";

  const handleConfirm = async (reason: string) => {
    if (!action) return;
    const success = await changeStatus(entityType, entityId, currentStatus, action, reason);
    if (success) {
      onStatusChange?.();
    }
  };

  const openDialog = (newAction: StatusAction) => {
    setAction(newAction);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          {compact ? (
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          ) : (
            <Button variant="outline" size="sm" className="gap-2">
              <MoreHorizontal className="h-4 w-4" />
              Actions
            </Button>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {/* Approval actions for pending/draft items */}
          {isPending && (
            <>
              <DropdownMenuItem onClick={() => openDialog("approved")} className="gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                Approve
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => openDialog("rejected")} className="gap-2 text-destructive">
                <XCircle className="h-4 w-4" />
                Reject
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => openDialog("deferred")} className="gap-2">
                <Clock className="h-4 w-4 text-yellow-500" />
                Defer
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}

          {/* Actions for active items */}
          {isActive && (
            <>
              <DropdownMenuItem onClick={() => openDialog("on_hold")} className="gap-2">
                <Clock className="h-4 w-4 text-orange-500" />
                Put On Hold
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => openDialog("closed")} className="gap-2">
                <Archive className="h-4 w-4 text-gray-500" />
                Close
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}

          {/* Actions for on-hold items */}
          {isOnHold && (
            <>
              <DropdownMenuItem onClick={() => openDialog("approved")} className="gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                Resume (Activate)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => openDialog("closed")} className="gap-2">
                <Archive className="h-4 w-4 text-gray-500" />
                Close
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}

          {/* Actions for deferred items */}
          {isDeferred && (
            <>
              <DropdownMenuItem onClick={() => openDialog("approved")} className="gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                Approve
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => openDialog("rejected")} className="gap-2 text-destructive">
                <XCircle className="h-4 w-4" />
                Reject
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}

          {/* Reopen action for closed/rejected items */}
          {(isClosed || isRejected) && (
            <>
              <DropdownMenuItem onClick={() => openDialog("reopened")} className="gap-2">
                <RefreshCw className="h-4 w-4 text-blue-500" />
                Reopen
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}

          {/* View history - always available */}
          <DropdownMenuItem onClick={() => setShowHistory(true)} className="gap-2">
            <History className="h-4 w-4" />
            View History
          </DropdownMenuItem>
        </DropdownMenuContent>
        </DropdownMenu>

        {/* Status Change Dialog */}
        {action && (
          <StatusChangeDialog
            open={!!action}
            onOpenChange={(open) => !open && setAction(null)}
            entityType={entityType === "work_package" ? "project" : entityType}
            entityName={entityName}
            currentStatus={currentStatus}
            action={action}
            onConfirm={handleConfirm}
          />
        )}

        {/* Status History Dialog */}
        <StatusHistoryDialog
          open={showHistory}
          onOpenChange={setShowHistory}
          entityType={entityType === "work_package" ? "project" : entityType}
          entityId={entityId}
          entityName={entityName}
        />
      </>
    );
  }
);
