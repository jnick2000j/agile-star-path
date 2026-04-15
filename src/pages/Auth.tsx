import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Target, Mail, Lock, User, ArrowRight, Loader2, ArrowLeft } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { applyBrandingCssVars, DEFAULT_BRANDING } from "@/lib/branding";

interface GlobalBranding {
  logo_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  accent_color: string | null;
  font_family: string | null;
  app_name: string | null;
  app_tagline: string | null;
  logo_size: string | null;
  show_logo: boolean | null;
  header_font_size: string | null;
}

const logoSizeClasses: Record<string, string> = {
  small: "h-10 w-auto",
  medium: "h-14 w-auto",
  large: "h-20 w-auto",
  xlarge: "h-28 w-auto",
};

const defaultIconSizeClasses: Record<string, { wrapper: string; icon: string }> = {
  small: { wrapper: "h-10 w-10", icon: "h-5 w-5" },
  medium: { wrapper: "h-14 w-14", icon: "h-8 w-8" },
  large: { wrapper: "h-20 w-20", icon: "h-12 w-12" },
  xlarge: { wrapper: "h-28 w-28", icon: "h-16 w-16" },
};

const headerFontSizeClasses: Record<string, { title: string; tagline: string }> = {
  small: { title: "text-xl md:text-2xl", tagline: "text-xs" },
  medium: { title: "text-2xl md:text-3xl", tagline: "text-sm" },
  large: { title: "text-3xl md:text-4xl", tagline: "text-base" },
  xlarge: { title: "text-4xl md:text-5xl", tagline: "text-lg" },
};

const emailSchema = z.string().email("Please enter a valid email address");
const passwordSchema = z.string().min(6, "Password must be at least 6 characters");
const nameSchema = z.string().min(1, "Name is required");

type AuthMode = "login" | "signup" | "forgot-password";

export default function Auth() {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; firstName?: string; lastName?: string }>({});
  const [branding, setBranding] = useState<GlobalBranding | null>(null);
  
  const { signIn, signUp, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate("/");
    }
  }, [user, navigate]);

  useEffect(() => {
    const fetchGlobalBranding = async () => {
      const { data } = await supabase
        .from("branding_settings")
        .select("logo_url, primary_color, secondary_color, accent_color, font_family, app_name, app_tagline, logo_size, show_logo, header_font_size")
        .is("organization_id", null)
        .maybeSingle();
      
      if (data) {
        setBranding(data);

        // Apply branding CSS variables for the login page
        applyBrandingCssVars({
          primaryHex: data.primary_color ?? DEFAULT_BRANDING.primaryHex,
          secondaryHex: data.secondary_color ?? DEFAULT_BRANDING.secondaryHex,
          accentHex: data.accent_color ?? DEFAULT_BRANDING.accentHex,
        });

        // Update document title dynamically
        document.title = data.app_name
          ? `${data.app_name} – Sign In`
          : "Program Information Management Platform";
      }
    };
    fetchGlobalBranding();
  }, []);

  const validateForm = () => {
    const newErrors: { email?: string; password?: string; firstName?: string; lastName?: string } = {};
    
    try {
      emailSchema.parse(email);
    } catch (e) {
      if (e instanceof z.ZodError) {
        newErrors.email = e.errors[0].message;
      }
    }
    
    if (mode !== "forgot-password") {
      try {
        passwordSchema.parse(password);
      } catch (e) {
        if (e instanceof z.ZodError) {
          newErrors.password = e.errors[0].message;
        }
      }
    }
    
    if (mode === "signup") {
      try {
        nameSchema.parse(firstName);
      } catch (e) {
        if (e instanceof z.ZodError) {
          newErrors.firstName = e.errors[0].message;
        }
      }
      try {
        nameSchema.parse(lastName);
      } catch (e) {
        if (e instanceof z.ZodError) {
          newErrors.lastName = e.errors[0].message;
        }
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setLoading(true);
    
    if (mode === "login") {
      const { error } = await signIn(email, password);
      if (!error) {
        navigate("/");
      }
    } else if (mode === "signup") {
      const fullName = `${firstName} ${lastName}`.trim();
      const { error } = await signUp(email, password, fullName, firstName, lastName);
      if (!error) {
        setMode("login");
        setPassword("");
      }
    } else if (mode === "forgot-password") {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth`,
      });
      
      if (error) {
        toast.error(error.message);
      } else {
        toast.success("Password reset email sent. Check your inbox.");
        setMode("login");
      }
    }
    
    setLoading(false);
  };

  const getTitle = () => {
    switch (mode) {
      case "login": return "Sign In";
      case "signup": return "Create Account";
      case "forgot-password": return "Reset Password";
    }
  };

  const getButtonText = () => {
    switch (mode) {
      case "login": return "Sign In";
      case "signup": return "Create Account";
      case "forgot-password": return "Send Reset Link";
    }
  };

  return (
    <div 
      className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 flex items-center justify-center p-6 md:p-12"
      style={{ fontFamily: branding?.font_family || undefined }}
    >
      <div className="w-full max-w-lg">
        {/* Logo and Title */}
        <div className="text-center mb-12">
          {(branding?.show_logo !== false) && (
            <div className="flex items-center justify-center mb-8">
              {branding?.logo_url ? (
                <img 
                  src={branding.logo_url} 
                  alt="Logo" 
                  className={`${logoSizeClasses[branding?.logo_size || "medium"]} object-contain`}
                />
              ) : (
                <Target className={`${defaultIconSizeClasses[branding?.logo_size || "medium"].icon} text-primary`} />
              )}
            </div>
          )}
          <h1 className={`${headerFontSizeClasses[branding?.header_font_size || "medium"].title} font-bold text-foreground tracking-tight leading-tight`}>
            {branding?.app_name || "PIMP"}
          </h1>
          <p className={`${headerFontSizeClasses[branding?.header_font_size || "medium"].tagline} text-muted-foreground mt-3 max-w-md mx-auto leading-relaxed`}>
            {branding?.app_tagline || "Program Information Management Platform"}
          </p>
        </div>

        {/* Form Card */}
        <div className="bg-card border border-border rounded-2xl p-8 md:p-10 shadow-xl">
          <h2 className="text-xl font-semibold text-center mb-2">
            {getTitle()}
          </h2>
          <p className="text-sm text-muted-foreground text-center mb-8">
            {mode === "login" && "Welcome back! Please enter your details."}
            {mode === "signup" && "Create your account to get started."}
            {mode === "forgot-password" && "Enter your email address and we'll send you a reset link."}
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            {mode === "signup" && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="firstName"
                      type="text"
                      placeholder="John"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="pl-10 h-11"
                    />
                  </div>
                  {errors.firstName && <p className="text-sm text-destructive">{errors.firstName}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    type="text"
                    placeholder="Smith"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="h-11"
                  />
                  {errors.lastName && <p className="text-sm text-destructive">{errors.lastName}</p>}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 h-11"
                />
              </div>
              {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
            </div>

            {mode !== "forgot-password" && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  {mode === "login" && (
                    <button
                      type="button"
                      onClick={() => {
                        setMode("forgot-password");
                        setErrors({});
                      }}
                      className="text-sm text-primary hover:underline font-medium"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 h-11"
                  />
                </div>
                {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
              </div>
            )}

            <Button type="submit" className="w-full h-11 gap-2 text-base font-medium mt-2" disabled={loading}>
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  {getButtonText()}
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t border-border text-center">
            {mode === "forgot-password" ? (
              <button
                type="button"
                onClick={() => {
                  setMode("login");
                  setErrors({});
                }}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5 mx-auto font-medium"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to sign in
              </button>
            ) : (
              <p className="text-sm text-muted-foreground">
                {mode === "login" ? "Don't have an account? " : "Already have an account? "}
                <button
                  type="button"
                  onClick={() => {
                    setMode(mode === "login" ? "signup" : "login");
                    setErrors({});
                  }}
                  className="text-primary hover:underline font-medium"
                >
                  {mode === "login" ? "Sign up" : "Sign in"}
                </button>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
