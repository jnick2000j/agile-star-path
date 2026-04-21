import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Monitor, Smartphone, X, ShieldOff } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface Session {
  id: string;
  user_agent: string | null;
  ip_address: string | null;
  device_label: string | null;
  last_seen_at: string;
  created_at: string;
  organization_id: string | null;
}

interface Props {
  scope?: "self" | "org";
  organizationId?: string;
}

export function ActiveSessionsCard({ scope = "self", organizationId }: Props) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    let q = supabase
      .from("user_sessions")
      .select("id, user_agent, ip_address, device_label, last_seen_at, created_at, organization_id")
      .is("revoked_at", null)
      .order("last_seen_at", { ascending: false });
    if (scope === "org" && organizationId) {
      q = q.eq("organization_id", organizationId);
    }
    const { data, error } = await q;
    if (error) toast.error("Failed to load sessions");
    setSessions(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [scope, organizationId]);

  const revoke = async (id: string) => {
    const { error } = await supabase.functions.invoke("session-manage", {
      body: { action: "revoke", session_id: id },
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Session revoked");
    load();
  };

  const revokeAll = async () => {
    if (!confirm("Sign out of all other sessions? You will stay signed in here.")) return;
    const { error } = await supabase.functions.invoke("session-manage", {
      body: { action: "revoke_all" },
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("All other sessions revoked");
    load();
  };

  const isMobile = (ua: string | null) =>
    !!ua && /Mobile|Android|iPhone|iPad/i.test(ua);

  const labelFromUA = (ua: string | null) => {
    if (!ua) return "Unknown device";
    if (/iPhone/.test(ua)) return "iPhone";
    if (/iPad/.test(ua)) return "iPad";
    if (/Android/.test(ua)) return "Android";
    if (/Mac/.test(ua)) return "Mac";
    if (/Windows/.test(ua)) return "Windows";
    if (/Linux/.test(ua)) return "Linux";
    return "Browser";
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Monitor className="h-5 w-5" />
              Active sessions
            </CardTitle>
            <CardDescription>
              {scope === "self"
                ? "Devices currently signed in to your account."
                : "All active sessions for members of this organization."}
            </CardDescription>
          </div>
          {scope === "self" && sessions.length > 1 && (
            <Button variant="outline" size="sm" onClick={revokeAll}>
              <ShieldOff className="mr-2 h-4 w-4" />
              Sign out everywhere else
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-24 w-full" />
        ) : sessions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No active sessions.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Device</TableHead>
                <TableHead>IP</TableHead>
                <TableHead>Last seen</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sessions.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {isMobile(s.user_agent) ? (
                        <Smartphone className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Monitor className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span className="text-sm">
                        {s.device_label ?? labelFromUA(s.user_agent)}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-mono text-xs">
                      {s.ip_address ?? "—"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDistanceToNow(new Date(s.last_seen_at), { addSuffix: true })}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => revoke(s.id)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
