import { usePermissions } from "@/hooks/usePermissions";
import { useModuleToggles } from "@/hooks/useModuleToggles";
import { useAuth } from "@/hooks/useAuth";

/**
 * Convenience accessor for LMS module permissions.
 * LMS is an optional add-on — all access is gated on the org-level `lms` module toggle.
 * - canLearn: any org member with the lms module enabled
 * - canAuthor: create/edit courses, modules, lessons, paths
 * - canAdmin: assign mandatory training, view team reporting
 *
 * Platform Admins and Org Admins always have full LMS rights when the
 * module is enabled for the org.
 */
export function useLmsPermissions() {
  const { can, isAdmin } = usePermissions();
  const { isEnabled, loading } = useModuleToggles();
  const { userRole } = useAuth();
  const lmsOn = isEnabled("lms");
  const isOrgAdmin = userRole === "org_admin";
  const fullRights = isAdmin || isOrgAdmin;

  if (loading || !lmsOn) {
    return { canLearn: false, canAuthor: false, canAdmin: false, lmsEnabled: lmsOn, loading };
  }

  return {
    canLearn: fullRights || can("lms", "view"),
    canAuthor: fullRights || can("lms_authoring", "edit") || can("lms_authoring", "create"),
    canAdmin: fullRights || can("lms_admin", "view"),
    lmsEnabled: true,
    loading: false,
  };
}
