import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Loader2, Plus, KeyRound, Ban, RotateCcw, ShieldX } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface LicenseRow {
  id: string;
  organization_id: string;
  license_key: string;
  deployment_mode: "cloud" | "on_prem" | "hybrid";
  plan_id: string | null;
  plan_tier: string | null;
  seats: number;
  ai_credits_monthly: number;
  valid_from: string;
  valid_until: string | null;
  status: "active" | "suspended" | "expired" | "revoked";
  customer_reference: string | null;
  notes: string | null;
  issued_at: string;
  organizations?: { name: string; slug: string } | null;
  subscription_plans?: { name: string } | null;
}

interface OrgOption { id: string; name: string }
interface PlanOption { id: string; name: string; tier: string | null }

interface FormState {
  organization_id: string;
  deployment_mode: "cloud" | "on_prem" | "hybrid";
  plan_id: string | "none";
  plan_tier: string;
  seats: number;
  ai_credits_monthly: number;
  valid_until: string;
  customer_reference: string;
  notes: string;
}

const EMPTY_FORM: FormState = {
  organization_id: "",
  deployment_mode: "on_prem",
  plan_id: "none",
  plan_tier: "",
  seats: 25,
  ai_credits_monthly: 1000,
  valid_until: "",
  customer_reference: "",
  notes: "",
};

const STATUS_STYLES: Record<LicenseRow["status"], string> = {
  active: "bg-success/10 text-success border-success/30",
  suspended: "bg-warning/10 text-warning border-warning/30",
  expired: "bg-muted text-muted-foreground",
  revoked: "bg-destructive/10 text-destructive border-destructive/30",
};

function generateLicenseKey() {
  const block = () => Math.random().toString(36).slice(2, 6).toUpperCase();
  return `LIC-${block()}-${block()}-${block()}-${block()}`;
}

export function LicenseManager() {
  const [rows, setRows] = useState<LicenseRow[]>([]);
  const [orgs, setOrgs] = useState<OrgOption[]>([]);
  const [plans, setPlans] = useState<PlanOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [statusDialog, setStatusDialog] = useState<{ row: LicenseRow; nextStatus: LicenseRow["status"] } | null>(null);
  const [statusReason, setStatusReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    const [licRes, orgRes, planRes] = await Promise.all([
      supabase.from("organization_licenses")
        .select("*, organizations(name, slug), subscription_plans(name)")
        .order("issued_at", { ascending: false }),
      supabase.from("organizations").select("id, name").order("name"),
      supabase.from("subscription_plans").select("id, name, tier").order("price_monthly"),
    ]);
    if (!licRes.error && licRes.data) setRows(licRes.data as any);
    if (!orgRes.error && orgRes.data) setOrgs(orgRes.data);
    if (!planRes.error && planRes.data) setPlans(planRes.data as any);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const createLicense = async () => {
    if (!form.organization_id) return toast.error("Select an organization");
    if (form.seats < 1) return toast.error("Seats must be ≥ 1");
    setSubmitting(true);
    const { data: userRes } = await supabase.auth.getUser();
    const payload = {
      organization_id: form.organization_id,
      license_key: generateLicenseKey(),
      deployment_mode: form.deployment_mode,
      plan_id: form.plan_id === "none" ? null : form.plan_id,
      plan_tier: form.plan_tier || null,
      seats: form.seats,
      ai_credits_monthly: form.ai_credits_monthly,
      valid_until: form.valid_until || null,
      customer_reference: form.customer_reference || null,
      notes: form.notes || null,
      issued_by: userRes.user?.id ?? null,
      status: "active" as const,
    };
    const { error } = await supabase.from("organization_licenses").insert(payload);
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success("License issued");
    setCreating(false);
    setForm(EMPTY_FORM);
    await load();
  };

  const applyStatusChange = async () => {
    if (!statusDialog) return;
    setSubmitting(true);
    const { error } = await supabase.rpc("set_license_status", {
      _license_id: statusDialog.row.id,
      _status: statusDialog.nextStatus,
      _reason: statusReason || null,
    });
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success(`License ${statusDialog.nextStatus}`);
    setStatusDialog(null);
    setStatusReason("");
    await load();
  };

  const copyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    toast.success("License key copied");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-primary" /> License Management
          </h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Issue and manage licenses for on-premises or PO-billed customers. License-mode customers
            bypass Stripe entirely — entitlements (seats, AI credits, plan tier) come from the active license.
          </p>
        </div>
        <Button onClick={() => setCreating(true)} size="sm">
          <Plus className="h-4 w-4 mr-1" /> Issue license
        </Button>
      </div>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Organization</TableHead>
              <TableHead>Mode</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Seats</TableHead>
              <TableHead>AI credits / mo</TableHead>
              <TableHead>Valid until</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Key</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={9} className="text-center py-8">
                <Loader2 className="h-4 w-4 animate-spin inline mr-2" /> Loading…
              </TableCell></TableRow>
            ) : rows.length === 0 ? (
              <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                No licenses issued yet.
              </TableCell></TableRow>
            ) : rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  <div className="font-medium">{r.organizations?.name || "—"}</div>
                  {r.customer_reference && (
                    <div className="text-xs text-muted-foreground">Ref: {r.customer_reference}</div>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="capitalize">{r.deployment_mode.replace("_", "-")}</Badge>
                </TableCell>
                <TableCell>
                  <span className="text-sm">{r.subscription_plans?.name || r.plan_tier || "—"}</span>
                </TableCell>
                <TableCell>{r.seats}</TableCell>
                <TableCell>{r.ai_credits_monthly.toLocaleString()}</TableCell>
                <TableCell className="text-sm">
                  {r.valid_until ? new Date(r.valid_until).toLocaleDateString() : "Perpetual"}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={STATUS_STYLES[r.status]}>{r.status}</Badge>
                </TableCell>
                <TableCell>
                  <button
                    type="button"
                    onClick={() => copyKey(r.license_key)}
                    className="text-xs font-mono text-primary hover:underline"
                    title="Click to copy"
                  >
                    {r.license_key.slice(0, 16)}…
                  </button>
                </TableCell>
                <TableCell className="text-right space-x-1">
                  {r.status === "active" ? (
                    <>
                      <Button size="sm" variant="outline" onClick={() => { setStatusDialog({ row: r, nextStatus: "suspended" }); setStatusReason(""); }}>
                        <Ban className="h-3.5 w-3.5 mr-1" /> Suspend
                      </Button>
                      <Button size="sm" variant="outline" className="text-destructive" onClick={() => { setStatusDialog({ row: r, nextStatus: "revoked" }); setStatusReason(""); }}>
                        <ShieldX className="h-3.5 w-3.5 mr-1" /> Revoke
                      </Button>
                    </>
                  ) : r.status === "suspended" ? (
                    <Button size="sm" variant="outline" onClick={() => { setStatusDialog({ row: r, nextStatus: "active" }); setStatusReason(""); }}>
                      <RotateCcw className="h-3.5 w-3.5 mr-1" /> Reactivate
                    </Button>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Create dialog */}
      <Dialog open={creating} onOpenChange={(o) => !o && setCreating(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Issue new license</DialogTitle>
            <DialogDescription>
              The license key is generated automatically. Hand the key to the customer for their on-prem installer.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Organization</Label>
              <Select value={form.organization_id} onValueChange={(v) => setForm({ ...form, organization_id: v })}>
                <SelectTrigger><SelectValue placeholder="Choose organization…" /></SelectTrigger>
                <SelectContent>
                  {orgs.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Deployment mode</Label>
                <Select value={form.deployment_mode} onValueChange={(v: any) => setForm({ ...form, deployment_mode: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="on_prem">On-premises</SelectItem>
                    <SelectItem value="cloud">Cloud (PO-billed)</SelectItem>
                    <SelectItem value="hybrid">Hybrid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Plan</Label>
                <Select value={form.plan_id} onValueChange={(v) => setForm({ ...form, plan_id: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— None —</SelectItem>
                    {plans.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Seats</Label>
                <Input type="number" min={1} value={form.seats}
                  onChange={(e) => setForm({ ...form, seats: parseInt(e.target.value || "0", 10) })} />
              </div>
              <div>
                <Label>AI credits / month</Label>
                <Input type="number" min={0} value={form.ai_credits_monthly}
                  onChange={(e) => setForm({ ...form, ai_credits_monthly: parseInt(e.target.value || "0", 10) })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Valid until</Label>
                <Input type="date" value={form.valid_until}
                  onChange={(e) => setForm({ ...form, valid_until: e.target.value })} />
              </div>
              <div>
                <Label>Customer reference</Label>
                <Input placeholder="PO-12345" value={form.customer_reference}
                  onChange={(e) => setForm({ ...form, customer_reference: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea rows={2} value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreating(false)} disabled={submitting}>Cancel</Button>
            <Button onClick={createLicense} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Issue license
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Status change dialog */}
      <Dialog open={!!statusDialog} onOpenChange={(o) => !o && setStatusDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {statusDialog?.nextStatus === "active" ? "Reactivate license" :
               statusDialog?.nextStatus === "suspended" ? "Suspend license" : "Revoke license"}
            </DialogTitle>
            <DialogDescription>
              {statusDialog?.nextStatus === "revoked"
                ? "Revoking is permanent. The customer will lose entitlements immediately."
                : "The customer will be notified via the next platform sync."}
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label>Reason (optional)</Label>
            <Textarea rows={3} value={statusReason} onChange={(e) => setStatusReason(e.target.value)}
              placeholder="e.g. Non-payment of invoice INV-2024-001" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusDialog(null)} disabled={submitting}>Cancel</Button>
            <Button
              variant={statusDialog?.nextStatus === "revoked" ? "destructive" : "default"}
              onClick={applyStatusChange}
              disabled={submitting}
            >
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
