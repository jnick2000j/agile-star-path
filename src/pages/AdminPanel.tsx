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
  ArrowRight,
  Archive,
  UserCheck,
  FolderKanban,
  Package,
  Layers,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSignedLogo } from "@/hooks/useSignedLogo";

function OrgLogoImg({ stored, name, primaryColor }: { stored?: string | null; name: string; primaryColor?: string | null }) {
  const url = useSignedLogo(stored);
  if (url) {
    return <img src={url} alt={name} className="h-10 w-10 rounded-lg object-cover" />;
  }
  return (
    <div className="h-10 w-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: primaryColor || "#2563eb" }}>
      <Building2 className="h-5 w-5 text-white" />
    </div>
  );
}
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
import { EditOrganizationDialog } from "@/components/dialogs/EditOrganizationDialog";
import { AssignUserAccessDialog } from "@/components/dialogs/AssignUserAccessDialog";
import { UserAccessList } from "@/components/admin/UserAccessList";
import { RoleTypesManager } from "@/components/admin/RoleTypesManager";
import { RoleBuilderMatrix } from "@/components/admin/RoleBuilderMatrix";
import { ResidencyComplianceManager } from "@/components/admin/ResidencyComplianceManager";
import { AIProviderSettings } from "@/components/admin/AIProviderSettings";
import { EmailSettings } from "@/components/admin/EmailSettings";


import { EditUserDialog } from "@/components/dialogs/EditUserDialog";
import { CreateUserDialog } from "@/components/dialogs/CreateUserDialog";

type AppRole = Database["public"]["Enums"]["app_role"];

interface UserWithRole {
  id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  phone_number: string | null;
  address: string | null;
  mailing_address: string | null;
  location: string | null;
  department: string | null;
  archived: boolean;
  role: AppRole;
  created_at: string;
  org_count: number;
}

interface Organization {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  primary_color: string | null;
  logo_url: string | null;
  programme_count: number;
  project_count: number;
  product_count: number;
}

const roleConfig: Record<AppRole, { label: string; icon: React.ElementType; className: string }> = {
  admin: { label: "Platform Administrator", icon: Crown, className: "bg-primary/10 text-primary" },
  org_admin: { label: "Org Administrator", icon: Building2, className: "bg-primary/10 text-primary" },
  programme_owner: { label: "Program Owner", icon: Briefcase, className: "bg-success/10 text-success" },
  project_manager: { label: "Project Manager", icon: UserCog, className: "bg-warning/10 text-warning" },
  product_manager: { label: "Product Manager", icon: Briefcase, className: "bg-accent/10 text-accent-foreground" },
  product_team_member: { label: "Product Team Member", icon: Users, className: "bg-secondary text-secondary-foreground" },
  project_team_member: { label: "Project Team Member", icon: Users, className: "bg-secondary text-secondary-foreground" },
  org_stakeholder: { label: "Org Stakeholder", icon: Building2, className: "bg-muted text-muted-foreground" },
  programme_stakeholder: { label: "Program Stakeholder", icon: Briefcase, className: "bg-muted text-muted-foreground" },
  project_stakeholder: { label: "Project Stakeholder", icon: FolderKanban, className: "bg-muted text-muted-foreground" },
  product_stakeholder: { label: "Product Stakeholder", icon: Package, className: "bg-muted text-muted-foreground" },
  stakeholder: { label: "Stakeholder", icon: Users, className: "bg-muted text-muted-foreground" },
};

export default function AdminPanel() {
  const [searchQuery, setSearchQuery] = useState("");
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);

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

      // Get org access counts
      const { data: orgAccess } = await supabase
        .from("user_organization_access")
        .select("user_id");

      const orgCountMap: Record<string, number> = {};
      orgAccess?.forEach((a) => {
        orgCountMap[a.user_id] = (orgCountMap[a.user_id] || 0) + 1;
      });

      const usersWithRoles: UserWithRole[] = (profiles || []).map((profile) => {
        const userRole = roles?.find((r) => r.user_id === profile.user_id);
        return {
          id: profile.id,
          user_id: profile.user_id,
          email: profile.email,
          full_name: profile.full_name,
          first_name: (profile as any).first_name,
          last_name: (profile as any).last_name,
          phone_number: profile.phone_number,
          address: profile.address,
          mailing_address: profile.mailing_address,
          location: profile.location,
          department: profile.department,
          archived: profile.archived || false,
          role: userRole?.role || "org_stakeholder",
          created_at: profile.created_at,
          org_count: orgCountMap[profile.user_id] || 0,
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
      const { data: orgs, error } = await supabase
        .from("organizations")
        .select("*")
        .order("name");

      if (error) throw error;

      // Fetch counts for each organization
      const orgsWithCounts = await Promise.all(
        (orgs || []).map(async (org) => {
          const [programmes, projects, products] = await Promise.all([
            supabase.from("programmes").select("id", { count: "exact", head: true }).eq("organization_id", org.id),
            supabase.from("projects").select("id", { count: "exact", head: true }).eq("organization_id", org.id),
            supabase.from("products").select("id", { count: "exact", head: true }).eq("organization_id", org.id),
          ]);

          return {
            id: org.id,
            name: org.name,
            slug: org.slug,
            created_at: org.created_at,
            primary_color: org.primary_color,
            logo_url: org.logo_url,
            programme_count: programmes.count || 0,
            project_count: projects.count || 0,
            product_count: products.count || 0,
          };
        })
      );

      setOrganizations(orgsWithCounts);
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

  const filteredUsers = users.filter((u) => {
    const displayName = u.first_name && u.last_name 
      ? `${u.first_name} ${u.last_name}` 
      : u.full_name || "";
    const matchesSearch =
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      displayName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesArchived = showArchived ? u.archived : !u.archived;
    return matchesSearch && matchesArchived;
  });

  const roleCounts = {
    admin: users.filter((u) => u.role === "admin" && !u.archived).length,
    programme_owner: users.filter((u) => u.role === "programme_owner" && !u.archived).length,
    project_manager: users.filter((u) => u.role === "project_manager" && !u.archived).length,
    org_stakeholder: users.filter((u) => u.role === "org_stakeholder" && !u.archived).length,
  };

  const archivedCount = users.filter((u) => u.archived).length;

  const getUserDisplayName = (user: UserWithRole) => {
    if (user.first_name && user.last_name) {
      return `${user.first_name} ${user.last_name}`;
    }
    return user.full_name || "No name";
  };

  const getUserInitials = (user: UserWithRole) => {
    if (user.first_name && user.last_name) {
      return `${user.first_name[0]}${user.last_name[0]}`.toUpperCase();
    }
    return (user.full_name || user.email)[0].toUpperCase();
  };

  return (
    <AppLayout title="Admin Panel" subtitle="Manage users, organizations, and permissions">
      <Tabs defaultValue="users" className="space-y-6">
        <TabsList className="bg-secondary">
          <TabsTrigger value="users">User Management</TabsTrigger>
          <TabsTrigger value="role-types">Role Types</TabsTrigger>
          <TabsTrigger value="role-builder">Permission Matrix</TabsTrigger>
          <TabsTrigger value="organizations">Organizations</TabsTrigger>
          <TabsTrigger value="access">Access Control</TabsTrigger>
          <TabsTrigger value="residency">Region & Compliance</TabsTrigger>
          <TabsTrigger value="ai-provider">AI Provider</TabsTrigger>
          <TabsTrigger value="email">Email</TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          {/* Summary Cards */}
          <div className="grid gap-4 md:grid-cols-5 mb-6">
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
                  <p className="text-sm text-muted-foreground">Program Owners</p>
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
                  <p className="text-2xl font-semibold">{roleCounts.org_stakeholder}</p>
                  <p className="text-sm text-muted-foreground">Stakeholders</p>
                </div>
              </div>
            </div>
            <div className="metric-card">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10">
                  <Archive className="h-5 w-5 text-destructive" />
                </div>
                <div>
                  <p className="text-2xl font-semibold">{archivedCount}</p>
                  <p className="text-sm text-muted-foreground">Archived</p>
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
            <div className="flex gap-2">
              <Button
                variant={showArchived ? "default" : "outline"}
                onClick={() => setShowArchived(!showArchived)}
                className="gap-2"
              >
                {showArchived ? <UserCheck className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                {showArchived ? "Show Active" : "Show Archived"}
              </Button>
              <CreateUserDialog onSuccess={fetchUsers} />
            </div>
          </div>

          {/* Users Table */}
          <div className="metric-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Organizations</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      Loading users...
                    </TableCell>
                  </TableRow>
                ) : filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      No users found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((user, index) => {
                    const RoleIcon = roleConfig[user.role].icon;
                    return (
                      <TableRow
                        key={user.id}
                        className={cn("animate-fade-in", user.archived && "opacity-60")}
                        style={{ animationDelay: `${index * 0.03}s` }}
                      >
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                              <span className="text-sm font-medium text-primary">
                                {getUserInitials(user)}
                              </span>
                            </div>
                            <div>
                              <span className="font-medium block">
                                {getUserDisplayName(user)}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {user.email}
                              </span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          <div className="text-sm">
                            {user.phone_number && <div>{user.phone_number}</div>}
                            {user.location && <div className="text-xs">{user.location}</div>}
                            {!user.phone_number && !user.location && "-"}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="gap-1">
                            <Building2 className="h-3 w-3" />
                            {user.org_count}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={user.role}
                            onValueChange={(value: AppRole) =>
                              handleRoleChange(user.user_id, value)
                            }
                            disabled={user.archived}
                          >
                            <SelectTrigger className="w-[160px]">
                              <div className="flex items-center gap-2">
                                <RoleIcon className="h-3 w-3" />
                                <SelectValue />
                              </div>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="admin">Platform Administrator</SelectItem>
                              <SelectItem value="org_admin">Org Administrator</SelectItem>
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
                        </TableCell>
                        <TableCell>
                          {user.archived ? (
                            <Badge variant="destructive">Archived</Badge>
                          ) : (
                            <Badge variant="default" className="bg-success">Active</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <EditUserDialog user={user} onSuccess={fetchUsers} />
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="role-types">
          <RoleTypesManager />
        </TabsContent>

        <TabsContent value="role-builder">
          <RoleBuilderMatrix />
        </TabsContent>

        <TabsContent value="organizations">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-lg font-semibold">Organizations</h3>
              <p className="text-sm text-muted-foreground">Manage companies and their programmes/projects</p>
            </div>
            <div className="flex gap-2">
              <Link to="/branding">
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
                      <OrgLogoImg stored={org.logo_url} name={org.name} primaryColor={org.primary_color} />
                      <div>
                        <h4 className="font-medium">{org.name}</h4>
                        <p className="text-xs text-muted-foreground">/{org.slug}</p>
                      </div>
                    </div>
                    <EditOrganizationDialog organization={org} onSuccess={fetchOrganizations} />
                  </div>
                  
                  {/* Linked Items */}
                  <div className="flex gap-4 mb-4 text-sm">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <FolderKanban className="h-4 w-4" />
                      <span>{org.programme_count} Programmes</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Layers className="h-4 w-4" />
                      <span>{org.project_count} Projects</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Package className="h-4 w-4" />
                      <span>{org.product_count} Products</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between text-sm text-muted-foreground border-t pt-3">
                    <span>Created {new Date(org.created_at).toLocaleDateString()}</span>
                    <Link to="/branding" className="text-primary hover:underline flex items-center gap-1">
                      Branding <ArrowRight className="h-3 w-3" />
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
            <AssignUserAccessDialog onSuccess={() => window.location.reload()} />
          </div>
          
          <UserAccessList />
        </TabsContent>

        <TabsContent value="residency">
          <ResidencyComplianceManager />
        </TabsContent>

        <TabsContent value="ai-provider">
          <AIProviderSettings />
        </TabsContent>

        <TabsContent value="email">
          <EmailSettings />
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}
