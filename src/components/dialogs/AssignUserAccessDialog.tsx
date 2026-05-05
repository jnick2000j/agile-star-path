import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
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

interface AssignUserAccessDialogProps {
  onSuccess: () => void;
  presetUserId?: string; // profiles.user_id to pre-select and lock
  presetUserLabel?: string;
  trigger?: React.ReactNode;
}

interface UserRow {
  id: string;
  user_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
}

interface NamedRow {
  id: string;
  name: string;
  organization_id?: string | null;
  programme_id?: string | null;
}

interface CustomRoleRow {
  id: string;
  name: string;
  is_system: boolean;
}

type Scope = "organization" | "programme" | "project" | "product";

const scopeLabel: Record<Scope, string> = {
  organization: "Organization",
  programme: "Programme",
  project: "Project",
  product: "Product",
};

export function AssignUserAccessDialog({ onSuccess, presetUserId, presetUserLabel, trigger }: AssignUserAccessDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const [users, setUsers] = useState<UserRow[]>([]);
  const [organizations, setOrganizations] = useState<NamedRow[]>([]);
  const [programmes, setProgrammes] = useState<NamedRow[]>([]);
  const [projects, setProjects] = useState<NamedRow[]>([]);
  const [products, setProducts] = useState<NamedRow[]>([]);
  const [roles, setRoles] = useState<CustomRoleRow[]>([]);

  const [selectedUser, setSelectedUser] = useState("");
  const [scope, setScope] = useState<Scope>("organization");
  const [selectedEntity, setSelectedEntity] = useState("");
  const [selectedRole, setSelectedRole] = useState("");

  useEffect(() => {
    if (open) fetchData();
  }, [open]);

  const fetchData = async () => {
    const [usersRes, orgsRes, progsRes, projsRes, prodsRes, rolesRes] = await Promise.all([
      supabase.from("profiles").select("id, user_id, email, first_name, last_name, full_name").order("email"),
      supabase.from("organizations").select("id, name").order("name"),
      supabase.from("programmes").select("id, name, organization_id").order("name"),
      supabase.from("projects").select("id, name, programme_id, organization_id").order("name"),
      supabase.from("products").select("id, name, organization_id").order("name"),
      supabase.from("custom_roles").select("id, name, is_system").order("name"),
    ]);

    if (usersRes.data) setUsers(usersRes.data as UserRow[]);
    if (orgsRes.data) setOrganizations(orgsRes.data as NamedRow[]);
    if (progsRes.data) setProgrammes(progsRes.data as NamedRow[]);
    if (projsRes.data) setProjects(projsRes.data as NamedRow[]);
    if (prodsRes.data) setProducts(prodsRes.data as NamedRow[]);
    if (rolesRes.data) setRoles(rolesRes.data as CustomRoleRow[]);
  };

  const userDisplay = (u: UserRow) =>
    u.first_name && u.last_name ? `${u.first_name} ${u.last_name}` : u.full_name || u.email;

  const getEntityOptions = (): NamedRow[] => {
    switch (scope) {
      case "organization": return organizations;
      case "programme":    return programmes;
      case "project":      return projects;
      case "product":      return products;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const effectiveUserId = presetUserId
      ? presetUserId
      : users.find((u) => u.id === selectedUser)?.user_id;
    if (!effectiveUserId || !selectedEntity || !selectedRole) {
      toast.error("Select a user, an entity, and a role from the catalog");
      return;
    }

    setLoading(true);
    try {
      const user = { user_id: effectiveUserId };

      let error;
      if (scope === "organization") {
        ({ error } = await supabase.from("user_organization_custom_roles").upsert(
          { user_id: user.user_id, organization_id: selectedEntity, custom_role_id: selectedRole },
          { onConflict: "user_id,organization_id,custom_role_id" }
        ));
      } else if (scope === "programme") {
        ({ error } = await supabase.from("user_programme_custom_roles").upsert(
          { user_id: user.user_id, programme_id: selectedEntity, custom_role_id: selectedRole },
          { onConflict: "user_id,programme_id,custom_role_id" }
        ));
      } else if (scope === "project") {
        ({ error } = await supabase.from("user_project_custom_roles").upsert(
          { user_id: user.user_id, project_id: selectedEntity, custom_role_id: selectedRole },
          { onConflict: "user_id,project_id,custom_role_id" }
        ));
      } else {
        ({ error } = await supabase.from("user_product_custom_roles").upsert(
          { user_id: user.user_id, product_id: selectedEntity, custom_role_id: selectedRole },
          { onConflict: "user_id,product_id,custom_role_id" }
        ));
      }

      if (error) throw error;

      toast.success("Role assigned successfully");
      setOpen(false);
      setSelectedUser("");
      setScope("organization");
      setSelectedEntity("");
      setSelectedRole("");
      onSuccess();
    } catch (err: any) {
      console.error("Error assigning role:", err);
      toast.error(err.message || "Failed to assign role");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button className="gap-2">
            <UserPlus className="h-4 w-4" />
            Assign Role
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            {presetUserId ? "Edit Access" : "Assign Role from Catalog"}
          </DialogTitle>
          <DialogDescription>
            {presetUserId
              ? `Assign a catalog role to ${presetUserLabel ?? "this user"} at the chosen scope.`
              : "Grant a user access by assigning a role from the catalog at the chosen scope."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            {!presetUserId && (
              <div className="space-y-2">
                <Label>User</Label>
                <Select value={selectedUser} onValueChange={setSelectedUser}>
                  <SelectTrigger><SelectValue placeholder="Select a user" /></SelectTrigger>
                  <SelectContent className="bg-popover z-50">
                    {users.map((u) => (
                      <SelectItem key={u.id} value={u.id}>{userDisplay(u)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>Scope</Label>
              <Select value={scope} onValueChange={(v) => { setScope(v as Scope); setSelectedEntity(""); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent className="bg-popover z-50">
                  <SelectItem value="organization">Organization</SelectItem>
                  <SelectItem value="programme">Programme</SelectItem>
                  <SelectItem value="project">Project</SelectItem>
                  <SelectItem value="product">Product</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{scopeLabel[scope]}</Label>
              <Select value={selectedEntity} onValueChange={setSelectedEntity}>
                <SelectTrigger><SelectValue placeholder={`Select a ${scope}`} /></SelectTrigger>
                <SelectContent className="bg-popover z-50">
                  {getEntityOptions().map((e) => (
                    <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger><SelectValue placeholder="Select a role from the catalog" /></SelectTrigger>
                <SelectContent className="bg-popover z-50">
                  {roles.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}{r.is_system ? "" : " (custom)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Assigning..." : "Assign Role"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
