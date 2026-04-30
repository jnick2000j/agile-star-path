import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Upload, Save, Palette, Image, Layout, Type, Eye } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSignedLogo } from "@/hooks/useSignedLogo";

const fontOptions = [
  { value: "Inter", label: "Inter" },
  { value: "Roboto", label: "Roboto" },
  { value: "Open Sans", label: "Open Sans" },
  { value: "Lato", label: "Lato" },
  { value: "Poppins", label: "Poppins" },
  { value: "Montserrat", label: "Montserrat" },
];

const colorSchemes = [
  { name: "Ocean Blue", primary: "#2563eb", secondary: "#1e293b", accent: "#3b82f6", description: "Professional and trustworthy" },
  { name: "Forest Green", primary: "#16a34a", secondary: "#14532d", accent: "#22c55e", description: "Fresh and eco-friendly" },
  { name: "Sunset Orange", primary: "#ea580c", secondary: "#431407", accent: "#f97316", description: "Warm and energetic" },
  { name: "Royal Purple", primary: "#7c3aed", secondary: "#2e1065", accent: "#8b5cf6", description: "Creative and premium" },
  { name: "Crimson Red", primary: "#dc2626", secondary: "#450a0a", accent: "#ef4444", description: "Bold and impactful" },
  { name: "Teal", primary: "#0d9488", secondary: "#134e4a", accent: "#14b8a6", description: "Calm and balanced" },
  { name: "Slate Grey", primary: "#475569", secondary: "#0f172a", accent: "#64748b", description: "Modern and neutral" },
  { name: "Rose Pink", primary: "#e11d48", secondary: "#4c0519", accent: "#f43f5e", description: "Vibrant and playful" },
  { name: "Amber Gold", primary: "#d97706", secondary: "#451a03", accent: "#f59e0b", description: "Luxurious and warm" },
  { name: "Indigo", primary: "#4f46e5", secondary: "#1e1b4b", accent: "#6366f1", description: "Deep and sophisticated" },
];

interface BrandingState {
  logo_url: string;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  font_family: string;
  app_name: string;
  app_tagline: string;
  logo_size: string;
  show_logo: boolean;
  header_font_size: string;
  hero_title: string;
  hero_description: string;
  feature_1_label: string;
  feature_1_text: string;
  feature_2_label: string;
  feature_2_text: string;
  feature_3_label: string;
  feature_3_text: string;
  feature_4_label: string;
  feature_4_text: string;
  login_footer_text: string;
  welcome_message: string;
  login_bg_image_url: string;
  login_bg_pattern: string;
  login_layout: string;
  show_features: boolean;
  login_button_text: string;
  login_cta_text: string;
  right_panel_bg_color: string;
  show_app_name: boolean;
  show_tagline: boolean;
  show_hero_title: boolean;
  show_hero_description: boolean;
  show_welcome_message: boolean;
  show_login_cta: boolean;
  show_footer: boolean;
  hero_text_color: string;
  form_text_color: string;
  app_name_color: string;
  tagline_color: string;
}

const defaultBranding: BrandingState = {
  logo_url: "",
  primary_color: "#2563eb",
  secondary_color: "#1e293b",
  accent_color: "#3b82f6",
  font_family: "Inter",
  app_name: "TaskMaster",
  app_tagline: "Program Information & Management Platform",
  logo_size: "medium",
  show_logo: true,
  header_font_size: "medium",
  hero_title: "",
  hero_description: "",
  feature_1_label: "",
  feature_1_text: "",
  feature_2_label: "",
  feature_2_text: "",
  feature_3_label: "",
  feature_3_text: "",
  feature_4_label: "",
  feature_4_text: "",
  login_footer_text: "",
  welcome_message: "",
  login_bg_image_url: "",
  login_bg_pattern: "circles",
  login_layout: "split",
  show_features: true,
  login_button_text: "",
  login_cta_text: "",
  right_panel_bg_color: "",
  show_app_name: true,
  show_tagline: true,
  show_hero_title: true,
  show_hero_description: true,
  show_welcome_message: true,
  show_login_cta: true,
  show_footer: true,
  hero_text_color: "",
  form_text_color: "",
  app_name_color: "",
  tagline_color: "",
};

export default function BrandingSettings() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [branding, setBranding] = useState<BrandingState>(defaultBranding);
  const [organizations, setOrganizations] = useState<{ id: string; name: string }[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<string>("global");

  useEffect(() => { fetchOrganizations(); }, []);
  useEffect(() => { fetchBranding(selectedOrg); }, [selectedOrg]);

  const fetchOrganizations = async () => {
    const { data } = await supabase.from("organizations").select("id, name").order("name");
    if (data) setOrganizations(data);
  };

  const fetchBranding = async (orgId: string) => {
    let query = supabase.from("branding_settings").select("*");
    query = orgId === "global" ? query.is("organization_id", null) : query.eq("organization_id", orgId);
    const { data } = await query.maybeSingle();

    if (data) {
      setBranding({
        logo_url: data.logo_url || "",
        primary_color: data.primary_color || "#2563eb",
        secondary_color: data.secondary_color || "#1e293b",
        accent_color: data.accent_color || "#3b82f6",
        font_family: data.font_family || "Inter",
        app_name: data.app_name || "TaskMaster",
        app_tagline: data.app_tagline || "Program Information & Management Platform",
        logo_size: data.logo_size || "medium",
        show_logo: data.show_logo !== false,
        header_font_size: data.header_font_size || "medium",
        hero_title: data.hero_title || "",
        hero_description: data.hero_description || "",
        feature_1_label: data.feature_1_label || "",
        feature_1_text: data.feature_1_text || "",
        feature_2_label: data.feature_2_label || "",
        feature_2_text: data.feature_2_text || "",
        feature_3_label: (data as any).feature_3_label || "",
        feature_3_text: (data as any).feature_3_text || "",
        feature_4_label: (data as any).feature_4_label || "",
        feature_4_text: (data as any).feature_4_text || "",
        login_footer_text: data.login_footer_text || "",
        welcome_message: data.welcome_message || "",
        login_bg_image_url: (data as any).login_bg_image_url || "",
        login_bg_pattern: (data as any).login_bg_pattern || "circles",
        login_layout: (data as any).login_layout || "split",
        show_features: (data as any).show_features !== false,
        login_button_text: (data as any).login_button_text || "",
        login_cta_text: (data as any).login_cta_text || "",
        right_panel_bg_color: (data as any).right_panel_bg_color || "",
        show_app_name: (data as any).show_app_name !== false,
        show_tagline: (data as any).show_tagline !== false,
        show_hero_title: (data as any).show_hero_title !== false,
        show_hero_description: (data as any).show_hero_description !== false,
        show_welcome_message: (data as any).show_welcome_message !== false,
        show_login_cta: (data as any).show_login_cta !== false,
        show_footer: (data as any).show_footer !== false,
        hero_text_color: (data as any).hero_text_color || "",
        form_text_color: (data as any).form_text_color || "",
        app_name_color: (data as any).app_name_color || "",
        tagline_color: (data as any).tagline_color || "",
      });
    } else {
      setBranding(defaultBranding);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      if (!user?.id) throw new Error("You must be signed in to upload files");
      const fileExt = file.name.split(".").pop();
      const filePath = selectedOrg === "global"
        ? `${user.id}/global-logo.${fileExt}`
        : `${selectedOrg}/logo.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from("logos").upload(filePath, file, { upsert: true });
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

  const handleBgImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      if (!user?.id) throw new Error("You must be signed in to upload files");
      const fileExt = file.name.split(".").pop();
      const filePath = selectedOrg === "global"
        ? `${user.id}/global-login-bg.${fileExt}`
        : `${selectedOrg}/login-bg.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from("logos").upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from("logos").getPublicUrl(filePath);
      setBranding((prev) => ({ ...prev, login_bg_image_url: data.publicUrl }));
      toast.success("Background image uploaded");
    } catch (error) {
      toast.error("Failed to upload background image");
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const payload: any = { ...branding };
      if (selectedOrg === "global") {
        const { data: existing } = await supabase.from("branding_settings").select("id").is("organization_id", null).maybeSingle();
        if (existing) {
          const { error } = await supabase.from("branding_settings").update(payload).is("organization_id", null);
          if (error) throw error;
        } else {
          const { error } = await supabase.from("branding_settings").insert({ organization_id: null, ...payload });
          if (error) throw error;
        }
      } else {
        const { error } = await supabase.from("branding_settings").upsert({ organization_id: selectedOrg, ...payload }, { onConflict: "organization_id" });
        if (error) throw error;
        await supabase.from("organizations").update({ primary_color: branding.primary_color, secondary_color: branding.secondary_color, logo_url: branding.logo_url }).eq("id", selectedOrg);
      }
      toast.success("Branding settings saved successfully");
      await fetchBranding(selectedOrg);
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

  const update = (key: keyof BrandingState, value: any) => setBranding((prev) => ({ ...prev, [key]: value }));

  // Signed URLs for previews — the 'logos' bucket is private.
  const signedLogoUrl = useSignedLogo(branding.logo_url);
  const signedBgUrl = useSignedLogo(branding.login_bg_image_url);

  return (
    <AppLayout title="Branding Settings" subtitle="Customize your organization's appearance">
      <div className="max-w-4xl space-y-6">
        {/* Organization Selection */}
        <div className="metric-card">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Palette className="h-5 w-5 text-primary" />
            Select Branding Target
          </h3>
          <div className="space-y-2">
            <Label>Branding For</Label>
            <Select value={selectedOrg} onValueChange={setSelectedOrg}>
              <SelectTrigger>
                <SelectValue placeholder="Select branding target" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="global">🌐 Global (Login Page & Unassigned Admins)</SelectItem>
                {organizations.map((org) => (
                  <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
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

        <Tabs defaultValue="general" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="login">Login Page</TabsTrigger>
            <TabsTrigger value="colors">Colors & Fonts</TabsTrigger>
            <TabsTrigger value="preview">Preview</TabsTrigger>
          </TabsList>

          {/* General Tab */}
          <TabsContent value="general" className="space-y-6 mt-4">
            {/* Logo */}
            <div className="metric-card">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Image className="h-5 w-5 text-primary" /> Logo Settings
              </h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Show Logo</Label>
                    <p className="text-sm text-muted-foreground">Display the logo on the login page</p>
                  </div>
                  <Switch checked={branding.show_logo} onCheckedChange={(v) => update("show_logo", v)} />
                </div>
                {branding.show_logo && (
                  <>
                    <div className="space-y-2">
                      <Label>Logo Size</Label>
                      <Select value={branding.logo_size} onValueChange={(v) => update("logo_size", v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="small">Small</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="large">Large</SelectItem>
                          <SelectItem value="xlarge">Extra Large</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {branding.logo_url && (
                      <div className="space-y-2">
                        <Label>Current Logo</Label>
                        <div className="flex items-center gap-4">
                          <img src={signedLogoUrl || branding.logo_url} alt="Logo" className="h-16 w-auto object-contain rounded-lg border border-border p-2" />
                          <Button variant="outline" size="sm" onClick={() => update("logo_url", "")}>Remove</Button>
                        </div>
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label>Upload Logo (PNG recommended)</Label>
                      <Input type="file" accept="image/png,image/svg+xml" onChange={handleLogoUpload} disabled={uploading} />
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* App Name & Tagline */}
            <div className="metric-card">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Type className="h-5 w-5 text-primary" /> Application Identity
              </h3>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Application Name</Label>
                  <Input value={branding.app_name} onChange={(e) => update("app_name", e.target.value)} placeholder="TaskMaster" />
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div>
                    <Label>Show Application Name</Label>
                    <p className="text-xs text-muted-foreground">When off, the logo appears larger and centered on the login page.</p>
                  </div>
                  <Switch checked={branding.show_app_name} onCheckedChange={(v) => update("show_app_name", v)} />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Tagline</Label>
                    <Switch checked={branding.show_tagline} onCheckedChange={(v) => update("show_tagline", v)} />
                  </div>
                  <Input value={branding.app_tagline} onChange={(e) => update("app_tagline", e.target.value)} placeholder="Program Information & Management Platform" disabled={!branding.show_tagline} />
                </div>
                <div className="space-y-2">
                  <Label>Header Text Size</Label>
                  <Select value={branding.header_font_size} onValueChange={(v) => update("header_font_size", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="small">Small</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="large">Large</SelectItem>
                      <SelectItem value="xlarge">Extra Large</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Login Page Tab */}
          <TabsContent value="login" className="space-y-6 mt-4">
            {/* Layout */}
            <div className="metric-card">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Layout className="h-5 w-5 text-primary" /> Login Page Layout
              </h3>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Layout Style</Label>
                  <Select value={branding.login_layout} onValueChange={(v) => update("login_layout", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="split">Split (Hero Left, Form Right)</SelectItem>
                      <SelectItem value="centered">Centered Card</SelectItem>
                      <SelectItem value="full-left">Full Width Hero Top</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Background Pattern</Label>
                  <Select value={branding.login_bg_pattern} onValueChange={(v) => update("login_bg_pattern", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="circles">Circles</SelectItem>
                      <SelectItem value="dots">Dots</SelectItem>
                      <SelectItem value="grid">Grid</SelectItem>
                      <SelectItem value="none">None</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Background Image (optional)</Label>
                  {branding.login_bg_image_url && (
                    <div className="flex items-center gap-3 mb-2">
                      <img src={signedBgUrl || branding.login_bg_image_url} alt="BG" className="h-16 w-24 object-cover rounded border border-border" />
                      <Button variant="outline" size="sm" onClick={() => update("login_bg_image_url", "")}>Remove</Button>
                    </div>
                  )}
                  <Input type="file" accept="image/*" onChange={handleBgImageUpload} disabled={uploading} />
                  <p className="text-xs text-muted-foreground">Replaces the colored hero panel with a background image</p>
                </div>
                <div className="space-y-2">
                  <Label>Form Panel Background Color</Label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={branding.right_panel_bg_color || "#ffffff"} onChange={(e) => update("right_panel_bg_color", e.target.value)} className="h-10 w-14 rounded border border-border cursor-pointer" />
                    <Input value={branding.right_panel_bg_color} onChange={(e) => update("right_panel_bg_color", e.target.value)} placeholder="Leave blank for default" className="flex-1" />
                    {branding.right_panel_bg_color && <Button variant="ghost" size="sm" onClick={() => update("right_panel_bg_color", "")}>Reset</Button>}
                  </div>
                </div>
              </div>
            </div>

            {/* Hero Content */}
            <div className="metric-card">
              <h3 className="text-lg font-semibold mb-2">Hero Section Content</h3>
              <p className="text-xs text-muted-foreground mb-4">Toggle individual sections on/off to control what appears on the login page.</p>
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Hero Title</Label>
                    <Switch checked={branding.show_hero_title} onCheckedChange={(v) => update("show_hero_title", v)} />
                  </div>
                  <Input value={branding.hero_title} onChange={(e) => update("hero_title", e.target.value)} placeholder="Manage programmes with confidence" disabled={!branding.show_hero_title} />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Hero Description</Label>
                    <Switch checked={branding.show_hero_description} onCheckedChange={(v) => update("show_hero_description", v)} />
                  </div>
                  <Textarea value={branding.hero_description} onChange={(e) => update("hero_description", e.target.value)} placeholder="Your tagline will be shown here by default" rows={3} disabled={!branding.show_hero_description} />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Welcome Message (Login form title)</Label>
                    <Switch checked={branding.show_welcome_message} onCheckedChange={(v) => update("show_welcome_message", v)} />
                  </div>
                  <Input value={branding.welcome_message} onChange={(e) => update("welcome_message", e.target.value)} placeholder="Welcome back" disabled={!branding.show_welcome_message} />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Call-to-Action Text</Label>
                    <Switch checked={branding.show_login_cta} onCheckedChange={(v) => update("show_login_cta", v)} />
                  </div>
                  <Input value={branding.login_cta_text} onChange={(e) => update("login_cta_text", e.target.value)} placeholder="Enter your credentials to access your dashboard." disabled={!branding.show_login_cta} />
                </div>
                <div className="space-y-2">
                  <Label>Sign In Button Text</Label>
                  <Input value={branding.login_button_text} onChange={(e) => update("login_button_text", e.target.value)} placeholder="Sign In" />
                </div>
              </div>
            </div>

            {/* Features */}
            <div className="metric-card">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Eye className="h-5 w-5 text-primary" /> Feature Cards
              </h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Show Feature Cards</Label>
                    <p className="text-sm text-muted-foreground">Display feature highlights on the login hero panel</p>
                  </div>
                  <Switch checked={branding.show_features} onCheckedChange={(v) => update("show_features", v)} />
                </div>
                {branding.show_features && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {([1, 2, 3, 4] as const).map((n) => (
                      <div key={n} className="space-y-2 p-3 rounded-lg border border-border">
                        <Label className="text-xs font-semibold text-muted-foreground">Feature {n}</Label>
                        <Input value={(branding as any)[`feature_${n}_label`] || ""} onChange={(e) => update(`feature_${n}_label` as any, e.target.value)} placeholder={`Feature ${n} title`} />
                        <Input value={(branding as any)[`feature_${n}_text`] || ""} onChange={(e) => update(`feature_${n}_text` as any, e.target.value)} placeholder={`Feature ${n} description`} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="metric-card">
              <h3 className="text-lg font-semibold mb-4">Footer</h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Show Login Footer</Label>
                  <Switch checked={branding.show_footer} onCheckedChange={(v) => update("show_footer", v)} />
                </div>
                <Input value={branding.login_footer_text} onChange={(e) => update("login_footer_text", e.target.value)} placeholder={`© ${new Date().getFullYear()} TaskMaster. All rights reserved.`} disabled={!branding.show_footer} />
              </div>
            </div>
          </TabsContent>

          {/* Colors & Fonts Tab */}
          <TabsContent value="colors" className="space-y-6 mt-4">
            <div className="metric-card">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Palette className="h-5 w-5 text-primary" /> Color Scheme Presets
              </h3>
              <div className="grid gap-3 grid-cols-2 md:grid-cols-5">
                {colorSchemes.map((scheme) => (
                  <button
                    key={scheme.name}
                    onClick={() => setBranding((prev) => ({ ...prev, primary_color: scheme.primary, secondary_color: scheme.secondary, accent_color: scheme.accent }))}
                    className={`group p-3 rounded-lg border-2 transition-all hover:scale-105 ${
                      branding.primary_color === scheme.primary && branding.secondary_color === scheme.secondary
                        ? "border-primary ring-2 ring-primary/20" : "border-border hover:border-primary/50"
                    }`}
                  >
                    <div className="flex gap-1 mb-2">
                      <div className="h-6 w-6 rounded-full border border-border/50" style={{ backgroundColor: scheme.primary }} />
                      <div className="h-6 w-6 rounded-full border border-border/50" style={{ backgroundColor: scheme.secondary }} />
                      <div className="h-6 w-6 rounded-full border border-border/50" style={{ backgroundColor: scheme.accent }} />
                    </div>
                    <p className="text-xs font-medium text-foreground">{scheme.name}</p>
                    <p className="text-[10px] text-muted-foreground">{scheme.description}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="metric-card">
              <h3 className="text-lg font-semibold mb-4">Custom Colors</h3>
              <div className="grid gap-4 md:grid-cols-3">
                {(["primary_color", "secondary_color", "accent_color"] as const).map((key) => (
                  <div key={key} className="space-y-2">
                    <Label>{key.replace("_", " ").replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())}</Label>
                    <div className="flex items-center gap-2">
                      <input type="color" value={branding[key]} onChange={(e) => update(key, e.target.value)} className="h-10 w-14 rounded border border-border cursor-pointer" />
                      <Input value={branding[key]} onChange={(e) => update(key, e.target.value)} className="flex-1" />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="metric-card">
              <h3 className="text-lg font-semibold mb-4">Font Colors</h3>
              <p className="text-xs text-muted-foreground mb-4">Customize text colors for the login page. Leave blank to use defaults.</p>
              <div className="grid gap-4 md:grid-cols-2">
                {([
                  { key: "hero_text_color", label: "Hero Panel Text", help: "Title, description & features on left panel" },
                  { key: "form_text_color", label: "Form Panel Text", help: "Welcome message & form labels on right panel" },
                  { key: "app_name_color", label: "App Name Color", help: "Application name text" },
                  { key: "tagline_color", label: "Tagline Color", help: "Tagline text" },
                ] as const).map(({ key, label, help }) => (
                  <div key={key} className="space-y-2">
                    <Label>{label}</Label>
                    <div className="flex items-center gap-2">
                      <input type="color" value={branding[key] || "#ffffff"} onChange={(e) => update(key, e.target.value)} className="h-10 w-14 rounded border border-border cursor-pointer" />
                      <Input value={branding[key]} onChange={(e) => update(key, e.target.value)} placeholder="Default" className="flex-1" />
                      {branding[key] && <Button variant="ghost" size="sm" onClick={() => update(key, "")}>Reset</Button>}
                    </div>
                    <p className="text-xs text-muted-foreground">{help}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="metric-card">
              <h3 className="text-lg font-semibold mb-4">Typography</h3>
              <div className="space-y-2">
                <Label>Font Family</Label>
                <Select value={branding.font_family} onValueChange={(v) => update("font_family", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {fontOptions.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </TabsContent>

          {/* Preview Tab */}
          <TabsContent value="preview" className="space-y-6 mt-4">
            <div className="metric-card">
              <h3 className="text-lg font-semibold mb-4">Login Page Preview</h3>
              <div className="rounded-lg border border-border overflow-hidden" style={{ fontFamily: branding.font_family }}>
                <div className="flex min-h-[400px]">
                  {/* Hero side */}
                  <div
                    className="w-1/2 p-6 text-white relative overflow-hidden flex flex-col justify-between"
                    style={{
                      backgroundColor: branding.primary_color,
                      backgroundImage: signedBgUrl ? `url(${signedBgUrl})` : undefined,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                    }}
                  >
                    {signedBgUrl && <div className="absolute inset-0 bg-black/40" />}
                    <div className="relative z-10">
                      <div className="flex items-center gap-2 mb-8">
                        {branding.show_logo && signedLogoUrl && (
                          <img src={signedLogoUrl} alt="Logo" className="h-8 w-auto object-contain" />
                        )}
                        <span className="text-sm font-semibold">{branding.app_name || "TaskMaster"}</span>
                      </div>
                      <h2 className="text-lg font-bold mb-2">{branding.hero_title || "Manage programmes with confidence"}</h2>
                      <p className="text-xs opacity-70">{branding.hero_description || branding.app_tagline}</p>
                    </div>
                    {branding.show_features && (
                      <div className="relative z-10 space-y-2">
                        {[1, 2, 3, 4].map((n) => {
                          const label = (branding as any)[`feature_${n}_label`];
                          if (!label) return null;
                          return (
                            <div key={n} className="flex items-start gap-2">
                              <div className="h-5 w-5 rounded bg-white/15 flex-shrink-0 mt-0.5" />
                              <div>
                                <p className="text-xs font-medium">{label}</p>
                                <p className="text-[10px] opacity-60">{(branding as any)[`feature_${n}_text`]}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    <p className="relative z-10 text-[10px] opacity-40">{branding.login_footer_text || `© ${new Date().getFullYear()} ${branding.app_name || "TaskMaster"}`}</p>
                  </div>
                  {/* Form side */}
                  <div className="w-1/2 p-6 flex flex-col justify-center" style={{ backgroundColor: branding.right_panel_bg_color || undefined }}>
                    <h3 className="text-base font-bold text-foreground mb-1">{branding.welcome_message || "Welcome back"}</h3>
                    <p className="text-xs text-muted-foreground mb-4">{branding.login_cta_text || "Enter your credentials to access your dashboard."}</p>
                    <div className="space-y-2">
                      <div className="h-8 rounded bg-muted/30 border border-border/60" />
                      <div className="h-8 rounded bg-muted/30 border border-border/60" />
                      <button className="w-full h-8 rounded text-white text-xs font-medium" style={{ backgroundColor: branding.primary_color }}>
                        {branding.login_button_text || "Sign In"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <Button onClick={handleSave} disabled={loading} className="gap-2">
          <Save className="h-4 w-4" />
          {loading ? "Saving..." : "Save Branding Settings"}
        </Button>
      </div>
    </AppLayout>
  );
}
