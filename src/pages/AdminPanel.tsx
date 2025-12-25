import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Search, 
  Shield, 
  UserCog, 
  Users,
  Crown,
  Briefcase,
  Building2,
  Palette,
  ArrowRight
} from "lucide-react";
import { cn } from "@/lib/utils";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Database } from "@/integrations/supabase/types";
import { CreateOrganizationDialog } from "@/components/dialogs/CreateOrganizationDialog";
import { AssignUserAccessDialog } from "@/components/dialogs/AssignUserAccessDialog";

type AppRole = Database["public"]["Enums"]["app_role"];

interface UserWithRole {
  id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  role: AppRole;
  created_at: string;
}

interface Organization {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  primary_color: string | null;
}

interface UserWithRole {
  id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  role: AppRole;
  created_at: string;
}

const roleConfig: Record<AppRole, { label: string; icon: React.ElementType; className: string }> = {
  admin: { label: "Admin", icon: Crown, className: "bg-primary/10 text-primary" },
  programme_owner: { label: "Programme Owner", icon: Briefcase, className: "bg-success/10 text-success" },
  project_manager: { label: "Project Manager", icon: UserCog, className: "bg-warning/10 text-warning" },
  stakeholder: { label: "Stakeholder", icon: Users, className: "bg-muted text-muted-foreground" },
};

export default function AdminPanel() {
  const [searchQuery, setSearchQuery] = useState("");
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data: profiles, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (profileError) throw profileError;

      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("*");

      if (rolesError) throw rolesError;

      const usersWithRoles: UserWithRole[] = (profiles || []).map((profile) => {
        const userRole = roles?.find((r) => r.user_id === profile.user_id);
        return {
          id: profile.id,
          user_id: profile.user_id,
          email: profile.email,
          full_name: profile.full_name,
          role: userRole?.role || "stakeholder",
          created_at: profile.created_at,
        };
      });

      setUsers(usersWithRoles);
    } catch (error) {
      console.error("Error fetching users:", error);
      toast.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  const fetchOrganizations = async () => {
    try {
      const { data, error } = await supabase
        .from("organizations")
        .select("*")
        .order("name");

      if (error) throw error;
      setOrganizations(data || []);
    } catch (error) {
      console.error("Error fetching organizations:", error);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchOrganizations();
  }, []);

  const handleRoleChange = async (userId: string, newRole: AppRole) => {
    try {
      // Check if user already has a role entry
      const { data: existing } = await supabase
        .from("user_roles")
        .select("*")
        .eq("user_id", userId)
        .single();

      if (existing) {
        const { error } = await supabase
          .from("user_roles")
          .update({ role: newRole })
          .eq("user_id", userId);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("user_roles")
          .insert({ user_id: userId, role: newRole });

        if (error) throw error;
      }

      // Also update the profile role
      await supabase
        .from("profiles")
        .update({ role: newRole })
        .eq("user_id", userId);

      toast.success("Role updated successfully");
      fetchUsers();
    } catch (error) {
      console.error("Error updating role:", error);
      toast.error("Failed to update role. You may not have admin permissions.");
    }
  };

  const filteredUsers = users.filter(
    (u) =>
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.full_name?.toLowerCase() || "").includes(searchQuery.toLowerCase())
  );

  const roleCounts = {
    admin: users.filter((u) => u.role === "admin").length,
    programme_owner: users.filter((u) => u.role === "programme_owner").length,
    project_manager: users.filter((u) => u.role === "project_manager").length,
    stakeholder: users.filter((u) => u.role === "stakeholder").length,
  };

  return (
    <AppLayout title="Admin Panel" subtitle="Manage users, organizations, and permissions">
      <Tabs defaultValue="users" className="space-y-6">
        <TabsList className="bg-secondary">
          <TabsTrigger value="users">User Roles</TabsTrigger>
          <TabsTrigger value="organizations">Organizations</TabsTrigger>
          <TabsTrigger value="access">Access Control</TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          {/* Summary Cards */}
          <div className="grid gap-4 md:grid-cols-4 mb-6">
            <div className="metric-card">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Crown className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-semibold">{roleCounts.admin}</p>
                  <p className="text-sm text-muted-foreground">Admins</p>
                </div>
              </div>
            </div>
            <div className="metric-card">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
                  <Briefcase className="h-5 w-5 text-success" />
                </div>
                <div>
                  <p className="text-2xl font-semibold">{roleCounts.programme_owner}</p>
                  <p className="text-sm text-muted-foreground">Programme Owners</p>
                </div>
              </div>
            </div>
            <div className="metric-card">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/10">
                  <UserCog className="h-5 w-5 text-warning" />
                </div>
                <div>
                  <p className="text-2xl font-semibold">{roleCounts.project_manager}</p>
                  <p className="text-sm text-muted-foreground">Project Managers</p>
                </div>
              </div>
            </div>
            <div className="metric-card">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                  <Users className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-2xl font-semibold">{roleCounts.stakeholder}</p>
                  <p className="text-sm text-muted-foreground">Stakeholders</p>
                </div>
              </div>
            </div>
          </div>

          {/* Actions Bar */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {/* Users Table */}
          <div className="metric-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Current Role</TableHead>
                  <TableHead>Change Role</TableHead>
                  <TableHead>Joined</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      Loading users...
                    </TableCell>
                  </TableRow>
                ) : filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      No users found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((user, index) => {
                    const RoleIcon = roleConfig[user.role].icon;
                    return (
                      <TableRow
                        key={user.id}
                        className="animate-fade-in"
                        style={{ animationDelay: `${index * 0.03}s` }}
                      >
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                              <span className="text-sm font-medium text-primary">
                                {(user.full_name || user.email)[0].toUpperCase()}
                              </span>
                            </div>
                            <span className="font-medium">
                              {user.full_name || "No name"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {user.email}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={cn("gap-1", roleConfig[user.role].className)}
                          >
                            <RoleIcon className="h-3 w-3" />
                            {roleConfig[user.role].label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={user.role}
                            onValueChange={(value: AppRole) =>
                              handleRoleChange(user.user_id, value)
                            }
                          >
                            <SelectTrigger className="w-[180px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="admin">Admin</SelectItem>
                              <SelectItem value="programme_owner">
                                Programme Owner
                              </SelectItem>
                              <SelectItem value="project_manager">
                                Project Manager
                              </SelectItem>
                              <SelectItem value="stakeholder">Stakeholder</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(user.created_at).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="organizations">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-lg font-semibold">Organizations</h3>
              <p className="text-sm text-muted-foreground">Manage companies and their programmes/projects</p>
            </div>
            <div className="flex gap-2">
              <Link to="/admin/branding">
                <Button variant="outline" className="gap-2">
                  <Palette className="h-4 w-4" />
                  Branding Settings
                </Button>
              </Link>
              <CreateOrganizationDialog onSuccess={fetchOrganizations} />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {organizations.length === 0 ? (
              <div className="col-span-full metric-card text-center py-12">
                <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No Organizations Yet</h3>
                <p className="text-muted-foreground mb-4">Create your first organization to start grouping programmes and projects.</p>
                <CreateOrganizationDialog onSuccess={fetchOrganizations} />
              </div>
            ) : (
              organizations.map((org) => (
                <div key={org.id} className="metric-card">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div 
                        className="h-10 w-10 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: org.primary_color || "#2563eb" }}
                      >
                        <Building2 className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <h4 className="font-medium">{org.name}</h4>
                        <p className="text-xs text-muted-foreground">/{org.slug}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>Created {new Date(org.created_at).toLocaleDateString()}</span>
                    <Link to="/admin/branding" className="text-primary hover:underline flex items-center gap-1">
                      Manage <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="access">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-lg font-semibold">Access Control</h3>
              <p className="text-sm text-muted-foreground">
                Configure granular access permissions for users to specific programmes and projects.
              </p>
            </div>
            <AssignUserAccessDialog onSuccess={() => {}} />
          </div>
          
          <div className="grid gap-4 md:grid-cols-3 mb-6">
            <div className="metric-card">
              <div className="p-4 border border-border rounded-lg">
                <h4 className="font-medium mb-2">Organization-Level Access</h4>
                <p className="text-sm text-muted-foreground">
                  Users with organization access can view all programmes and projects within that organization.
                </p>
              </div>
            </div>
            <div className="metric-card">
              <div className="p-4 border border-border rounded-lg">
                <h4 className="font-medium mb-2">Programme-Level Access</h4>
                <p className="text-sm text-muted-foreground">
                  Grant users access to specific programmes and all projects within them.
                </p>
              </div>
            </div>
            <div className="metric-card">
              <div className="p-4 border border-border rounded-lg">
                <h4 className="font-medium mb-2">Project-Level Access</h4>
                <p className="text-sm text-muted-foreground">
                  Grant users access to individual projects without access to the full programme.
                </p>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}
