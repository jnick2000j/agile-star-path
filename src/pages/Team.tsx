import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Plus,
  Search,
  Filter,
  Mail,
  MoreVertical,
  Send,
  Loader2,
  ShieldOff,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface TeamMember {
  id: string;
  user_id: string;
  full_name: string | null;
  email: string;
  role: string;
  department: string | null;
  phone_number: string | null;
  avatar_url: string | null;
  archived: boolean;
  is_disabled: boolean;
  disabled_reason: string | null;
  disabled_at: string | null;
}

const roleConfig: Record<string, { label: string; className: string }> = {
  admin: { label: "Administrator", className: "bg-destructive/10 text-destructive" },
  programme_owner: { label: "Program Owner", className: "bg-primary/10 text-primary" },
  project_manager: { label: "Project Manager", className: "bg-success/10 text-success" },
  product_manager: { label: "Product Manager", className: "bg-warning/10 text-warning" },
  product_team_member: { label: "Product Team Member", className: "bg-accent/10 text-accent-foreground" },
  project_team_member: { label: "Project Team Member", className: "bg-info/10 text-info" },
  org_stakeholder: { label: "Org Stakeholder", className: "bg-muted text-muted-foreground" },
  programme_stakeholder: { label: "Program Stakeholder", className: "bg-muted text-muted-foreground" },
  project_stakeholder: { label: "Project Stakeholder", className: "bg-muted text-muted-foreground" },
  product_stakeholder: { label: "Product Stakeholder", className: "bg-muted text-muted-foreground" },
  
};

export default function Team() {
  const { currentOrganization } = useOrganization();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [roleFilters, setRoleFilters] = useState<string[]>([]);
  const [departmentFilters, setDepartmentFilters] = useState<string[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [resendingFor, setResendingFor] = useState<string | null>(null);

  // Add member dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<TeamMember[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedRole, setSelectedRole] = useState("org_stakeholder");
  const [adding, setAdding] = useState(false);

  // Disable / enable member dialog state
  const [statusTarget, setStatusTarget] = useState<TeamMember | null>(null);
  const [statusAction, setStatusAction] = useState<"disable" | "enable">("disable");
  const [statusReason, setStatusReason] = useState("");
  const [statusBusy, setStatusBusy] = useState(false);

  useEffect(() => {
    fetchTeamMembers();
  }, [currentOrganization]);

  const fetchTeamMembers = async () => {
    if (!currentOrganization) {
      setTeamMembers([]);
      setLoading(false);
      return;
    }
    
    setLoading(true);
    try {
      const { data: accessData, error: accessError } = await supabase
        .from("user_organization_access")
        .select("user_id, access_level, is_disabled, disabled_at, disabled_reason")
        .eq("organization_id", currentOrganization.id);

      if (accessError) throw accessError;

      if (!accessData || accessData.length === 0) {
        setTeamMembers([]);
        setLoading(false);
        return;
      }

      const userIds = accessData.map(a => a.user_id);
      const accessByUser = new Map(accessData.map(a => [a.user_id, a]));

      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .in("user_id", userIds)
        .eq("archived", false);

      if (profilesError) throw profilesError;

      const members: TeamMember[] = (profiles || []).map(p => {
        const access = accessByUser.get(p.user_id);
        return {
          id: p.id,
          user_id: p.user_id,
          full_name: p.full_name,
          email: p.email,
          role: p.role,
          department: p.department,
          phone_number: p.phone_number,
          avatar_url: p.avatar_url,
          archived: p.archived,
          is_disabled: !!access?.is_disabled,
          disabled_reason: access?.disabled_reason ?? null,
          disabled_at: access?.disabled_at ?? null,
        };
      });

      setTeamMembers(members);

      const depts = [...new Set(members.map(m => m.department).filter(Boolean))] as string[];
      setDepartments(depts);
    } catch (error) {
      console.error("Error fetching team members:", error);
      toast.error("Failed to load team members");
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableUsers = async () => {
    if (!currentOrganization) return;
    
    try {
      const { data: allProfiles, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .eq("archived", false);

      if (profilesError) throw profilesError;

      const { data: existingAccess, error: accessError } = await supabase
        .from("user_organization_access")
        .select("user_id")
        .eq("organization_id", currentOrganization.id);

      if (accessError) throw accessError;

      const existingUserIds = new Set(existingAccess?.map(a => a.user_id) || []);

      const available = (allProfiles || [])
        .filter(p => !existingUserIds.has(p.user_id))
        .map(p => ({
          id: p.id,
          user_id: p.user_id,
          full_name: p.full_name,
          email: p.email,
          role: p.role,
          department: p.department,
          phone_number: p.phone_number,
          avatar_url: p.avatar_url,
          archived: p.archived,
          is_disabled: false,
          disabled_reason: null,
          disabled_at: null,
        }));

      setAvailableUsers(available);
    } catch (error) {
      console.error("Error fetching available users:", error);
    }
  };

  const handleAddMember = async () => {
    if (!selectedUserId || !currentOrganization) return;
    
    setAdding(true);
    try {
      const { error: accessError } = await supabase
        .from("user_organization_access")
        .insert({
          user_id: selectedUserId,
          organization_id: currentOrganization.id,
          access_level: "viewer",
        });

      if (accessError) throw accessError;

      const { error: roleError } = await supabase
        .from("user_organization_roles")
        .insert({
          user_id: selectedUserId,
          organization_id: currentOrganization.id,
          role: selectedRole as any,
        });

      if (roleError) throw roleError;

      toast.success("Team member added successfully");
      setDialogOpen(false);
      setSelectedUserId("");
      setSelectedRole("org_stakeholder");
      fetchTeamMembers();
    } catch (error: any) {
      console.error("Error adding team member:", error);
      toast.error(error.message || "Failed to add team member");
    } finally {
      setAdding(false);
    }
  };

  const handleResendInvite = async (member: TeamMember) => {
    setResendingFor(member.user_id);
    try {
      const { data, error } = await supabase.functions.invoke("manage-user", {
        body: {
          action: "resend_invite",
          user_id: member.user_id,
          redirect_to: `${window.location.origin}/auth`,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success(`Invite email resent to ${member.email}`);
    } catch (error: any) {
      console.error("Error resending invite:", error);
      toast.error(error.message || "Failed to resend invite");
    } finally {
      setResendingFor(null);
    }
  };

  const openStatusDialog = (member: TeamMember, action: "disable" | "enable") => {
    setStatusTarget(member);
    setStatusAction(action);
    setStatusReason(action === "disable" ? "" : member.disabled_reason ?? "");
  };

  const handleConfirmStatus = async () => {
    if (!statusTarget || !currentOrganization) return;
    setStatusBusy(true);
    try {
      const { error } = await supabase.rpc("set_org_member_disabled", {
        _org_id: currentOrganization.id,
        _user_id: statusTarget.user_id,
        _disable: statusAction === "disable",
        _reason: statusAction === "disable" ? (statusReason.trim() || null) : null,
      });
      if (error) throw error;
      toast.success(
        statusAction === "disable"
          ? `${statusTarget.full_name || statusTarget.email} has been disabled`
          : `${statusTarget.full_name || statusTarget.email} has been re-enabled`
      );
      setStatusTarget(null);
      setStatusReason("");
      fetchTeamMembers();
    } catch (e: any) {
      console.error("Status change error:", e);
      toast.error(e.message || "Failed to update member status");
    } finally {
      setStatusBusy(false);
    }
  };

  const toggleFilter = (value: string, filters: string[], setFilters: React.Dispatch<React.SetStateAction<string[]>>) => {
    setFilters(prev => 
      prev.includes(value) 
        ? prev.filter(s => s !== value)
        : [...prev, value]
    );
  };

  const clearFilters = () => {
    setRoleFilters([]);
    setDepartmentFilters([]);
  };

  const filteredMembers = teamMembers.filter((m) => {
    const matchesSearch = 
      m.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.department?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilters.length === 0 || roleFilters.includes(m.role);
    const matchesDept = departmentFilters.length === 0 || (m.department && departmentFilters.includes(m.department));
    return matchesSearch && matchesRole && matchesDept;
  });

  const activeFilterCount = roleFilters.length + departmentFilters.length;

  return (
    <AppLayout title="Team" subtitle="Manage programme team members">
      {/* Actions Bar */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search team members..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Filter className="h-4 w-4" />
                Filter
                {activeFilterCount > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs">
                    {activeFilterCount}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64" align="end">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-sm">Filters</h4>
                  {activeFilterCount > 0 && (
                    <Button variant="ghost" size="sm" onClick={clearFilters} className="h-auto p-0 text-xs text-muted-foreground">
                      Clear all
                    </Button>
                  )}
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Role</Label>
                  {Object.entries(roleConfig).map(([key, config]) => (
                    <div key={key} className="flex items-center space-x-2">
                      <Checkbox 
                        id={`role-${key}`} 
                        checked={roleFilters.includes(key)}
                        onCheckedChange={() => toggleFilter(key, roleFilters, setRoleFilters)}
                      />
                      <label htmlFor={`role-${key}`} className="text-sm cursor-pointer flex-1">
                        {config.label}
                      </label>
                    </div>
                  ))}
                </div>
                {departments.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Department</Label>
                    {departments.map((dept) => (
                      <div key={dept} className="flex items-center space-x-2">
                        <Checkbox 
                          id={`dept-${dept}`} 
                          checked={departmentFilters.includes(dept)}
                          onCheckedChange={() => toggleFilter(dept, departmentFilters, setDepartmentFilters)}
                        />
                        <label htmlFor={`dept-${dept}`} className="text-sm cursor-pointer flex-1">
                          {dept}
                        </label>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </PopoverContent>
          </Popover>
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (open) fetchAvailableUsers(); }}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Add Member
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Team Member</DialogTitle>
                <DialogDescription>
                  Add an existing user to this organization's team.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Select User</Label>
                  <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a user" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableUsers.length === 0 ? (
                        <SelectItem value="none" disabled>No available users</SelectItem>
                      ) : (
                        availableUsers.map((user) => (
                          <SelectItem key={user.user_id} value={user.user_id}>
                            {user.full_name || user.email}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Role in Organization</Label>
                  <Select value={selectedRole} onValueChange={setSelectedRole}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(roleConfig).map(([key, config]) => (
                        <SelectItem key={key} value={key}>{config.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleAddMember} disabled={!selectedUserId || adding}>
                  {adding ? "Adding..." : "Add Member"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Team Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">Loading team members...</p>
        </div>
      ) : filteredMembers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-muted-foreground mb-2">No team members found</p>
          <p className="text-sm text-muted-foreground">Add members to your organization to see them here</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredMembers.map((member, index) => {
            const isSelf = member.user_id === user?.id;
            return (
            <div
              key={member.id}
              className={cn(
                "metric-card animate-slide-up",
                member.is_disabled && "opacity-70 border-destructive/40"
              )}
              style={{ animationDelay: `${index * 0.03}s` }}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-lg font-medium text-primary">
                      {member.full_name?.split(' ').map(n => n[0]).join('') || member.email.substring(0, 2).toUpperCase()}
                    </div>
                  </div>
                  <div>
                    <p className="font-medium">{member.full_name || "Unnamed User"}</p>
                    <p className="text-sm text-muted-foreground">{member.department || "No department"}</p>
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => handleResendInvite(member)}
                      disabled={resendingFor === member.user_id}
                    >
                      {resendingFor === member.user_id ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4 mr-2" />
                      )}
                      Resend Invite
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {member.is_disabled ? (
                      <DropdownMenuItem onClick={() => openStatusDialog(member, "enable")}>
                        <ShieldCheck className="h-4 w-4 mr-2" />
                        Enable access
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem
                        onClick={() => openStatusDialog(member, "disable")}
                        disabled={isSelf}
                        className="text-destructive focus:text-destructive"
                      >
                        <ShieldOff className="h-4 w-4 mr-2" />
                        Disable access
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary" className={cn("text-xs", roleConfig[member.role]?.className || "")}>
                    {roleConfig[member.role]?.label || member.role}
                  </Badge>
                  {member.is_disabled && (
                    <Badge variant="outline" className="text-xs gap-1 border-destructive/40 text-destructive">
                      <ShieldOff className="h-3 w-3" />
                      Disabled
                    </Badge>
                  )}
                </div>

                {member.is_disabled && member.disabled_reason && (
                  <p className="text-xs text-muted-foreground italic line-clamp-2">
                    Reason: {member.disabled_reason}
                  </p>
                )}

                <div className="pt-3 border-t border-border">
                  <Button variant="ghost" size="sm" className="w-full gap-2 justify-start text-muted-foreground hover:text-foreground">
                    <Mail className="h-4 w-4" />
                    {member.email}
                  </Button>
                </div>
              </div>
            </div>
            );
          })}
        </div>
      )}

      {/* Disable / enable member dialog */}
      <Dialog open={!!statusTarget} onOpenChange={(open) => !open && setStatusTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {statusAction === "disable" ? "Disable member access" : "Re-enable member access"}
            </DialogTitle>
            <DialogDescription>
              {statusAction === "disable"
                ? `${statusTarget?.full_name || statusTarget?.email} will lose access to ${currentOrganization?.name ?? "this organization"}. They will keep access to any other organizations they belong to.`
                : `Restore access for ${statusTarget?.full_name || statusTarget?.email} to ${currentOrganization?.name ?? "this organization"}.`}
            </DialogDescription>
          </DialogHeader>
          {statusAction === "disable" && (
            <div className="space-y-2 py-2">
              <Label htmlFor="disable-reason">Reason (optional)</Label>
              <Textarea
                id="disable-reason"
                placeholder="e.g. Left the team, security concern, awaiting review…"
                value={statusReason}
                onChange={(e) => setStatusReason(e.target.value)}
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                Shown to the user on the access-blocked screen and recorded in the audit log.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusTarget(null)} disabled={statusBusy}>
              Cancel
            </Button>
            <Button
              onClick={handleConfirmStatus}
              disabled={statusBusy}
              variant={statusAction === "disable" ? "destructive" : "default"}
            >
              {statusBusy
                ? "Saving…"
                : statusAction === "disable"
                ? "Disable access"
                : "Enable access"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
