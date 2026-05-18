import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Calendar, Mail, RefreshCw, Unplug, Plug } from "lucide-react";
import { toast } from "sonner";

type Provider = "google" | "microsoft";

interface OrgIntegration { provider: Provider; enabled: boolean }
interface Connection {
  id: string;
  provider: Provider;
  account_email: string | null;
  sync_enabled: boolean;
  last_synced_at: string | null;
  last_error: string | null;
}

const META: Record<Provider, { label: string; icon: typeof Calendar }> = {
  google: { label: "Google Calendar", icon: Calendar },
  microsoft: { label: "Microsoft 365 Calendar", icon: Mail },
};

export function ConnectedCalendarsCard() {
  const { user } = useAuth();
  const { currentOrganization } = useOrganization();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [conns, setConns] = useState<Record<Provider, Connection | null>>({ google: null, microsoft: null });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<Provider | null>(null);

  const load = async () => {
    if (!user?.id || !currentOrganization?.id) return;
    setLoading(true);
    const [orgRes, connRes] = await Promise.all([
      supabase
        .from("org_calendar_integrations_public")
        .select("provider, enabled")
        .eq("organization_id", currentOrganization.id),
      supabase
        .from("user_calendar_connections")
        .select("id, provider, account_email, sync_enabled, last_synced_at, last_error")
        .eq("user_id", user.id)
        .eq("organization_id", currentOrganization.id),
    ]);
    setProviders(((orgRes.data || []) as OrgIntegration[]).filter(r => r.enabled).map(r => r.provider));
    const next: Record<Provider, Connection | null> = { google: null, microsoft: null };
    (connRes.data || []).forEach((c: any) => { next[c.provider as Provider] = c as Connection; });
    setConns(next);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user?.id, currentOrganization?.id]);

  // Handle ?calendar=connected redirect
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("calendar") === "connected") {
      toast.success("Calendar connected");
      url.searchParams.delete("calendar");
      window.history.replaceState({}, "", url.toString());
      load();
    } else if (url.searchParams.get("calendar") === "error") {
      toast.error(url.searchParams.get("reason") || "Connection failed");
      url.searchParams.delete("calendar");
      url.searchParams.delete("reason");
      window.history.replaceState({}, "", url.toString());
    }
    // eslint-disable-next-line
  }, []);

  const connect = async (provider: Provider) => {
    setBusy(provider);
    try {
      const { data, error } = await supabase.functions.invoke("calendar-oauth-start", {
        body: { provider, organization_id: currentOrganization!.id },
      });
      if (error || !data?.url) throw new Error(error?.message || "No redirect URL");
      window.location.href = data.url;
    } catch (e: any) {
      toast.error(e.message || "Could not start connection");
      setBusy(null);
    }
  };

  const disconnect = async (provider: Provider) => {
    setBusy(provider);
    const conn = conns[provider];
    if (!conn) { setBusy(null); return; }
    await supabase.from("user_calendar_connections").delete().eq("id", conn.id);
    toast.success("Disconnected");
    await load();
    setBusy(null);
  };

  const toggleSync = async (provider: Provider, on: boolean) => {
    const conn = conns[provider];
    if (!conn) return;
    await supabase.from("user_calendar_connections").update({ sync_enabled: on }).eq("id", conn.id);
    setConns({ ...conns, [provider]: { ...conn, sync_enabled: on } });
  };

  const syncNow = async (provider: Provider) => {
    setBusy(provider);
    try {
      await supabase.functions.invoke("calendar-sync-push", { body: { provider } });
      await supabase.functions.invoke("calendar-sync-pull", { body: { provider } });
      toast.success("Sync triggered");
      await load();
    } catch (e: any) {
      toast.error(e.message || "Sync failed");
    } finally {
      setBusy(null);
    }
  };

  if (loading) return null;
  if (providers.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plug className="h-5 w-5" /> Connected Calendars
          </CardTitle>
          <CardDescription>
            No calendar providers have been enabled by your administrator yet.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plug className="h-5 w-5" /> Connected Calendars
        </CardTitle>
        <CardDescription>
          Two-way sync between your assigned tasks and your calendar.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {providers.map((p) => {
          const Icon = META[p].icon;
          const conn = conns[p];
          return (
            <div key={p} className="rounded border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon className="h-5 w-5" />
                  <div>
                    <p className="font-medium text-sm">{META[p].label}</p>
                    {conn ? (
                      <p className="text-xs text-muted-foreground">
                        Connected{conn.account_email ? ` as ${conn.account_email}` : ""}
                        {conn.last_synced_at && ` · last sync ${new Date(conn.last_synced_at).toLocaleString()}`}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground">Not connected</p>
                    )}
                    {conn?.last_error && (
                      <p className="text-xs text-destructive mt-1">{conn.last_error}</p>
                    )}
                  </div>
                </div>
                {conn ? (
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2 mr-2">
                      <Label htmlFor={`sync-${p}`} className="text-xs">Sync</Label>
                      <Switch
                        id={`sync-${p}`}
                        checked={conn.sync_enabled}
                        onCheckedChange={(v) => toggleSync(p, v)}
                      />
                    </div>
                    <Button variant="outline" size="sm" onClick={() => syncNow(p)} disabled={busy === p}>
                      <RefreshCw className="h-4 w-4 mr-1" /> Sync now
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => disconnect(p)} disabled={busy === p}>
                      <Unplug className="h-4 w-4 mr-1" /> Disconnect
                    </Button>
                  </div>
                ) : (
                  <Button size="sm" onClick={() => connect(p)} disabled={busy === p}>
                    <Plug className="h-4 w-4 mr-1" /> Connect
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
