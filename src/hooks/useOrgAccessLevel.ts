import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useOrganization } from "./useOrganization";

export type OrgAccessLevel = "admin" | "manager" | "editor" | "viewer" | null;

export function useOrgAccessLevel() {
  const { user, userRole } = useAuth();
  const { currentOrganization } = useOrganization();
  const [accessLevel, setAccessLevel] = useState<OrgAccessLevel>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      if (!user || !currentOrganization) {
        setAccessLevel(null);
        setLoading(false);
        return;
      }

      // Platform admins always get full access
      if (userRole === "admin") {
        setAccessLevel("admin");
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from("user_organization_access")
        .select("access_level")
        .eq("user_id", user.id)
        .eq("organization_id", currentOrganization.id)
        .maybeSingle();

      setAccessLevel((data?.access_level as OrgAccessLevel) || null);
      setLoading(false);
    };

    fetch();
  }, [user, currentOrganization, userRole]);

  // admin/manager see everything; editor/viewer need explicit assignments
  const hasFullOrgAccess = accessLevel === "admin" || accessLevel === "manager";

  return { accessLevel, hasFullOrgAccess, loading };
}
