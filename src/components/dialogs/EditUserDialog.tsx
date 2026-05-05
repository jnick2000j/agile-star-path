import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { UserCog, Building2, X, Plus, Trash2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { Badge } from "@/components/ui/badge";
import { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

interface UserProfile {
  id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  phone_number: string | null;
  address: string | null;
  mailing_address: string | null;
  location: string | null;
  department: string | null;
  archived: boolean;
}

interface Organization {
  id: string;
  name: string;
}

interface UserOrgAccess {
  id: string;
  organization_id: string;
  access_level: string;
  organization_name?: string;
}

interface EditUserDialogProps {
  user: UserProfile;
  onSuccess: () => void;
  trigger?: React.ReactNode;
}

export function EditUserDialog({ user, onSuccess, trigger }: EditUserDialogProps) {
  const { userRole } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [userOrgAccess, setUserOrgAccess] = useState<UserOrgAccess[]>([]);
  const [selectedOrgToAdd, setSelectedOrgToAdd] = useState<string>("");
  const [selectedAccessLevel, setSelectedAccessLevel] = useState<string>("viewer");
  const [newEmail, setNewEmail] = useState(user.email);
  const [changingEmail, setChangingEmail] = useState(false);

  const isAdmin = userRole === "admin";

  const [formData, setFormData] = useState({
    full_name: user.full_name || "",
    phone_number: user.phone_number || "",
    address: user.address || "",
    mailing_address: user.mailing_address || "",
    location: user.location || "",
    department: user.department || "",
    archived: user.archived || false,
  });

  useEffect(() => {
    if (open) {
      fetchOrganizations();
      fetchUserOrgAccess();
    }
  }, [open, user.user_id]);

  const fetchOrganizations = async () => {
    const { data } = await supabase
      .from("organizations")
      .select("id, name")
      .order("name");
    if (data) setOrganizations(data);
  };

  const fetchUserOrgAccess = async () => {
    const { data } = await supabase
      .from("user_organization_access")
      .select("id, organization_id, access_level")
      .eq("user_id", user.user_id);
    
    if (data) {
      // Fetch organization names
      const orgIds = data.map(a => a.organization_id);
      const { data: orgs } = await supabase
        .from("organizations")
        .select("id, name")
        .in("id", orgIds);
      
      const accessWithNames = data.map(a => ({
        ...a,
        organization_name: orgs?.find(o => o.id === a.organization_id)?.name || "Unknown"
      }));
      setUserOrgAccess(accessWithNames);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // If archive status changed, use edge function to ban/unban user
      if (formData.archived !== user.archived) {
        const { data: sessionData } = await supabase.auth.getSession();
        const response = await supabase.functions.invoke("manage-user", {
          body: { 
            action: formData.archived ? "archive" : "unarchive",
            user_id: user.user_id 
          },
        });

        if (response.error) {
          throw new Error(response.error.message || "Failed to update user status");
        }
      } else {
        // Just update profile normally
        const { error } = await supabase
          .from("profiles")
          .update({
            full_name: formData.full_name,
            phone_number: formData.phone_number || null,
            address: formData.address || null,
            mailing_address: formData.mailing_address || null,
            location: formData.location || null,
            department: formData.department || null,
          })
          .eq("id", user.id);

        if (error) throw error;
      }

      toast.success("User updated successfully");
      setOpen(false);
      onSuccess();
    } catch (error: unknown) {
      console.error("Error updating user:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to update user";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    setDeleting(true);
    try {
      const response = await supabase.functions.invoke("manage-user", {
        body: { 
          action: "delete",
          user_id: user.user_id 
        },
      });

      if (response.error) {
        throw new Error(response.error.message || "Failed to delete user");
      }

      toast.success("User permanently deleted");
      setOpen(false);
      onSuccess();
    } catch (error: unknown) {
      console.error("Error deleting user:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to delete user";
      toast.error(errorMessage);
    } finally {
      setDeleting(false);
    }
  };

  const handleAddOrgAccess = async () => {
    if (!selectedOrgToAdd) return;

    try {
      const { error } = await supabase
        .from("user_organization_access")
        .insert({
          user_id: user.user_id,
          organization_id: selectedOrgToAdd,
          access_level: selectedAccessLevel,
        });

      if (error) throw error;

      toast.success("Organization access added");
      fetchUserOrgAccess();
      setSelectedOrgToAdd("");
    } catch (error: any) {
      console.error("Error adding org access:", error);
      toast.error(error.message || "Failed to add organization access");
    }
  };

  const handleRemoveOrgAccess = async (accessId: string) => {
    try {
      const { error } = await supabase
        .from("user_organization_access")
        .delete()
        .eq("id", accessId);

      if (error) throw error;

      toast.success("Organization access removed");
      fetchUserOrgAccess();
    } catch (error: any) {
      console.error("Error removing org access:", error);
      toast.error(error.message || "Failed to remove organization access");
    }
  };

  const handleUpdateAccessLevel = async (accessId: string, newLevel: string) => {
    try {
      const { error } = await supabase
        .from("user_organization_access")
        .update({ access_level: newLevel })
        .eq("id", accessId);

      if (error) throw error;

      toast.success("Access level updated");
      fetchUserOrgAccess();
    } catch (error: any) {
      console.error("Error updating access level:", error);
      toast.error(error.message || "Failed to update access level");
    }
  };

  const availableOrgs = organizations.filter(
    org => !userOrgAccess.some(a => a.organization_id === org.id)
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="sm" className="gap-2">
            <UserCog className="h-4 w-4" />
            Edit
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit User</DialogTitle>
          <DialogDescription>
            Update user information and organization access for {user.email}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Info */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="full_name">Full Name</Label>
              <Input
                id="full_name"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone_number">Phone Number</Label>
              <Input
                id="phone_number"
                value={formData.phone_number}
                onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="department">Department</Label>
              <Input
                id="department"
                value={formData.department}
                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Address</Label>
            <Textarea
              id="address"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="mailing_address">Mailing Address</Label>
            <Textarea
              id="mailing_address"
              value={formData.mailing_address}
              onChange={(e) => setFormData({ ...formData, mailing_address: e.target.value })}
              rows={2}
            />
          </div>

          {/* Access is managed via role assignments — see the "Edit access" button on the user row */}
          <div className="rounded-lg border border-dashed border-border p-4 bg-muted/30">
            <div className="flex items-center gap-2 mb-1">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <Label className="text-sm font-medium">Access &amp; Roles</Label>
            </div>
            <p className="text-xs text-muted-foreground">
              Organization, programme, project and product access is now governed entirely by
              the role catalog. Close this dialog and click <span className="font-medium">Edit access</span>
              on the user's row to assign or remove roles.
            </p>
          </div>

          {/* Archive Toggle */}
          <div className="flex items-center justify-between rounded-lg border border-border p-4">
            <div className="space-y-0.5">
              <Label className="text-base">Archive User</Label>
              <p className="text-sm text-muted-foreground">
                Archived users cannot log in but their data is preserved.
              </p>
            </div>
            <Switch
              checked={formData.archived}
              onCheckedChange={(checked) => setFormData({ ...formData, archived: checked })}
            />
          </div>

          {/* Delete User - Admin Only */}
          {isAdmin && (
            <div className="flex items-center justify-between rounded-lg border border-destructive/50 bg-destructive/5 p-4">
              <div className="space-y-0.5">
                <Label className="text-base text-destructive">Delete User Permanently</Label>
                <p className="text-sm text-muted-foreground">
                  This action cannot be undone. All user data will be permanently removed.
                </p>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm" className="gap-2">
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete the user <strong>{user.email}</strong> and all their data. 
                      This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDeleteUser}
                      disabled={deleting}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {deleting ? "Deleting..." : "Delete Permanently"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}