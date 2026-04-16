import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, Lock, User, ArrowRight, Loader2, ArrowLeft, Shield, BarChart3, Users, Layers, Building2 } from "lucide-react";
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
  hero_title: string | null;
  hero_description: string | null;
  feature_1_label: string | null;
  feature_1_text: string | null;
  feature_2_label: string | null;
  feature_2_text: string | null;
  login_footer_text: string | null;
  welcome_message: string | null;
}

const logoSizeClasses: Record<string, string> = {
  small: "h-8 w-auto",
  medium: "h-10 w-auto",
  large: "h-14 w-auto",
  xlarge: "h-20 w-auto",
};

const emailSchema = z.string().email("Please enter a valid email address");
const passwordSchema = z.string().min(6, "Password must be at least 6 characters");
const nameSchema = z.string().min(1, "Name is required");

type AuthMode = "login" | "signup" | "forgot-password";

const features = [
  { icon: Layers, title: "Programme Management", description: "Track programmes, projects, and products with full lifecycle governance." },
  { icon: Shield, title: "Risk & Issue Tracking", description: "Comprehensive registers for risks, issues, and change control." },
  { icon: BarChart3, title: "Real-time Reporting", description: "Dashboards and weekly reports with AI-powered summaries." },
  { icon: Users, title: "Team Collaboration", description: "Role-based access, assignments, and stakeholder management." },
];

export default function Auth() {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [orgName, setOrgName] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; firstName?: string; lastName?: string; orgName?: string }>({});
  const [branding, setBranding] = useState<GlobalBranding | null>(null);

  const { signIn, signUp, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      // Check if user has org_name in metadata and no org yet — create one
      const orgNameMeta = user.user_metadata?.org_name;
      if (orgNameMeta) {
        supabase.rpc('create_org_for_new_user', { _org_name: orgNameMeta }).then(() => {
          navigate("/");
        });
      } else {
        navigate("/");
      }
    }
  }, [user, navigate]);

  useEffect(() => {
    const fetchGlobalBranding = async () => {
      const { data } = await supabase
        .from("branding_settings")
        .select("logo_url, primary_color, secondary_color, accent_color, font_family, app_name, app_tagline, logo_size, show_logo, header_font_size, hero_title, hero_description, feature_1_label, feature_1_text, feature_2_label, feature_2_text, login_footer_text, welcome_message")
        .is("organization_id", null)
        .maybeSingle();

      if (data) {
        setBranding(data);
        applyBrandingCssVars({
          primaryHex: data.primary_color ?? DEFAULT_BRANDING.primaryHex,
          secondaryHex: data.secondary_color ?? DEFAULT_BRANDING.secondaryHex,
          accentHex: data.accent_color ?? DEFAULT_BRANDING.accentHex,
        });
        document.title = data.app_name
          ? `${data.app_name} – Sign In`
          : "Program Information Management Platform";
      }
    };
    fetchGlobalBranding();
  }, []);

  const validateForm = () => {
    const newErrors: typeof errors = {};
    try { emailSchema.parse(email); } catch (e) { if (e instanceof z.ZodError) newErrors.email = e.errors[0].message; }
    if (mode !== "forgot-password") {
      try { passwordSchema.parse(password); } catch (e) { if (e instanceof z.ZodError) newErrors.password = e.errors[0].message; }
    }
    if (mode === "signup") {
      try { nameSchema.parse(firstName); } catch (e) { if (e instanceof z.ZodError) newErrors.firstName = e.errors[0].message; }
      try { nameSchema.parse(lastName); } catch (e) { if (e instanceof z.ZodError) newErrors.lastName = e.errors[0].message; }
      if (!orgName.trim()) newErrors.orgName = "Organization name is required";
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
      if (!error) navigate("/");
    } else if (mode === "signup") {
      const fullName = `${firstName} ${lastName}`.trim();
      const { error } = await signUp(email, password, fullName, firstName, lastName, orgName.trim());
      if (!error) { setMode("login"); setPassword(""); }
    } else if (mode === "forgot-password") {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth`,
      });
      if (error) toast.error(error.message);
      else { toast.success("Password reset email sent. Check your inbox."); setMode("login"); }
    }
    setLoading(false);
  };

  const getTitle = () => {
    switch (mode) {
      case "login": return branding?.welcome_message || "Welcome back";
      case "signup": return "Create your account";
      case "forgot-password": return "Reset your password";
    }
  };

  const getSubtitle = () => {
    switch (mode) {
      case "login": return "Enter your credentials to access your dashboard.";
      case "signup": return "Get started with your programme management journey.";
      case "forgot-password": return "Enter your email and we'll send you a reset link.";
    }
  };

  const getButtonText = () => {
    switch (mode) {
      case "login": return "Sign In";
      case "signup": return "Create Account";
      case "forgot-password": return "Send Reset Link";
    }
  };

  const appName = branding?.app_name || "PIMP";
  const appTagline = branding?.app_tagline || "Program Information Management Platform";

  return (
    <div
      className="min-h-screen flex"
      style={{ fontFamily: branding?.font_family || undefined }}
    >
      {/* Left Panel - Branding / Hero */}
      <div className="hidden lg:flex lg:w-[480px] xl:w-[540px] flex-col justify-between bg-primary p-10 text-primary-foreground relative overflow-hidden">
        {/* Decorative background elements */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-primary-foreground/20" />
          <div className="absolute bottom-[-80px] right-[-60px] w-80 h-80 rounded-full bg-primary-foreground/15" />
          <div className="absolute top-1/2 left-1/3 w-64 h-64 rounded-full bg-primary-foreground/10" />
        </div>

        <div className="relative z-10">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-16">
            {branding?.show_logo !== false && branding?.logo_url ? (
              <img
                src={branding.logo_url}
                alt="Logo"
                className={`${logoSizeClasses[branding?.logo_size || "medium"]} object-contain`}
              />
            ) : (
              <div className="h-10 w-10 rounded-xl bg-primary-foreground/20 flex items-center justify-center backdrop-blur-sm">
                <Layers className="h-5 w-5" />
              </div>
            )}
            <span className="text-lg font-semibold tracking-tight">{appName}</span>
          </div>

          {/* Hero text */}
          <div className="space-y-4">
            <h1 className="text-3xl xl:text-4xl font-bold leading-tight tracking-tight">
              {branding?.hero_title || "Manage programmes with confidence"}
            </h1>
            <p className="text-primary-foreground/70 text-base leading-relaxed max-w-md">
              {branding?.hero_description || appTagline}
            </p>
          </div>
        </div>

        {/* Features list */}
        <div className="relative z-10 space-y-5">
          {features.map((feature, i) => (
            <div key={i} className="flex items-start gap-3.5">
              <div className="h-9 w-9 rounded-lg bg-primary-foreground/15 flex items-center justify-center flex-shrink-0 backdrop-blur-sm mt-0.5">
                <feature.icon className="h-4 w-4" />
              </div>
              <div>
                <p className="font-medium text-sm">{feature.title}</p>
                <p className="text-primary-foreground/60 text-xs leading-relaxed mt-0.5">{feature.description}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <p className="relative z-10 text-xs text-primary-foreground/40">
          {branding?.login_footer_text || `© ${new Date().getFullYear()} ${appName}. All rights reserved.`}
        </p>
      </div>

      {/* Right Panel - Auth Form */}
      <div className="flex-1 flex items-center justify-center bg-background p-6 sm:p-10">
        <div className="w-full max-w-[420px]">
          {/* Mobile logo */}
          <div className="flex items-center gap-2.5 mb-10 lg:hidden">
            {branding?.show_logo !== false && branding?.logo_url ? (
              <img
                src={branding.logo_url}
                alt="Logo"
                className={`${logoSizeClasses[branding?.logo_size || "small"]} object-contain`}
              />
            ) : (
              <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
                <Layers className="h-4.5 w-4.5 text-primary" />
              </div>
            )}
            <span className="text-base font-semibold text-foreground">{appName}</span>
          </div>

          {/* Form header */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-foreground tracking-tight">
              {getTitle()}
            </h2>
            <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
              {getSubtitle()}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="firstName" className="text-xs font-medium">First Name</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
                      <Input
                        id="firstName"
                        type="text"
                        placeholder="John"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        className="pl-9 h-10 text-sm bg-muted/30 border-border/60 focus:bg-background transition-colors"
                      />
                    </div>
                    {errors.firstName && <p className="text-xs text-destructive">{errors.firstName}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="lastName" className="text-xs font-medium">Last Name</Label>
                    <Input
                      id="lastName"
                      type="text"
                      placeholder="Smith"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="h-10 text-sm bg-muted/30 border-border/60 focus:bg-background transition-colors"
                    />
                    {errors.lastName && <p className="text-xs text-destructive">{errors.lastName}</p>}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="orgName" className="text-xs font-medium">Organization Name</Label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
                    <Input
                      id="orgName"
                      type="text"
                      placeholder="Acme Corporation"
                      value={orgName}
                      onChange={(e) => setOrgName(e.target.value)}
                      className="pl-9 h-10 text-sm bg-muted/30 border-border/60 focus:bg-background transition-colors"
                    />
                  </div>
                  {errors.orgName && <p className="text-xs text-destructive">{errors.orgName}</p>}
                </div>
              </>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-medium">Email address</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
                <Input
                  id="email"
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-9 h-10 text-sm bg-muted/30 border-border/60 focus:bg-background transition-colors"
                />
              </div>
              {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
            </div>

            {mode !== "forgot-password" && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-xs font-medium">Password</Label>
                  {mode === "login" && (
                    <button
                      type="button"
                      onClick={() => { setMode("forgot-password"); setErrors({}); }}
                      className="text-xs text-primary hover:text-primary/80 font-medium transition-colors"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-9 h-10 text-sm bg-muted/30 border-border/60 focus:bg-background transition-colors"
                  />
                </div>
                {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-10 gap-2 text-sm font-medium mt-1 shadow-sm"
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  {getButtonText()}
                  <ArrowRight className="h-3.5 w-3.5" />
                </>
              )}
            </Button>
          </form>

          <div className="mt-6 pt-5 border-t border-border/60 text-center">
            {mode === "forgot-password" ? (
              <button
                type="button"
                onClick={() => { setMode("login"); setErrors({}); }}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5 mx-auto font-medium"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to sign in
              </button>
            ) : (
              <p className="text-sm text-muted-foreground">
                {mode === "login" ? "Don't have an account? " : "Already have an account? "}
                <button
                  type="button"
                  onClick={() => { setMode(mode === "login" ? "signup" : "login"); setErrors({}); }}
                  className="text-primary hover:text-primary/80 font-medium transition-colors"
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
