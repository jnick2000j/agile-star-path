import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Building2, Layers, FolderKanban, Users } from "lucide-react";
import { useOrganization } from "@/hooks/useOrganization";

interface OrgStats {
  totalOrganizations: number;
  totalPrograms: number;
  totalProjects: number;
  totalUsersWithAccess: number;
  orgBreakdown: {
    id: string;
    name: string;
    programmeCount: number;
    projectCount: number;
    userCount: number;
  }[];
}

export function OrganizationStats() {
  const [stats, setStats] = useState<OrgStats | null>(null);
  const [loading, setLoading] = useState(true);
  const { currentOrganization } = useOrganization();

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      try {
        const [orgsRes, progsRes, projsRes, accessRes] = await Promise.all([
          supabase.from("organizations").select("id, name"),
          supabase.from("programmes").select("id, organization_id"),
          supabase.from("projects").select("id, organization_id"),
          supabase.from("user_organization_access").select("id, organization_id, user_id"),
        ]);

        const orgs = orgsRes.data || [];
        const progs = progsRes.data || [];
        const projs = projsRes.data || [];
        const access = accessRes.data || [];

        const orgBreakdown = orgs.map((org) => ({
          id: org.id,
          name: org.name,
          programmeCount: progs.filter((p) => p.organization_id === org.id).length,
          projectCount: projs.filter((p) => p.organization_id === org.id).length,
          userCount: new Set(access.filter((a) => a.organization_id === org.id).map((a) => a.user_id)).size,
        }));

        setStats({
          totalOrganizations: orgs.length,
          totalPrograms: progs.length,
          totalProjects: projs.length,
          totalUsersWithAccess: new Set(access.map((a) => a.user_id)).size,
          orgBreakdown,
        });
      } catch (error) {
        console.error("Error fetching org stats:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="metric-card">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" />
          Organization Overview
        </h3>
        <div className="text-center py-8 text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!stats || stats.totalOrganizations === 0) {
    return (
      <div className="metric-card">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" />
          Organization Overview
        </h3>
        <div className="text-center py-8 text-muted-foreground">
          No organizations configured yet. Go to Admin Panel to create one.
        </div>
      </div>
    );
  }

  return (
    <div className="metric-card">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <Building2 className="h-5 w-5 text-primary" />
        Organization Overview
      </h3>

      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="text-center p-3 rounded-lg bg-primary/10">
          <Building2 className="h-5 w-5 mx-auto mb-1 text-primary" />
          <p className="text-2xl font-bold">{stats.totalOrganizations}</p>
          <p className="text-xs text-muted-foreground">Organizations</p>
        </div>
        <div className="text-center p-3 rounded-lg bg-info/10">
          <Layers className="h-5 w-5 mx-auto mb-1 text-info" />
          <p className="text-2xl font-bold">{stats.totalPrograms}</p>
          <p className="text-xs text-muted-foreground">Programs</p>
        </div>
        <div className="text-center p-3 rounded-lg bg-success/10">
          <FolderKanban className="h-5 w-5 mx-auto mb-1 text-success" />
          <p className="text-2xl font-bold">{stats.totalProjects}</p>
          <p className="text-xs text-muted-foreground">Projects</p>
        </div>
        <div className="text-center p-3 rounded-lg bg-warning/10">
          <Users className="h-5 w-5 mx-auto mb-1 text-warning" />
          <p className="text-2xl font-bold">{stats.totalUsersWithAccess}</p>
          <p className="text-xs text-muted-foreground">Users</p>
        </div>
      </div>

      {/* Organization Breakdown */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-muted-foreground">By Organization</h4>
        {stats.orgBreakdown.map((org) => (
          <div
            key={org.id}
            className={`flex items-center justify-between p-3 rounded-lg border ${
              currentOrganization?.id === org.id ? "border-primary bg-primary/5" : "border-border"
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Building2 className="h-4 w-4 text-primary" />
              </div>
              <span className="font-medium">{org.name}</span>
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Layers className="h-3 w-3" />
                {org.programmeCount}
              </span>
              <span className="flex items-center gap-1">
                <FolderKanban className="h-3 w-3" />
                {org.projectCount}
              </span>
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                {org.userCount}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
