import { useState, forwardRef } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CheckCircle, XCircle, Clock, RefreshCw, Archive, History, MoreHorizontal, Trash2 } from "lucide-react";
import { StatusChangeDialog, StatusAction } from "@/components/dialogs/StatusChangeDialog";
import { StatusHistoryDialog } from "@/components/dialogs/StatusHistoryDialog";
import { useStatusChange } from "@/hooks/useStatusChange";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface EntityStatusActionsProps {
  entityType: "project" | "program" | "product" | "work_package";
  entityId: string;
  entityName: string;
  currentStatus: string;
  onStatusChange?: () => void;
  compact?: boolean;
}

const tableByEntity: Record<EntityStatusActionsProps["entityType"], string> = {
  project: "projects",
  program: "programmes",
  product: "products",
  work_package: "work_packages",
};

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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { changeStatus } = useStatusChange();

  const normalizedStatus = currentStatus?.toLowerCase().replace(/[^a-z]/g, "") || "";

  const isClosed =
    normalizedStatus === "closed" ||
    normalizedStatus === "completed" ||
    normalizedStatus === "retired" ||
    normalizedStatus === "deprecated";
  const isRejected = normalizedStatus === "rejected";
  const isDeferred = normalizedStatus === "deferred";
  const isOnHold = normalizedStatus === "onhold";
  const isPending = normalizedStatus === "pending" || normalizedStatus === "draft";
  // Treat any non-terminal/non-on-hold status as "active-like" so Close / On Hold
  // are always available for live work (e.g. project stage = "executing", product
  // status = "in_development", etc.).
  const isActive = !isClosed && !isOnHold && !isRejected && !isDeferred && !isPending;

  const handleConfirm = async (reason: string) => {
    if (!action) return;
    const success = await changeStatus(entityType, entityId, currentStatus, action, reason);
    if (success) {
      onStatusChange?.();
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const table = tableByEntity[entityType];
      const { error } = await supabase.from(table as any).delete().eq("id", entityId);
      if (error) throw error;
      toast.success(`${entityName} deleted`);
      setShowDeleteConfirm(false);
      onStatusChange?.();
    } catch (err: any) {
      console.error("Delete error:", err);
      toast.error(err?.message || "Failed to delete");
    } finally {
      setDeleting(false);
    }
  };

  const openDialog = (newAction: StatusAction) => {
    setAction(newAction);
  };

  const entityLabel =
    entityType === "work_package" ? "work package" : entityType === "program" ? "programme" : entityType;

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

          <DropdownMenuSeparator />

          {/* Delete - always available */}
          <DropdownMenuItem
            onClick={() => setShowDeleteConfirm(true)}
            className="gap-2 text-destructive focus:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
            Delete
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

        {/* Delete confirmation */}
        <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this {entityLabel}?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete <strong>{entityName}</strong>. This action cannot be
                undone. Any related records that depend on it may also be removed or orphaned.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  handleDelete();
                }}
                disabled={deleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleting ? "Deleting…" : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    );
  }
);
