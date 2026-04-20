import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreVertical, Plus, Pencil, Copy, Archive, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatPrice } from "@/lib/currency";
import { toast } from "sonner";
import { PlanEditorDialog } from "./PlanEditorDialog";
import { FeatureCatalogManager } from "./FeatureCatalogManager";
import { OrgOverridesManager } from "./OrgOverridesManager";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

interface Plan {
  id: string;
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
  sort_order: number;
  active_subscriptions?: number;
}

export function PlanManager() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Plan> | null>(null);

  const load = async () => {
    setLoading(true);
    const { data: planRows } = await supabase
      .from("subscription_plans")
      .select("*")
      .order("sort_order");

    const { data: subs } = await supabase
      .from("organization_subscriptions")
      .select("plan_id, status");

    const counts: Record<string, number> = {};
    (subs || []).forEach((s: any) => {
      if (["active", "trialing"].includes(s.status)) {
        counts[s.plan_id] = (counts[s.plan_id] || 0) + 1;
      }
    });

    setPlans(
      ((planRows || []) as Plan[]).map((p) => ({
        ...p,
        active_subscriptions: counts[p.id] || 0,
      })),
    );
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const handleDuplicate = async (plan: Plan) => {
    const { id, ...rest } = plan as any;
    delete rest.active_subscriptions;
    const { data: newPlan, error } = await supabase
      .from("subscription_plans")
      .insert({ ...rest, name: `${plan.name} (copy)`, is_archived: true, is_public: false })
      .select()
      .single();
    if (error) {
      toast.error(error.message);
      return;
    }
    // Copy feature values
    const { data: vals } = await supabase
      .from("plan_feature_values")
      .select("feature_key, value")
      .eq("plan_id", plan.id);
    if (vals && newPlan) {
      await supabase.from("plan_feature_values").insert(
        vals.map((v: any) => ({ plan_id: newPlan.id, feature_key: v.feature_key, value: v.value })),
      );
    }
    toast.success("Plan duplicated");
    load();
  };

  const handleArchive = async (plan: Plan) => {
    const { error } = await supabase
      .from("subscription_plans")
      .update({ is_archived: !plan.is_archived, is_public: false, is_active: !plan.is_archived ? false : true })
      .eq("id", plan.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(plan.is_archived ? "Plan unarchived" : "Plan archived");
    load();
  };

  const handleDelete = async (plan: Plan) => {
    if ((plan.active_subscriptions || 0) > 0) {
      toast.error(`Cannot delete — ${plan.active_subscriptions} active subscription(s). Archive instead.`);
      return;
    }
    if (!confirm(`Permanently delete "${plan.name}"?`)) return;
    const { error } = await supabase.from("subscription_plans").delete().eq("id", plan.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Plan deleted");
    load();
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="plans">
        <TabsList>
          <TabsTrigger value="plans">Plans</TabsTrigger>
          <TabsTrigger value="features">Feature catalog</TabsTrigger>
          <TabsTrigger value="overrides">Per-org overrides</TabsTrigger>
        </TabsList>

        <TabsContent value="plans" className="space-y-4 mt-4">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold">Subscription plans</h3>
                <p className="text-sm text-muted-foreground">
                  Create and edit pricing tiers, limits, and feature toggles.
                </p>
              </div>
              <Button
                onClick={() => {
                  setEditing(null);
                  setEditorOpen(true);
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                New plan
              </Button>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Plan</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Trial</TableHead>
                  <TableHead>Active subs</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-6">Loading…</TableCell></TableRow>
                ) : plans.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">No plans yet</TableCell></TableRow>
                ) : (
                  plans.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{p.name}</span>
                          {p.highlight && <Badge>Popular</Badge>}
                        </div>
                        {p.description && (
                          <p className="text-xs text-muted-foreground mt-0.5">{p.description}</p>
                        )}
                      </TableCell>
                      <TableCell>
                        <p className="font-medium">{formatPrice(p.currency, p.price_monthly)}/mo</p>
                        <p className="text-xs text-muted-foreground">{formatPrice(p.currency, p.price_yearly)}/yr</p>
                      </TableCell>
                      <TableCell>{p.trial_days} days</TableCell>
                      <TableCell>{p.active_subscriptions}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {p.is_active ? <Badge variant="default">Active</Badge> : <Badge variant="secondary">Inactive</Badge>}
                          {p.is_public ? <Badge variant="outline">Public</Badge> : <Badge variant="outline">Private</Badge>}
                          {p.is_archived && <Badge variant="destructive">Archived</Badge>}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => { setEditing(p); setEditorOpen(true); }}>
                              <Pencil className="h-4 w-4 mr-2" />Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDuplicate(p)}>
                              <Copy className="h-4 w-4 mr-2" />Duplicate
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleArchive(p)}>
                              <Archive className="h-4 w-4 mr-2" />
                              {p.is_archived ? "Unarchive" : "Archive"}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDelete(p)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="features" className="mt-4">
          <FeatureCatalogManager />
        </TabsContent>

        <TabsContent value="overrides" className="mt-4">
          <OrgOverridesManager />
        </TabsContent>
      </Tabs>

      <PlanEditorDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        plan={editing}
        onSaved={load}
      />
    </div>
  );
}
