import { useState, useEffect, createContext, useContext, ReactNode, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { PermissionAction, RoleModulePermission } from "@/lib/permissions";
import { actionToColumn } from "@/lib/permissions";

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
  can_draft_with_ai?: boolean;
  can_approve_ai_output?: boolean;
  can_view_ai_advisor?: boolean;
  can_manage_translations?: boolean;
  can_manage_regions?: boolean;
}

interface PermissionsContextType {
  permissions: CustomRole | null;
  modulePermissions: RoleModulePermission[];
  loading: boolean;
  isAdmin: boolean;
  canManage: (entity: string) => boolean;
  canDelete: (entity: string) => boolean;
  /** Granular check: can the user perform `action` on `module`? */
  can: (module: string, action?: PermissionAction) => boolean;
  refetch: () => Promise<void>;
}

const PermissionsContext = createContext<PermissionsContextType | undefined>(undefined);

// Map legacy "manage" entity keys → new module_keys
const legacyEntityToModule: Record<string, string> = {
  programmes: "programmes",
  projects: "projects",
  products: "products",
  users: "users",
  risks: "risks",
  issues: "issues",
  benefits: "benefits",
  stakeholders: "stakeholders",
  requirements: "requirements",
  milestones: "milestones",
  stage_gates: "stage_gates",
  change_requests: "change_requests",
  exceptions: "exceptions",
  quality: "quality",
  work_packages: "work_packages",
  tranches: "tranches",
  lessons: "lessons",
};

export function PermissionsProvider({ children }: { children: ReactNode }) {
  const { user, userRole } = useAuth();
  const [permissions, setPermissions] = useState<CustomRole | null>(null);
  const [modulePermissions, setModulePermissions] = useState<RoleModulePermission[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPermissions = useCallback(async () => {
    if (!userRole) {
      setPermissions(null);
      setModulePermissions([]);
      setLoading(false);
      return;
    }

    try {
      // Fetch the custom role row
      const { data: roleRow, error: roleErr } = await supabase
        .from("custom_roles")
        .select("*")
        .eq("name", userRole)
        .maybeSingle();

      if (roleErr) {
        console.error("Error fetching custom role:", roleErr);
      }

      const role = (roleRow as CustomRole | null) ?? getDefaultPermissions(userRole);
      setPermissions(role);

      // Fetch granular module permissions if we have a role id
      if (roleRow?.id) {
        const { data: modPerms, error: modErr } = await supabase
          .from("role_module_permissions")
          .select("*")
          .eq("role_id", roleRow.id);

        if (modErr) {
          console.error("Error fetching module permissions:", modErr);
          setModulePermissions([]);
        } else {
          setModulePermissions((modPerms ?? []) as RoleModulePermission[]);
        }
      } else {
        setModulePermissions([]);
      }
    } catch (error) {
      console.error("Error fetching permissions:", error);
      setPermissions(null);
      setModulePermissions([]);
    } finally {
      setLoading(false);
    }
  }, [userRole]);

  useEffect(() => {
    fetchPermissions();
  }, [fetchPermissions]);

  const getDefaultPermissions = (role: string): CustomRole => {
    const isAdminR = role === "admin";
    const isManager = role === "manager" || role === "programme_manager" || role === "project_manager";
    const isProductManager = role === "product_manager";
    const isProductTeam = role === "product_team_member";
    const isProjectTeam = role === "project_team_member";
    const isStakeholder =
      role === "org_stakeholder" ||
      role === "programme_stakeholder" ||
      role === "project_stakeholder" ||
      role === "product_stakeholder";

    return {
      id: "",
      name: role,
      can_manage_programmes: isAdminR || isManager,
      can_manage_projects: isAdminR || isManager || isProjectTeam,
      can_manage_products: isAdminR || isManager || isProductManager || isProductTeam,
      can_manage_users: isAdminR,
      can_view_reports: isAdminR || isManager || isProductManager || isStakeholder,
      can_manage_risks: isAdminR || isManager || isProductManager,
      can_manage_issues: isAdminR || isManager || isProductManager,
      can_manage_benefits: isAdminR || isManager || isProductManager,
      can_manage_stakeholders: isAdminR || isManager || isProductManager,
      can_manage_requirements: isAdminR || isManager || isProductManager,
      can_manage_milestones: isAdminR || isManager || isProductManager,
      can_manage_stage_gates: isAdminR || isManager,
      can_manage_change_requests: isAdminR || isManager || isProductManager,
      can_manage_exceptions: isAdminR || isManager,
      can_manage_quality: isAdminR || isManager || isProductManager,
      can_manage_work_packages: isAdminR || isManager,
      can_manage_tranches: isAdminR || isManager,
      can_manage_lessons: isAdminR || isManager || isProductManager,
      can_draft_with_ai: isAdminR || isManager || isProductManager,
      can_approve_ai_output: isAdminR || isManager,
      can_view_ai_advisor: isAdminR || isManager || isProductManager,
      can_manage_translations: isAdminR,
      can_manage_regions: isAdminR,
    };
  };

  const isAdmin = userRole === "admin";

  const canManage = (entity: string): boolean => {
    if (isAdmin) return true;
    if (!permissions) return false;

    const map: Record<string, keyof CustomRole> = {
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

    const key = map[entity];
    if (!key) return false;
    return Boolean(permissions[key]);
  };

  const canDelete = (entity: string): boolean => {
    if (isAdmin) return true;
    return can(entity, "delete");
  };

  const can = (module: string, action: PermissionAction = "view"): boolean => {
    if (isAdmin) return true;
    const moduleKey = legacyEntityToModule[module] ?? module;
    const row = modulePermissions.find((p) => p.module_key === moduleKey);
    if (row) {
      return Boolean(row[actionToColumn(action)]);
    }
    // Fallback to legacy boolean for view/create/edit
    if (action === "view" || action === "create" || action === "edit") {
      return canManage(module);
    }
    return false;
  };

  return (
    <PermissionsContext.Provider
      value={{
        permissions,
        modulePermissions,
        loading,
        isAdmin,
        canManage,
        canDelete,
        can,
        refetch: fetchPermissions,
      }}
    >
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
