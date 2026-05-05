import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, UserX, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface OrphanUser {
  user_id: string;
  email: string;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  created_at: string;
  archived: boolean;
}

interface OrgOption {
  id: string;
  name: string;
}

export function OrphanUsersPanel() {
  const [loading, setLoading] = useState(true);
  const [orphans, setOrphans] = useState<OrphanUser[]>([]);
  const [orgs, setOrgs] = useState<OrgOption[]>([]);
  const [assignTarget, setAssignTarget] = useState<Record<string, { orgId?: string; level?: string }>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    const [orphanRes, orgRes] = await Promise.all([
      supabase.rpc("list_orphan_users"),
      supabase.from("organizations").select("id, name").order("name"),
    ]);
    if (orphanRes.error) {
      toast.error(orphanRes.error.message);
    } else {
      setOrphans((orphanRes.data as OrphanUser[]) || []);
    }
    setOrgs((orgRes.data as OrgOption[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    refresh();
  }, []);

  const handleAssign = async (userId: string) => {
    const target = assignTarget[userId];
    if (!target?.orgId) {
      toast.error("Pick an organization first");
      return;
    }
    setBusyId(userId);
    const { error } = await supabase
      .from("user_organization_access")
      .upsert(
        {
          user_id: userId,
          organization_id: target.orgId,
          access_level: target.level || "editor",
        },
        { onConflict: "user_id,organization_id" }
      );
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("User assigned to organization");
      await refresh();
    }
    setBusyId(null);
  };

  const displayName = (u: OrphanUser) => {
    if (u.first_name || u.last_name) {
      return `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim();
    }
    return u.full_name || u.email;
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <UserX className="h-5 w-5" />
            Orphan Users
          </CardTitle>
          <CardDescription>
            Users with no organization assignment. Platform administrators are excluded.
          </CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : orphans.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            No orphan users — every non-admin user is assigned to at least one organization.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Assign to organization</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {orphans.map((u) => (
                <TableRow key={u.user_id}>
                  <TableCell className="font-medium">{displayName(u)}</TableCell>
                  <TableCell className="text-muted-foreground">{u.email}</TableCell>
                  <TableCell>{format(new Date(u.created_at), "PP")}</TableCell>
                  <TableCell>
                    {u.archived ? (
                      <Badge variant="secondary">Archived</Badge>
                    ) : (
                      <Badge variant="outline">Active</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Select
                        value={assignTarget[u.user_id]?.orgId}
                        onValueChange={(v) =>
                          setAssignTarget((s) => ({
                            ...s,
                            [u.user_id]: { ...s[u.user_id], orgId: v },
                          }))
                        }
                      >
                        <SelectTrigger className="w-[200px]">
                          <SelectValue placeholder="Organization" />
                        </SelectTrigger>
                        <SelectContent>
                          {orgs.map((o) => (
                            <SelectItem key={o.id} value={o.id}>
                              {o.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select
                        value={assignTarget[u.user_id]?.level || "editor"}
                        onValueChange={(v) =>
                          setAssignTarget((s) => ({
                            ...s,
                            [u.user_id]: { ...s[u.user_id], level: v },
                          }))
                        }
                      >
                        <SelectTrigger className="w-[120px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="viewer">Viewer</SelectItem>
                          <SelectItem value="editor">Editor</SelectItem>
                          <SelectItem value="manager">Manager</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      onClick={() => handleAssign(u.user_id)}
                      disabled={busyId === u.user_id}
                    >
                      {busyId === u.user_id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Assign"
                      )}
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
