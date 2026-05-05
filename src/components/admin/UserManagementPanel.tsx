import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  Users,
  Crown,
  Building2,
  Archive,
  UserCheck,
  Tag,
  Settings2,
  Mail,
  Loader2,
  RotateCcw,
  Clock,
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
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AssignUserAccessDialog } from "@/components/dialogs/AssignUserAccessDialog";
import { EditUserDialog } from "@/components/dialogs/EditUserDialog";
import { CreateUserDialog } from "@/components/dialogs/CreateUserDialog";

type AccessLevel = "admin" | "editor" | "viewer";

interface UserCustomRoleAssignment {
  organization_id: string;
  role_name: string;
  is_system: boolean;
}

export interface UserWithRole {
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
  account_status: "pending" | "active";
  job_title: string | null;
  highest_access: AccessLevel | null;
  custom_roles: UserCustomRoleAssignment[];
  created_at: string;
  org_count: number;
}

const accessRank: Record<AccessLevel, number> = { viewer: 1, editor: 2, admin: 3 };

interface Props {
  /** Override the heading shown above the panel. Defaults to none (parent page provides). */
  heading?: string;
  /** Override the subtitle shown next to the heading. */
  subtitle?: string;
}

/**
 * Reusable user-management panel. Used by both Org Admin Panel and Platform Admin
 * (where it shows users across all organizations the viewer can see via RLS).
 */
export function UserManagementPanel({ heading, subtitle }: Props) {
  const [searchQuery, setSearchQuery] = useState("");
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const [resendingFor, setResendingFor] = useState<string | null>(null);

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
        account_status: (profile.account_status as "pending" | "active") || "pending",
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

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleResendInvite = async (user: UserWithRole) => {
    setResendingFor(user.user_id);
    try {
      const { data, error } = await supabase.functions.invoke("manage-user", {
        body: {
          action: "resend_invite",
          user_id: user.user_id,
          redirect_to: `${window.location.origin}/auth/confirm`,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`Invite email resent to ${user.email}`);
    } catch (err: any) {
      console.error("Resend invite failed:", err);
      toast.error(err.message || "Failed to resend invite");
    } finally {
      setResendingFor(null);
    }
  };

  const [resettingFor, setResettingFor] = useState<string | null>(null);
  const handleResetToPending = async (user: UserWithRole) => {
    if (!confirm(`Reset ${user.email} to Pending? They will be signed out and required to re-confirm their email.`)) return;
    setResettingFor(user.user_id);
    try {
      const { data, error } = await supabase.functions.invoke("manage-user", {
        body: {
          action: "reset_to_pending",
          user_id: user.user_id,
          redirect_to: `${window.location.origin}/auth/confirm`,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`${user.email} reset to Pending. Confirmation email sent.`);
      await fetchUsers();
    } catch (err: any) {
      console.error("Reset to pending failed:", err);
      toast.error(err.message || "Failed to reset user");
    } finally {
      setResettingFor(null);
    }
  };

  const filteredUsers = users.filter((u) => {
    const displayName = u.first_name && u.last_name
      ? `${u.first_name} ${u.last_name}`
      : u.full_name || "";
    const matchesSearch =
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      displayName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesArchive = showArchived ? u.archived : !u.archived;
    return matchesSearch && matchesArchive;
  });

  const totalActive = users.filter((u) => !u.archived).length;
  const orgAdminCount = users.filter((u) => !u.archived && u.highest_access === "admin").length;
  const withCustomRoleCount = users.filter((u) => !u.archived && u.custom_roles.length > 0).length;
  const archivedCount = users.filter((u) => u.archived).length;

  const getUserDisplayName = (user: UserWithRole) => {
    if (user.first_name && user.last_name) return `${user.first_name} ${user.last_name}`;
    if (user.first_name) return user.first_name;
    if (user.last_name) return user.last_name;
    return user.full_name || user.email;
  };

  const getUserInitials = (user: UserWithRole) => {
    if (user.first_name && user.last_name) return `${user.first_name[0]}${user.last_name[0]}`.toUpperCase();
    if (user.first_name) return user.first_name.slice(0, 2).toUpperCase();
    if (user.last_name) return user.last_name.slice(0, 2).toUpperCase();
    return (user.full_name || user.email).slice(0, 2).toUpperCase();
  };

  return (
    <>
      {(heading || subtitle) && (
        <div className="mb-4">
          {heading && <h3 className="text-lg font-semibold">{heading}</h3>}
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        </div>
      )}

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
                        <span className="font-medium block">{getUserDisplayName(user)}</span>
                        <span className="text-xs text-muted-foreground">{user.email}</span>
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
                      {user.custom_roles.length > 0 ? (() => {
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
                      })() : (
                        <Badge variant="outline" className="w-fit text-muted-foreground">
                          No roles assigned
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {user.archived ? (
                      <Badge variant="destructive">Archived</Badge>
                    ) : user.account_status === "pending" ? (
                      <Badge variant="outline" className="border-warning text-warning gap-1">
                        <Clock className="h-3 w-3" />
                        Pending
                      </Badge>
                    ) : (
                      <Badge variant="default" className="bg-success">Active</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 flex-wrap">
                      <EditUserDialog user={user} onSuccess={fetchUsers} />
                      <AssignUserAccessDialog
                        onSuccess={fetchUsers}
                        presetUserId={user.user_id}
                        presetUserLabel={getUserDisplayName(user)}
                        trigger={
                          <Button variant="outline" size="sm" className="gap-1.5">
                            <Settings2 className="h-3.5 w-3.5" />
                            Edit access
                          </Button>
                        }
                      />
                      {!user.archived && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5"
                          disabled={resendingFor === user.user_id}
                          onClick={() => handleResendInvite(user)}
                          title="Resend the invitation email with a fresh sign-in link"
                        >
                          {resendingFor === user.user_id
                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            : <Mail className="h-3.5 w-3.5" />}
                          Resend invite
                        </Button>
                      )}
                      {!user.archived && user.account_status === "active" && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5"
                          disabled={resettingFor === user.user_id}
                          onClick={() => handleResetToPending(user)}
                          title="Force user to re-confirm their email address"
                        >
                          {resettingFor === user.user_id
                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            : <RotateCcw className="h-3.5 w-3.5" />}
                          Reset to pending
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
