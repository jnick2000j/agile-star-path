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
}

interface User {
  id: string;
  user_id: string;
  email: string;
  full_name: string | null;
}

interface Organization {
  id: string;
  name: string;
}

interface Program {
  id: string;
  name: string;
  organization_id: string | null;
}

interface Project {
  id: string;
  name: string;
  programme_id: string | null;
  organization_id: string | null;
}

interface Product {
  id: string;
  name: string;
  organization_id: string | null;
}

export function AssignUserAccessDialog({ onSuccess }: AssignUserAccessDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [programmes, setProgrammes] = useState<Program[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  
  const [selectedUser, setSelectedUser] = useState("");
  const [accessType, setAccessType] = useState<"organization" | "program" | "project" | "product">("organization");
  const [selectedEntity, setSelectedEntity] = useState("");
  const [accessLevel, setAccessLevel] = useState("viewer");

  useEffect(() => {
    if (open) {
      fetchData();
    }
  }, [open]);

  const fetchData = async () => {
    const [usersRes, orgsRes, progsRes, projsRes, prodsRes] = await Promise.all([
      supabase.from("profiles").select("id, user_id, email, full_name").order("email"),
      supabase.from("organizations").select("id, name").order("name"),
      supabase.from("programmes").select("id, name, organization_id").order("name"),
      supabase.from("projects").select("id, name, programme_id, organization_id").order("name"),
      supabase.from("products").select("id, name, organization_id").order("name"),
    ]);

    if (usersRes.data) setUsers(usersRes.data);
    if (orgsRes.data) setOrganizations(orgsRes.data);
    if (progsRes.data) setProgrammes(progsRes.data);
    if (projsRes.data) setProjects(projsRes.data);
    if (prodsRes.data) setProducts(prodsRes.data);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || !selectedEntity) {
      toast.error("Please select a user and an entity");
      return;
    }

    setLoading(true);
    try {
      const user = users.find((u) => u.id === selectedUser);
      if (!user) throw new Error("User not found");

      let error;

      if (accessType === "organization") {
        const { error: insertError } = await supabase
          .from("user_organization_access")
          .upsert({
            user_id: user.user_id,
            organization_id: selectedEntity,
            access_level: accessLevel,
          }, { onConflict: "user_id,organization_id" });
        error = insertError;
      } else if (accessType === "program") {
        const { error: insertError } = await supabase
          .from("user_programme_access")
          .upsert({
            user_id: user.user_id,
            programme_id: selectedEntity,
            access_level: accessLevel,
          }, { onConflict: "user_id,programme_id" });
        error = insertError;
      } else if (accessType === "project") {
        const { error: insertError } = await supabase
          .from("user_project_access")
          .upsert({
            user_id: user.user_id,
            project_id: selectedEntity,
            access_level: accessLevel,
          }, { onConflict: "user_id,project_id" });
        error = insertError;
      } else if (accessType === "product") {
        const { error: insertError } = await supabase
          .from("user_product_access")
          .upsert({
            user_id: user.user_id,
            product_id: selectedEntity,
            access_level: accessLevel,
          }, { onConflict: "user_id,product_id" });
        error = insertError;
      }

      if (error) throw error;

      toast.success("Access granted successfully");
      setOpen(false);
      resetForm();
      onSuccess();
    } catch (error: any) {
      console.error("Error granting access:", error);
      toast.error(error.message || "Failed to grant access");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setSelectedUser("");
    setAccessType("organization");
    setSelectedEntity("");
    setAccessLevel("viewer");
  };

  const getEntityOptions = () => {
    switch (accessType) {
      case "organization":
        return organizations;
      case "program":
        return programmes;
      case "project":
        return projects;
      case "product":
        return products;
      default:
        return [];
    }
  };

  const getAccessLevels = () => {
    if (accessType === "organization") {
      return [
        { value: "admin", label: "Admin" },
        { value: "manager", label: "Manager" },
        { value: "editor", label: "Editor" },
        { value: "viewer", label: "Viewer" },
      ];
    }
    return [
      { value: "owner", label: "Owner" },
      { value: "manager", label: "Manager" },
      { value: "editor", label: "Editor" },
      { value: "viewer", label: "Viewer" },
    ];
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <UserPlus className="h-4 w-4" />
          Assign Access
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            Assign User Access
          </DialogTitle>
          <DialogDescription>
            Grant a user access to an organization, programme, or project.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>User</Label>
              <Select value={selectedUser} onValueChange={setSelectedUser}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a user" />
                </SelectTrigger>
                <SelectContent className="bg-popover z-50">
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.full_name || user.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Access Type</Label>
              <Select value={accessType} onValueChange={(v) => {
                setAccessType(v as typeof accessType);
                setSelectedEntity("");
              }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover z-50">
                  <SelectItem value="organization">Organization</SelectItem>
                  <SelectItem value="program">Program</SelectItem>
                  <SelectItem value="project">Project</SelectItem>
                  <SelectItem value="product">Product</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>
                {accessType === "organization" ? "Organization" : accessType === "program" ? "Program" : "Project"}
              </Label>
              <Select value={selectedEntity} onValueChange={setSelectedEntity}>
                <SelectTrigger>
                  <SelectValue placeholder={`Select a ${accessType}`} />
                </SelectTrigger>
                <SelectContent className="bg-popover z-50">
                  {getEntityOptions().map((entity) => (
                    <SelectItem key={entity.id} value={entity.id}>
                      {entity.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Access Level</Label>
              <Select value={accessLevel} onValueChange={setAccessLevel}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover z-50">
                  {getAccessLevels().map((level) => (
                    <SelectItem key={level.value} value={level.value}>
                      {level.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Assigning..." : "Assign Access"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}