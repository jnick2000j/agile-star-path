import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

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
};

export function PlanEditorDialog({ open, onOpenChange, plan, onSaved }: PlanEditorDialogProps) {
  const [form, setForm] = useState<Plan>(blank);
  const [catalog, setCatalog] = useState<FeatureCatalogItem[]>([]);
  const [values, setValues] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm({ ...blank, ...(plan as any) });
    loadCatalog();
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

  const setValue = (key: string, val: any) => setValues((p) => ({ ...p, [key]: val }));

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error("Plan name is required");
      return;
    }
    setSaving(true);
    try {
      let planId = plan?.id;

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

      // Upsert feature values
      const rows = catalog.map((c) => ({
        plan_id: planId!,
        feature_key: c.feature_key,
        value: values[c.feature_key] ?? c.default_value,
      }));

      const { error: fvErr } = await supabase
        .from("plan_feature_values")
        .upsert(rows, { onConflict: "plan_id,feature_key" });
      if (fvErr) throw fvErr;

      toast.success(plan?.id ? "Plan updated" : "Plan created");
      onSaved();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const grouped = catalog.reduce((acc, f) => {
    (acc[f.category] = acc[f.category] || []).push(f);
    return acc;
  }, {} as Record<string, FeatureCatalogItem[]>);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{plan?.id ? "Edit plan" : "Create plan"}</DialogTitle>
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
                    onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <Label>CTA label (optional)</Label>
                  <Input
                    value={form.cta_label || ""}
                    placeholder="e.g. Start free trial"
                    onChange={(e) => setForm({ ...form, cta_label: e.target.value || null })}
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
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Monthly price</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={form.price_monthly}
                    onChange={(e) => setForm({ ...form, price_monthly: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <Label>Yearly price</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={form.price_yearly}
                    onChange={(e) => setForm({ ...form, price_yearly: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <Label>Currency</Label>
                  <Input
                    value={form.currency}
                    onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })}
                  />
                </div>
                <div>
                  <Label>Trial days</Label>
                  <Input
                    type="number"
                    value={form.trial_days}
                    onChange={(e) => setForm({ ...form, trial_days: Number(e.target.value) })}
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
                              checked={values[f.feature_key] === true || values[f.feature_key] === "true"}
                              onCheckedChange={(c) => setValue(f.feature_key, c)}
                            />
                          ) : f.feature_type === "numeric" ? (
                            <div className="flex items-center gap-2">
                              <Input
                                type="number"
                                value={values[f.feature_key] ?? 0}
                                className="w-24"
                                onChange={(e) => setValue(f.feature_key, Number(e.target.value))}
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
              <p className="text-sm text-muted-foreground">
                Paste Stripe Price IDs once you create the products in Stripe.
              </p>
              <div>
                <Label>Monthly Price ID</Label>
                <Input
                  placeholder="price_..."
                  value={form.stripe_price_id_monthly || ""}
                  onChange={(e) =>
                    setForm({ ...form, stripe_price_id_monthly: e.target.value || null })
                  }
                />
              </div>
              <div>
                <Label>Yearly Price ID</Label>
                <Input
                  placeholder="price_..."
                  value={form.stripe_price_id_yearly || ""}
                  onChange={(e) =>
                    setForm({ ...form, stripe_price_id_yearly: e.target.value || null })
                  }
                />
              </div>
            </TabsContent>
          </ScrollArea>
        </Tabs>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Save plan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
