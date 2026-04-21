import { useEffect, useState } from "react";
import { Loader2, Plus, Pencil, Archive, RotateCcw, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { getStripeEnvironment } from "@/lib/stripe";
import { toast } from "sonner";

export interface AdminPack {
  id: string;
  pack_key: string;
  name: string;
  description: string | null;
  credits: number;
  amount_usd: number;
  highlight: boolean;
  sort_order: number;
  is_active: boolean;
  stripe_product_id: string | null;
  stripe_price_lookup_key: string | null;
}

interface PackFormState {
  id?: string;
  name: string;
  description: string;
  credits: number;
  amount_usd: number;
  highlight: boolean;
  sort_order: number;
  is_active: boolean;
}

const EMPTY: PackFormState = {
  name: "",
  description: "",
  credits: 500,
  amount_usd: 25,
  highlight: false,
  sort_order: 100,
  is_active: true,
};

export function AICreditPackManager() {
  const [packs, setPacks] = useState<AdminPack[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<PackFormState | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("ai_credit_packs")
      .select("*")
      .order("sort_order", { ascending: true });
    if (!error && data) setPacks(data as AdminPack[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openNew = () => setEditing({ ...EMPTY });
  const openEdit = (p: AdminPack) =>
    setEditing({
      id: p.id,
      name: p.name,
      description: p.description ?? "",
      credits: p.credits,
      amount_usd: Number(p.amount_usd),
      highlight: p.highlight,
      sort_order: p.sort_order,
      is_active: p.is_active,
    });

  const save = async () => {
    if (!editing) return;
    if (!editing.name.trim()) return toast.error("Name is required");
    if (editing.credits < 1) return toast.error("Credits must be ≥ 1");
    if (editing.amount_usd < 0.5) return toast.error("Amount must be ≥ $0.50");

    setSaving(true);
    try {
      const action = editing.id ? "update" : "create";
      const { data, error } = await supabase.functions.invoke("manage-ai-credit-packs", {
        body: { action, environment: getStripeEnvironment(), pack: editing },
      });
      if (error || data?.error) throw new Error(error?.message || data?.error);
      toast.success(editing.id ? "Pack updated" : "Pack created and synced to Stripe");
      setEditing(null);
      await load();
    } catch (e: any) {
      toast.error(e.message || "Failed to save pack");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (p: AdminPack) => {
    try {
      const { data, error } = await supabase.functions.invoke("manage-ai-credit-packs", {
        body: {
          action: p.is_active ? "archive" : "restore",
          id: p.id,
          environment: getStripeEnvironment(),
        },
      });
      if (error || data?.error) throw new Error(error?.message || data?.error);
      toast.success(p.is_active ? "Pack archived" : "Pack restored");
      await load();
    } catch (e: any) {
      toast.error(e.message || "Failed");
    }
  };

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            AI Credit Pack Catalog
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Platform admins create and price packs here. Each pack syncs to Stripe automatically.
          </p>
        </div>
        <Button onClick={openNew} size="sm">
          <Plus className="h-4 w-4 mr-1" /> New pack
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading packs…
        </div>
      ) : packs.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6">No packs defined yet.</p>
      ) : (
        <div className="divide-y rounded-md border">
          {packs.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-4 p-3 flex-wrap">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{p.name}</span>
                  {p.highlight && <Badge variant="default" className="text-[10px]">Best value</Badge>}
                  {!p.is_active && <Badge variant="outline" className="text-[10px]">Archived</Badge>}
                  {!p.stripe_product_id && (
                    <Badge variant="outline" className="text-[10px] border-warning text-warning">
                      Not in Stripe
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {p.credits.toLocaleString()} credits · ${Number(p.amount_usd).toFixed(2)} ·
                  key <code className="text-[10px]">{p.pack_key}</code>
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => openEdit(p)}>
                  <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                </Button>
                <Button variant="outline" size="sm" onClick={() => toggleActive(p)}>
                  {p.is_active ? (
                    <><Archive className="h-3.5 w-3.5 mr-1" /> Archive</>
                  ) : (
                    <><RotateCcw className="h-3.5 w-3.5 mr-1" /> Restore</>
                  )}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Edit pack" : "Create credit pack"}</DialogTitle>
            <DialogDescription>
              {editing?.id
                ? "Updating price creates a new Stripe price and points the same key at it. Old prices are archived."
                : "A Stripe product and one-time price are created automatically."}
            </DialogDescription>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div>
                <Label>Name</Label>
                <Input
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  placeholder="e.g. Power top-up"
                />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea
                  rows={2}
                  value={editing.description}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                  placeholder="Shown to org admins on the Billing page"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Credits</Label>
                  <Input
                    type="number"
                    min={1}
                    value={editing.credits}
                    onChange={(e) => setEditing({ ...editing, credits: parseInt(e.target.value || "0", 10) })}
                  />
                </div>
                <div>
                  <Label>Price (USD)</Label>
                  <Input
                    type="number"
                    min={0.5}
                    step={0.5}
                    value={editing.amount_usd}
                    onChange={(e) => setEditing({ ...editing, amount_usd: parseFloat(e.target.value || "0") })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Sort order</Label>
                  <Input
                    type="number"
                    value={editing.sort_order}
                    onChange={(e) => setEditing({ ...editing, sort_order: parseInt(e.target.value || "0", 10) })}
                  />
                </div>
                <div className="flex items-end gap-4">
                  <label className="flex items-center gap-2 text-sm">
                    <Switch
                      checked={editing.highlight}
                      onCheckedChange={(v) => setEditing({ ...editing, highlight: v })}
                    /> Highlight
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <Switch
                      checked={editing.is_active}
                      onCheckedChange={(v) => setEditing({ ...editing, is_active: v })}
                    /> Active
                  </label>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)} disabled={saving}>Cancel</Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editing?.id ? "Save changes" : "Create pack"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
