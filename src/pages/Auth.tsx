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
  welcome_message: string | null;
}

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
        .select("logo_url, primary_color, secondary_color, accent_color, font_family, app_name, app_tagline, welcome_message")
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
          : "Programme Information Management Platform";
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
    <div className="min-h-screen bg-background" style={{ fontFamily: branding?.font_family || undefined }}>
      <div className="min-h-screen grid lg:grid-cols-2">
        {/* Brand panel */}
        <aside className="hidden lg:flex flex-col justify-between p-10 bg-gradient-to-br from-primary/12 via-background to-background border-r border-border">
          <header className="flex items-center gap-3">
            {branding?.logo_url ? (
              <img
                src={branding.logo_url}
                alt={`${branding?.app_name || "Application"} logo`}
                className="h-10 w-auto object-contain"
                loading="eager"
              />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                <Target className="h-5 w-5" />
              </div>
            )}
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{branding?.app_name || "PIMP"}</p>
              <p className="text-xs text-muted-foreground truncate">
                {branding?.app_tagline || "Programme Information Management Platform"}
              </p>
            </div>
          </header>

          <section className="space-y-4">
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">
              {branding?.welcome_message || "Welcome back"}
            </h1>
            <p className="text-sm text-muted-foreground max-w-md">
              Secure access to programmes, projects, products and PRINCE2 controls—fully branded for your organization.
            </p>
            <div className="grid grid-cols-2 gap-3 max-w-md">
              <div className="glass-card rounded-xl p-4">
                <p className="text-xs text-muted-foreground">Multi-tenant</p>
                <p className="text-sm font-medium text-foreground">Organization data isolation</p>
              </div>
              <div className="glass-card rounded-xl p-4">
                <p className="text-xs text-muted-foreground">Governance</p>
                <p className="text-sm font-medium text-foreground">PRINCE2 registers & reporting</p>
              </div>
            </div>
          </section>

          <footer className="text-xs text-muted-foreground">
            Use your company email to sign in.
          </footer>
        </aside>

        {/* Form panel */}
        <main className="flex items-center justify-center p-6 lg:p-10">
          <div className="w-full max-w-md">
            {/* Mobile header */}
            <div className="lg:hidden text-center mb-8">
              <div className="flex items-center justify-center gap-3 mb-4">
                {branding?.logo_url ? (
                  <img
                    src={branding.logo_url}
                    alt={`${branding?.app_name || "Application"} logo`}
                    className="h-12 w-auto object-contain"
                    loading="eager"
                  />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                    <Target className="h-6 w-6" />
                  </div>
                )}
              </div>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">{branding?.app_name || "PIMP"}</h1>
              <p className="text-sm text-muted-foreground">
                {branding?.app_tagline || "Programme Information Management Platform"}
              </p>
            </div>

            <div className="glass-card rounded-2xl p-6 md:p-8">
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-foreground">{getTitle()}</h2>
                {mode === "forgot-password" && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Enter your email address and we’ll send a reset link.
                  </p>
                )}
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {mode === "signup" && (
                  <div className="grid grid-cols-2 gap-3">
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
                          className="pl-9"
                        />
                      </div>
                      {errors.firstName && <p className="text-sm text-destructive">{errors.firstName}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName">Last Name</Label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id="lastName"
                          type="text"
                          placeholder="Smith"
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                          className="pl-9"
                        />
                      </div>
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
                      className="pl-9"
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
                          className="text-xs text-primary hover:underline"
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
                        className="pl-9"
                      />
                    </div>
                    {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
                  </div>
                )}

                <Button type="submit" className="w-full gap-2" disabled={loading}>
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      {getButtonText()}
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </form>

              <div className="mt-5 text-center">
                {mode === "forgot-password" ? (
                  <button
                    type="button"
                    onClick={() => {
                      setMode("login");
                      setErrors({});
                    }}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
                  >
                    <ArrowLeft className="h-3 w-3" />
                    Back to sign in
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setMode(mode === "login" ? "signup" : "login");
                      setErrors({});
                    }}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {mode === "login" ? "Don’t have an account? Sign up" : "Already have an account? Sign in"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
