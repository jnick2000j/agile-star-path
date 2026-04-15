import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Trash2, Pencil, Building2, Briefcase, FolderKanban, Package } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

interface AccessAssignment {
  id: string;
  user_id: string;
  user_email: string;
  user_name: string | null;
  entity_type: "organization" | "program" | "project" | "product";
  entity_id: string;
  entity_name: string;
  access_level: string;
}

const accessLevelColors: Record<string, string> = {
  admin: "bg-primary/10 text-primary",
  owner: "bg-primary/10 text-primary",
  manager: "bg-success/10 text-success",
  editor: "bg-warning/10 text-warning",
  viewer: "bg-muted text-muted-foreground",
};

const entityIcons: Record<string, React.ElementType> = {
  organization: Building2,
  programme: Briefcase,
  project: FolderKanban,
  product: Package,
};

export function UserAccessList() {
  const [assignments, setAssignments] = useState<AccessAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);

  const fetchAssignments = async () => {
    setLoading(true);
    try {
      const [orgAccess, progAccess, projAccess, prodAccess] = await Promise.all([
        supabase
          .from("user_organization_access")
          .select("id, user_id, access_level, organization_id, organizations(name)")
          .order("created_at", { ascending: false }),
        supabase
          .from("user_programme_access")
          .select("id, user_id, access_level, programme_id, programmes(name)")
          .order("created_at", { ascending: false }),
        supabase
          .from("user_project_access")
          .select("id, user_id, access_level, project_id, projects(name)")
          .order("created_at", { ascending: false }),
        supabase
          .from("user_product_access")
          .select("id, user_id, access_level, product_id, products(name)")
          .order("created_at", { ascending: false }),
      ]);

      const { data: profiles } = await supabase.from("profiles").select("user_id, email, full_name");
      const profileMap = new Map(profiles?.map((p) => [p.user_id, p]) || []);

      const allAssignments: AccessAssignment[] = [];

      orgAccess.data?.forEach((a: any) => {
        const profile = profileMap.get(a.user_id);
        allAssignments.push({
          id: a.id,
          user_id: a.user_id,
          user_email: profile?.email || "Unknown",
          user_name: profile?.full_name || null,
          entity_type: "organization",
          entity_id: a.organization_id,
          entity_name: a.organizations?.name || "Unknown",
          access_level: a.access_level,
        });
      });

      progAccess.data?.forEach((a: any) => {
        const profile = profileMap.get(a.user_id);
        allAssignments.push({
          id: a.id,
          user_id: a.user_id,
          user_email: profile?.email || "Unknown",
          user_name: profile?.full_name || null,
          entity_type: "program",
          entity_id: a.programme_id,
          entity_name: a.programmes?.name || "Unknown",
          access_level: a.access_level,
        });
      });

      projAccess.data?.forEach((a: any) => {
        const profile = profileMap.get(a.user_id);
        allAssignments.push({
          id: a.id,
          user_id: a.user_id,
          user_email: profile?.email || "Unknown",
          user_name: profile?.full_name || null,
          entity_type: "project",
          entity_id: a.project_id,
          entity_name: a.projects?.name || "Unknown",
          access_level: a.access_level,
        });
      });

      prodAccess.data?.forEach((a: any) => {
        const profile = profileMap.get(a.user_id);
        allAssignments.push({
          id: a.id,
          user_id: a.user_id,
          user_email: profile?.email || "Unknown",
          user_name: profile?.full_name || null,
          entity_type: "product",
          entity_id: a.product_id,
          entity_name: a.products?.name || "Unknown",
          access_level: a.access_level,
        });
      });

      setAssignments(allAssignments);
    } catch (error) {
      console.error("Error fetching assignments:", error);
      toast.error("Failed to load access assignments");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssignments();
  }, []);

  const handleUpdateAccess = async (assignment: AccessAssignment, newLevel: string) => {
    try {
      const table =
        assignment.entity_type === "organization"
          ? "user_organization_access"
          : assignment.entity_type === "program"
          ? "user_programme_access"
          : assignment.entity_type === "product"
          ? "user_product_access"
          : "user_project_access";

      const { error } = await supabase.from(table).update({ access_level: newLevel }).eq("id", assignment.id);

      if (error) throw error;

      toast.success("Access level updated");
      setEditingId(null);
      fetchAssignments();
    } catch (error) {
      console.error("Error updating access:", error);
      toast.error("Failed to update access level");
    }
  };

  const handleRevokeAccess = async (assignment: AccessAssignment) => {
    try {
      const table =
        assignment.entity_type === "organization"
          ? "user_organization_access"
          : assignment.entity_type === "program"
          ? "user_programme_access"
          : assignment.entity_type === "product"
          ? "user_product_access"
          : "user_project_access";

      const { error } = await supabase.from(table).delete().eq("id", assignment.id);

      if (error) throw error;

      toast.success("Access revoked successfully");
      fetchAssignments();
    } catch (error) {
      console.error("Error revoking access:", error);
      toast.error("Failed to revoke access");
    }
  };

  const getAccessLevels = (entityType: string) => {
    if (entityType === "organization") {
      return ["admin", "manager", "editor", "viewer"];
    }
    return ["owner", "manager", "editor", "viewer"];
  };

  if (loading) {
    return (
      <div className="metric-card">
        <div className="text-center py-8 text-muted-foreground">Loading access assignments...</div>
      </div>
    );
  }

  if (assignments.length === 0) {
    return (
      <div className="metric-card">
        <div className="text-center py-8 text-muted-foreground">
          No access assignments yet. Use "Assign Access" to grant users access to organizations, programmes, or
          projects.
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
            <TableHead>Type</TableHead>
            <TableHead>Entity</TableHead>
            <TableHead>Access Level</TableHead>
            <TableHead className="w-[100px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {assignments.map((assignment) => {
            const Icon = entityIcons[assignment.entity_type];
            return (
              <TableRow key={`${assignment.entity_type}-${assignment.id}`}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-xs font-medium text-primary">
                        {(assignment.user_name || assignment.user_email)[0].toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-sm">{assignment.user_name || "No name"}</p>
                      <p className="text-xs text-muted-foreground">{assignment.user_email}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="gap-1 capitalize">
                    <Icon className="h-3 w-3" />
                    {assignment.entity_type}
                  </Badge>
                </TableCell>
                <TableCell className="font-medium">{assignment.entity_name}</TableCell>
                <TableCell>
                  {editingId === `${assignment.entity_type}-${assignment.id}` ? (
                    <Select
                      defaultValue={assignment.access_level}
                      onValueChange={(value) => handleUpdateAccess(assignment, value)}
                    >
                      <SelectTrigger className="w-[120px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {getAccessLevels(assignment.entity_type).map((level) => (
                          <SelectItem key={level} value={level} className="capitalize">
                            {level}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge className={accessLevelColors[assignment.access_level] || "bg-muted"}>
                      {assignment.access_level}
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() =>
                        setEditingId(
                          editingId === `${assignment.entity_type}-${assignment.id}`
                            ? null
                            : `${assignment.entity_type}-${assignment.id}`
                        )
                      }
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Revoke Access</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to revoke {assignment.user_name || assignment.user_email}'s access to{" "}
                            {assignment.entity_name}? This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleRevokeAccess(assignment)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Revoke Access
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
