// Determines whether the current user must complete an MFA challenge before
// being granted access to the app. Triggers on every fresh sign-in.
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

interface MFAGateState {
  loading: boolean;
  required: boolean;
  satisfied: boolean;
}

export function useMFAGate(): MFAGateState & { markSatisfied: () => void } {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [required, setRequired] = useState(false);
  // Verification is intentionally NOT persisted across reloads or tabs.
  // Persisting in sessionStorage/localStorage would let an attacker (or any user
  // via devtools) bypass the MFA challenge by setting a flag. The challenge
  // must be completed in-memory for every fresh page load.
  const [satisfied, setSatisfied] = useState(false);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      setRequired(false);
      return;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        // 1) Does the user have a verified factor?
        const { data: factors } = await supabase
          .from("user_mfa_factors")
          .select("id")
          .eq("user_id", user.id)
          .eq("verified", true)
          .limit(1);
        const hasFactor = (factors?.length ?? 0) > 0;

        // 2) Does any of the user's orgs require MFA?
        let policyRequires = false;
        const { data: access } = await supabase
          .from("user_organization_access")
          .select("organization_id, access_level")
          .eq("user_id", user.id);
        if (access && access.length) {
          const orgIds = access.map((a: any) => a.organization_id);
          const { data: policies } = await supabase
            .from("org_mfa_policies")
            .select("organization_id, enforcement_mode")
            .in("organization_id", orgIds);
          for (const p of policies ?? []) {
            const acc = access.find((a: any) => a.organization_id === p.organization_id);
            if (p.enforcement_mode === "required_all") policyRequires = true;
            if (
              p.enforcement_mode === "required_admins" &&
              acc?.access_level === "admin"
            )
              policyRequires = true;
          }
        }

        if (cancelled) return;
        setRequired(hasFactor || policyRequires);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  // Reset verification on sign-out
  useEffect(() => {
    if (!user) {
      sessionStorage.removeItem("mfa_verified"); // cleanup any legacy value
      setSatisfied(false);
    }
  }, [user]);

  return {
    loading,
    required,
    satisfied,
    markSatisfied: () => {
      setSatisfied(true);
    },
  };
}
