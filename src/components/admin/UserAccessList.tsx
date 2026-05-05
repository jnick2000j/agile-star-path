import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Trash2, Building2, Briefcase, FolderKanban, Package, Tag } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

type Scope = "organization" | "programme" | "project" | "product";

interface RoleAssignment {
  id: string;
  user_id: string;
  user_email: string;
  user_name: string | null;
  scope: Scope;
  entity_id: string;
  entity_name: string;
  role_id: string;
  role_name: string;
  is_system: boolean;
}

const scopeIcon: Record<Scope, React.ElementType> = {
  organization: Building2,
  programme: Briefcase,
  project: FolderKanban,
  product: Package,
};

const scopeLabel: Record<Scope, string> = {
  organization: "Organization",
  programme: "Programme",
  project: "Project",
  product: "Product",
};

const tableForScope: Record<Scope, string> = {
  organization: "user_organization_custom_roles",
  programme: "user_programme_custom_roles",
  project: "user_project_custom_roles",
  product: "user_product_custom_roles",
};

export function UserAccessList() {
  const [assignments, setAssignments] = useState<RoleAssignment[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAssignments = async () => {
    setLoading(true);
    try {
      const [orgRes, progRes, projRes, prodRes, profilesRes] = await Promise.all([
        supabase
          .from("user_organization_custom_roles")
          .select("id, user_id, organization_id, custom_role_id, organizations(name), custom_roles(name, is_system)"),
        supabase
          .from("user_programme_custom_roles")
          .select("id, user_id, programme_id, custom_role_id, programmes(name), custom_roles(name, is_system)"),
        supabase
          .from("user_project_custom_roles")
          .select("id, user_id, project_id, custom_role_id, projects(name), custom_roles(name, is_system)"),
        supabase
          .from("user_product_custom_roles")
          .select("id, user_id, product_id, custom_role_id, products(name), custom_roles(name, is_system)"),
        supabase.from("profiles").select("user_id, email, first_name, last_name, full_name"),
      ]);

      const profileMap = new Map(
        (profilesRes.data || []).map((p: any) => [
          p.user_id,
          {
            email: p.email,
            name:
              p.first_name && p.last_name ? `${p.first_name} ${p.last_name}` : p.full_name || null,
          },
        ])
      );

      const all: RoleAssignment[] = [];

      const push = (
        scope: Scope,
        rows: any[] | null,
        entityIdKey: string,
        entityRel: string
      ) => {
        rows?.forEach((r) => {
          const profile = profileMap.get(r.user_id);
          if (!r.custom_roles) return;
          all.push({
            id: r.id,
            user_id: r.user_id,
            user_email: profile?.email || "Unknown",
            user_name: profile?.name || null,
            scope,
            entity_id: r[entityIdKey],
            entity_name: r[entityRel]?.name || "Unknown",
            role_id: r.custom_role_id,
            role_name: r.custom_roles.name,
            is_system: !!r.custom_roles.is_system,
          });
        });
      };

      push("organization", orgRes.data as any[], "organization_id", "organizations");
      push("programme", progRes.data as any[], "programme_id", "programmes");
      push("project", projRes.data as any[], "project_id", "projects");
      push("product", prodRes.data as any[], "product_id", "products");

      // Sort: scope hierarchy, then user, then entity
      const scopeOrder: Record<Scope, number> = { organization: 0, programme: 1, project: 2, product: 3 };
      all.sort((a, b) =>
        scopeOrder[a.scope] - scopeOrder[b.scope] ||
        (a.user_name || a.user_email).localeCompare(b.user_name || b.user_email) ||
        a.entity_name.localeCompare(b.entity_name)
      );

      setAssignments(all);
    } catch (error) {
      console.error("Error fetching role assignments:", error);
      toast.error("Failed to load role assignments");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssignments();
  }, []);

  const handleRevoke = async (a: RoleAssignment) => {
    try {
      const { error } = await supabase.from(tableForScope[a.scope] as any).delete().eq("id", a.id);
      if (error) throw error;
      toast.success("Role revoked");
      fetchAssignments();
    } catch (err) {
      console.error("Error revoking role:", err);
      toast.error("Failed to revoke role");
    }
  };

  if (loading) {
    return (
      <div className="metric-card">
        <div className="text-center py-8 text-muted-foreground">Loading role assignments...</div>
      </div>
    );
  }

  if (assignments.length === 0) {
    return (
      <div className="metric-card">
        <div className="text-center py-8 text-muted-foreground">
          No role assignments yet. Use "Assign Role" to grant a user access via a catalog role.
        </div>
      </div>
    );
  }

  return (
    <div className="metric-card overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>User</TableHead>
            <TableHead>Scope</TableHead>
            <TableHead>Entity</TableHead>
            <TableHead>Role</TableHead>
            <TableHead className="w-[80px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {assignments.map((a) => {
            const Icon = scopeIcon[a.scope];
            return (
              <TableRow key={`${a.scope}-${a.id}`}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-xs font-medium text-primary">
                        {(a.user_name || a.user_email)[0].toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-sm">{a.user_name || "No name"}</p>
                      <p className="text-xs text-muted-foreground">{a.user_email}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="gap-1">
                    <Icon className="h-3 w-3" />
                    {scopeLabel[a.scope]}
                  </Badge>
                </TableCell>
                <TableCell className="font-medium">{a.entity_name}</TableCell>
                <TableCell>
                  <Badge
                    variant="secondary"
                    className="gap-1 font-normal"
                  >
                    <Tag className="h-3 w-3" />
                    {a.role_name}
                    {!a.is_system && <span className="text-[10px] opacity-70 ml-1">(custom)</span>}
                  </Badge>
                </TableCell>
                <TableCell>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Revoke Role</AlertDialogTitle>
                        <AlertDialogDescription>
                          Remove the <strong>{a.role_name}</strong> role from{" "}
                          {a.user_name || a.user_email} on {scopeLabel[a.scope].toLowerCase()}{" "}
                          <strong>{a.entity_name}</strong>?
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleRevoke(a)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Revoke
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
