import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, Eye, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import {
  downloadCertificate,
  type CertificateBranding,
  type CertificateTemplate,
  urlToDataUrl,
} from "@/lib/certificate";

interface Settings {
  template: CertificateTemplate;
  accent_color: string;
  background_color: string;
  logo_url: string | null;
  signature_image_url: string | null;
  signatory_name: string | null;
  signatory_title: string | null;
  footer_text: string | null;
}

const DEFAULTS: Settings = {
  template: "classic",
  accent_color: "#1E40AF",
  background_color: "#FFFFFF",
  logo_url: null,
  signature_image_url: null,
  signatory_name: null,
  signatory_title: null,
  footer_text: null,
};

export function LmsCertificateSettings() {
  const { currentOrganization } = useOrganization();
  const { user, userProfile } = useAuth();
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingSig, setUploadingSig] = useState(false);

  useEffect(() => {
    if (!currentOrganization?.id) return;
    (async () => {
      setLoading(true);
      const { data } = await (supabase as any)
        .from("lms_certificate_settings")
        .select("*")
        .eq("organization_id", currentOrganization.id)
        .maybeSingle();
      if (data) setSettings({ ...DEFAULTS, ...data });
      setLoading(false);
    })();
  }, [currentOrganization?.id]);

  const handleSave = async () => {
    if (!currentOrganization?.id) return;
    setSaving(true);
    const payload = { ...settings, organization_id: currentOrganization.id };
    const { error } = await (supabase as any)
      .from("lms_certificate_settings")
      .upsert(payload, { onConflict: "organization_id" });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Certificate branding saved");
  };

  const uploadAsset = async (file: File, kind: "logo" | "signature") => {
    if (!currentOrganization?.id) return;
    if (!file.type.startsWith("image/")) return toast.error("Please upload an image file");
    if (file.size > 3 * 1024 * 1024) return toast.error("Image must be under 3MB");
    const setBusy = kind === "logo" ? setUploadingLogo : setUploadingSig;
    setBusy(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `${currentOrganization.id}/certificate/${kind}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("lms-covers").upload(path, file, {
        contentType: file.type, upsert: true,
      });
      if (error) throw error;
      const { data } = supabase.storage.from("lms-covers").getPublicUrl(path);
      setSettings((s) => ({
        ...s,
        ...(kind === "logo" ? { logo_url: data.publicUrl } : { signature_image_url: data.publicUrl }),
      }));
      toast.success(`${kind === "logo" ? "Logo" : "Signature"} uploaded`);
    } catch (e: any) {
      toast.error(e?.message ?? "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  const previewCertificate = async () => {
    if (!currentOrganization?.id) return;
    const [logoDataUrl, signatureDataUrl] = await Promise.all([
      settings.logo_url ? urlToDataUrl(settings.logo_url) : Promise.resolve(null),
      settings.signature_image_url ? urlToDataUrl(settings.signature_image_url) : Promise.resolve(null),
    ]);
    const branding: CertificateBranding = {
      template: settings.template,
      accentColor: settings.accent_color,
      backgroundColor: settings.background_color,
      logoDataUrl,
      signatureDataUrl,
      signatoryName: settings.signatory_name,
      signatoryTitle: settings.signatory_title,
      footerText: settings.footer_text,
    };
    const recipientName =
      [userProfile?.first_name, userProfile?.last_name].filter(Boolean).join(" ").trim() ||
      user?.email || "Sample Learner";
    downloadCertificate({
      recipientName,
      courseTitle: "Sample Course Title",
      organizationName: currentOrganization.name,
      serial: "PREVIEW-0001",
      issuedAt: new Date(),
      finalScore: 92,
      branding,
    });
  };

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Certificate branding</CardTitle>
          <p className="text-sm text-muted-foreground">
            Customize how learner certificates look. Settings apply to every course in this organization.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>Template</Label>
              <Select
                value={settings.template}
                onValueChange={(v) => setSettings((s) => ({ ...s, template: v as CertificateTemplate }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="classic">Classic — double border</SelectItem>
                  <SelectItem value="modern">Modern — accent header bar</SelectItem>
                  <SelectItem value="minimal">Minimal — just a thin underline</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Accent color</Label>
                <div className="flex gap-2 items-center">
                  <Input
                    type="color"
                    value={settings.accent_color}
                    onChange={(e) => setSettings((s) => ({ ...s, accent_color: e.target.value }))}
                    className="h-10 w-14 p-1"
                  />
                  <Input
                    value={settings.accent_color}
                    onChange={(e) => setSettings((s) => ({ ...s, accent_color: e.target.value }))}
                    className="flex-1"
                  />
                </div>
              </div>
              <div>
                <Label>Background color</Label>
                <div className="flex gap-2 items-center">
                  <Input
                    type="color"
                    value={settings.background_color}
                    onChange={(e) => setSettings((s) => ({ ...s, background_color: e.target.value }))}
                    className="h-10 w-14 p-1"
                  />
                  <Input
                    value={settings.background_color}
                    onChange={(e) => setSettings((s) => ({ ...s, background_color: e.target.value }))}
                    className="flex-1"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <ImageField
              label="Logo"
              hint="Displayed at the top. PNG with transparent background works best."
              url={settings.logo_url}
              uploading={uploadingLogo}
              onClear={() => setSettings((s) => ({ ...s, logo_url: null }))}
              onUpload={(f) => uploadAsset(f, "logo")}
            />
            <ImageField
              label="Signature image"
              hint="Optional handwritten signature shown above the signatory name."
              url={settings.signature_image_url}
              uploading={uploadingSig}
              onClear={() => setSettings((s) => ({ ...s, signature_image_url: null }))}
              onUpload={(f) => uploadAsset(f, "signature")}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>Signatory name</Label>
              <Input
                value={settings.signatory_name ?? ""}
                onChange={(e) => setSettings((s) => ({ ...s, signatory_name: e.target.value || null }))}
                placeholder="e.g. Jane Doe"
              />
            </div>
            <div>
              <Label>Signatory title</Label>
              <Input
                value={settings.signatory_title ?? ""}
                onChange={(e) => setSettings((s) => ({ ...s, signatory_title: e.target.value || null }))}
                placeholder="e.g. Head of Learning"
              />
            </div>
          </div>

          <div>
            <Label>Footer text</Label>
            <Textarea
              value={settings.footer_text ?? ""}
              onChange={(e) => setSettings((s) => ({ ...s, footer_text: e.target.value || null }))}
              placeholder="Verify this certificate using serial {serial}."
              rows={2}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Leave blank to use the default verification line.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={previewCertificate}>
              <Eye className="h-4 w-4 mr-2" /> Preview PDF
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Save branding"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ImageField({
  label, hint, url, uploading, onUpload, onClear,
}: {
  label: string;
  hint: string;
  url: string | null;
  uploading: boolean;
  onUpload: (file: File) => void;
  onClear: () => void;
}) {
  const id = `file-${label.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <div>
      <Label>{label}</Label>
      <div className="flex items-start gap-3 mt-1">
        {url ? (
          <div className="relative">
            <img src={url} alt="" className="h-20 w-32 rounded border object-contain bg-muted/30" />
            <Button
              type="button" size="icon" variant="destructive"
              className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
              onClick={onClear}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        ) : (
          <div className="h-20 w-32 rounded border border-dashed bg-muted/40 flex items-center justify-center text-xs text-muted-foreground">
            No {label.toLowerCase()}
          </div>
        )}
        <div className="flex-1">
          <input
            id={id} type="file" accept="image/*" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); e.target.value = ""; }}
          />
          <Button
            type="button" variant="outline" size="sm" disabled={uploading}
            onClick={() => document.getElementById(id)?.click()}
          >
            <Upload className="h-4 w-4 mr-2" />
            {uploading ? "Uploading…" : url ? "Replace" : "Upload"}
          </Button>
          <p className="text-xs text-muted-foreground mt-1">{hint}</p>
        </div>
      </div>
    </div>
  );
}
