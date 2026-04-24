import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/use-toast";
import { UserPlus, X } from "lucide-react";

interface TaskAssignmentsProps {
  taskId: string;
  organizationId?: string | null;
  projectId?: string | null;
  programmeId?: string | null;
  productId?: string | null;
}

export function TaskAssignments({
  taskId,
  organizationId,
  projectId,
  programmeId,
  productId,
}: TaskAssignmentsProps) {
  const { user } = useAuth();
  const { isAdmin, canManage } = usePermissions();
  const canManageProjects = canManage("projects");
  const queryClient = useQueryClient();
  const [selectedUserId, setSelectedUserId] = useState("");

  const { data: assignments = [] } = useQuery({
    queryKey: ["task-assignments", taskId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("task_assignments")
        .select("*")
        .eq("task_id", taskId)
        .order("created_at");
      if (error) throw error;
      const userIds = Array.from(new Set((data || []).map((a: any) => a.user_id)));
      if (userIds.length === 0) return data || [];
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, full_name, email")
        .in("user_id", userIds);
      const map = new Map((profs || []).map((p: any) => [p.user_id, p]));
      return (data || []).map((a: any) => ({ ...a, profiles: map.get(a.user_id) || null }));
    },
  });

  // Fetch users scoped to the task's entity (project/programme/product)
  const { data: entityUsers = [] } = useQuery({
    queryKey: ["entity-users-for-task", projectId, programmeId, productId, organizationId],
    queryFn: async () => {
      const userIds = new Set<string>();

      const collect = async (entityType: string, entityId: string | null | undefined) => {
        if (!entityId) return;
        const { data } = await supabase
          .from("entity_assignments")
          .select("user_id")
          .eq("entity_id", entityId)
          .eq("entity_type", entityType);
        (data || []).forEach((r: any) => userIds.add(r.user_id));
      };

      await collect("project", projectId);
      await collect("programme", programmeId);
      await collect("product", productId);

      // Fallback: if no entity-scoped users, show org users
      if (userIds.size === 0 && organizationId) {
        const { data } = await supabase
          .from("user_organization_access")
          .select("user_id")
          .eq("organization_id", organizationId);
        (data || []).forEach((r: any) => userIds.add(r.user_id));
      }

      const ids = Array.from(userIds);
      if (ids.length === 0) return [];
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, full_name, email")
        .in("user_id", ids)
        .eq("archived", false);
      return (profs || []).map((p: any) => ({
        user_id: p.user_id,
        full_name: p.full_name,
        email: p.email,
      }));
    },
    enabled: !!(projectId || programmeId || productId || organizationId),
  });

  const assignedUserIds = useMemo(() => new Set(assignments.map((a: any) => a.user_id)), [assignments]);
  const availableUsers = entityUsers.filter((u) => !assignedUserIds.has(u.user_id));

  const taskDetails = useQuery({
    queryKey: ["task-details-for-notify", taskId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("id, name, project_id, programme_id, product_id")
        .eq("id", taskId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!taskId,
  });

  const addAssignment = useMutation({
    mutationFn: async () => {
      if (!selectedUserId) return;
      const { error } = await supabase.from("task_assignments").insert({
        task_id: taskId,
        user_id: selectedUserId,
        role: "assignee",
        organization_id: organizationId,
        assigned_by: user?.id,
      });
      if (error) throw error;

      const taskData = taskDetails.data;
      await supabase.functions.invoke("notification-dispatcher", {
        body: {
          event_type: "task_assignment",
          recipient_user_id: selectedUserId,
          actor_user_id: user?.id,
          organization_id: organizationId ?? null,
          task_id: taskId,
          task_name: taskData?.name ?? null,
          entity_type: "task",
          entity_id: taskId,
          project_id: taskData?.project_id ?? projectId ?? null,
          programme_id: taskData?.programme_id ?? programmeId ?? null,
          product_id: taskData?.product_id ?? productId ?? null,
          link: `/tasks`,
        },
      }).catch((notifyError) => {
        console.error("task assignment notification failed", notifyError);
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-assignments", taskId] });
      queryClient.invalidateQueries({ queryKey: ["notifications-unread"] });
      setSelectedUserId("");
      toast({ title: "User assigned to task" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const removeAssignment = useMutation({
    mutationFn: async (assignmentId: string) => {
      const { error } = await supabase.from("task_assignments").delete().eq("id", assignmentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-assignments", taskId] });
      toast({ title: "User removed from task" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const getInitials = (name: string | null, email: string) => {
    if (name) return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
    return email[0]?.toUpperCase() || "?";
  };

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">Assigned Team Members</label>
      <div className="flex flex-wrap gap-1.5">
        {assignments.map((a: any) => (
          <div key={a.id} className="flex items-center gap-1.5 rounded-full border bg-muted/50 pl-1 pr-2 py-0.5">
            <Avatar className="h-5 w-5">
              <AvatarFallback className="text-[10px]">
                {getInitials(a.profiles?.full_name, a.profiles?.email || "")}
              </AvatarFallback>
            </Avatar>
            <span className="text-xs">{a.profiles?.full_name || a.profiles?.email}</span>
            {(isAdmin || canManageProjects || user?.id === a.assigned_by) && (
              <button
                onClick={() => removeAssignment.mutate(a.id)}
                className="text-muted-foreground hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        ))}
        {assignments.length === 0 && (
          <span className="text-xs text-muted-foreground">No members assigned</span>
        )}
      </div>
      <div className="flex gap-1.5">
        <Select value={selectedUserId} onValueChange={setSelectedUserId}>
          <SelectTrigger className="h-8 text-xs flex-1">
            <SelectValue placeholder="Assign team member..." />
          </SelectTrigger>
          <SelectContent>
            {availableUsers.length === 0 ? (
              <div className="px-2 py-1.5 text-xs text-muted-foreground">
                No available members. Assign users to the project/programme/product first.
              </div>
            ) : (
              availableUsers.map((u) => (
                <SelectItem key={u.user_id} value={u.user_id}>
                  {u.full_name || u.email}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
        <Button
          size="icon"
          variant="outline"
          className="h-8 w-8"
          onClick={() => addAssignment.mutate()}
          disabled={!selectedUserId || addAssignment.isPending}
        >
          <UserPlus className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
