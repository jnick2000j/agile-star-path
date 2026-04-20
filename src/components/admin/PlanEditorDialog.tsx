import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, RefreshCw, AlertTriangle, CheckCircle2 } from "lucide-react";
import { getStripeEnvironment } from "@/lib/stripe";
import { formatDistanceToNow } from "date-fns";
import { formatPrice } from "@/lib/currency";

interface Plan {
  id?: string;
  name: string;
  description: string | null;
  price_monthly: number;
  price_yearly: number;
  currency: string;
  trial_days: number;
  is_active: boolean;
  is_public: boolean;
  is_archived: boolean;
  highlight: boolean;
  cta_label: string | null;
  sort_order: number;
  stripe_price_id_monthly: string | null;
  stripe_price_id_yearly: string | null;
  stripe_product_id?: string | null;
  stripe_lookup_key_monthly?: string | null;
  stripe_lookup_key_yearly?: string | null;
  last_synced_at?: string | null;
  sync_status?: string | null;
}

interface FeatureCatalogItem {
  feature_key: string;
  name: string;
  description: string | null;
  category: string;
  feature_type: "boolean" | "numeric" | "text";
  default_value: any;
  display_order: number;
}

interface PlanEditorDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  plan: Partial<Plan> | null;
  onSaved: () => void;
}

const blank: Plan = {
  name: "",
  description: "",
  price_monthly: 0,
  price_yearly: 0,
  currency: "USD",
  trial_days: 30,
  is_active: true,
  is_public: true,
  is_archived: false,
  highlight: false,
  cta_label: null,
  sort_order: 0,
  stripe_price_id_monthly: null,
  stripe_price_id_yearly: null,
  stripe_product_id: null,
  stripe_lookup_key_monthly: null,
  stripe_lookup_key_yearly: null,
  last_synced_at: null,
  sync_status: "unsynced",
};

export function PlanEditorDialog({
  open,
  onOpenChange,
  plan,
  onSaved,
}: PlanEditorDialogProps) {
  const [form, setForm] = useState<Plan>(blank);
  const [originalPrices, setOriginalPrices] = useState<{ m: number; y: number }>({ m: 0, y: 0 });
  const [catalog, setCatalog] = useState<FeatureCatalogItem[]>([]);
  const [values, setValues] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [history, setHistory] = useState<any[]>([]);

  // confirm-to-edit state
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  // price-change strategy dialog state
  const [priceChangeOpen, setPriceChangeOpen] = useState(false);
  const [migrationStrategy, setMigrationStrategy] = useState<"grandfather" | "migrate_all">(
    "grandfather",
  );
  const [activeSubsCount, setActiveSubsCount] = useState(0);

  useEffect(() => {
    if (!open) return;
    const merged = { ...blank, ...(plan as any) };
    setForm(merged);
    setOriginalPrices({
      m: Number(merged.price_monthly || 0),
      y: Number(merged.price_yearly || 0),
    });
    setConfirmText("");
    loadCatalog();
    if (plan?.id) loadHistory(plan.id);
  }, [open, plan]);

  const loadCatalog = async () => {
    setLoading(true);
    const { data: cat } = await supabase
      .from("plan_features")
      .select("*")
      .eq("is_active", true)
      .order("display_order");
    setCatalog((cat || []) as FeatureCatalogItem[]);

    if (plan?.id) {
      const { data: vals } = await supabase
        .from("plan_feature_values")
        .select("feature_key, value")
        .eq("plan_id", plan.id);
      const v: Record<string, any> = {};
      (vals || []).forEach((row: any) => (v[row.feature_key] = row.value));
      setValues(v);
    } else {
      const v: Record<string, any> = {};
      (cat || []).forEach((c: any) => (v[c.feature_key] = c.default_value));
      setValues(v);
    }
    setLoading(false);
  };

  const loadHistory = async (planId: string) => {
    const { data } = await supabase
      .from("plan_price_sync_history")
      .select("*")
      .eq("plan_id", planId)
      .order("created_at", { ascending: false })
      .limit(20);
    setHistory(data || []);
  };

  const setValue = (key: string, val: any) =>
    setValues((p) => ({ ...p, [key]: val }));

  const priceChanged =
    Number(form.price_monthly) !== originalPrices.m ||
    Number(form.price_yearly) !== originalPrices.y;

  const isPaid = Number(form.price_monthly) > 0 || Number(form.price_yearly) > 0;

  const persistChanges = async (): Promise<string | null> => {
    if (!form.name.trim()) {
      toast.error("Plan name is required");
      return null;
    }

    let planId = plan?.id;

    // Build legacy `features` JSONB array from enabled boolean features
    // (excluding limit_* numeric features which feed the max_* columns)
    const legacyFeatures = catalog
      .filter(
        (c) =>
          c.feature_type === "boolean" &&
          !c.feature_key.startsWith("limit_") &&
          (values[c.feature_key] === true || values[c.feature_key] === "true"),
      )
      .map((c) => c.name);

    const payload = {
      name: form.name,
      description: form.description,
      price_monthly: form.price_monthly,
      price_yearly: form.price_yearly,
      currency: form.currency,
      trial_days: form.trial_days,
      is_active: form.is_active,
      is_public: form.is_public,
      is_archived: form.is_archived,
      highlight: form.highlight,
      cta_label: form.cta_label,
      sort_order: form.sort_order,
      stripe_price_id_monthly: form.stripe_price_id_monthly,
      stripe_price_id_yearly: form.stripe_price_id_yearly,
      max_users: Number(values["limit_users"] ?? 0),
      max_programmes: Number(values["limit_programmes"] ?? 0),
      max_projects: Number(values["limit_projects"] ?? 0),
      max_products: Number(values["limit_products"] ?? 0),
      max_storage_mb: Number(values["limit_storage_mb"] ?? 0),
      features: legacyFeatures,
      sync_status: priceChanged ? "pending" : form.sync_status,
    };

    if (planId) {
      const { error } = await supabase
        .from("subscription_plans")
        .update(payload)
        .eq("id", planId);
      if (error) throw error;
    } else {
      const { data, error } = await supabase
        .from("subscription_plans")
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      planId = data.id;
    }

    const rows = catalog.map((c) => ({
      plan_id: planId!,
      feature_key: c.feature_key,
      value: values[c.feature_key] ?? c.default_value,
    }));
    const { error: fvErr } = await supabase
      .from("plan_feature_values")
      .upsert(rows, { onConflict: "plan_id,feature_key" });
    if (fvErr) throw fvErr;

    return planId!;
  };

  const handleSaveClick = async () => {
    // If editing existing paid plan and price changed, require type-to-confirm
    if (plan?.id && isPaid && priceChanged) {
      // Count active subs to show in dialog
      const { count } = await supabase
        .from("organization_subscriptions")
        .select("id", { count: "exact", head: true })
        .eq("plan_id", plan.id)
        .in("status", ["active", "trialing"]);
      setActiveSubsCount(count || 0);
      setConfirmOpen(true);
      return;
    }
    // Non-price changes — just save
    setSaving(true);
    try {
      await persistChanges();
      toast.success(plan?.id ? "Plan updated" : "Plan created");
      onSaved();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmedSave = async () => {
    setSaving(true);
    try {
      await persistChanges();
      setConfirmOpen(false);
      toast.success("Plan saved — choose how to update Stripe next");
      // Open the migration strategy dialog
      setMigrationStrategy("grandfather");
      setPriceChangeOpen(true);
    } catch (e: any) {
      toast.error(e.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleSyncToStripe = async () => {
    if (!plan?.id) return;
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("sync-plan-to-stripe", {
        body: {
          planId: plan.id,
          environment: getStripeEnvironment(),
          migrationStrategy,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(
        migrationStrategy === "migrate_all"
          ? "New Stripe price created — existing subscribers were migrated"
          : "New Stripe price created — existing subscribers grandfathered to old price",
      );
      setPriceChangeOpen(false);
      onSaved();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  const handleManualSync = async () => {
    if (!plan?.id) return;
    setMigrationStrategy("grandfather");
    setActiveSubsCount(0);
    // count subs first
    const { count } = await supabase
      .from("organization_subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("plan_id", plan.id)
      .in("status", ["active", "trialing"]);
    setActiveSubsCount(count || 0);
    setPriceChangeOpen(true);
  };

  const grouped = catalog.reduce((acc, f) => {
    (acc[f.category] = acc[f.category] || []).push(f);
    return acc;
  }, {} as Record<string, FeatureCatalogItem[]>);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{plan?.id ? "Edit plan" : "Create plan"}</DialogTitle>
            {plan?.id && (
              <DialogDescription className="flex items-center gap-2 flex-wrap">
                Stripe sync:
                {form.sync_status === "synced" ? (
                  <Badge variant="default" className="gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Synced
                  </Badge>
                ) : form.sync_status === "pending" ? (
                  <Badge variant="secondary">Changes pending</Badge>
                ) : (
                  <Badge variant="outline">Unsynced</Badge>
                )}
                {form.last_synced_at && (
                  <span className="text-xs text-muted-foreground">
                    Last synced {formatDistanceToNow(new Date(form.last_synced_at), { addSuffix: true })}
                  </span>
                )}
              </DialogDescription>
            )}
          </DialogHeader>
          <Tabs defaultValue="details" className="flex-1 flex flex-col overflow-hidden">
            <TabsList>
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="pricing">Pricing</TabsTrigger>
              <TabsTrigger value="features">Features & limits</TabsTrigger>
              <TabsTrigger value="stripe">Stripe</TabsTrigger>
            </TabsList>

            <ScrollArea className="flex-1 pr-4">
              <TabsContent value="details" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <Label>Name</Label>
                    <Input
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                    />
                  </div>
                  <div className="col-span-2">
                    <Label>Description</Label>
                    <Textarea
                      value={form.description || ""}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Display order</Label>
                    <Input
                      type="number"
                      value={form.sort_order}
                      onChange={(e) =>
                        setForm({ ...form, sort_order: Number(e.target.value) })
                      }
                    />
                  </div>
                  <div>
                    <Label>CTA label (optional)</Label>
                    <Input
                      value={form.cta_label || ""}
                      placeholder="e.g. Start free trial"
                      onChange={(e) =>
                        setForm({ ...form, cta_label: e.target.value || null })
                      }
                    />
                  </div>
                  <div className="col-span-2 grid grid-cols-2 gap-4 pt-2">
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium text-sm">Active</p>
                        <p className="text-xs text-muted-foreground">Plan can be assigned</p>
                      </div>
                      <Switch
                        checked={form.is_active}
                        onCheckedChange={(c) => setForm({ ...form, is_active: c })}
                      />
                    </div>
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium text-sm">Public</p>
                        <p className="text-xs text-muted-foreground">Show on pricing page</p>
                      </div>
                      <Switch
                        checked={form.is_public}
                        onCheckedChange={(c) => setForm({ ...form, is_public: c })}
                      />
                    </div>
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium text-sm">Highlight</p>
                        <p className="text-xs text-muted-foreground">"Most popular" badge</p>
                      </div>
                      <Switch
                        checked={form.highlight}
                        onCheckedChange={(c) => setForm({ ...form, highlight: c })}
                      />
                    </div>
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium text-sm">Archived</p>
                        <p className="text-xs text-muted-foreground">Hidden, no new subs</p>
                      </div>
                      <Switch
                        checked={form.is_archived}
                        onCheckedChange={(c) => setForm({ ...form, is_archived: c })}
                      />
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="pricing" className="space-y-4 mt-4">
                {priceChanged && plan?.id && isPaid && (
                  <div className="p-3 border border-warning/40 bg-warning/5 rounded-lg flex gap-2 items-start text-sm">
                    <AlertTriangle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
                    <div>
                      <p className="font-medium">Price change pending</p>
                      <p className="text-muted-foreground">
                        Saving will prompt you to confirm and choose how to handle existing subscribers.
                      </p>
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Monthly price</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={form.price_monthly}
                      onChange={(e) =>
                        setForm({ ...form, price_monthly: Number(e.target.value) })
                      }
                    />
                  </div>
                  <div>
                    <Label>Yearly price</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={form.price_yearly}
                      onChange={(e) =>
                        setForm({ ...form, price_yearly: Number(e.target.value) })
                      }
                    />
                  </div>
                  <div>
                    <Label>Currency</Label>
                    <Input
                      value={form.currency}
                      onChange={(e) =>
                        setForm({ ...form, currency: e.target.value.toUpperCase() })
                      }
                    />
                  </div>
                  <div>
                    <Label>Trial days</Label>
                    <Input
                      type="number"
                      value={form.trial_days}
                      onChange={(e) =>
                        setForm({ ...form, trial_days: Number(e.target.value) })
                      }
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="features" className="space-y-6 mt-4">
                {loading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : (
                  Object.entries(grouped).map(([category, items]) => (
                    <div key={category}>
                      <h4 className="text-sm font-semibold uppercase text-muted-foreground mb-2">
                        {category}
                      </h4>
                      <div className="space-y-2">
                        {items.map((f) => (
                          <div
                            key={f.feature_key}
                            className="flex items-center justify-between p-3 border rounded-lg gap-4"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm">{f.name}</p>
                              {f.description && (
                                <p className="text-xs text-muted-foreground">{f.description}</p>
                              )}
                            </div>
                            {f.feature_type === "boolean" ? (
                              <Switch
                                checked={
                                  values[f.feature_key] === true ||
                                  values[f.feature_key] === "true"
                                }
                                onCheckedChange={(c) => setValue(f.feature_key, c)}
                              />
                            ) : f.feature_type === "numeric" ? (
                              <div className="flex items-center gap-2">
                                <Input
                                  type="number"
                                  value={values[f.feature_key] ?? 0}
                                  className="w-24"
                                  onChange={(e) =>
                                    setValue(f.feature_key, Number(e.target.value))
                                  }
                                />
                                <span className="text-xs text-muted-foreground whitespace-nowrap">
                                  (-1 = ∞)
                                </span>
                              </div>
                            ) : (
                              <Input
                                value={values[f.feature_key] ?? ""}
                                className="w-40"
                                onChange={(e) => setValue(f.feature_key, e.target.value)}
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </TabsContent>

              <TabsContent value="stripe" className="space-y-4 mt-4">
                {plan?.id && isPaid && (
                  <div className="p-4 border rounded-lg space-y-3 bg-muted/30">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium text-sm">Stripe sync</p>
                        <p className="text-xs text-muted-foreground">
                          Push current prices to Stripe. Creates a new Stripe price and archives the old one.
                        </p>
                      </div>
                      <Button onClick={handleManualSync} disabled={syncing} size="sm">
                        {syncing ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <RefreshCw className="h-4 w-4 mr-2" />
                        )}
                        Sync to Stripe
                      </Button>
                    </div>
                    {form.stripe_product_id && (
                      <p className="text-xs text-muted-foreground">
                        Product: <code>{form.stripe_product_id}</code>
                      </p>
                    )}
                  </div>
                )}

                <p className="text-sm text-muted-foreground">
                  Stripe lookup keys (used internally to resolve prices in checkout). Auto-managed by sync.
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Monthly lookup key</Label>
                    <Input
                      placeholder="plan_pro_monthly"
                      value={form.stripe_lookup_key_monthly || ""}
                      onChange={(e) =>
                        setForm({ ...form, stripe_lookup_key_monthly: e.target.value || null })
                      }
                    />
                  </div>
                  <div>
                    <Label>Yearly lookup key</Label>
                    <Input
                      placeholder="plan_pro_yearly"
                      value={form.stripe_lookup_key_yearly || ""}
                      onChange={(e) =>
                        setForm({ ...form, stripe_lookup_key_yearly: e.target.value || null })
                      }
                    />
                  </div>
                </div>

                {plan?.id && history.length > 0 && (
                  <div className="pt-4">
                    <p className="font-medium text-sm mb-2">Sync history</p>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {history.map((h) => (
                        <div
                          key={h.id}
                          className="text-xs p-2 border rounded flex justify-between items-start gap-2"
                        >
                          <div>
                            <p className="font-medium">
                              {h.interval}: {formatPrice(h.currency, h.old_amount ?? "—")} → {formatPrice(h.currency, h.new_amount)}
                            </p>
                            <p className="text-muted-foreground">
                              {h.migration_strategy === "migrate_all"
                                ? `Migrated ${h.affected_subscribers} subscribers`
                                : `Grandfathered ${h.affected_subscribers} subscribers`}
                            </p>
                          </div>
                          <span className="text-muted-foreground whitespace-nowrap">
                            {formatDistanceToNow(new Date(h.created_at), { addSuffix: true })}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </TabsContent>
            </ScrollArea>
          </Tabs>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveClick} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Save plan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Type-to-confirm before saving a price change */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm price change for "{form.name}"</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span>
                You're changing the price of <strong>{form.name}</strong>. This affects what new
                customers pay and may affect{" "}
                <strong>{activeSubsCount} active subscriber(s)</strong> depending on the strategy you
                choose next.
              </span>
              <span className="block">
                Type <code className="bg-muted px-1.5 py-0.5 rounded">{form.name}</code> to confirm.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={form.name}
            autoFocus
          />
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmText("")}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={confirmText !== form.name || saving}
              onClick={handleConfirmedSave}
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Save & continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Per-change subscriber-migration choice */}
      <Dialog open={priceChangeOpen} onOpenChange={setPriceChangeOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>How should this affect existing subscribers?</DialogTitle>
            <DialogDescription>
              {activeSubsCount} active subscriber(s) on this plan. Choose what happens at sync.
            </DialogDescription>
          </DialogHeader>
          <RadioGroup
            value={migrationStrategy}
            onValueChange={(v) => setMigrationStrategy(v as any)}
            className="space-y-3"
          >
            <div className="flex items-start gap-3 p-3 border rounded-lg">
              <RadioGroupItem value="grandfather" id="grandfather" className="mt-1" />
              <div className="flex-1">
                <Label htmlFor="grandfather" className="font-medium cursor-pointer">
                  Grandfather existing subscribers
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Existing subscribers keep paying the old price forever. Only new signups get the new
                  price. Recommended for price increases.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 border rounded-lg">
              <RadioGroupItem value="migrate_all" id="migrate_all" className="mt-1" />
              <div className="flex-1">
                <Label htmlFor="migrate_all" className="font-medium cursor-pointer">
                  Migrate everyone to the new price
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  All {activeSubsCount} active subscriber(s) switch immediately. Stripe pro-rates the
                  difference. Use for price decreases or aligned plan changes.
                </p>
              </div>
            </div>
          </RadioGroup>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPriceChangeOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSyncToStripe} disabled={syncing}>
              {syncing && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Sync to Stripe
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
