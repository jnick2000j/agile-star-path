import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { getSiteUrl } from "@/lib/site-url";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, User, ArrowRight, Loader2, ArrowLeft, Shield, BarChart3, Users, Layers, Building2, KeyRound } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { applyBrandingCssVars, DEFAULT_BRANDING } from "@/lib/branding";
import { lovable } from "@/integrations/lovable/index";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

interface LoginBranding {
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
  feature_3_label: string | null;
  feature_3_text: string | null;
  feature_4_label: string | null;
  feature_4_text: string | null;
  login_footer_text: string | null;
  welcome_message: string | null;
  login_bg_image_url: string | null;
  login_bg_pattern: string | null;
  login_layout: string | null;
  show_features: boolean | null;
  login_button_text: string | null;
  login_cta_text: string | null;
  right_panel_bg_color: string | null;
  show_app_name: boolean | null;
  show_tagline: boolean | null;
  show_hero_title: boolean | null;
  show_hero_description: boolean | null;
  show_welcome_message: boolean | null;
  show_login_cta: boolean | null;
  show_footer: boolean | null;
}

const logoSizeClasses: Record<string, string> = {
  small: "h-8 w-auto",
  medium: "h-10 w-auto",
  large: "h-14 w-auto",
  xlarge: "h-20 w-auto",
};

const emailSchema = z.string().email("Please enter a valid email address");
const nameSchema = z.string().min(1, "Name is required");
const otpSchema = z.string().regex(/^\d{6}$/, "Enter the 6-digit code");

type AuthMode = "login" | "signup" | "sso";
type AuthStep = "request" | "verify";

const defaultFeatures = [
  { icon: Layers, title: "Programme Management", description: "Track programmes, projects, and products with full lifecycle governance." },
  { icon: Shield, title: "Risk & Issue Tracking", description: "Comprehensive registers for risks, issues, and change control." },
  { icon: BarChart3, title: "Real-time Reporting", description: "Dashboards and weekly reports with AI-powered summaries." },
  { icon: Users, title: "Team Collaboration", description: "Role-based access, assignments, and stakeholder management." },
];

const featureIcons = [Layers, Shield, BarChart3, Users];

function PatternOverlay({ pattern }: { pattern: string }) {
  if (pattern === "none") return null;
  if (pattern === "dots") return (
    <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle, currentColor 1px, transparent 1px)", backgroundSize: "20px 20px" }} />
  );
  if (pattern === "grid") return (
    <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "linear-gradient(currentColor 1px, transparent 1px), linear-gradient(90deg, currentColor 1px, transparent 1px)", backgroundSize: "40px 40px" }} />
  );
  // circles (default)
  return (
    <div className="absolute inset-0 opacity-10">
      <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-primary-foreground/20" />
      <div className="absolute bottom-[-80px] right-[-60px] w-80 h-80 rounded-full bg-primary-foreground/15" />
      <div className="absolute top-1/2 left-1/3 w-64 h-64 rounded-full bg-primary-foreground/10" />
    </div>
  );
}

export default function Auth() {
  const [mode, setMode] = useState<AuthMode>("login");
  const [step, setStep] = useState<AuthStep>("request");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [orgName, setOrgName] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; otp?: string; firstName?: string; lastName?: string; orgName?: string }>({});
  const [branding, setBranding] = useState<LoginBranding | null>(null);

  const { requestEmailOtp, verifyEmailOtp, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      const orgNameMeta = user.user_metadata?.org_name;
      if (orgNameMeta) {
        supabase.rpc('create_org_for_new_user', { _org_name: orgNameMeta }).then(() => navigate("/"));
      } else {
        navigate("/");
      }
    }
  }, [user, navigate]);

  useEffect(() => {
    const fetchGlobalBranding = async () => {
      const { data: payload, error } = await supabase.functions.invoke("get-public-branding");
      const data = !error ? (payload as any)?.branding : null;

      if (data) {
        setBranding(data as any);
        applyBrandingCssVars({
          primaryHex: data.primary_color ?? DEFAULT_BRANDING.primaryHex,
          secondaryHex: data.secondary_color ?? DEFAULT_BRANDING.secondaryHex,
          accentHex: data.accent_color ?? DEFAULT_BRANDING.accentHex,
        });
        document.title = data.app_name ? `${data.app_name} – Sign In` : "TaskMaster – Program Information & Management Platform";
      }
    };
    fetchGlobalBranding();
  }, []);

  const switchMode = (next: AuthMode) => {
    setMode(next);
    setStep("request");
    setOtp("");
    setErrors({});
  };

  const validateRequest = () => {
    const newErrors: typeof errors = {};
    try { emailSchema.parse(email); } catch (e) { if (e instanceof z.ZodError) newErrors.email = e.errors[0].message; }
    if (mode === "signup") {
      try { nameSchema.parse(firstName); } catch (e) { if (e instanceof z.ZodError) newErrors.firstName = e.errors[0].message; }
      try { nameSchema.parse(lastName); } catch (e) { if (e instanceof z.ZodError) newErrors.lastName = e.errors[0].message; }
      if (!orgName.trim()) newErrors.orgName = "Organization name is required";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateVerify = () => {
    const newErrors: typeof errors = {};
    try { otpSchema.parse(otp); } catch (e) { if (e instanceof z.ZodError) newErrors.otp = e.errors[0].message; }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "sso") {
      if (!validateRequest()) return;
      setLoading(true);
      try {
        const { data, error } = await supabase.rpc("get_org_sso_config_by_domain", { _email: email });
        if (error) throw error;
        const cfg = Array.isArray(data) ? data[0] : data;
        if (!cfg?.saml_provider_id && !cfg?.oidc_issuer_url) {
          toast.error("No SSO configured for this email domain. Use email sign-in or contact your admin.");
          setLoading(false);
          return;
        }
        if (cfg.saml_provider_id) {
          const siteUrl = await getSiteUrl();
          const { error: ssoError } = await (supabase.auth as any).signInWithSSO({
            providerId: cfg.saml_provider_id,
            options: { redirectTo: siteUrl },
          });
          if (ssoError) throw ssoError;
        } else {
          const domain = email.split("@")[1];
          const siteUrl = await getSiteUrl();
          const { error: ssoError } = await (supabase.auth as any).signInWithSSO({
            domain,
            options: { redirectTo: siteUrl },
          });
          if (ssoError) throw ssoError;
        }
      } catch (err: any) {
        toast.error(err.message || "SSO sign-in failed");
      }
      setLoading(false);
      return;
    }

    if (step === "request") {
      if (!validateRequest()) return;
      setLoading(true);
      const { error } = await requestEmailOtp(email, {
        firstName: mode === "signup" ? firstName : undefined,
        lastName: mode === "signup" ? lastName : undefined,
        fullName: mode === "signup" ? `${firstName} ${lastName}`.trim() : undefined,
        orgName: mode === "signup" ? orgName.trim() : undefined,
        shouldCreateUser: mode === "signup",
      });
      if (!error) setStep("verify");
      setLoading(false);
      return;
    }

    // step === "verify"
    if (!validateVerify()) return;
    setLoading(true);
    const { error } = await verifyEmailOtp(email, otp);
    if (!error) navigate("/");
    setLoading(false);
  };

  const handleResendCode = async () => {
    setResending(true);
    await requestEmailOtp(email, {
      firstName: mode === "signup" ? firstName : undefined,
      lastName: mode === "signup" ? lastName : undefined,
      fullName: mode === "signup" ? `${firstName} ${lastName}`.trim() : undefined,
      orgName: mode === "signup" ? orgName.trim() : undefined,
      shouldCreateUser: mode === "signup",
    });
    setResending(false);
  };

  const handleOAuth = async (provider: "google" | "apple") => {
    setLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth(provider, {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        toast.error(result.error.message || `${provider} sign-in failed`);
        setLoading(false);
        return;
      }
      if (result.redirected) return; // browser will redirect
      // Tokens were returned
      navigate("/");
    } catch (e: any) {
      toast.error(e.message || `${provider} sign-in failed`);
      setLoading(false);
    }
  };

  const appName = branding?.app_name || "TaskMaster";
  const showTagline = branding?.show_tagline !== false;
  const appTagline = showTagline ? (branding?.app_tagline || "Program Information & Management Platform") : "";
  const layout = branding?.login_layout || "split";
  const bgPattern = branding?.login_bg_pattern || "circles";
  const showFeatures = branding?.show_features !== false;
  const showAppName = branding?.show_app_name !== false;
  const showHeroTitle = branding?.show_hero_title !== false;
  const showHeroDescription = branding?.show_hero_description !== false;
  const showWelcomeMessage = branding?.show_welcome_message !== false;
  const showLoginCta = branding?.show_login_cta !== false;
  const showFooter = branding?.show_footer !== false;
  const hasLogo = branding?.show_logo !== false && !!branding?.logo_url;
  const logoOnly = hasLogo && !showAppName;
  const heroTextColor = (branding as any)?.hero_text_color || undefined;
  const formTextColor = (branding as any)?.form_text_color || undefined;
  const appNameColor = (branding as any)?.app_name_color || undefined;
  const taglineColor = (branding as any)?.tagline_color || undefined;

  const features = defaultFeatures.map((def, i) => {
    const n = i + 1;
    const label = (branding as any)?.[`feature_${n}_label`];
    const text = (branding as any)?.[`feature_${n}_text`];
    return {
      icon: featureIcons[i],
      title: label || def.title,
      description: text || def.description,
    };
  });

  const getTitle = () => {
    if (step === "verify") return "Enter your code";
    switch (mode) {
      case "login": return showWelcomeMessage ? (branding?.welcome_message || "Welcome back") : "Sign in";
      case "signup": return "Create your account";
      case "sso": return "Sign in with SSO";
    }
  };

  const getSubtitle = () => {
    if (step === "verify") return `We sent a 6-digit code to ${email}. It expires in a few minutes.`;
    switch (mode) {
      case "login": return showLoginCta ? (branding?.login_cta_text || "Enter your email and we'll send you a one-time code.") : "Enter your email and we'll send you a one-time code.";
      case "signup": return "Tell us about you. We'll email a one-time code to confirm your address.";
      case "sso": return "Enter your work email and we'll route you to your identity provider.";
    }
  };

  const getButtonText = () => {
    if (step === "verify") return "Verify & sign in";
    switch (mode) {
      case "login": return branding?.login_button_text || "Email me a code";
      case "signup": return "Send verification code";
      case "sso": return "Continue with SSO";
    }
  };

  const formContent = (
    <div className="w-full max-w-[420px]" style={{ color: formTextColor }}>
      <div className={`mb-10 lg:hidden ${logoOnly ? "flex justify-center" : "flex items-center gap-2.5"}`}>
        {hasLogo ? (
          <img
            src={branding!.logo_url!}
            alt={appName}
            className={logoOnly ? "max-h-20 w-auto object-contain" : `${logoSizeClasses[branding?.logo_size || "small"]} object-contain`}
          />
        ) : (
          <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <Layers className="h-4.5 w-4.5 text-primary" />
          </div>
        )}
        {showAppName && <span className="text-base font-semibold text-foreground" style={{ color: appNameColor }}>{appName}</span>}
      </div>

      <div className="mb-8">
        {getTitle() && <h2 className="text-2xl font-bold text-foreground tracking-tight">{getTitle()}</h2>}
        {getSubtitle() && <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{getSubtitle()}</p>}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {step === "request" && mode === "signup" && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="firstName" className="text-xs font-medium">First Name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
                  <Input id="firstName" placeholder="John" value={firstName} onChange={(e) => setFirstName(e.target.value)} className="pl-9 h-10 text-sm bg-muted/30 border-border/60 focus:bg-background transition-colors" />
                </div>
                {errors.firstName && <p className="text-xs text-destructive">{errors.firstName}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lastName" className="text-xs font-medium">Last Name</Label>
                <Input id="lastName" placeholder="Smith" value={lastName} onChange={(e) => setLastName(e.target.value)} className="h-10 text-sm bg-muted/30 border-border/60 focus:bg-background transition-colors" />
                {errors.lastName && <p className="text-xs text-destructive">{errors.lastName}</p>}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="orgName" className="text-xs font-medium">Organization Name</Label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
                <Input id="orgName" placeholder="Acme Corporation" value={orgName} onChange={(e) => setOrgName(e.target.value)} className="pl-9 h-10 text-sm bg-muted/30 border-border/60 focus:bg-background transition-colors" />
              </div>
              {errors.orgName && <p className="text-xs text-destructive">{errors.orgName}</p>}
            </div>
          </>
        )}

        {step === "request" && (
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-xs font-medium">Email address</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
              <Input id="email" type="email" placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-9 h-10 text-sm bg-muted/30 border-border/60 focus:bg-background transition-colors" />
            </div>
            {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
          </div>
        )}

        {step === "verify" && (
          <div className="space-y-3">
            <Label htmlFor="otp" className="text-xs font-medium flex items-center gap-1.5">
              <KeyRound className="h-3.5 w-3.5" /> 6-digit verification code
            </Label>
            <InputOTP maxLength={6} value={otp} onChange={setOtp} containerClassName="justify-start">
              <InputOTPGroup>
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
                <InputOTPSlot index={3} />
                <InputOTPSlot index={4} />
                <InputOTPSlot index={5} />
              </InputOTPGroup>
            </InputOTP>
            {errors.otp && <p className="text-xs text-destructive">{errors.otp}</p>}
            <div className="flex items-center justify-between text-xs">
              <button type="button" onClick={() => { setStep("request"); setOtp(""); setErrors({}); }} className="text-muted-foreground hover:text-foreground flex items-center gap-1">
                <ArrowLeft className="h-3 w-3" /> Use a different email
              </button>
              <button type="button" onClick={handleResendCode} disabled={resending} className="text-primary hover:text-primary/80 font-medium disabled:opacity-50">
                {resending ? "Sending…" : "Resend code"}
              </button>
            </div>
          </div>
        )}

        <Button type="submit" className="w-full h-10 gap-2 text-sm font-medium mt-1 shadow-sm" disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>{getButtonText()} <ArrowRight className="h-3.5 w-3.5" /></>}
        </Button>
      </form>

      <div className="mt-6 pt-5 border-t border-border/60 text-center">
        {mode === "sso" ? (
          <button type="button" onClick={() => switchMode("login")} className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5 mx-auto font-medium">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
          </button>
        ) : (
          <p className="text-sm text-muted-foreground">
            {mode === "login" ? "Don't have an account? " : "Already have an account? "}
            <button type="button" onClick={() => switchMode(mode === "login" ? "signup" : "login")} className="text-primary hover:text-primary/80 font-medium transition-colors">
              {mode === "login" ? "Sign up" : "Sign in"}
            </button>
          </p>
        )}
      </div>
    </div>
  );

  const heroPanel = (
    <div
      className="hidden lg:flex lg:w-[480px] xl:w-[540px] flex-col justify-between p-10 bg-primary text-primary-foreground relative overflow-hidden"
      style={{
        backgroundImage: branding?.login_bg_image_url ? `url(${branding.login_bg_image_url})` : undefined,
        backgroundSize: "cover",
        backgroundPosition: "center",
        color: heroTextColor,
      }}
    >
      {branding?.login_bg_image_url && <div className="absolute inset-0 bg-black/50" />}
      {!branding?.login_bg_image_url && <PatternOverlay pattern={bgPattern} />}

      <div className="relative z-10">
        <div className={`mb-16 ${logoOnly ? "flex justify-center" : ""}`}>
          {hasLogo ? (
            <img
              src={branding!.logo_url!}
              alt={appName}
              className={logoOnly ? "max-h-40 w-auto object-contain" : "max-h-24 w-auto object-contain"}
            />
          ) : (
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary-foreground/20 flex items-center justify-center backdrop-blur-sm">
                <Layers className="h-5 w-5" />
              </div>
              {showAppName && <span className="text-lg font-semibold tracking-tight" style={{ color: appNameColor }}>{appName}</span>}
            </div>
          )}
        </div>
        <div className="space-y-4">
          {showHeroTitle && (
            <h1 className="text-3xl xl:text-4xl font-bold leading-tight tracking-tight">
              {branding?.hero_title || "Manage programmes with confidence"}
            </h1>
          )}
          {showHeroDescription && (
            <p className="text-primary-foreground/70 text-base leading-relaxed max-w-md" style={{ color: taglineColor }}>
              {branding?.hero_description || appTagline}
            </p>
          )}
        </div>
      </div>

      {showFeatures && (
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
      )}

      {showFooter && (
        <p className="relative z-10 text-xs text-primary-foreground/40">
          {branding?.login_footer_text || `© ${new Date().getFullYear()} ${appName}. All rights reserved.`}
        </p>
      )}
    </div>
  );

  // Centered layout
  if (layout === "centered") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6" style={{ fontFamily: branding?.font_family || undefined }}>
        <div className="w-full max-w-md">
          <div className="rounded-2xl border border-border shadow-lg overflow-hidden">
            {/* Mini hero banner */}
            <div className="bg-primary p-6 text-primary-foreground relative overflow-hidden" style={{ color: heroTextColor }}>
              {!branding?.login_bg_image_url && <PatternOverlay pattern={bgPattern} />}
              {branding?.login_bg_image_url && (
                <>
                  <div className="absolute inset-0" style={{ backgroundImage: `url(${branding.login_bg_image_url})`, backgroundSize: "cover", backgroundPosition: "center" }} />
                  <div className="absolute inset-0 bg-black/50" />
                </>
              )}
              <div className={`relative z-10 mb-3 ${logoOnly ? "flex justify-center" : "flex items-center gap-3"}`}>
                {hasLogo ? (
                  <img
                    src={branding!.logo_url!}
                    alt={appName}
                    className={logoOnly ? "max-h-20 w-auto object-contain" : "h-8 w-auto object-contain"}
                  />
                ) : (
                  <div className="h-8 w-8 rounded-lg bg-primary-foreground/20 flex items-center justify-center"><Layers className="h-4 w-4" /></div>
                )}
                {showAppName && <span className="font-semibold" style={{ color: appNameColor }}>{appName}</span>}
              </div>
              {showHeroTitle && <h1 className="relative z-10 text-lg font-bold">{branding?.hero_title || "Manage programmes with confidence"}</h1>}
            </div>
            <div className="p-6" style={{ backgroundColor: branding?.right_panel_bg_color || undefined }}>
              {formContent}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Full-width hero top layout
  if (layout === "full-left") {
    return (
      <div className="min-h-screen flex flex-col" style={{ fontFamily: branding?.font_family || undefined }}>
        <div
          className="bg-primary p-8 text-primary-foreground relative overflow-hidden"
          style={{
            backgroundImage: branding?.login_bg_image_url ? `url(${branding.login_bg_image_url})` : undefined,
            backgroundSize: "cover",
            backgroundPosition: "center",
            color: heroTextColor,
          }}
        >
          {branding?.login_bg_image_url && <div className="absolute inset-0 bg-black/50" />}
          {!branding?.login_bg_image_url && <PatternOverlay pattern={bgPattern} />}
          <div className="relative z-10 max-w-4xl mx-auto">
            <div className={`mb-6 ${logoOnly ? "flex justify-center" : "flex items-center gap-3"}`}>
              {hasLogo ? (
                <img
                  src={branding!.logo_url!}
                  alt={appName}
                  className={logoOnly ? "max-h-28 w-auto object-contain" : `${logoSizeClasses[branding?.logo_size || "medium"]} object-contain`}
                />
              ) : (
                <div className="h-10 w-10 rounded-xl bg-primary-foreground/20 flex items-center justify-center"><Layers className="h-5 w-5" /></div>
              )}
              {showAppName && <span className="text-lg font-semibold" style={{ color: appNameColor }}>{appName}</span>}
            </div>
            {showHeroTitle && <h1 className="text-2xl md:text-3xl font-bold mb-2">{branding?.hero_title || "Manage programmes with confidence"}</h1>}
            {showHeroDescription && <p className="text-primary-foreground/70 max-w-lg" style={{ color: taglineColor }}>{branding?.hero_description || appTagline}</p>}
            {showFeatures && (
              <div className="flex flex-wrap gap-6 mt-6">
                {features.map((f, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <f.icon className="h-4 w-4 text-primary-foreground/70" />
                    <span className="text-sm font-medium">{f.title}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center p-6 sm:p-10" style={{ backgroundColor: branding?.right_panel_bg_color || undefined }}>
          {formContent}
        </div>
      </div>
    );
  }

  // Default split layout
  return (
    <div className="min-h-screen flex" style={{ fontFamily: branding?.font_family || undefined }}>
      {heroPanel}
      <div className="flex-1 flex items-center justify-center bg-background p-6 sm:p-10" style={{ backgroundColor: branding?.right_panel_bg_color || undefined }}>
        {formContent}
      </div>
    </div>
  );
}
