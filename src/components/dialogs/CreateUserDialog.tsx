import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { UserPlus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface CreateUserDialogProps {
  onSuccess: () => void;
}

interface OrgOption {
  id: string;
  name: string;
}

interface RoleOption {
  id: string;
  name: string;
  is_system: boolean;
}

interface ScopedEntity {
  id: string;
  name: string;
  organization_id: string;
}

type AssignmentScope = "organization" | "programme" | "project" | "product";

export function CreateUserDialog({ onSuccess }: CreateUserDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [orgs, setOrgs] = useState<OrgOption[]>([]);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [programmes, setProgrammes] = useState<ScopedEntity[]>([]);
  const [projects, setProjects] = useState<ScopedEntity[]>([]);
  const [products, setProducts] = useState<ScopedEntity[]>([]);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    first_name: "",
    last_name: "",
    phone_number: "",
    department: "",
    location: "",
    organization_id: "",
    assignment_scope: "organization" as AssignmentScope,
    scoped_entity_id: "",
    custom_role_id: "",
    create_as_platform_admin: false,
  });

  useEffect(() => {
    if (!open) return;
    supabase
      .from("organizations")
      .select("id, name")
      .order("name")
      .then(({ data }) => setOrgs((data as OrgOption[]) || []));
    supabase
      .from("custom_roles")
      .select("id, name, is_system")
      .order("name")
      .then(({ data }) => {
        const list = (data as RoleOption[]) || [];
        setRoles(list);
        setFormData((prev) => {
          if (prev.custom_role_id) return prev;
          const def = list.find((r) => r.name === "Customer Portal User");
          return def ? { ...prev, custom_role_id: def.id } : prev;
        });
      });
    supabase
      .from("programmes")
      .select("id, name, organization_id")
      .order("name")
      .then(({ data }) => setProgrammes((data as ScopedEntity[]) || []));
    supabase
      .from("projects")
      .select("id, name, organization_id")
      .order("name")
      .then(({ data }) => setProjects((data as ScopedEntity[]) || []));
    supabase
      .from("products")
      .select("id, name, organization_id")
      .order("name")
      .then(({ data }) => setProducts((data as ScopedEntity[]) || []));
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: role } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", data.user.id)
        .eq("role", "admin")
        .maybeSingle();
      setIsPlatformAdmin(!!role);
    });
  }, [open]);

  const scopedEntities = (): ScopedEntity[] => {
    if (!formData.organization_id) return [];
    switch (formData.assignment_scope) {
      case "programme": return programmes.filter((p) => p.organization_id === formData.organization_id);
      case "project":   return projects.filter((p) => p.organization_id === formData.organization_id);
      case "product":   return products.filter((p) => p.organization_id === formData.organization_id);
      default: return [];
    }
  };

  const deriveAccessLevel = (roleName?: string): string => {
    if (!roleName) return "viewer";
    if (roleName === "Org Admin") return "admin";
    if (roleName === "Org Editor") return "editor";
    return "viewer";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.email || !formData.password) {
      toast.error("Email and password are required");
      return;
    }

    if (formData.password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    if (!formData.organization_id && !formData.create_as_platform_admin) {
      toast.error("Select an organization, or mark this user as a platform administrator.");
      return;
    }

    if (formData.organization_id && !formData.custom_role_id && !formData.create_as_platform_admin) {
      toast.error("Select a role from the catalog for this user.");
      return;
    }

    if (
      formData.organization_id &&
      formData.assignment_scope !== "organization" &&
      !formData.scoped_entity_id &&
      !formData.create_as_platform_admin
    ) {
      toast.error(`Select a ${formData.assignment_scope} for this assignment.`);
      return;
    }

    setLoading(true);

    try {
      const fullName = `${formData.first_name} ${formData.last_name}`.trim();
      const selectedRole = roles.find((r) => r.id === formData.custom_role_id);
      const derivedAccessLevel = deriveAccessLevel(selectedRole?.name);

      // Create user via the manage-user edge function (uses admin API)
      const { data, error } = await supabase.functions.invoke("manage-user", {
        body: {
          action: "invite",
          email: formData.email,
          password: formData.password,
          full_name: fullName || formData.email.split('@')[0],
          redirect_to: `${window.location.origin}/auth`,
          organization_id: formData.organization_id || null,
          access_level: derivedAccessLevel,
          create_as_platform_admin: formData.create_as_platform_admin,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      // Assign the catalog role at the chosen scope
      if (data?.user_id && formData.organization_id && formData.custom_role_id && !formData.create_as_platform_admin) {
        let roleErr: any = null;
        if (formData.assignment_scope === "organization") {
          ({ error: roleErr } = await supabase
            .from("user_organization_custom_roles")
            .upsert(
              { user_id: data.user_id, organization_id: formData.organization_id, custom_role_id: formData.custom_role_id },
              { onConflict: "user_id,organization_id,custom_role_id" }
            ));
        } else if (formData.assignment_scope === "programme") {
          ({ error: roleErr } = await supabase
            .from("user_programme_custom_roles")
            .upsert(
              { user_id: data.user_id, programme_id: formData.scoped_entity_id, custom_role_id: formData.custom_role_id },
              { onConflict: "user_id,programme_id,custom_role_id" }
            ));
        } else if (formData.assignment_scope === "project") {
          ({ error: roleErr } = await supabase
            .from("user_project_custom_roles")
            .upsert(
              { user_id: data.user_id, project_id: formData.scoped_entity_id, custom_role_id: formData.custom_role_id },
              { onConflict: "user_id,project_id,custom_role_id" }
            ));
        } else if (formData.assignment_scope === "product") {
          ({ error: roleErr } = await supabase
            .from("user_product_custom_roles")
            .upsert(
              { user_id: data.user_id, product_id: formData.scoped_entity_id, custom_role_id: formData.custom_role_id },
              { onConflict: "user_id,product_id,custom_role_id" }
            ));
        }
        if (roleErr) console.error("Failed to assign role:", roleErr);
      }

      // Update the profile with additional info after a short delay
      if (data?.user_id) {
        setTimeout(async () => {
          await supabase
            .from("profiles")
            .update({
              full_name: fullName,
              first_name: formData.first_name || null,
              last_name: formData.last_name || null,
              phone_number: formData.phone_number || null,
              department: formData.department || null,
              location: formData.location || null,
            })
            .eq("user_id", data.user_id);
        }, 1000);
      }

      if (data?.emailSent) {
        toast.success("User created and invite email sent.");
      } else if (data?.accept_url) {
        toast.warning(
          `User created, but email could not be sent${
            data?.emailError ? ` (${data.emailError})` : ""
          }. Share this link manually: ${data.accept_url}`,
          { duration: 15000 },
        );
      } else {
        toast.success("User created.");
      }
      setOpen(false);
      setFormData({
        email: "",
        password: "",
        first_name: "",
        last_name: "",
        phone_number: "",
        department: "",
        location: "",
        organization_id: "",
        assignment_scope: "organization",
        scoped_entity_id: "",
        custom_role_id: "",
        create_as_platform_admin: false,
      });
      onSuccess();
    } catch (error: any) {
      console.error("Error creating user:", error);
      toast.error(error.message || "Failed to create user");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <UserPlus className="h-4 w-4" />
          Create User
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create & Invite User</DialogTitle>
          <DialogDescription>
            Add a new user to the system. They will receive a confirmation email to verify their account before they can sign in.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Temporary Password *</Label>
            <Input
              id="password"
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              required
              minLength={6}
            />
            <p className="text-xs text-muted-foreground">
              The user must confirm their email before signing in. They can reset this password after.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="first_name">First Name</Label>
              <Input
                id="first_name"
                value={formData.first_name}
                onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="last_name">Last Name</Label>
              <Input
                id="last_name"
                value={formData.last_name}
                onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
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
          </div>

          <div className="space-y-2">
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
            />
          </div>

          <div className="space-y-3 rounded-md border p-3">
            <Label className="text-sm font-semibold">Organization assignment *</Label>
            <p className="text-xs text-muted-foreground">
              Every user must belong to at least one organization. Platform administrators are the only exception.
            </p>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="organization_id">Organization</Label>
                <Select
                  value={formData.organization_id}
                  onValueChange={(v) => setFormData({ ...formData, organization_id: v })}
                  disabled={formData.create_as_platform_admin}
                >
                  <SelectTrigger id="organization_id">
                    <SelectValue placeholder="Select organization" />
                  </SelectTrigger>
                  <SelectContent>
                    {orgs.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="custom_role_id">Role (from catalog)</Label>
                <Select
                  value={formData.custom_role_id}
                  onValueChange={(v) => setFormData({ ...formData, custom_role_id: v })}
                  disabled={formData.create_as_platform_admin}
                >
                  <SelectTrigger id="custom_role_id">
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.name}{r.is_system ? "" : " (custom)"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Manage the catalog under Roles &amp; Access → Role Catalog.
                </p>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="assignment_scope">Assign role at</Label>
                <Select
                  value={formData.assignment_scope}
                  onValueChange={(v) =>
                    setFormData({
                      ...formData,
                      assignment_scope: v as AssignmentScope,
                      scoped_entity_id: "",
                    })
                  }
                  disabled={formData.create_as_platform_admin}
                >
                  <SelectTrigger id="assignment_scope">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="organization">Organization (all)</SelectItem>
                    <SelectItem value="programme">Specific Programme</SelectItem>
                    <SelectItem value="project">Specific Project</SelectItem>
                    <SelectItem value="product">Specific Product</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {formData.assignment_scope !== "organization" && (
                <div className="space-y-2">
                  <Label htmlFor="scoped_entity_id" className="capitalize">
                    {formData.assignment_scope}
                  </Label>
                  <Select
                    value={formData.scoped_entity_id}
                    onValueChange={(v) => setFormData({ ...formData, scoped_entity_id: v })}
                    disabled={formData.create_as_platform_admin || !formData.organization_id}
                  >
                    <SelectTrigger id="scoped_entity_id">
                      <SelectValue
                        placeholder={
                          formData.organization_id
                            ? `Select ${formData.assignment_scope}`
                            : "Select organization first"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {scopedEntities().map((e) => (
                        <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                      ))}
                      {scopedEntities().length === 0 && formData.organization_id && (
                        <div className="px-3 py-2 text-xs text-muted-foreground">
                          No {formData.assignment_scope}s in this organization.
                        </div>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            {isPlatformAdmin && (
              <label className="flex items-start gap-2 pt-1 text-sm">
                <Checkbox
                  checked={formData.create_as_platform_admin}
                  onCheckedChange={(v) =>
                    setFormData({
                      ...formData,
                      create_as_platform_admin: v === true,
                      organization_id: v === true ? "" : formData.organization_id,
                    })
                  }
                />
                <span>
                  Create as <strong>Platform Administrator</strong> (no organization required; full system access).
                </span>
              </label>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Creating..." : "Create & Send Invite"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
