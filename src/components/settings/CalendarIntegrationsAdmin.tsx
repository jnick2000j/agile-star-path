import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { useOrgAccessLevel } from "@/hooks/useOrgAccessLevel";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Copy, Save, Calendar, Mail, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

type Provider = "google" | "microsoft";

interface Integration {
  id?: string;
  organization_id: string;
  provider: Provider;
  enabled: boolean;
  use_custom_oauth: boolean;
  custom_client_id: string | null;
  custom_client_secret: string | null;
  tenant_id: string | null;
}

const SUPABASE_URL = (import.meta as any).env?.VITE_SUPABASE_URL as string;
const REDIRECT_URI = `${SUPABASE_URL}/functions/v1/calendar-oauth-callback`;

const PROVIDER_META: Record<Provider, {
  label: string;
  icon: typeof Calendar;
  scopes: string;
  consoleUrl: string;
  consoleLabel: string;
  showsTenant: boolean;
}> = {
  google: {
    label: "Google Calendar",
    icon: Calendar,
    scopes: "openid email https://www.googleapis.com/auth/calendar.events",
    consoleUrl: "https://console.cloud.google.com/apis/credentials",
    consoleLabel: "Google Cloud Console",
    showsTenant: false,
  },
  microsoft: {
    label: "Microsoft 365 Calendar",
    icon: Mail,
    scopes: "openid email offline_access Calendars.ReadWrite User.Read",
    consoleUrl: "https://entra.microsoft.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade",
    consoleLabel: "Microsoft Entra admin center",
    showsTenant: true,
  },
};

function emptyIntegration(org: string, provider: Provider): Integration {
  return {
    organization_id: org,
    provider,
    enabled: false,
    use_custom_oauth: true,
    custom_client_id: "",
    custom_client_secret: "",
    tenant_id: provider === "microsoft" ? "common" : null,
  };
}

function ProviderCard({ value, onSave }: { value: Integration; onSave: (v: Integration) => Promise<void> }) {
  const [draft, setDraft] = useState<Integration>(value);
  const [saving, setSaving] = useState(false);
  const meta = PROVIDER_META[draft.provider];
  const Icon = meta.icon;

  useEffect(() => setDraft(value), [value.id, value.organization_id, value.provider]);

  const copy = (s: string) => { navigator.clipboard.writeText(s); toast.success("Copied"); };

  const save = async () => {
    setSaving(true);
    try {
      await onSave(draft);
      toast.success(`${meta.label} settings saved`);
    } catch (e: any) {
      toast.error(e.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon className="h-5 w-5" /> {meta.label}
        </CardTitle>
        <CardDescription>
          Allow users in your organisation to two-way sync their assigned tasks with {meta.label}.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-sm">Enable for this organisation</Label>
            <p className="text-xs text-muted-foreground">Users can connect their personal {meta.label} from their profile.</p>
          </div>
          <Switch checked={draft.enabled} onCheckedChange={(v) => setDraft({ ...draft, enabled: v })} />
        </div>

        {draft.enabled && (
          <>
            <div className="rounded border p-3 text-xs text-muted-foreground">
              Register an OAuth application in the <a href={meta.consoleUrl} target="_blank" rel="noreferrer" className="text-primary underline">{meta.consoleLabel}</a>, then paste the Client ID and Secret below. Users will see your organisation's branding on the consent screen.
            </div>
                <div className="space-y-1">
                  <Label className="text-xs">Redirect URI (paste this into your OAuth app)</Label>
                  <div className="flex gap-2">
                    <Input readOnly value={REDIRECT_URI} className="font-mono text-xs" />
                    <Button variant="outline" size="icon" onClick={() => copy(REDIRECT_URI)}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Required scopes</Label>
                  <div className="flex gap-2">
                    <Input readOnly value={meta.scopes} className="font-mono text-xs" />
                    <Button variant="outline" size="icon" onClick={() => copy(meta.scopes)}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Client ID</Label>
                  <Input
                    value={draft.custom_client_id || ""}
                    onChange={(e) => setDraft({ ...draft, custom_client_id: e.target.value })}
                    placeholder={draft.provider === "google" ? "xxxxxxxxxxxx.apps.googleusercontent.com" : "Application (client) ID"}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Client Secret</Label>
                  <Input
                    type="password"
                    value={draft.custom_client_secret || ""}
                    onChange={(e) => setDraft({ ...draft, custom_client_secret: e.target.value })}
                    placeholder="••••••••"
                  />
                </div>
                {meta.showsTenant && (
                  <div className="space-y-1">
                    <Label className="text-xs">Tenant ID</Label>
                    <Input
                      value={draft.tenant_id || ""}
                      onChange={(e) => setDraft({ ...draft, tenant_id: e.target.value })}
                      placeholder="common (multi-tenant) or your tenant GUID"
                    />
                  </div>
                )}
                <a
                  href={meta.consoleUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-primary underline inline-block"
                >
                  Open {meta.consoleLabel} →
                </a>
          </>
        )}

        <div className="flex justify-end">
          <Button onClick={save} disabled={saving} className="gap-2">
            <Save className="h-4 w-4" /> {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function CalendarIntegrationsAdmin() {
  const { currentOrganization } = useOrganization();
  const { accessLevel, loading: aclLoading } = useOrgAccessLevel();
  const [rows, setRows] = useState<Record<Provider, Integration>>({
    google: emptyIntegration("", "google"),
    microsoft: emptyIntegration("", "microsoft"),
  });
  const [loading, setLoading] = useState(true);

  const isAdmin = accessLevel === "admin";

  useEffect(() => {
    if (!currentOrganization?.id) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("organization_calendar_integrations")
        .select("*")
        .eq("organization_id", currentOrganization.id);
      const next: Record<Provider, Integration> = {
        google: emptyIntegration(currentOrganization.id, "google"),
        microsoft: emptyIntegration(currentOrganization.id, "microsoft"),
      };
      (data || []).forEach((r: any) => { next[r.provider as Provider] = r as Integration; });
      setRows(next);
      setLoading(false);
    })();
  }, [currentOrganization?.id]);

  const saveOne = async (v: Integration) => {
    const payload = {
      organization_id: v.organization_id,
      provider: v.provider,
      enabled: v.enabled,
      use_custom_oauth: v.use_custom_oauth,
      custom_client_id: v.custom_client_id || null,
      custom_client_secret: v.custom_client_secret || null,
      tenant_id: v.tenant_id || null,
    };
    const { data, error } = await supabase
      .from("organization_calendar_integrations")
      .upsert(payload, { onConflict: "organization_id,provider" })
      .select()
      .single();
    if (error) throw error;
    setRows((r) => ({ ...r, [v.provider]: data as Integration }));
  };

  if (aclLoading || loading) return <p className="text-sm text-muted-foreground">Loading…</p>;

  if (!isAdmin) {
    return (
      <Alert>
        <ShieldAlert className="h-4 w-4" />
        <AlertDescription>
          Calendar integrations can only be configured by an Organisation Admin.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <ProviderCard value={rows.google} onSave={saveOne} />
      <ProviderCard value={rows.microsoft} onSave={saveOne} />
    </div>
  );
}
