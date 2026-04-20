import { ReactNode } from "react";
import { usePermissions } from "@/hooks/usePermissions";
import type { PermissionAction } from "@/lib/permissions";

interface PermissionGateProps {
  module: string;
  action?: PermissionAction;
  fallback?: ReactNode;
  children: ReactNode;
}

/**
 * Conditionally renders children if the current user has the required
 * action permission on the given module.
 *
 * Example:
 *   <PermissionGate module="risks" action="create">
 *     <Button>New Risk</Button>
 *   </PermissionGate>
 */
export function PermissionGate({ module, action = "view", fallback = null, children }: PermissionGateProps) {
  const { can, loading } = usePermissions();
  if (loading) return null;
  if (!can(module, action)) return <>{fallback}</>;
  return <>{children}</>;
}
