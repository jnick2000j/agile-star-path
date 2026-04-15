import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { StatusAction } from "@/components/dialogs/StatusChangeDialog";

const actionToStatus: Record<StatusAction, string> = {
  approved: "active",
  rejected: "rejected",
  deferred: "deferred",
  reopened: "active",
  closed: "closed",
  on_hold: "on-hold",
};

export function useStatusChange() {
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  const changeStatus = async (
    entityType: "project" | "program" | "product" | "work_package",
    entityId: string,
    currentStatus: string,
    action: StatusAction,
    reason: string
  ): Promise<boolean> => {
    if (!user) {
      toast.error("You must be logged in to perform this action");
      return false;
    }

    setLoading(true);
    const newStatus = actionToStatus[action];

    try {
      // Update the entity status based on entity type
      let updateError: Error | null = null;
      
      if (entityType === "program") {
        const { error } = await supabase
          .from("programmes")
          .update({ 
            status: newStatus,
            updated_at: new Date().toISOString()
          })
          .eq("id", entityId);
        updateError = error;
      } else if (entityType === "project") {
        // Projects don't have a status column directly - they use stage/health
        // We'll update a status-like field or just record in history
        const { error } = await supabase
          .from("projects")
          .update({ 
            stage: newStatus === "active" ? "execution" : newStatus === "closed" ? "closure" : "initiation",
            updated_at: new Date().toISOString()
          })
          .eq("id", entityId);
        updateError = error;
      } else if (entityType === "work_package") {
        // Map status to work package status enum
        const wpStatus = newStatus === "active" ? "authorized" : 
                         newStatus === "closed" ? "closed" : 
                         newStatus === "on-hold" ? "pending" : "pending";
        const { error } = await supabase
          .from("work_packages")
          .update({ 
            status: wpStatus,
            updated_at: new Date().toISOString()
          })
          .eq("id", entityId);
        updateError = error;
      } else {
        const { error } = await supabase
          .from("products")
          .update({ 
            status: newStatus,
            updated_at: new Date().toISOString()
          })
          .eq("id", entityId);
        updateError = error;
      }

      if (updateError) throw updateError;

      if (updateError) throw updateError;

      // Record in status history
      const { error: historyError } = await supabase
        .from("status_history")
        .insert({
          entity_type: entityType,
          entity_id: entityId,
          old_status: currentStatus,
          new_status: newStatus,
          action: action,
          reason: reason || null,
          changed_by: user.id,
        });

      if (historyError) throw historyError;

      toast.success(`${entityType.charAt(0).toUpperCase() + entityType.slice(1)} ${action} successfully`);
      return true;
    } catch (error) {
      console.error("Error changing status:", error);
      toast.error(`Failed to ${action} ${entityType}`);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const recordInitialStatus = async (
    entityType: "project" | "program" | "product" | "work_package",
    entityId: string,
    status: string
  ) => {
    if (!user) return;

    try {
      await supabase.from("status_history").insert({
        entity_type: entityType === "work_package" ? "project" : entityType,
        entity_id: entityId,
        old_status: null,
        new_status: status,
        action: "created",
        changed_by: user.id,
      });
    } catch (error) {
      console.error("Error recording initial status:", error);
    }
  };

  return { changeStatus, recordInitialStatus, loading };
}
