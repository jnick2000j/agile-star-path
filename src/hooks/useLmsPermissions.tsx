import { usePermissions } from "@/hooks/usePermissions";
import { useModuleToggles } from "@/hooks/useModuleToggles";

/**
 * Convenience accessor for LMS module permissions.
 * LMS is an optional add-on — all access is gated on the org-level `lms` module toggle.
 * - canLearn: any org member with the lms module enabled
 * - canAuthor: create/edit courses, modules, lessons, paths
 * - canAdmin: assign mandatory training, view team reporting
 */
export function useLmsPermissions() {
  const { can, isAdmin } = usePermissions();
  const { isEnabled, loading } = useModuleToggles();
  const lmsOn = isEnabled("lms");

  if (loading || !lmsOn) {
    return { canLearn: false, canAuthor: false, canAdmin: false, lmsEnabled: lmsOn, loading };
  }

  return {
    canLearn: isAdmin || can("lms", "view"),
    canAuthor: isAdmin || can("lms_authoring", "edit") || can("lms_authoring", "create"),
    canAdmin: isAdmin || can("lms_admin", "view"),
    lmsEnabled: true,
    loading: false,
  };
}
