import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Building2, Plus, X, Crown, AlertCircle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { toast } from "sonner";

interface BillingAccount {
  id: string;
  name: string;
  owner_organization_id: string;
  stripe_customer_id: string | null;
}

interface AttachedOrg {
  id: string;
  name: string;
  is_archived: boolean;
  is_owner: boolean;
}

interface PlanInfo {
  plan_id: string;
  plan_name: string;
  included_orgs: number;
  extra_org_price_monthly: number;
  status: string;
}

interface UserOrg {
  id: string;
  name: string;
  billing_account_id: string | null;
}

export function BillingAccountPanel({ isAdmin }: { isAdmin: boolean }) {
  const { currentOrganization } = useOrganization();
  const [account, setAccount] = useState<BillingAccount | null>(null);
  const [orgs, setOrgs] = useState<AttachedOrg[]>([]);
  const [plan, setPlan] = useState<PlanInfo | null>(null);
  const [availableOrgs, setAvailableOrgs] = useState<UserOrg[]>([]);
  const [loading, setLoading] = useState(true);
  const [attachOpen, setAttachOpen] = useState(false);
  const [orgToAttach, setOrgToAttach] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!currentOrganization?.id) return;
    setLoading(true);
    try {
      // Find this org's billing account id
      const { data: orgRow } = await supabase
        .from("organizations")
        .select("billing_account_id")
        .eq("id", currentOrganization.id)
        .maybeSingle();

      const accountId = orgRow?.billing_account_id;
      if (!accountId) {
        setAccount(null);
        setOrgs([]);
        setPlan(null);
        setAvailableOrgs([]);
        return;
      }

      const [acctRes, orgsRes, planRes] = await Promise.all([
        supabase.from("billing_accounts").select("*").eq("id", accountId).maybeSingle(),
        supabase.rpc("list_billing_account_orgs", { _account_id: accountId }),
        supabase.rpc("get_billing_account_plan", { _account_id: accountId }),
      ]);

      setAccount(acctRes.data as any);
      setOrgs((orgsRes.data as any) || []);
      const p = Array.isArray(planRes.data) ? planRes.data[0] : null;
      setPlan(p);

      // Orgs the current user has admin access to that are NOT yet on this account
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: access } = await supabase
          .from("user_organization_access")
          .select("organization_id, access_level, organizations!inner(id, name, billing_account_id, is_archived)")
          .eq("user_id", user.id)
          .eq("access_level", "admin");

        const candidates: UserOrg[] = (access || [])
          .map((r: any) => r.organizations)
          .filter((o: any) => o && !o.is_archived && o.billing_account_id !== accountId)
          .map((o: any) => ({ id: o.id, name: o.name, billing_account_id: o.billing_account_id }));
        setAvailableOrgs(candidates);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [currentOrganization?.id]);

  const activeCount = orgs.filter((o) => !o.is_archived).length;
  const quota = plan?.included_orgs ?? 1;
  const unlimited = quota === -1;
  const overQuota = !unlimited && activeCount > quota;
  const extrasAllowed = (plan?.extra_org_price_monthly ?? 0) > 0;
  const extras = unlimited ? 0 : Math.max(0, activeCount - quota);
  const extraMonthly = extras * (plan?.extra_org_price_monthly ?? 0);

  const handleAttach = async () => {
    if (!account || !orgToAttach) return;
    setBusy(true);
    try {
      const { error } = await supabase.rpc("attach_org_to_billing_account", {
        _org_id: orgToAttach,
        _account_id: account.id,
      });
      if (error) throw error;
      toast.success("Organization added to this billing account");
      setAttachOpen(false);
      setOrgToAttach("");
      // Best-effort sync of Stripe subscription quantity for extras.
      supabase.functions
        .invoke("sync-billing-quantity", { body: { billingAccountId: account.id } })
        .catch((err) => console.warn("sync-billing-quantity failed:", err));
      await load();
    } catch (e: any) {
      toast.error(e.message || "Failed to attach organization");
    } finally {
      setBusy(false);
    }
  };

  const handleDetach = async (orgId: string) => {
    setBusy(true);
    try {
      const { error } = await supabase.rpc("detach_org_from_billing_account", {
        _org_id: orgId,
      });
      if (error) throw error;
      toast.success("Organization removed from this billing account");
      if (account) {
        supabase.functions
          .invoke("sync-billing-quantity", { body: { billingAccountId: account.id } })
          .catch((err) => console.warn("sync-billing-quantity failed:", err));
      }
      await load();
    } catch (e: any) {
      toast.error(e.message || "Failed to detach organization");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading billing account…
        </div>
      </Card>
    );
  }

  if (!account) {
    return (
      <Card className="p-6">
        <div className="flex items-start gap-3">
          <Building2 className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
          <div>
            <h3 className="font-semibold">No billing account yet</h3>
            <p className="text-sm text-muted-foreground mt-1">
              A billing account is created automatically when you subscribe to a paid plan.
              Once active, a single plan can cover several Organizations under the same
              account.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Building2 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold">{account.name}</h3>
            <p className="text-sm text-muted-foreground">
              One plan, shared across multiple Organizations.
            </p>
          </div>
        </div>
        {plan && (
          <Badge variant="outline">
            {plan.plan_name} · {unlimited ? "unlimited" : `${activeCount} / ${quota}`} orgs
          </Badge>
        )}
      </div>

      {overQuota && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-xs">
            This account has more active organizations ({activeCount}) than the {plan?.plan_name}{" "}
            plan includes ({quota}). Upgrade the plan or archive extra organizations.
          </AlertDescription>
        </Alert>
      )}

      {!unlimited && extras > 0 && extrasAllowed && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-xs">
            <strong>{extras} extra organization{extras === 1 ? "" : "s"}</strong> beyond your{" "}
            {plan?.plan_name} plan's included quota. At ${plan?.extra_org_price_monthly}/org/mo
            this adds <strong>${extraMonthly}/mo</strong> to your subscription on the next
            billing cycle.
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium">
            Organizations on this account ({activeCount}
            {!unlimited && <span className="text-muted-foreground"> / {quota} included</span>})
          </h4>
          {isAdmin && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setAttachOpen(true)}
              disabled={availableOrgs.length === 0}
            >
              <Plus className="h-4 w-4 mr-1" /> Add organization
            </Button>
          )}
        </div>
        <div className="space-y-1.5">
          {orgs.map((o) => (
            <div
              key={o.id}
              className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
            >
              <div className="flex items-center gap-2 min-w-0">
                {o.is_owner && <Crown className="h-3.5 w-3.5 text-primary shrink-0" />}
                <span className="truncate">{o.name}</span>
                {o.is_archived && (
                  <Badge variant="secondary" className="text-[10px]">
                    archived
                  </Badge>
                )}
                {o.is_owner && (
                  <Badge variant="outline" className="text-[10px]">
                    owner org
                  </Badge>
                )}
              </div>
              {!o.is_owner && isAdmin && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-muted-foreground hover:text-destructive"
                  onClick={() => handleDetach(o.id)}
                  disabled={busy}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        The owner organization holds the subscription. Other organizations on this account
        share the same plan and entitlements (including SSO). To downgrade to a smaller plan,
        first archive any organizations beyond the new plan's included quota.
      </p>

      <Dialog open={attachOpen} onOpenChange={setAttachOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add organization to {account.name}</DialogTitle>
            <DialogDescription>
              The selected organization will be moved onto this billing account and share
              this plan.
              {!unlimited && extras + 1 > 0 && extrasAllowed && (
                <>
                  {" "}You'll be charged{" "}
                  <strong>+${plan?.extra_org_price_monthly}/mo</strong> for this organization
                  on the next billing cycle.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <Select value={orgToAttach} onValueChange={setOrgToAttach}>
            <SelectTrigger>
              <SelectValue placeholder="Choose an organization…" />
            </SelectTrigger>
            <SelectContent>
              {availableOrgs.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.name}
                  {o.billing_account_id && (
                    <span className="text-xs text-muted-foreground ml-2">
                      (will move from another billing account)
                    </span>
                  )}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAttachOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={handleAttach} disabled={!orgToAttach || busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Add organization
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
