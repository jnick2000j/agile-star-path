import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Save, Globe } from "lucide-react";
import { invalidateSiteUrlCache, DEFAULT_SITE_URL } from "@/lib/site-url";

export function PlatformSettingsPanel() {
  const [siteUrl, setSiteUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("platform_settings")
        .select("value")
        .eq("key", "site_url")
        .maybeSingle();
      if (error) {
        toast.error(error.message);
      } else {
        setSiteUrl(data?.value ?? DEFAULT_SITE_URL);
      }
      setLoading(false);
    })();
  }, []);

  const handleSave = async () => {
    const trimmed = siteUrl.trim().replace(/\/$/, "");
    try {
      new URL(trimmed);
    } catch {
      toast.error("Please enter a valid URL (including https://).");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("platform_settings")
      .update({ value: trimmed })
      .eq("key", "site_url");
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    invalidateSiteUrlCache();
    setSiteUrl(trimmed);
    toast.success("Site URL updated. New auth emails will use this address.");
  };

  return (
    <div className="space-y-4">
      <Card className="p-6 max-w-3xl">
        <div className="flex items-start gap-3 mb-4">
          <Globe className="w-5 h-5 mt-1 text-primary" />
          <div>
            <h3 className="text-lg font-semibold">Production Site URL</h3>
            <p className="text-sm text-muted-foreground">
              Public URL of this deployment. Used as the redirect target in
              authentication emails (sign up, sign in, password reset). Override
              this for on-premises or custom-domain deployments.
            </p>
          </div>
        </div>

        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <div className="space-y-3">
            <div>
              <Label htmlFor="site-url">Site URL</Label>
              <Input
                id="site-url"
                type="url"
                value={siteUrl}
                onChange={(e) => setSiteUrl(e.target.value)}
                placeholder="https://app.yourcompany.com"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Default: {DEFAULT_SITE_URL}
              </p>
            </div>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Save changes
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
