import { ReactNode, useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRoles?: string[];
}

export function ProtectedRoute({ children, requiredRoles }: ProtectedRouteProps) {
  const { user, loading, userRole } = useAuth();
  const location = useLocation();
  const [orgCheck, setOrgCheck] = useState<"checking" | "has" | "none">("checking");

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

  return <>{children}</>;
}
