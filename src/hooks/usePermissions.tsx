import { useState, useEffect, createContext, useContext, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface CustomRole {
  id: string;
  name: string;
  can_manage_programmes: boolean;
  can_manage_projects: boolean;
  can_manage_products: boolean;
  can_manage_users: boolean;
  can_view_reports: boolean;
  can_manage_risks: boolean;
  can_manage_issues: boolean;
  can_manage_benefits: boolean;
  can_manage_stakeholders: boolean;
  can_manage_requirements: boolean;
  can_manage_milestones: boolean;
  can_manage_stage_gates: boolean;
  can_manage_change_requests: boolean;
  can_manage_exceptions: boolean;
  can_manage_quality: boolean;
  can_manage_work_packages: boolean;
  can_manage_tranches: boolean;
  can_manage_lessons: boolean;
}

interface PermissionsContextType {
  permissions: CustomRole | null;
  loading: boolean;
  isAdmin: boolean;
  canManage: (entity: string) => boolean;
  canDelete: (entity: string) => boolean;
  refetch: () => Promise<void>;
}

const PermissionsContext = createContext<PermissionsContextType | undefined>(undefined);

export function PermissionsProvider({ children }: { children: ReactNode }) {
  const { user, userRole } = useAuth();
  const [permissions, setPermissions] = useState<CustomRole | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchPermissions = async () => {
    if (!userRole) {
      setPermissions(null);
      setLoading(false);
      return;
    }

    try {
      // Fetch the custom role based on the user's role name
      const { data, error } = await supabase
        .from("custom_roles")
        .select("*")
        .eq("name", userRole)
        .maybeSingle();

      if (error) {
        console.error("Error fetching permissions:", error);
        setPermissions(null);
      } else if (data) {
        setPermissions(data as CustomRole);
      } else {
        // If no custom role found, set default permissions based on role
        setPermissions(getDefaultPermissions(userRole));
      }
    } catch (error) {
      console.error("Error fetching permissions:", error);
      setPermissions(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPermissions();
  }, [userRole]);

  const getDefaultPermissions = (role: string): CustomRole => {
    const isAdmin = role === "admin";
    const isManager = role === "manager" || role === "programme_manager" || role === "project_manager";
    const isProductManager = role === "product_manager";
    const isProductTeam = role === "product_team_member";
    const isProjectTeam = role === "project_team_member";
    const isStakeholder = role === "org_stakeholder" || role === "programme_stakeholder" || role === "project_stakeholder" || role === "product_stakeholder";
    
    return {
      id: "",
      name: role,
      can_manage_programmes: isAdmin || isManager,
      can_manage_projects: isAdmin || isManager || isProjectTeam,
      can_manage_products: isAdmin || isManager || isProductManager || isProductTeam,
      can_manage_users: isAdmin,
      can_view_reports: isAdmin || isManager || isProductManager || isStakeholder,
      can_manage_risks: isAdmin || isManager || isProductManager,
      can_manage_issues: isAdmin || isManager || isProductManager,
      can_manage_benefits: isAdmin || isManager || isProductManager,
      can_manage_stakeholders: isAdmin || isManager || isProductManager,
      can_manage_requirements: isAdmin || isManager || isProductManager,
      can_manage_milestones: isAdmin || isManager || isProductManager,
      can_manage_stage_gates: isAdmin || isManager,
      can_manage_change_requests: isAdmin || isManager || isProductManager,
      can_manage_exceptions: isAdmin || isManager,
      can_manage_quality: isAdmin || isManager || isProductManager,
      can_manage_work_packages: isAdmin || isManager,
      can_manage_tranches: isAdmin || isManager,
      can_manage_lessons: isAdmin || isManager || isProductManager,
    };
  };

  const isAdmin = userRole === "admin";

  const canManage = (entity: string): boolean => {
    if (isAdmin) return true;
    if (!permissions) return false;

    const entityPermissionMap: Record<string, keyof CustomRole> = {
      programmes: "can_manage_programmes",
      projects: "can_manage_projects",
      products: "can_manage_products",
      users: "can_manage_users",
      risks: "can_manage_risks",
      issues: "can_manage_issues",
      benefits: "can_manage_benefits",
      stakeholders: "can_manage_stakeholders",
      requirements: "can_manage_requirements",
      milestones: "can_manage_milestones",
      stage_gates: "can_manage_stage_gates",
      change_requests: "can_manage_change_requests",
      exceptions: "can_manage_exceptions",
      quality: "can_manage_quality",
      work_packages: "can_manage_work_packages",
      tranches: "can_manage_tranches",
      lessons: "can_manage_lessons",
    };

    const permissionKey = entityPermissionMap[entity];
    if (!permissionKey) return false;

    return Boolean(permissions[permissionKey]);
  };

  const canDelete = (entity: string): boolean => {
    // Only admins can delete entities
    if (isAdmin) return true;
    // For specific entities, allow owners to delete (handled at component level)
    return false;
  };

  return (
    <PermissionsContext.Provider value={{ 
      permissions, 
      loading, 
      isAdmin, 
      canManage, 
      canDelete,
      refetch: fetchPermissions 
    }}>
      {children}
    </PermissionsContext.Provider>
  );
}

export function usePermissions() {
  const context = useContext(PermissionsContext);
  if (context === undefined) {
    throw new Error("usePermissions must be used within a PermissionsProvider");
  }
  return context;
}
