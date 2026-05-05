import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Search, 
  Users,
  Crown,
  Building2,
  Palette,
  ArrowRight,
  Archive,
  UserCheck,
  FolderKanban,
  Package,
  Layers,
  Tag,
  Settings2,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Database } from "@/integrations/supabase/types";
import { CreateOrganizationDialog } from "@/components/dialogs/CreateOrganizationDialog";
import { EditOrganizationDialog } from "@/components/dialogs/EditOrganizationDialog";
import { AssignUserAccessDialog } from "@/components/dialogs/AssignUserAccessDialog";
import { UserAccessList } from "@/components/admin/UserAccessList";
import { RoleTypesManager } from "@/components/admin/RoleTypesManager";
import { RequestMigrationCard } from "@/components/migration/RequestMigrationCard";
import { RoleBuilderMatrix } from "@/components/admin/RoleBuilderMatrix";
import { ResidencyComplianceManager } from "@/components/admin/ResidencyComplianceManager";
import { AIProviderSettings } from "@/components/admin/AIProviderSettings";
import { EmailSettings } from "@/components/admin/EmailSettings";
import { EmailTriggerSettings } from "@/components/admin/EmailTriggerSettings";
import { EditUserDialog } from "@/components/dialogs/EditUserDialog";
import { CreateUserDialog } from "@/components/dialogs/CreateUserDialog";

type AccessLevel = "admin" | "editor" | "viewer";

interface UserCustomRoleAssignment {
  organization_id: string;
  role_name: string;
  is_system: boolean;
}

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
  job_title: string | null;
  highest_access: AccessLevel | null;
  custom_roles: UserCustomRoleAssignment[];
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

const accessLevelConfig: Record<AccessLevel, { label: string; className: string }> = {
  admin:  { label: "Org Admin",  className: "bg-primary/10 text-primary border-primary/20" },
  editor: { label: "Editor",     className: "bg-success/10 text-success border-success/20" },
  viewer: { label: "Viewer",     className: "bg-muted text-muted-foreground" },
};

const accessRank: Record<AccessLevel, number> = { viewer: 1, editor: 2, admin: 3 };

export default function AdminPanel() {
  const [searchQuery, setSearchQuery] = useState("");
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const [
        { data: profiles, error: profileError },
        { data: orgAccess, error: orgAccessError },
        { data: customRoleAssignments, error: customRoleError },
      ] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at", { ascending: false }),
        supabase.from("user_organization_access").select("user_id, organization_id, access_level"),
        supabase
          .from("user_organization_custom_roles")
          .select("user_id, organization_id, custom_roles(name, is_system)"),
      ]);

      if (profileError) throw profileError;
      if (orgAccessError) throw orgAccessError;
      if (customRoleError) throw customRoleError;

      // Aggregate per user
      const orgCountMap: Record<string, number> = {};
      const highestAccessMap: Record<string, AccessLevel> = {};
      orgAccess?.forEach((a: any) => {
        orgCountMap[a.user_id] = (orgCountMap[a.user_id] || 0) + 1;
        const lvl = a.access_level as AccessLevel;
        const current = highestAccessMap[a.user_id];
        if (!current || accessRank[lvl] > accessRank[current]) {
          highestAccessMap[a.user_id] = lvl;
        }
      });

      const customRolesMap: Record<string, UserCustomRoleAssignment[]> = {};
      customRoleAssignments?.forEach((row: any) => {
        const cr = row.custom_roles;
        if (!cr) return;
        const list = customRolesMap[row.user_id] || (customRolesMap[row.user_id] = []);
        list.push({
          organization_id: row.organization_id,
          role_name: cr.name,
          is_system: !!cr.is_system,
        });
      });

      const usersWithRoles: UserWithRole[] = (profiles || []).map((profile: any) => ({
        id: profile.id,
        user_id: profile.user_id,
        email: profile.email,
        full_name: profile.full_name,
        first_name: profile.first_name,
        last_name: profile.last_name,
        phone_number: profile.phone_number,
        address: profile.address,
        mailing_address: profile.mailing_address,
        location: profile.location,
        department: profile.department,
        archived: profile.archived || false,
        job_title: profile.job_title || null,
        highest_access: highestAccessMap[profile.user_id] || null,
        custom_roles: customRolesMap[profile.user_id] || [],
        created_at: profile.created_at,
        org_count: orgCountMap[profile.user_id] || 0,
      }));

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

  const totalActive = users.filter((u) => !u.archived).length;
  const orgAdminCount = users.filter((u) => !u.archived && u.highest_access === "admin").length;
  const withCustomRoleCount = users.filter((u) => !u.archived && u.custom_roles.length > 0).length;
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
          <TabsTrigger value="roles-access">Roles &amp; Access</TabsTrigger>
          <TabsTrigger value="organizations">Organizations</TabsTrigger>
          <TabsTrigger value="residency">Region & Compliance</TabsTrigger>
          <TabsTrigger value="ai-provider">AI Provider</TabsTrigger>
          <TabsTrigger value="email">Email</TabsTrigger>
          <TabsTrigger value="migration">Migration</TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          {/* Summary Cards */}
          <div className="grid gap-4 md:grid-cols-4 mb-6">
            <div className="metric-card">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                  <Users className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-2xl font-semibold">{totalActive}</p>
                  <p className="text-sm text-muted-foreground">Total Members</p>
                </div>
              </div>
            </div>
            <div className="metric-card">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Crown className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-semibold">{orgAdminCount}</p>
                  <p className="text-sm text-muted-foreground">Org Admins</p>
                </div>
              </div>
            </div>
            <div className="metric-card">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
                  <Tag className="h-5 w-5 text-success" />
                </div>
                <div>
                  <p className="text-2xl font-semibold">{withCustomRoleCount}</p>
                  <p className="text-sm text-muted-foreground">With Custom Role</p>
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
                  filteredUsers.map((user, index) => (
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
                            {user.job_title && (
                              <span className="text-xs text-muted-foreground italic block">
                                {user.job_title}
                              </span>
                            )}
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
                        <div className="flex flex-col gap-1.5 max-w-[280px]">
                          {user.highest_access ? (
                            <Badge
                              variant="outline"
                              className={cn("w-fit gap-1", accessLevelConfig[user.highest_access].className)}
                            >
                              {user.highest_access === "admin" && <Crown className="h-3 w-3" />}
                              {accessLevelConfig[user.highest_access].label}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="w-fit text-muted-foreground">
                              No access
                            </Badge>
                          )}
                          {user.custom_roles.length > 0 && (() => {
                            const unique = Array.from(new Set(user.custom_roles.map((r) => r.role_name)));
                            return (
                              <div className="flex flex-wrap gap-1">
                                {unique.slice(0, 4).map((name) => (
                                  <Badge key={name} variant="secondary" className="text-[10px] gap-1 font-normal">
                                    <Tag className="h-2.5 w-2.5" />
                                    {name}
                                  </Badge>
                                ))}
                                {unique.length > 4 && (
                                  <Badge variant="secondary" className="text-[10px] font-normal">
                                    +{unique.length - 4}
                                  </Badge>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      </TableCell>
                      <TableCell>
                        {user.archived ? (
                          <Badge variant="destructive">Archived</Badge>
                        ) : (
                          <Badge variant="default" className="bg-success">Active</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <EditUserDialog user={user} onSuccess={fetchUsers} />
                          <Link to="/admin?tab=roles-access">
                            <Button variant="outline" size="sm" className="gap-1.5">
                              <Settings2 className="h-3.5 w-3.5" />
                              Edit access
                            </Button>
                          </Link>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="roles-access">
          <div className="mb-4">
            <h3 className="text-lg font-semibold">Roles &amp; Access</h3>
            <p className="text-sm text-muted-foreground">
              One place to manage who's in the organization, what they can do, and the role catalog
              that drives those permissions. Platform admin grants live under
              {" "}<a href="/platform-admin?tab=platform-admins" className="text-primary underline">Platform Admin → Platform Admins</a>.
            </p>
          </div>
          <Tabs defaultValue="members" className="space-y-4">
            <TabsList>
              <TabsTrigger value="members">Members &amp; Access</TabsTrigger>
              <TabsTrigger value="catalog">Role Catalog</TabsTrigger>
              <TabsTrigger value="matrix">Permission Matrix</TabsTrigger>
            </TabsList>
            <TabsContent value="members">
              <div className="flex justify-between items-center mb-4">
                <p className="text-sm text-muted-foreground">
                  Grant users access by assigning roles from the catalog. Roles can be assigned at
                  organization, programme, project, or product scope.
                </p>
                <AssignUserAccessDialog onSuccess={() => window.location.reload()} />
              </div>
              <UserAccessList />
            </TabsContent>
            <TabsContent value="catalog">
              <RoleTypesManager />
            </TabsContent>
            <TabsContent value="matrix">
              <RoleBuilderMatrix />
            </TabsContent>
          </Tabs>
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

        <TabsContent value="residency">
          <ResidencyComplianceManager />
        </TabsContent>

        <TabsContent value="ai-provider">
          <AIProviderSettings />
        </TabsContent>

        <TabsContent value="email" className="space-y-6">
          <EmailSettings />
          <EmailTriggerSettings />
        </TabsContent>

        <TabsContent value="migration">
          <RequestMigrationCard />
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}
