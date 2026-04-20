// Phase 1 — Granular RBAC types & helpers
export type PermissionAction = "view" | "create" | "edit" | "delete" | "approve" | "export";

export const PERMISSION_ACTIONS: PermissionAction[] = [
  "view",
  "create",
  "edit",
  "delete",
  "approve",
  "export",
];

export interface PermissionModule {
  module_key: string;
  label: string;
  category: string;
  description: string | null;
  sort_order: number;
}

export interface RoleModulePermission {
  id: string;
  role_id: string;
  module_key: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
  can_approve: boolean;
  can_export: boolean;
}

export const actionToColumn = (action: PermissionAction): keyof RoleModulePermission =>
  `can_${action}` as keyof RoleModulePermission;
