import { useState, useEffect, createContext, useContext, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getSiteUrl, DEFAULT_SITE_URL } from "@/lib/site-url";

/**
 * @deprecated Prefer `getSiteUrl()` from `@/lib/site-url`, which reads the
 * configurable platform setting. This constant remains as a static fallback.
 */
export const APP_URL = DEFAULT_SITE_URL;

interface UserProfile {
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
}

interface OtpRequestOptions {
  firstName?: string;
  lastName?: string;
  fullName?: string;
  orgName?: string;
  shouldCreateUser?: boolean;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  roleLoading: boolean;
  /** Send a 6-digit one-time code to the user's email. */
  requestEmailOtp: (email: string, options?: OtpRequestOptions) => Promise<{ error: Error | null }>;
  /** Verify the 6-digit code the user received by email. */
  verifyEmailOtp: (email: string, token: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  userRole: string | null;
  userProfile: UserProfile | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [roleLoading, setRoleLoading] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log("Auth state changed:", event, session?.user?.email);
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          setRoleLoading(true);
          setTimeout(() => {
            fetchUserRole(session.user.id);
          }, 0);
        } else {
          setUserRole(null);
          setUserProfile(null);
          setRoleLoading(false);
        }
      }
    );

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        setRoleLoading(true);
        await fetchUserRole(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserRole = async (userId: string) => {
    try {
      const [{ data: platformRoles, error: platformRoleError }, { data, error }] = await Promise.all([
        supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", userId)
          .eq("role", "admin"),
        supabase
          .from("profiles")
          .select("role, first_name, last_name, full_name")
          .eq("user_id", userId)
          .single(),
      ]);

      if (platformRoleError) console.error("Error fetching platform role:", platformRoleError);
      if (error) console.error("Error fetching user role:", error);

      setUserRole((platformRoles?.length ?? 0) > 0 ? "admin" : data?.role || "org_stakeholder");
      setUserProfile({
        first_name: data?.first_name || null,
        last_name: data?.last_name || null,
        full_name: data?.full_name || null,
      });
    } catch (error) {
      console.error("Error fetching user role:", error);
      setUserRole("org_stakeholder");
    } finally {
      setRoleLoading(false);
    }
  };

  const requestEmailOtp = async (email: string, options: OtpRequestOptions = {}) => {
    try {
      const { firstName, lastName, fullName, orgName, shouldCreateUser = true } = options;
      const siteUrl = await getSiteUrl();

      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser,
          emailRedirectTo: siteUrl,
          // user_metadata is only applied on first creation
          data: {
            full_name: fullName || `${firstName ?? ""} ${lastName ?? ""}`.trim() || undefined,
            first_name: firstName || undefined,
            last_name: lastName || undefined,
            org_name: orgName || undefined,
          },
        },
      });

      if (error) {
        const msg = error.message.toLowerCase();
        if (msg.includes("signups not allowed")) {
          toast.error("This email isn't registered yet. Please sign up first.");
        } else if (msg.includes("rate limit") || msg.includes("for security purposes")) {
          toast.error("Too many requests. Please wait a minute before trying again.");
        } else {
          toast.error(error.message);
        }
        return { error };
      }

      toast.success("We emailed you a verification code. Enter it below to continue.");
      return { error: null };
    } catch (error) {
      const err = error as Error;
      toast.error(err.message);
      return { error: err };
    }
  };

  const verifyEmailOtp = async (email: string, token: string) => {
    try {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: token.trim(),
        type: "email",
      });

      if (error) {
        toast.error(error.message || "Invalid or expired code. Try again.");
        return { error };
      }

      toast.success("You're signed in.");
      return { error: null };
    } catch (error) {
      const err = error as Error;
      toast.error(err.message);
      return { error: err };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    toast.info("You have been signed out.");
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        roleLoading,
        requestEmailOtp,
        verifyEmailOtp,
        signOut,
        userRole,
        userProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
