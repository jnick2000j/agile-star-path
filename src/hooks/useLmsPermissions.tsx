import { usePermissions } from "@/hooks/usePermissions";

/**
 * Convenience accessor for LMS module permissions.
 * - canLearn: any org member with the lms module enabled
 * - canAuthor: create/edit courses, modules, lessons, paths
 * - canAdmin: assign mandatory training, view team reporting
 */
export function useLmsPermissions() {
  const { can, isAdmin } = usePermissions();
  const canLearn = isAdmin || can("lms", "view");
  const canAuthor = isAdmin || can("lms_authoring", "edit") || can("lms_authoring", "create");
  const canAdmin = isAdmin || can("lms_admin", "view");
  return { canLearn, canAuthor, canAdmin };
}
