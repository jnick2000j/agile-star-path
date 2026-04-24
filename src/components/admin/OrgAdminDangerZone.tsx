import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Archive, ArchiveRestore, Loader2, Rocket } from "lucide-react";
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
import { toast } from "sonner";
import { OrgOnboardingWizard } from "@/components/admin/OrgOnboardingWizard";

/** Org-admin self-service: re-run onboarding wizard, archive/unarchive own org. */
export function OrgAdminDangerZone() {
  const { user } = useAuth();
  const { currentOrganization, refreshOrganizations } = useOrganization() as any;
  const [isAdmin, setIsAdmin] = useState(false);
  const [isArchived, setIsArchived] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);

  useEffect(() => {
    if (!user || !currentOrganization?.id) return;
    (async () => {
      const [accessRes, orgRes] = await Promise.all([
        supabase
          .from("user_organization_access")
          .select("access_level")
          .eq("user_id", user.id)
          .eq("organization_id", currentOrganization.id)
          .maybeSingle(),
        supabase
          .from("organizations")
          .select("is_archived")
          .eq("id", currentOrganization.id)
          .maybeSingle(),
      ]);
      setIsAdmin(accessRes.data?.access_level === "admin");
      setIsArchived(!!(orgRes.data as any)?.is_archived);
    })();
  }, [user, currentOrganization?.id]);

  if (!isAdmin || !currentOrganization?.id) return null;

  const doArchive = async () => {
    setBusy(true);
    try {
      const { error } = await supabase.rpc("archive_organization", {
        _org_id: currentOrganization.id,
        _archive: !isArchived,
      });
      if (error) throw error;
      toast.success(isArchived ? "Organization restored" : "Organization archived");
      setIsArchived(!isArchived);
      setConfirmArchive(false);
      refreshOrganizations?.();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to update organization");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="p-6 max-w-2xl border-destructive/30">
      <h3 className="text-lg font-semibold mb-1">Organization administration</h3>
      <p className="text-sm text-muted-foreground mb-4">
        Re-run the setup wizard or archive this organization. Only platform admins can permanently delete an organization.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => setWizardOpen(true)} className="gap-2">
          <Rocket className="h-4 w-4" /> Run setup wizard
        </Button>
        <Button
          variant="outline"
          onClick={() => setConfirmArchive(true)}
          className={isArchived ? "" : "text-destructive hover:text-destructive"}
        >
          {isArchived ? (
            <><ArchiveRestore className="h-4 w-4 mr-1" /> Restore organization</>
          ) : (
            <><Archive className="h-4 w-4 mr-1" /> Archive organization</>
          )}
        </Button>
      </div>

      <AlertDialog open={confirmArchive} onOpenChange={setConfirmArchive}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isArchived ? "Restore this organization?" : "Archive this organization?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isArchived
                ? `Restore "${currentOrganization.name}" — members will regain access.`
                : `Archive "${currentOrganization.name}" — the org and its data will be hidden from active lists. You can restore it later.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={busy} onClick={(e) => { e.preventDefault(); void doArchive(); }}>
              {busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
              {isArchived ? "Restore" : "Archive"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <OrgOnboardingWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        organization={{
          id: currentOrganization.id,
          name: currentOrganization.name,
          slug: currentOrganization.slug ?? "",
          industry_vertical: (currentOrganization as any).industry_vertical ?? null,
        }}
        onSuccess={() => setWizardOpen(false)}
      />
    </Card>
  );
}
