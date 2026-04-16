import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
}

export function TaskAssignments({ taskId, organizationId }: TaskAssignmentsProps) {
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
        .select("*, profiles:user_id(full_name, email)")
        .eq("task_id", taskId)
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });

  const { data: orgUsers = [] } = useQuery({
    queryKey: ["org-users-for-task-assign", organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      const { data, error } = await supabase
        .from("user_organization_access")
        .select("user_id, profiles:user_id(full_name, email)")
        .eq("organization_id", organizationId);
      if (error) throw error;
      return data;
    },
    enabled: !!organizationId,
  });

  const assignedUserIds = new Set(assignments.map((a: any) => a.user_id));
  const availableUsers = orgUsers.filter((u: any) => !assignedUserIds.has(u.user_id));

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
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-assignments", taskId] });
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
    return email[0].toUpperCase();
  };

  return (
    <div className="space-y-2">
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
      </div>
      <div className="flex gap-1.5">
        <Select value={selectedUserId} onValueChange={setSelectedUserId}>
          <SelectTrigger className="h-8 text-xs flex-1">
            <SelectValue placeholder="Assign user..." />
          </SelectTrigger>
          <SelectContent>
            {availableUsers.map((u: any) => (
              <SelectItem key={u.user_id} value={u.user_id}>
                {u.profiles?.full_name || u.profiles?.email}
              </SelectItem>
            ))}
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
