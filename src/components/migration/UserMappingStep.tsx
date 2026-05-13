import { useEffect, useMemo, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Info, Loader2, MailPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import type { DiscoveredUser, FieldMapping } from "@/lib/migration/types";

type Disposition = "match" | "invite" | "skip" | "manual";

interface RowState {
  user: DiscoveredUser;
  matchedUserId?: string;
  matchedName?: string;
  disposition: Disposition;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface Props {
  discoveredUsers: DiscoveredUser[];
  /** True while the wizard is fetching the discovery list. */
  loading: boolean;
  mapping: FieldMapping;
  onChange: (m: FieldMapping) => void;
  organizationIdOverride?: string;
}

export function UserMappingStep({
  discoveredUsers,
  loading,
  mapping,
  onChange,
  organizationIdOverride,
}: Props) {
  const { currentOrganization } = useOrganization();
  const orgId = organizationIdOverride ?? currentOrganization?.id;

  const [rows, setRows] = useState<RowState[]>([]);
  const [resolving, setResolving] = useState(false);
  const [inviting, setInviting] = useState(false);

  // Initial auto-match by email against profiles.
  useEffect(() => {
    if (!discoveredUsers.length) {
      setRows([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setResolving(true);
      const emails = Array.from(
        new Set(discoveredUsers.map((u) => u.email).filter(Boolean) as string[]),
      );
      const profByEmail = new Map<string, { user_id: string; first_name: string | null; last_name: string | null; email: string }>();
      if (emails.length) {
        const { data } = await supabase
          .from("profiles")
          .select("user_id, email, first_name, last_name")
          .in("email", emails);
        for (const p of data ?? []) {
          profByEmail.set(String(p.email).toLowerCase(), p as any);
        }
      }
      if (cancelled) return;
      const next: RowState[] = discoveredUsers.map((u) => {
        const match = u.email ? profByEmail.get(u.email.toLowerCase()) : undefined;
        return {
          user: u,
          matchedUserId: match?.user_id,
          matchedName: match
            ? [match.first_name, match.last_name].filter(Boolean).join(" ") || match.email
            : undefined,
          disposition: match
            ? "match"
            : (u.email && EMAIL_RE.test(u.email) ? "invite" : "skip"),
        };
      });
      setRows(next);
      // Persist initial matches into mapping.user
      const userMap: Record<string, string> = { ...(mapping.user ?? {}) };
      for (const r of next) {
        if (r.matchedUserId) userMap[r.user.externalId] = r.matchedUserId;
      }
      onChange({ ...mapping, user: userMap });
      setResolving(false);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [discoveredUsers]);

  const counts = useMemo(() => ({
    matched: rows.filter((r) => r.disposition === "match").length,
    invite: rows.filter((r) => r.disposition === "invite").length,
    skip: rows.filter((r) => r.disposition === "skip").length,
  }), [rows]);

  const setRowDisposition = (idx: number, d: Disposition) => {
    setRows((prev) => {
      const next = prev.slice();
      next[idx] = { ...next[idx], disposition: d };
      // Update mapping.user accordingly
      const userMap: Record<string, string> = { ...(mapping.user ?? {}) };
      if (d === "match" && next[idx].matchedUserId) {
        userMap[next[idx].user.externalId] = next[idx].matchedUserId!;
      } else {
        delete userMap[next[idx].user.externalId];
      }
      onChange({ ...mapping, user: userMap });
      return next;
    });
  };

  const inviteAll = async () => {
    const targets = rows
      .map((r, i) => ({ r, i }))
      .filter(({ r }) => r.disposition === "invite" && r.user.email && EMAIL_RE.test(r.user.email!));
    if (!targets.length || !orgId) return;
    setInviting(true);
    try {
      const payloadRows = targets.map(({ r }) => {
        const name = (r.user.displayName ?? "").trim().split(/\s+/);
        return {
          email: r.user.email!.toLowerCase(),
          first_name: name[0] || r.user.email!.split("@")[0],
          last_name: name.slice(1).join(" ") || "",
          access_level: "viewer",
          send_invite: true,
        };
      });
      const { data, error } = await supabase.functions.invoke("bulk-create-users", {
        body: {
          rows: payloadRows,
          organization_id: orgId,
          redirect_to: `${window.location.origin}/auth/confirm`,
        },
      });
      if (error) throw error;
      const out = ((data as any)?.rows ?? []) as { email: string; user_id?: string; status: string }[];
      // Apply newly-created/linked user_ids to mapping
      const userMap: Record<string, string> = { ...(mapping.user ?? {}) };
      const next = rows.slice();
      for (const { r, i } of targets) {
        const m = out.find((o) => o.email === r.user.email!.toLowerCase());
        if (m?.user_id) {
          userMap[r.user.externalId] = m.user_id;
          next[i] = { ...next[i], matchedUserId: m.user_id, matchedName: r.user.displayName ?? r.user.email, disposition: "match" };
        }
      }
      setRows(next);
      onChange({ ...mapping, user: userMap });
      const s = (data as any)?.summary;
      toast.success(`Invited: ${s?.created ?? 0} created, ${s?.linked ?? 0} linked`);
    } catch (e: any) {
      toast.error(e.message || "Auto-invite failed");
    } finally {
      setInviting(false);
    }
  };

  if (loading || resolving) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
        <Loader2 className="h-4 w-4 animate-spin" /> Discovering source users…
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>No source users found</AlertTitle>
        <AlertDescription className="text-xs">
          The selected scope didn't surface any assignees or reporters to map.
          Imported records will keep their original creator on the platform.
        </AlertDescription>
      </Alert>
    );
  }

  const inviteable = counts.invite;

  return (
    <div className="space-y-3">
      <Alert>
        <Users className="h-4 w-4" />
        <AlertTitle>User mapping (optional)</AlertTitle>
        <AlertDescription className="text-xs">
          Auto-matched against existing platform users by email. Unmatched users
          with valid emails default to <strong>Invite</strong>; you can switch
          them to <strong>Skip</strong> per row, or click "Invite all" to
          provision them now.
        </AlertDescription>
      </Alert>

      <div className="flex items-center gap-2 text-xs">
        <Badge variant="secondary">{counts.matched} matched</Badge>
        <Badge variant="outline">{counts.invite} to invite</Badge>
        <Badge variant="outline">{counts.skip} to skip</Badge>
        <div className="ml-auto">
          <Button
            size="sm"
            variant="default"
            onClick={inviteAll}
            disabled={!inviteable || inviting}
            className="gap-1.5"
          >
            {inviting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MailPlus className="h-3.5 w-3.5" />}
            Invite all ({inviteable})
          </Button>
        </div>
      </div>

      <ScrollArea className="max-h-[40vh] border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Source user</TableHead>
              <TableHead>Refs</TableHead>
              <TableHead>Match</TableHead>
              <TableHead>Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r, i) => {
              const validEmail = !!r.user.email && EMAIL_RE.test(r.user.email);
              return (
                <TableRow key={r.user.externalId}>
                  <TableCell>
                    <div className="text-xs">
                      <div className="font-medium">{r.user.displayName || r.user.email || r.user.externalId}</div>
                      {r.user.email && (
                        <div className="text-muted-foreground">{r.user.email}</div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.user.refCount ?? 1}</TableCell>
                  <TableCell className="text-xs">
                    {r.matchedUserId
                      ? <Badge variant="default" className="bg-success">{r.matchedName ?? "matched"}</Badge>
                      : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell>
                    <Select
                      value={r.disposition}
                      onValueChange={(v) => setRowDisposition(i, v as Disposition)}
                    >
                      <SelectTrigger className="h-7 w-32 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {r.matchedUserId && <SelectItem value="match" className="text-xs">Linked</SelectItem>}
                        <SelectItem value="invite" disabled={!validEmail} className="text-xs">Invite</SelectItem>
                        <SelectItem value="skip" className="text-xs">Skip</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </ScrollArea>
    </div>
  );
}
