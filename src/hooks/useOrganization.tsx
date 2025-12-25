import { useState, useEffect, createContext, useContext, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

interface Organization {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  primary_color: string | null;
}

interface OrganizationContextType {
  organizations: Organization[];
  currentOrganization: Organization | null;
  setCurrentOrganization: (org: Organization | null) => void;
  loading: boolean;
  refreshOrganizations: () => Promise<void>;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [currentOrganization, setCurrentOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchOrganizations = async () => {
    if (!user) {
      setOrganizations([]);
      setCurrentOrganization(null);
      setLoading(false);
      return;
    }

    try {
      // Get organizations the user has access to
      const { data: accessData, error: accessError } = await supabase
        .from("user_organization_access")
        .select("organization_id")
        .eq("user_id", user.id);

      if (accessError) throw accessError;

      const orgIds = accessData?.map((a) => a.organization_id) || [];

      if (orgIds.length > 0) {
        const { data: orgs, error: orgsError } = await supabase
          .from("organizations")
          .select("id, name, slug, logo_url, primary_color")
          .in("id", orgIds)
          .order("name");

        if (orgsError) throw orgsError;
        setOrganizations(orgs || []);

        // Check localStorage for previously selected org
        const savedOrgId = localStorage.getItem("currentOrganizationId");
        const savedOrg = orgs?.find((o) => o.id === savedOrgId);
        
        if (savedOrg) {
          setCurrentOrganization(savedOrg);
        } else if (orgs && orgs.length > 0) {
          setCurrentOrganization(orgs[0]);
          localStorage.setItem("currentOrganizationId", orgs[0].id);
        }
      } else {
        // Check if user is admin - admins can see all organizations
        const { data: roleData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .eq("role", "admin")
          .maybeSingle();

        if (roleData) {
          const { data: allOrgs, error: allOrgsError } = await supabase
            .from("organizations")
            .select("id, name, slug, logo_url, primary_color")
            .order("name");

          if (!allOrgsError && allOrgs) {
            setOrganizations(allOrgs);
            if (allOrgs.length > 0) {
              const savedOrgId = localStorage.getItem("currentOrganizationId");
              const savedOrg = allOrgs.find((o) => o.id === savedOrgId);
              setCurrentOrganization(savedOrg || allOrgs[0]);
              localStorage.setItem("currentOrganizationId", (savedOrg || allOrgs[0]).id);
            }
          }
        }
      }
    } catch (error) {
      console.error("Error fetching organizations:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrganizations();
  }, [user]);

  const handleSetCurrentOrganization = (org: Organization | null) => {
    setCurrentOrganization(org);
    if (org) {
      localStorage.setItem("currentOrganizationId", org.id);
    } else {
      localStorage.removeItem("currentOrganizationId");
    }
  };

  return (
    <OrganizationContext.Provider
      value={{
        organizations,
        currentOrganization,
        setCurrentOrganization: handleSetCurrentOrganization,
        loading,
        refreshOrganizations: fetchOrganizations,
      }}
    >
      {children}
    </OrganizationContext.Provider>
  );
}

export function useOrganization() {
  const context = useContext(OrganizationContext);
  if (context === undefined) {
    throw new Error("useOrganization must be used within an OrganizationProvider");
  }
  return context;
}