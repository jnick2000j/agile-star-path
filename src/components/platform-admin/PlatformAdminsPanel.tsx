import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  ShieldAlert,
  ShieldCheck,
  Loader2,
  Plus,
  Trash2,
  Search,
  Check,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";

/**
 * PlatformAdminsPanel
 * -------------------
 * Grant or revoke the platform-wide `admin` role (stored in user_roles).
 * Platform admins bypass org-scoped checks via is_admin(uid). This is the
 * highest-privilege grant in the system, so it lives on /platform-admin
 * and is itself only usable by existing platform admins.
 *
 * NOTE: We query the `profiles` table directly (not the profiles_directory
 * view) because the view is filtered to "users in shared org OR self OR
 * platform admin" — and platform admins may not share an org with everyone
 * they need to grant. The RLS on `profiles` already grants platform admins
 * read access to all profiles via `is_admin(auth.uid())`.
 */
interface AdminRow {
  user_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  granted_at: string;
}

interface CandidateUser {
  user_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
}

function displayName(r: { first_name: string | null; last_name: string | null; email: string }) {
  const fn = r.first_name?.trim();
  const ln = r.last_name?.trim();
  if (fn || ln) return `${fn ?? ""} ${ln ?? ""}`.trim();
  return r.email;
}

export function PlatformAdminsPanel() {
  const { user: currentUser } = useAuth();
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [grantOpen, setGrantOpen] = useState(false);
  const [candidates, setCandidates] = useState<CandidateUser[]>([]);
  const [candidatesLoading, setCandidatesLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [granting, setGranting] = useState(false);
  const [pickedUserId, setPickedUserId] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [revokeTarget, setRevokeTarget] = useState<AdminRow | null>(null);
  const [revokeBusy, setRevokeBusy] = useState(false);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    setLoadError(null);
    try {
      const { data: roleRows, error: roleErr } = await supabase
        .from("user_roles")
        .select("user_id, created_at")
        .eq("role", "admin")
        .order("created_at", { ascending: true });
      if (roleErr) throw roleErr;

      const ids = (roleRows ?? []).map((r) => r.user_id);
      if (ids.length === 0) {
        setAdmins([]);
        return;
      }

      const { data: profiles, error: profErr } = await supabase
        .from("profiles")
        .select("user_id,email,first_name,last_name")
        .in("user_id", ids);
      if (profErr) throw profErr;

      const byUser = new Map((profiles ?? []).map((p: any) => [p.user_id, p]));
      const rows: AdminRow[] = (roleRows ?? []).map((r: any) => {
        const p = byUser.get(r.user_id) as any;
        return {
          user_id: r.user_id,
          email: p?.email ?? "(no profile)",
          first_name: p?.first_name ?? null,
          last_name: p?.last_name ?? null,
          granted_at: r.created_at,
        };
      });
      rows.sort((a, b) => a.email.localeCompare(b.email));
      setAdmins(rows);
    } catch (e: any) {
      console.error("PlatformAdminsPanel.load:", e);
      setLoadError(e?.message || "Failed to load platform admins");
    } finally {
      setLoading(false);
    }
  }

  async function openGrantDialog() {
    setGrantOpen(true);
    setPickedUserId(null);
    setConfirmText("");
    setSearch("");
    setCandidates([]);
    setCandidatesLoading(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id,email,first_name,last_name")
        .order("email", { ascending: true })
        .limit(1000);
      if (error) throw error;
      const adminIds = new Set(admins.map((a) => a.user_id));
      const list = (data ?? [])
        .filter((u: any) => !adminIds.has(u.user_id))
        .map((u: any) => ({
          user_id: u.user_id,
          email: u.email,
          first_name: u.first_name,
          last_name: u.last_name,
        }));
      setCandidates(list);
    } catch (e: any) {
      console.error("PlatformAdminsPanel.openGrantDialog:", e);
      toast.error(e?.message || "Failed to load users");
    } finally {
      setCandidatesLoading(false);
    }
  }

  async function grantAdmin() {
    if (!pickedUserId) return;
    setGranting(true);
    try {
      const { error } = await supabase
        .from("user_roles")
        .insert({ user_id: pickedUserId, role: "admin" });
      if (error) throw error;
      toast.success("Platform admin granted");
      setGrantOpen(false);
      void load();
    } catch (e: any) {
      console.error("PlatformAdminsPanel.grantAdmin:", e);
      toast.error(e?.message || "Failed to grant platform admin");
    } finally {
      setGranting(false);
    }
  }

  async function revokeAdmin() {
    if (!revokeTarget) return;
    if (revokeTarget.user_id === currentUser?.id) {
      toast.error("You cannot revoke your own platform admin role.");
      return;
    }
    setRevokeBusy(true);
    try {
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", revokeTarget.user_id)
        .eq("role", "admin");
      if (error) throw error;
      toast.success("Platform admin revoked");
      setRevokeTarget(null);
      void load();
    } catch (e: any) {
      console.error("PlatformAdminsPanel.revokeAdmin:", e);
      toast.error(e?.message || "Failed to revoke platform admin");
    } finally {
      setRevokeBusy(false);
    }
  }

  const q = search.trim().toLowerCase();
  const filteredCandidates = !q
    ? candidates
    : candidates.filter((c) => {
        const name = `${c.first_name ?? ""} ${c.last_name ?? ""}`.toLowerCase();
        return c.email.toLowerCase().includes(q) || name.includes(q);
      });

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-destructive" />
            Platform Administrators
          </h2>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Platform admins bypass all organization-level access checks and can
            manage every tenant on the system. Grant this only to trusted
            internal staff. This is the highest privilege in the system and
            does not require organization membership.
          </p>
        </div>
        <Button onClick={openGrantDialog} className="gap-2">
          <Plus className="h-4 w-4" />
          Grant platform admin
        </Button>
      </div>

      {loadError && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          {loadError}
        </div>
      )}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Granted</TableHead>
              <TableHead className="w-[120px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8">
                  <Loader2 className="inline h-5 w-5 animate-spin text-muted-foreground" />
                </TableCell>
              </TableRow>
            )}
            {!loading && admins.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                  No platform admins configured.
                </TableCell>
              </TableRow>
            )}
            {!loading &&
              admins.map((a) => (
                <TableRow key={a.user_id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-primary" />
                      {displayName(a)}
                      {a.user_id === currentUser?.id && (
                        <Badge variant="secondary" className="text-xs">You</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{a.email}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {new Date(a.granted_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      disabled={a.user_id === currentUser?.id}
                      onClick={() => setRevokeTarget(a)}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Revoke
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>

      {/* Grant dialog */}
      <Dialog open={grantOpen} onOpenChange={setGrantOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Grant platform admin</DialogTitle>
            <DialogDescription>
              The selected user will gain unrestricted access to every
              organization, every tenant's data, and the platform-admin
              console. Type <strong>GRANT</strong> to confirm.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or email"
                className="pl-8"
                autoFocus
              />
            </div>

            <div className="rounded-md border">
              <ScrollArea className="h-64">
                {candidatesLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredCandidates.length === 0 ? (
                  <div className="px-3 py-8 text-center text-sm text-muted-foreground">
                    {candidates.length === 0
                      ? "No users available."
                      : "No users match your search."}
                  </div>
                ) : (
                  <ul className="divide-y">
                    {filteredCandidates.slice(0, 200).map((c) => {
                      const picked = pickedUserId === c.user_id;
                      return (
                        <li key={c.user_id}>
                          <button
                            type="button"
                            onClick={() => setPickedUserId(c.user_id)}
                            className={`w-full flex items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-accent/60 ${
                              picked ? "bg-accent" : ""
                            }`}
                          >
                            <div className="min-w-0">
                              <div className="font-medium truncate">{displayName(c)}</div>
                              <div className="text-xs text-muted-foreground truncate">{c.email}</div>
                            </div>
                            {picked && <Check className="h-4 w-4 text-primary shrink-0" />}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </ScrollArea>
            </div>

            <div className="space-y-1">
              <Label htmlFor="grant-confirm">Type GRANT to confirm</Label>
              <Input
                id="grant-confirm"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="GRANT"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setGrantOpen(false)}>Cancel</Button>
            <Button
              onClick={grantAdmin}
              disabled={!pickedUserId || confirmText !== "GRANT" || granting}
            >
              {granting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Grant platform admin
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke confirm */}
      <AlertDialog open={!!revokeTarget} onOpenChange={(o) => !o && setRevokeTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke platform admin?</AlertDialogTitle>
            <AlertDialogDescription>
              {revokeTarget && (
                <>
                  <strong>{displayName(revokeTarget)}</strong> ({revokeTarget.email}) will
                  immediately lose platform-wide administrative access. They
                  will keep any organization-scoped roles they currently hold.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={revokeBusy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={revokeAdmin}
              disabled={revokeBusy}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {revokeBusy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Revoke
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
