import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus, X, Search } from "lucide-react";
import { toast } from "sonner";

type UserType = "staff" | "portal" | "system";

interface SystemRole {
  id: string;
  name: string;
  description: string | null;
}

interface MemberRow {
  user_id: string;
  full_name: string | null;
  email: string;
  user_type: UserType;
  role_ids: string[];
}

/**
 * SystemRoleAssignmentsPanel
 * --------------------------
 * Lets an org admin assign system custom_roles (Helpdesk Admin, CAB Member,
 * Customer Portal User, etc.) to members of the current organization, and
 * adjust profiles.user_type so external customers don't consume paid seats.
 */
export function SystemRoleAssignmentsPanel() {
  const { currentOrganization } = useOrganization();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [systemRoles, setSystemRoles] = useState<SystemRole[]>([]);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!currentOrganization) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOrganization?.id]);

  async function load() {
    if (!currentOrganization) return;
    setLoading(true);
    try {
      const [rolesRes, accessRes] = await Promise.all([
        supabase
          .from("custom_roles")
          .select("id,name,description")
          .eq("is_system", true)
          .order("name"),
        supabase
          .from("user_organization_access")
          .select("user_id")
          .eq("organization_id", currentOrganization.id)
          .eq("is_disabled", false),
      ]);
      if (rolesRes.error) throw rolesRes.error;
      if (accessRes.error) throw accessRes.error;

      const roles = (rolesRes.data || []) as SystemRole[];
      setSystemRoles(roles);

      const userIds = (accessRes.data || []).map((r) => r.user_id);
      if (userIds.length === 0) {
        setMembers([]);
        return;
      }

      const [profilesRes, assignRes] = await Promise.all([
        supabase
          .from("profiles_directory" as any)
          .select("user_id,full_name,email")
          .in("user_id", userIds),
        supabase
          .from("user_organization_custom_roles")
          .select("user_id,custom_role_id")
          .eq("organization_id", currentOrganization.id)
          .in("user_id", userIds),
      ]);
      if (profilesRes.error) throw profilesRes.error;
      if (assignRes.error) throw assignRes.error;

      // user_type comes from profiles (not the directory view)
      const { data: typeRows } = await supabase
        .from("profiles")
        .select("user_id,user_type")
        .in("user_id", userIds);
      const typeByUser = new Map<string, UserType>(
        (typeRows || []).map((r: any) => [r.user_id, (r.user_type ?? "staff") as UserType]),
      );

      const rolesByUser = new Map<string, string[]>();
      for (const a of assignRes.data || []) {
        const list = rolesByUser.get(a.user_id) || [];
        list.push(a.custom_role_id);
        rolesByUser.set(a.user_id, list);
      }

      const rows: MemberRow[] = ((profilesRes.data || []) as any[]).map((p) => ({
        user_id: p.user_id,
        full_name: p.full_name,
        email: p.email,
        user_type: typeByUser.get(p.user_id) ?? "staff",
        role_ids: rolesByUser.get(p.user_id) ?? [],
      }));
      rows.sort((a, b) =>
        (a.full_name || a.email).localeCompare(b.full_name || b.email),
      );
      setMembers(rows);
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Failed to load system role assignments");
    } finally {
      setLoading(false);
    }
  }

  async function setUserType(userId: string, newType: UserType) {
    setBusy(userId);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ user_type: newType })
        .eq("user_id", userId);
      if (error) throw error;
      setMembers((prev) =>
        prev.map((m) => (m.user_id === userId ? { ...m, user_type: newType } : m)),
      );
      toast.success("User type updated");
    } catch (e: any) {
      toast.error(e.message || "Failed to update user type");
    } finally {
      setBusy(null);
    }
  }

  async function addRole(userId: string, roleId: string) {
    if (!currentOrganization) return;
    setBusy(userId);
    try {
      const { error } = await supabase
        .from("user_organization_custom_roles")
        .insert({
          user_id: userId,
          organization_id: currentOrganization.id,
          custom_role_id: roleId,
        });
      if (error) throw error;
      setMembers((prev) =>
        prev.map((m) =>
          m.user_id === userId ? { ...m, role_ids: [...m.role_ids, roleId] } : m,
        ),
      );
      toast.success("Role assigned");
    } catch (e: any) {
      toast.error(e.message || "Failed to assign role");
    } finally {
      setBusy(null);
    }
  }

  async function removeRole(userId: string, roleId: string) {
    if (!currentOrganization) return;
    setBusy(userId);
    try {
      const { error } = await supabase
        .from("user_organization_custom_roles")
        .delete()
        .eq("user_id", userId)
        .eq("organization_id", currentOrganization.id)
        .eq("custom_role_id", roleId);
      if (error) throw error;
      setMembers((prev) =>
        prev.map((m) =>
          m.user_id === userId
            ? { ...m, role_ids: m.role_ids.filter((r) => r !== roleId) }
            : m,
        ),
      );
      toast.success("Role removed");
    } catch (e: any) {
      toast.error(e.message || "Failed to remove role");
    } finally {
      setBusy(null);
    }
  }

  const roleById = useMemo(
    () => new Map(systemRoles.map((r) => [r.id, r])),
    [systemRoles],
  );

  const filtered = useMemo(() => {
    if (!search.trim()) return members;
    const q = search.toLowerCase();
    return members.filter(
      (m) =>
        (m.full_name || "").toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q),
    );
  }, [members, search]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">System role assignments</h2>
          <p className="text-sm text-muted-foreground">
            Assign Helpdesk, Change Management, Governance and Customer Portal
            roles. Portal users do not count toward your seat license.
          </p>
        </div>
        <div className="relative w-64">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search members"
            className="pl-8"
          />
        </div>
      </div>

      <div className="rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Member</th>
              <th className="px-3 py-2 text-left font-medium">User type</th>
              <th className="px-3 py-2 text-left font-medium">System roles</th>
              <th className="px-3 py-2 text-left font-medium">Add role</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">
                  No members
                </td>
              </tr>
            )}
            {filtered.map((m) => {
              const available = systemRoles.filter((r) => !m.role_ids.includes(r.id));
              return (
                <tr key={m.user_id} className="border-t align-top">
                  <td className="px-3 py-2">
                    <div className="font-medium">{m.full_name || m.email}</div>
                    <div className="text-xs text-muted-foreground">{m.email}</div>
                  </td>
                  <td className="px-3 py-2">
                    <Select
                      value={m.user_type}
                      onValueChange={(v) => setUserType(m.user_id, v as UserType)}
                      disabled={busy === m.user_id}
                    >
                      <SelectTrigger className="w-[140px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="staff">Staff (billable)</SelectItem>
                        <SelectItem value="portal">Customer portal</SelectItem>
                        <SelectItem value="system">System / bot</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {m.role_ids.length === 0 && (
                        <span className="text-xs text-muted-foreground">No roles</span>
                      )}
                      {m.role_ids.map((rid) => {
                        const role = roleById.get(rid);
                        if (!role) return null;
                        return (
                          <Badge key={rid} variant="secondary" className="gap-1">
                            {role.name}
                            <button
                              type="button"
                              className="ml-1 rounded hover:bg-background/40"
                              onClick={() => removeRole(m.user_id, rid)}
                              disabled={busy === m.user_id}
                              aria-label={`Remove ${role.name}`}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        );
                      })}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <Select
                      value=""
                      onValueChange={(v) => v && addRole(m.user_id, v)}
                      disabled={busy === m.user_id || available.length === 0}
                    >
                      <SelectTrigger className="w-[200px]">
                        <SelectValue placeholder={available.length === 0 ? "All assigned" : "Add role…"} />
                      </SelectTrigger>
                      <SelectContent>
                        {available.map((r) => (
                          <SelectItem key={r.id} value={r.id}>
                            {r.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
