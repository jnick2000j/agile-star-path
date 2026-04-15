import { useState, useEffect } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

interface Profile {
  id: string;
  user_id: string;
  email: string;
  full_name: string | null;
}

interface AssignRoleDialogProps {
  onSuccess: () => void;
}

export function AssignRoleDialog({ onSuccess }: AssignRoleDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<Profile[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [selectedRole, setSelectedRole] = useState<AppRole>("stakeholder");

  useEffect(() => {
    if (open) {
      fetchUsers();
    }
  }, [open]);

  const fetchUsers = async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, user_id, email, full_name")
      .eq("archived", false)
      .order("full_name");

    if (error) {
      console.error("Error fetching users:", error);
      return;
    }

    setUsers(data || []);
  };

  const handleSubmit = async () => {
    if (!selectedUserId || !selectedRole) {
      toast.error("Please select a user and role");
      return;
    }

    setLoading(true);
    try {
      // Check if user already has a role
      const { data: existingRole } = await supabase
        .from("user_roles")
        .select("*")
        .eq("user_id", selectedUserId)
        .single();

      if (existingRole) {
        // Update existing role
        const { error } = await supabase
          .from("user_roles")
          .update({ role: selectedRole })
          .eq("user_id", selectedUserId);

        if (error) throw error;
      } else {
        // Insert new role
        const { error } = await supabase
          .from("user_roles")
          .insert({ user_id: selectedUserId, role: selectedRole });

        if (error) throw error;
      }

      // Also update profile role
      await supabase
        .from("profiles")
        .update({ role: selectedRole })
        .eq("user_id", selectedUserId);

      toast.success("Role assigned successfully");
      setOpen(false);
      setSelectedUserId("");
      setSelectedRole("stakeholder");
      onSuccess();
    } catch (error) {
      console.error("Error assigning role:", error);
      toast.error("Failed to assign role. You may not have admin permissions.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Assign Role
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Assign Role</DialogTitle>
          <DialogDescription>
            Assign or update a user's system role. This determines their global permissions.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label>User</Label>
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a user" />
              </SelectTrigger>
              <SelectContent>
                {users.map((user) => (
                  <SelectItem key={user.user_id} value={user.user_id}>
                    {user.full_name || user.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Role</Label>
            <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as AppRole)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="programme_owner">Program Owner</SelectItem>
                <SelectItem value="project_manager">Project Manager</SelectItem>
                <SelectItem value="product_manager">Product Manager</SelectItem>
                <SelectItem value="product_team_member">Product Team Member</SelectItem>
                <SelectItem value="project_team_member">Project Team Member</SelectItem>
                <SelectItem value="org_stakeholder">Org Stakeholder</SelectItem>
                <SelectItem value="programme_stakeholder">Program Stakeholder</SelectItem>
                <SelectItem value="project_stakeholder">Project Stakeholder</SelectItem>
                <SelectItem value="product_stakeholder">Product Stakeholder</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {selectedRole === "admin" && "Full system access including user management"}
              {selectedRole === "programme_owner" && "Can manage programmes and their projects"}
              {selectedRole === "project_manager" && "Can manage assigned projects"}
              {selectedRole === "product_manager" && "Manages products, features, roadmaps and related registers"}
              {selectedRole === "product_team_member" && "Works on products and assigned tasks only"}
              {selectedRole === "project_team_member" && "Works on projects and assigned tasks only"}
              {selectedRole === "org_stakeholder" && "View-only access to everything in the organization"}
              {selectedRole === "programme_stakeholder" && "View-only access to assigned programmes"}
              {selectedRole === "project_stakeholder" && "View-only access to assigned projects"}
              {selectedRole === "product_stakeholder" && "View-only access to assigned products"}
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? "Assigning..." : "Assign Role"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
