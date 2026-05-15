import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, Copy, RefreshCw, Trash2, ExternalLink } from "lucide-react";
import { toast } from "sonner";

interface TokenRow {
  id: string;
  token: string;
  scope: "my_tasks" | "org_tasks";
  revoked_at: string | null;
  last_accessed_at: string | null;
  created_at: string;
}

function genToken() {
  const bytes = new Uint8Array(36);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function CalendarSyncSection() {
  const { user } = useAuth();
  const { currentOrganization } = useOrganization();
  const [token, setToken] = useState<TokenRow | null>(null);
  const [scope, setScope] = useState<"my_tasks" | "org_tasks">("my_tasks");
  const [loading, setLoading] = useState(true);

  const projectRef = (import.meta as any).env?.VITE_SUPABASE_PROJECT_ID as string | undefined;
  const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL as string | undefined;
  const fnBase = supabaseUrl ? `${supabaseUrl}/functions/v1/task-calendar-ics` : `https://${projectRef}.functions.supabase.co/task-calendar-ics`;

  const httpsUrl = token ? `${fnBase}?token=${token.token}` : "";
  const webcalUrl = httpsUrl ? httpsUrl.replace(/^https?:\/\//, "webcal://") : "";

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("task_calendar_tokens")
        .select("*")
        .eq("user_id", user.id)
        .is("revoked_at", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) {
        setToken(data as TokenRow);
        setScope((data as TokenRow).scope);
      }
      setLoading(false);
    })();
  }, [user?.id]);

  const generate = async () => {
    if (!user?.id || !currentOrganization?.id) return;
    if (token) {
      await supabase.from("task_calendar_tokens").update({ revoked_at: new Date().toISOString() }).eq("id", token.id);
    }
    const newToken = genToken();
    const { data, error } = await supabase
      .from("task_calendar_tokens")
      .insert({ user_id: user.id, organization_id: currentOrganization.id, token: newToken, scope })
      .select()
      .single();
    if (error) {
      toast.error(`Failed: ${error.message}`);
      return;
    }
    setToken(data as TokenRow);
    toast.success("Calendar feed ready");
  };

  const revoke = async () => {
    if (!token) return;
    await supabase.from("task_calendar_tokens").update({ revoked_at: new Date().toISOString() }).eq("id", token.id);
    setToken(null);
    toast.success("Feed revoked");
  };

  const copy = async (value: string) => {
    await navigator.clipboard.writeText(value);
    toast.success("Copied");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" /> Calendar Sync
        </CardTitle>
        <CardDescription>
          Subscribe to your tasks from Google Calendar, Outlook, or Apple Calendar. Updates flow automatically.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : !token ? (
          <div className="space-y-3">
            <div>
              <Label>Include</Label>
              <Select value={scope} onValueChange={(v) => setScope(v as any)}>
                <SelectTrigger className="w-full max-w-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="my_tasks">My tasks only</SelectItem>
                  <SelectItem value="org_tasks">All organisation tasks</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={generate}>
              <Calendar className="h-4 w-4 mr-2" /> Generate Feed
            </Button>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <Label>Subscription URL (one-click in most calendars)</Label>
              <div className="flex gap-2">
                <Input readOnly value={webcalUrl} className="font-mono text-xs" />
                <Button variant="outline" size="icon" onClick={() => copy(webcalUrl)}><Copy className="h-4 w-4" /></Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>HTTPS URL (paste into Google Calendar → Add by URL)</Label>
              <div className="flex gap-2">
                <Input readOnly value={httpsUrl} className="font-mono text-xs" />
                <Button variant="outline" size="icon" onClick={() => copy(httpsUrl)}><Copy className="h-4 w-4" /></Button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
              <Button asChild variant="outline" size="sm">
                <a
                  href={`https://calendar.google.com/calendar/r?cid=${encodeURIComponent(httpsUrl)}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <ExternalLink className="h-4 w-4 mr-2" /> Add to Google Calendar
                </a>
              </Button>
              <Button asChild variant="outline" size="sm">
                <a href={httpsUrl} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-4 w-4 mr-2" /> Download .ics
                </a>
              </Button>
              <Button variant="outline" size="sm" onClick={generate}>
                <RefreshCw className="h-4 w-4 mr-2" /> Regenerate (revokes old)
              </Button>
              <Button variant="destructive" size="sm" onClick={revoke}>
                <Trash2 className="h-4 w-4 mr-2" /> Revoke
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Treat this URL like a password — anyone with it can read your task schedule.
              {token.last_accessed_at && (
                <> Last accessed {new Date(token.last_accessed_at).toLocaleString()}.</>
              )}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
