import { ReactNode, useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { useMFAGate } from "@/hooks/useMFAGate";
import { MFAChallengeDialog } from "@/components/security/MFAChallengeDialog";
import { SuspendedOrgBlock } from "@/components/SuspendedOrgBlock";

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRoles?: string[];
}

// Routes that remain accessible even when the current org is suspended.
// Platform admins still need to manage suspensions, billing, and support.
const SUSPENSION_ALLOWED_PATHS = [
  "/platform-admin",
  "/billing",
  "/support",
  "/profile",
  "/onboarding",
  "/accept-invite",
];

export function ProtectedRoute({ children, requiredRoles }: ProtectedRouteProps) {
  const { user, loading, userRole } = useAuth();
  const { currentOrganization } = useOrganization();
  const location = useLocation();
  const [orgCheck, setOrgCheck] = useState<"checking" | "has" | "none">("checking");
  const mfa = useMFAGate();

  useEffect(() => {
    if (!user) {
      setOrgCheck("checking");
      return;
    }
    supabase
      .from("user_organization_access")
      .select("organization_id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .then(({ count }) => {
        setOrgCheck((count || 0) > 0 ? "has" : "none");
      });
  }, [user]);

  if (loading || (user && orgCheck === "checking")) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Send users without an org to onboarding (except when they're already there)
  if (orgCheck === "none" && location.pathname !== "/onboarding" && location.pathname !== "/accept-invite") {
    return <Navigate to="/onboarding" replace />;
  }

  if (requiredRoles && requiredRoles.length > 0 && userRole) {
    if (!requiredRoles.includes(userRole)) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-foreground mb-2">Access Denied</h1>
            <p className="text-muted-foreground">
              You don't have permission to access this page.
            </p>
          </div>
        </div>
      );
    }
  }

  // MFA gate — challenge before granting access if user has TOTP or org policy requires it.
  if (mfa.required && !mfa.satisfied) {
    return (
      <>
        <div className="min-h-screen flex items-center justify-center bg-background">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
        <MFAChallengeDialog
          open
          onVerified={mfa.markSatisfied}
          onCancel={() => { /* signOut handled inside */ }}
        />
      </>
    );
  }

  // Suspension gate — block access if the current organization is suspended.
  // Platform admins can still reach platform-admin / billing / support / profile to resolve.
  if (currentOrganization?.is_suspended) {
    const isAllowedPath = SUSPENSION_ALLOWED_PATHS.some((p) =>
      location.pathname === p || location.pathname.startsWith(`${p}/`)
    );
    if (!isAllowedPath) {
      return (
        <SuspendedOrgBlock
          reason={currentOrganization.suspended_reason}
          kind={currentOrganization.suspension_kind}
        />
      );
    }
  }

  return <>{children}</>;
}
