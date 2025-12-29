import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Upload, Save, Palette, Image } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const fontOptions = [
  { value: "Inter", label: "Inter" },
  { value: "Roboto", label: "Roboto" },
  { value: "Open Sans", label: "Open Sans" },
  { value: "Lato", label: "Lato" },
  { value: "Poppins", label: "Poppins" },
  { value: "Montserrat", label: "Montserrat" },
];

const colorSchemes = [
  { 
    name: "Ocean Blue", 
    primary: "#2563eb", 
    secondary: "#1e293b", 
    accent: "#3b82f6",
    description: "Professional and trustworthy"
  },
  { 
    name: "Forest Green", 
    primary: "#16a34a", 
    secondary: "#14532d", 
    accent: "#22c55e",
    description: "Fresh and eco-friendly"
  },
  { 
    name: "Sunset Orange", 
    primary: "#ea580c", 
    secondary: "#431407", 
    accent: "#f97316",
    description: "Warm and energetic"
  },
  { 
    name: "Royal Purple", 
    primary: "#7c3aed", 
    secondary: "#2e1065", 
    accent: "#8b5cf6",
    description: "Creative and premium"
  },
  { 
    name: "Crimson Red", 
    primary: "#dc2626", 
    secondary: "#450a0a", 
    accent: "#ef4444",
    description: "Bold and impactful"
  },
  { 
    name: "Teal", 
    primary: "#0d9488", 
    secondary: "#134e4a", 
    accent: "#14b8a6",
    description: "Calm and balanced"
  },
  { 
    name: "Slate Grey", 
    primary: "#475569", 
    secondary: "#0f172a", 
    accent: "#64748b",
    description: "Modern and neutral"
  },
  { 
    name: "Rose Pink", 
    primary: "#e11d48", 
    secondary: "#4c0519", 
    accent: "#f43f5e",
    description: "Vibrant and playful"
  },
  { 
    name: "Amber Gold", 
    primary: "#d97706", 
    secondary: "#451a03", 
    accent: "#f59e0b",
    description: "Luxurious and warm"
  },
  { 
    name: "Indigo", 
    primary: "#4f46e5", 
    secondary: "#1e1b4b", 
    accent: "#6366f1",
    description: "Deep and sophisticated"
  },
];

export default function BrandingSettings() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [branding, setBranding] = useState({
    logo_url: "",
    primary_color: "#2563eb",
    secondary_color: "#1e293b",
    accent_color: "#3b82f6",
    font_family: "Inter",
    app_name: "PIMP",
    app_tagline: "Programme Information Management Platform",
    welcome_message: "",
    hero_title: "Welcome back",
    hero_description: "Secure access to programmes, projects, products and PRINCE2 controls—fully branded for your organization.",
    feature_1_label: "Multi-tenant",
    feature_1_text: "Organization data isolation",
    feature_2_label: "Governance",
    feature_2_text: "PRINCE2 registers & reporting",
    login_footer_text: "Use your company email to sign in.",
  });
  const [organizations, setOrganizations] = useState<{ id: string; name: string }[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<string>("global");

  useEffect(() => {
    fetchOrganizations();
  }, []);

  useEffect(() => {
    fetchBranding(selectedOrg);
  }, [selectedOrg]);

  const fetchOrganizations = async () => {
    const { data, error } = await supabase
      .from("organizations")
      .select("id, name")
      .order("name");
    
    if (!error && data) {
      setOrganizations(data);
    }
  };

  const fetchBranding = async (orgId: string) => {
    let query = supabase
      .from("branding_settings")
      .select("*");
    
    if (orgId === "global") {
      query = query.is("organization_id", null);
    } else {
      query = query.eq("organization_id", orgId);
    }
    
    const { data, error } = await query.maybeSingle();
    
    if (!error && data) {
      setBranding({
        logo_url: data.logo_url || "",
        primary_color: data.primary_color || "#2563eb",
        secondary_color: data.secondary_color || "#1e293b",
        accent_color: data.accent_color || "#3b82f6",
        font_family: data.font_family || "Inter",
        app_name: data.app_name || "PIMP",
        app_tagline: data.app_tagline || "Programme Information Management Platform",
        welcome_message: data.welcome_message || "",
        hero_title: data.hero_title || "Welcome back",
        hero_description: data.hero_description || "Secure access to programmes, projects, products and PRINCE2 controls—fully branded for your organization.",
        feature_1_label: data.feature_1_label || "Multi-tenant",
        feature_1_text: data.feature_1_text || "Organization data isolation",
        feature_2_label: data.feature_2_label || "Governance",
        feature_2_text: data.feature_2_text || "PRINCE2 registers & reporting",
        login_footer_text: data.login_footer_text || "Use your company email to sign in.",
      });
    } else {
      // Reset to defaults if no branding found
      setBranding({
        logo_url: "",
        primary_color: "#2563eb",
        secondary_color: "#1e293b",
        accent_color: "#3b82f6",
        font_family: "Inter",
        app_name: "PIMP",
        app_tagline: "Programme Information Management Platform",
        welcome_message: "",
        hero_title: "Welcome back",
        hero_description: "Secure access to programmes, projects, products and PRINCE2 controls—fully branded for your organization.",
        feature_1_label: "Multi-tenant",
        feature_1_text: "Organization data isolation",
        feature_2_label: "Governance",
        feature_2_text: "PRINCE2 registers & reporting",
        login_footer_text: "Use your company email to sign in.",
      });
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const folderName = selectedOrg === "global" ? "global" : selectedOrg;
      const filePath = `${folderName}/logo.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("logos")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("logos").getPublicUrl(filePath);
      setBranding((prev) => ({ ...prev, logo_url: data.publicUrl }));
      toast.success("Logo uploaded successfully");
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Failed to upload logo");
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      if (selectedOrg === "global") {
        // Update global branding (organization_id = NULL)
        const { data: existing } = await supabase
          .from("branding_settings")
          .select("id")
          .is("organization_id", null)
          .maybeSingle();
        
        if (existing) {
          const { error } = await supabase
            .from("branding_settings")
            .update(branding)
            .is("organization_id", null);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from("branding_settings")
            .insert({ organization_id: null, ...branding });
          if (error) throw error;
        }
      } else {
        const { error } = await supabase
          .from("branding_settings")
          .upsert({
            organization_id: selectedOrg,
            ...branding,
          }, { onConflict: "organization_id" });

        if (error) throw error;

        // Also update organization colors
        await supabase
          .from("organizations")
          .update({
            primary_color: branding.primary_color,
            secondary_color: branding.secondary_color,
            logo_url: branding.logo_url,
          })
          .eq("id", selectedOrg);
      }

      toast.success("Branding settings saved successfully");
      
      // Re-fetch to ensure state is in sync
      await fetchBranding(selectedOrg);
      
      // Apply colors to CSS variables if not global
      if (selectedOrg !== "global") {
        document.documentElement.style.setProperty("--primary", hexToHsl(branding.primary_color));
        document.documentElement.style.setProperty("--sidebar-background", hexToHsl(branding.secondary_color));
      }
    } catch (error) {
      console.error("Save error:", error);
      toast.error("Failed to save branding settings");
    } finally {
      setLoading(false);
    }
  };

  const hexToHsl = (hex: string): string => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return "217 91% 50%";
    
    let r = parseInt(result[1], 16) / 255;
    let g = parseInt(result[2], 16) / 255;
    let b = parseInt(result[3], 16) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
        case g: h = ((b - r) / d + 2) / 6; break;
        case b: h = ((r - g) / d + 4) / 6; break;
      }
    }

    return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
  };

  return (
    <AppLayout title="Branding Settings" subtitle="Customize your organization's appearance">
      <div className="max-w-2xl space-y-6">
        {/* Organization Selection */}
        <div className="metric-card">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Palette className="h-5 w-5 text-primary" />
            Select Branding Target
          </h3>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Branding For</Label>
              <Select value={selectedOrg} onValueChange={setSelectedOrg}>
                <SelectTrigger>
                  <SelectValue placeholder="Select branding target" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="global">
                    🌐 Global (Login Page & Unassigned Admins)
                  </SelectItem>
                  {organizations.map((org) => (
                    <SelectItem key={org.id} value={org.id}>
                      {org.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                {selectedOrg === "global" 
                  ? "This branding applies to the login page and admins not assigned to any organization."
                  : "This branding applies to users within this organization."}
              </p>
            </div>
          </div>
        </div>

        {/* Login Page Text - Only show for global branding */}
        {selectedOrg === "global" && (
          <div className="metric-card">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Palette className="h-5 w-5 text-primary" />
            Login Page Header
          </h3>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="appName">Application Name</Label>
              <Input
                id="appName"
                value={branding.app_name}
                onChange={(e) => setBranding((prev) => ({ ...prev, app_name: e.target.value }))}
                placeholder="PIMP"
              />
              <p className="text-sm text-muted-foreground">The main title shown in the header</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="appTagline">Tagline</Label>
              <Input
                id="appTagline"
                value={branding.app_tagline}
                onChange={(e) => setBranding((prev) => ({ ...prev, app_tagline: e.target.value }))}
                placeholder="Programme Information Management Platform"
              />
              <p className="text-sm text-muted-foreground">Subtitle displayed below the application name</p>
            </div>
          </div>
        </div>
        )}

        {/* Login Page Left Panel Content - Only show for global branding */}
        {selectedOrg === "global" && (
          <div className="metric-card">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Palette className="h-5 w-5 text-primary" />
              Login Page Content (Left Panel)
            </h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="heroTitle">Hero Title</Label>
                <Input
                  id="heroTitle"
                  value={branding.hero_title}
                  onChange={(e) => setBranding((prev) => ({ ...prev, hero_title: e.target.value }))}
                  placeholder="Welcome back"
                />
                <p className="text-sm text-muted-foreground">Main heading on the left panel</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="heroDescription">Hero Description</Label>
                <textarea
                  id="heroDescription"
                  value={branding.hero_description}
                  onChange={(e) => setBranding((prev) => ({ ...prev, hero_description: e.target.value }))}
                  placeholder="Describe your platform benefits..."
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  rows={3}
                />
                <p className="text-sm text-muted-foreground">Supporting text below the hero title</p>
              </div>
              
              <div className="border-t border-border pt-4 mt-4">
                <p className="text-sm font-medium text-foreground mb-3">Feature Cards</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="feature1Label">Feature 1 Label</Label>
                      <Input
                        id="feature1Label"
                        value={branding.feature_1_label}
                        onChange={(e) => setBranding((prev) => ({ ...prev, feature_1_label: e.target.value }))}
                        placeholder="Multi-tenant"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="feature1Text">Feature 1 Text</Label>
                      <Input
                        id="feature1Text"
                        value={branding.feature_1_text}
                        onChange={(e) => setBranding((prev) => ({ ...prev, feature_1_text: e.target.value }))}
                        placeholder="Organization data isolation"
                      />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="feature2Label">Feature 2 Label</Label>
                      <Input
                        id="feature2Label"
                        value={branding.feature_2_label}
                        onChange={(e) => setBranding((prev) => ({ ...prev, feature_2_label: e.target.value }))}
                        placeholder="Governance"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="feature2Text">Feature 2 Text</Label>
                      <Input
                        id="feature2Text"
                        value={branding.feature_2_text}
                        onChange={(e) => setBranding((prev) => ({ ...prev, feature_2_text: e.target.value }))}
                        placeholder="PRINCE2 registers & reporting"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t border-border pt-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="loginFooterText">Footer Text</Label>
                  <Input
                    id="loginFooterText"
                    value={branding.login_footer_text}
                    onChange={(e) => setBranding((prev) => ({ ...prev, login_footer_text: e.target.value }))}
                    placeholder="Use your company email to sign in."
                  />
                  <p className="text-sm text-muted-foreground">Displayed at the bottom of the left panel</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Logo Upload */}
        <div className="metric-card">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Image className="h-5 w-5 text-primary" />
            Logo
          </h3>
          <div className="space-y-4">
            {branding.logo_url && (
              <div className="flex items-center gap-4">
                <img
                  src={branding.logo_url}
                  alt="Organization logo"
                  className="h-16 w-auto object-contain rounded-lg border border-border p-2"
                />
                <span className="text-sm text-muted-foreground">Current logo</span>
              </div>
            )}
            <div className="flex items-center gap-4">
              <Input
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                disabled={uploading}
                className="flex-1"
              />
              {uploading && <span className="text-sm text-muted-foreground">Uploading...</span>}
            </div>
          </div>
        </div>

        {/* Color Scheme Presets */}
        <div className="metric-card">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Palette className="h-5 w-5 text-primary" />
            Color Scheme Presets
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            Choose a pre-designed color scheme or customize your own below
          </p>
          <div className="grid gap-3 grid-cols-2 md:grid-cols-5">
            {colorSchemes.map((scheme) => (
              <button
                key={scheme.name}
                onClick={() => setBranding((prev) => ({
                  ...prev,
                  primary_color: scheme.primary,
                  secondary_color: scheme.secondary,
                  accent_color: scheme.accent,
                }))}
                className={`group p-3 rounded-lg border-2 transition-all hover:scale-105 ${
                  branding.primary_color === scheme.primary && 
                  branding.secondary_color === scheme.secondary
                    ? "border-primary ring-2 ring-primary/20"
                    : "border-border hover:border-primary/50"
                }`}
              >
                <div className="flex gap-1 mb-2">
                  <div 
                    className="h-6 w-6 rounded-full border border-border/50"
                    style={{ backgroundColor: scheme.primary }}
                  />
                  <div 
                    className="h-6 w-6 rounded-full border border-border/50"
                    style={{ backgroundColor: scheme.secondary }}
                  />
                  <div 
                    className="h-6 w-6 rounded-full border border-border/50"
                    style={{ backgroundColor: scheme.accent }}
                  />
                </div>
                <p className="text-xs font-medium text-foreground">{scheme.name}</p>
                <p className="text-[10px] text-muted-foreground">{scheme.description}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Custom Color Scheme */}
        <div className="metric-card">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Palette className="h-5 w-5 text-primary" />
            Custom Colors
          </h3>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="primaryColor">Primary Color</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  id="primaryColor"
                  value={branding.primary_color}
                  onChange={(e) => setBranding((prev) => ({ ...prev, primary_color: e.target.value }))}
                  className="h-10 w-14 rounded border border-border cursor-pointer"
                />
                <Input
                  value={branding.primary_color}
                  onChange={(e) => setBranding((prev) => ({ ...prev, primary_color: e.target.value }))}
                  className="flex-1"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="secondaryColor">Secondary Color</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  id="secondaryColor"
                  value={branding.secondary_color}
                  onChange={(e) => setBranding((prev) => ({ ...prev, secondary_color: e.target.value }))}
                  className="h-10 w-14 rounded border border-border cursor-pointer"
                />
                <Input
                  value={branding.secondary_color}
                  onChange={(e) => setBranding((prev) => ({ ...prev, secondary_color: e.target.value }))}
                  className="flex-1"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="accentColor">Accent Color</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  id="accentColor"
                  value={branding.accent_color}
                  onChange={(e) => setBranding((prev) => ({ ...prev, accent_color: e.target.value }))}
                  className="h-10 w-14 rounded border border-border cursor-pointer"
                />
                <Input
                  value={branding.accent_color}
                  onChange={(e) => setBranding((prev) => ({ ...prev, accent_color: e.target.value }))}
                  className="flex-1"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Font Family */}
        <div className="metric-card">
          <h3 className="text-lg font-semibold mb-4">Typography</h3>
          <div className="space-y-2">
            <Label>Font Family</Label>
            <Select
              value={branding.font_family}
              onValueChange={(value) => setBranding((prev) => ({ ...prev, font_family: value }))}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {fontOptions.map((font) => (
                  <SelectItem key={font.value} value={font.value}>
                    {font.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Preview */}
        <div className="metric-card">
          <h3 className="text-lg font-semibold mb-4">Preview</h3>
          {selectedOrg === "global" ? (
            // Login page preview for global branding
            <div
              className="rounded-lg p-6 space-y-4 bg-background border border-border"
              style={{ fontFamily: branding.font_family }}
            >
              <div className="flex items-center justify-center gap-3 mb-4">
                {branding.logo_url ? (
                  <img src={branding.logo_url} alt="Logo" className="h-12 w-auto object-contain" />
                ) : (
                  <div 
                    className="flex h-12 w-12 items-center justify-center rounded-xl"
                    style={{ backgroundColor: branding.primary_color }}
                  >
                    <span className="text-white text-xl">📊</span>
                  </div>
                )}
              </div>
              <h2 className="text-xl font-bold text-center text-foreground">{branding.app_name || "PIMP"}</h2>
              <p className="text-sm text-muted-foreground text-center">{branding.app_tagline || "Programme Information Management Platform"}</p>
              {branding.welcome_message && (
                <p className="text-sm text-muted-foreground text-center">{branding.welcome_message}</p>
              )}
              <div className="flex gap-2 justify-center mt-4">
                <button
                  className="px-4 py-2 rounded-md text-white text-sm font-medium"
                  style={{ backgroundColor: branding.primary_color }}
                >
                  Sign In
                </button>
              </div>
            </div>
          ) : (
            // Organization preview
            <div
              className="rounded-lg p-6 space-y-4"
              style={{
                backgroundColor: branding.secondary_color,
                fontFamily: branding.font_family,
              }}
            >
              <div className="flex items-center gap-3">
                {branding.logo_url && (
                  <img src={branding.logo_url} alt="Logo" className="h-8 w-auto" />
                )}
                <span className="text-white font-semibold">Your Organization</span>
              </div>
              <div className="flex gap-2">
                <button
                  className="px-4 py-2 rounded-md text-white text-sm font-medium"
                  style={{ backgroundColor: branding.primary_color }}
                >
                  Primary Button
                </button>
                <button
                  className="px-4 py-2 rounded-md text-white text-sm font-medium"
                  style={{ backgroundColor: branding.accent_color }}
                >
                  Accent Button
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Save Button */}
        <Button onClick={handleSave} disabled={loading} className="gap-2">
          <Save className="h-4 w-4" />
          {loading ? "Saving..." : "Save Branding Settings"}
        </Button>
      </div>
    </AppLayout>
  );
}