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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/use-toast";
import { UserPlus, X, Users } from "lucide-react";

interface EntityAssignmentsProps {
  entityType: "programme" | "project" | "product";
  entityId: string;
  organizationId?: string | null;
}

export function EntityAssignments({
  entityType,
  entityId,
  organizationId,
}: EntityAssignmentsProps) {
  const { user } = useAuth();
  const { isAdmin, canManage } = usePermissions();
  const canManageEntity = canManage(entityType === "programme" ? "programmes" : entityType === "project" ? "projects" : "products");
  const queryClient = useQueryClient();
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedRole, setSelectedRole] = useState("contributor");

  const { data: assignments = [] } = useQuery({
    queryKey: ["entity-assignments", entityType, entityId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("entity_assignments")
        .select("*")
        .eq("entity_type", entityType)
        .eq("entity_id", entityId)
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

  const { data: orgUsers = [] } = useQuery({
    queryKey: ["org-users-for-assign", organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      const { data: access, error } = await supabase
        .from("user_organization_access")
        .select("user_id")
        .eq("organization_id", organizationId);
      if (error) throw error;
      const userIds = (access || []).map((a: any) => a.user_id);
      if (userIds.length === 0) return [];
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, full_name, email")
        .in("user_id", userIds)
        .eq("archived", false);
      return (profs || []).map((p: any) => ({ user_id: p.user_id, profiles: p }));
    },
    enabled: !!organizationId,
  });

  const assignedUserIds = new Set(assignments.map((a: any) => a.user_id));
  const availableUsers = orgUsers.filter((u: any) => !assignedUserIds.has(u.user_id));

  const addAssignment = useMutation({
    mutationFn: async () => {
      if (!selectedUserId) return;
      const { error } = await supabase.from("entity_assignments").insert({
        entity_type: entityType,
        entity_id: entityId,
        user_id: selectedUserId,
        role: selectedRole,
        organization_id: organizationId,
        assigned_by: user?.id,
      });
      if (error) throw error;
      await supabase.functions.invoke("notification-dispatcher", {
        body: {
          event_type: "entity_assignment",
          recipient_user_id: selectedUserId,
          actor_user_id: user?.id,
          organization_id: organizationId ?? null,
          entity_type: entityType,
          entity_id: entityId,
          assignment_role: selectedRole,
          link: `/${entityType === "programme" ? "programmes" : entityType === "project" ? "projects" : "products"}/details?id=${entityId}`,
        },
      }).catch((notifyError) => {
        console.error("entity assignment notification failed", notifyError);
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["entity-assignments", entityType, entityId] });
      queryClient.invalidateQueries({ queryKey: ["notifications-unread"] });
      setSelectedUserId("");
      toast({ title: "User assigned" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const removeAssignment = useMutation({
    mutationFn: async (assignmentId: string) => {
      const { error } = await supabase
        .from("entity_assignments")
        .delete()
        .eq("id", assignmentId);
      if (error) throw error;
      await supabase.functions.invoke("notification-dispatcher", {
        body: {
          event_type: "entity_assignment",
          recipient_user_id: selectedUserId,
          actor_user_id: user?.id,
          organization_id: organizationId ?? null,
          entity_type: entityType,
          entity_id: entityId,
          assignment_role: selectedRole,
          link: `/${entityType === "programme" ? "programmes" : entityType === "project" ? "projects" : "products"}/details?id=${entityId}`,
        },
      }).catch((notifyError) => {
        console.error("entity assignment notification failed", notifyError);
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["entity-assignments", entityType, entityId] });
      toast({ title: "User removed" });
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
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="h-4 w-4" />
          Assigned Users ({assignments.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {assignments.map((a: any) => (
            <div
              key={a.id}
              className="flex items-center gap-2 rounded-full border bg-muted/50 pl-1 pr-2 py-1"
            >
              <Avatar className="h-6 w-6">
                <AvatarFallback className="text-xs">
                  {getInitials(a.profiles?.full_name, a.profiles?.email || "")}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm">{a.profiles?.full_name || a.profiles?.email}</span>
              <Badge variant="outline" className="text-xs">{a.role}</Badge>
              {(isAdmin || canManageEntity || user?.id === a.assigned_by) && (
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
            <p className="text-sm text-muted-foreground">No users assigned yet.</p>
          )}
        </div>

        {(isAdmin || canManageEntity) && (
          <div className="flex gap-2">
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Select user" />
              </SelectTrigger>
              <SelectContent>
                {availableUsers.map((u: any) => (
                  <SelectItem key={u.user_id} value={u.user_id}>
                    {u.profiles?.full_name || u.profiles?.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedRole} onValueChange={setSelectedRole}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="lead">Lead</SelectItem>
                <SelectItem value="contributor">Contributor</SelectItem>
                <SelectItem value="reviewer">Reviewer</SelectItem>
              </SelectContent>
            </Select>
            <Button
              size="icon"
              onClick={() => addAssignment.mutate()}
              disabled={!selectedUserId || addAssignment.isPending}
            >
              <UserPlus className="h-4 w-4" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
