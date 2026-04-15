import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Shield, Lock } from "lucide-react";

interface CustomRole {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  icon: string | null;
  is_system: boolean;
  can_manage_programmes: boolean;
  can_manage_projects: boolean;
  can_manage_products: boolean;
  can_manage_users: boolean;
  can_view_reports: boolean;
  can_manage_risks: boolean;
  can_manage_issues: boolean;
  can_manage_benefits: boolean;
  can_manage_stakeholders: boolean;
  can_manage_requirements: boolean;
  can_manage_milestones: boolean;
  can_manage_stage_gates: boolean;
  can_manage_change_requests: boolean;
  can_manage_exceptions: boolean;
  can_manage_quality: boolean;
  can_manage_work_packages: boolean;
  can_manage_tranches: boolean;
  can_manage_lessons: boolean;
}

interface PermissionGroup {
  label: string;
  permissions: {
    key: keyof CustomRole;
    label: string;
    description: string;
  }[];
}

const permissionGroups: PermissionGroup[] = [
  {
    label: "Core Management",
    permissions: [
      { key: "can_manage_programmes", label: "Manage Programs", description: "Create, edit, and delete programs" },
      { key: "can_manage_projects", label: "Manage Projects", description: "Create, edit, and delete projects" },
      { key: "can_manage_products", label: "Manage Products", description: "Create, edit, and delete products" },
      { key: "can_manage_users", label: "Manage Users", description: "Create users and assign roles" },
    ],
  },
  {
    label: "PRINCE2 Controls",
    permissions: [
      { key: "can_manage_milestones", label: "Manage Milestones", description: "Create and track milestones" },
      { key: "can_manage_stage_gates", label: "Manage Stage Gates", description: "Define and review stage gates" },
      { key: "can_manage_change_requests", label: "Manage Change Requests", description: "Raise and process change requests" },
      { key: "can_manage_exceptions", label: "Manage Exceptions", description: "Raise and handle exceptions" },
      { key: "can_manage_quality", label: "Manage Quality", description: "Quality reviews and approvals" },
      { key: "can_manage_work_packages", label: "Manage Work Packages", description: "Create and assign work packages" },
      { key: "can_manage_tranches", label: "Manage Tranches", description: "Define programme tranches" },
    ],
  },
  {
    label: "Registers",
    permissions: [
      { key: "can_manage_risks", label: "Manage Risks", description: "Create and manage risk entries" },
      { key: "can_manage_issues", label: "Manage Issues", description: "Create and manage issue entries" },
      { key: "can_manage_benefits", label: "Manage Benefits", description: "Track and manage benefits" },
      { key: "can_manage_stakeholders", label: "Manage Stakeholders", description: "Manage stakeholder registry" },
      { key: "can_manage_requirements", label: "Manage Requirements", description: "Business and technical requirements" },
      { key: "can_manage_lessons", label: "Manage Lessons Learned", description: "Capture and share lessons" },
    ],
  },
  {
    label: "Reporting",
    permissions: [
      { key: "can_view_reports", label: "View Reports", description: "Access reports and analytics" },
    ],
  },
];

interface CreateRoleDialogProps {
  role?: CustomRole;
  onSuccess: () => void;
}

export function CreateRoleDialog({ role, onSuccess }: CreateRoleDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#6b7280");
  const [permissions, setPermissions] = useState<Record<string, boolean>>({});
  const queryClient = useQueryClient();

  const isAdminRole = role?.name === "Administrator";

  useEffect(() => {
    if (role) {
      setName(role.name);
      setDescription(role.description || "");
      setColor(role.color || "#6b7280");
      const perms: Record<string, boolean> = {};
      permissionGroups.forEach(group => {
        group.permissions.forEach(perm => {
          perms[perm.key] = (role as any)[perm.key] || false;
        });
      });
      setPermissions(perms);
    } else {
      setName("");
      setDescription("");
      setColor("#6b7280");
      setPermissions({
        can_view_reports: true,
      });
    }
  }, [role, open]);

  const mutation = useMutation({
    mutationFn: async () => {
      const roleData = {
        name,
        description,
        color,
        ...permissions,
      };

      if (role) {
        const { error } = await supabase
          .from("custom_roles")
          .update(roleData)
          .eq("id", role.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("custom_roles")
          .insert(roleData);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custom-roles"] });
      toast.success(role ? "Role updated" : "Role created");
      setOpen(false);
      onSuccess();
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const togglePermission = (key: string) => {
    setPermissions(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const selectAllInGroup = (group: PermissionGroup, value: boolean) => {
    const newPerms = { ...permissions };
    group.permissions.forEach(perm => {
      newPerms[perm.key] = value;
    });
    setPermissions(newPerms);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {role ? (
          <Button variant="ghost" size="icon" disabled={isAdminRole}>
            {isAdminRole ? <Lock className="h-4 w-4 text-muted-foreground" /> : <Pencil className="h-4 w-4" />}
          </Button>
        ) : (
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Create Role
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>{role ? "Edit Role" : "Create Role"}</DialogTitle>
          <DialogDescription>
            {role ? "Update role permissions and details." : "Create a new role with specific permissions."}
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-6 py-4">
            <div className="grid grid-cols-4 gap-4">
              <div className="col-span-3 space-y-2">
                <Label>Role Name</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Product Manager"
                />
              </div>
              <div className="space-y-2">
                <Label>Color</Label>
                <Input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="h-10 p-1"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what this role can do..."
                rows={2}
              />
            </div>

            {permissionGroups.map((group, idx) => (
              <div key={group.label} className="space-y-3">
                {idx > 0 && <Separator />}
                <div className="flex items-center justify-between">
                  <Label className="text-base font-semibold">{group.label}</Label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-xs h-7"
                      onClick={() => selectAllInGroup(group, true)}
                    >
                      Select All
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-xs h-7"
                      onClick={() => selectAllInGroup(group, false)}
                    >
                      Clear
                    </Button>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {group.permissions.map((perm) => (
                    <div
                      key={perm.key}
                      className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                    >
                      <div className="space-y-0.5">
                        <p className="font-medium text-sm">{perm.label}</p>
                        <p className="text-xs text-muted-foreground">{perm.description}</p>
                      </div>
                      <Switch
                        checked={permissions[perm.key] || false}
                        onCheckedChange={() => togglePermission(perm.key)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || !name}>
            {mutation.isPending ? "Saving..." : role ? "Update Role" : "Create Role"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface RoleTypesManagerProps {
  onRolesChange?: () => void;
}

export function RoleTypesManager({ onRolesChange }: RoleTypesManagerProps) {
  const queryClient = useQueryClient();

  const { data: roles = [], isLoading } = useQuery({
    queryKey: ["custom-roles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("custom_roles")
        .select("*")
        .order("is_system", { ascending: false })
        .order("name");
      if (error) throw error;
      return data as CustomRole[];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (roleId: string) => {
      const { error } = await supabase
        .from("custom_roles")
        .delete()
        .eq("id", roleId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custom-roles"] });
      toast.success("Role deleted");
      onRolesChange?.();
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const countPermissions = (role: CustomRole) => {
    let count = 0;
    permissionGroups.forEach(group => {
      group.permissions.forEach(perm => {
        if ((role as any)[perm.key]) count++;
      });
    });
    return count;
  };

  const totalPermissions = permissionGroups.reduce((acc, g) => acc + g.permissions.length, 0);

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Loading roles...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Role Types</h3>
          <p className="text-sm text-muted-foreground">
            Define role types with specific permissions for access control (RBAC). Administrator role cannot be edited.
          </p>
        </div>
        <CreateRoleDialog onSuccess={() => onRolesChange?.()} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {roles.map((role) => {
          const isAdmin = role.name === "Administrator";
          const permCount = countPermissions(role);
          
          return (
            <div
              key={role.id}
              className="metric-card flex flex-col"
              style={{ borderLeftColor: role.color || "#6b7280", borderLeftWidth: "4px" }}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold">{role.name}</h4>
                    {isAdmin && (
                      <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded flex items-center gap-1">
                        <Shield className="h-3 w-3" />
                        Protected
                      </span>
                    )}
                    {role.is_system && !isAdmin && (
                      <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded">System</span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{role.description || "No description"}</p>
                </div>
                <div className="flex gap-1">
                  <CreateRoleDialog role={role} onSuccess={() => onRolesChange?.()} />
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={isAdmin}
                    onClick={() => deleteMutation.mutate(role.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
              
              <div className="text-xs text-muted-foreground mb-2">
                {permCount} of {totalPermissions} permissions enabled
              </div>
              
              <div className="flex flex-wrap gap-1.5 mt-auto">
                {role.can_manage_programmes && (
                  <span className="text-xs bg-success/10 text-success px-2 py-0.5 rounded">Programmes</span>
                )}
                {role.can_manage_projects && (
                  <span className="text-xs bg-warning/10 text-warning px-2 py-0.5 rounded">Projects</span>
                )}
                {role.can_manage_products && (
                  <span className="text-xs bg-info/10 text-info px-2 py-0.5 rounded">Products</span>
                )}
                {role.can_manage_users && (
                  <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">Users</span>
                )}
                {role.can_manage_risks && (
                  <span className="text-xs bg-destructive/10 text-destructive px-2 py-0.5 rounded">Risks</span>
                )}
                {role.can_manage_issues && (
                  <span className="text-xs bg-orange-500/10 text-orange-600 px-2 py-0.5 rounded">Issues</span>
                )}
                {role.can_manage_milestones && (
                  <span className="text-xs bg-purple-500/10 text-purple-600 px-2 py-0.5 rounded">Milestones</span>
                )}
                {role.can_manage_quality && (
                  <span className="text-xs bg-teal-500/10 text-teal-600 px-2 py-0.5 rounded">Quality</span>
                )}
                {role.can_view_reports && (
                  <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded">Reports</span>
                )}
                {permCount > 9 && (
                  <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded">
                    +{permCount - 9} more
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}