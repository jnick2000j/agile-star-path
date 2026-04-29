import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function CreateAssetDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { currentOrganization } = useOrganization();
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    asset_tag: "",
    name: "",
    category: "hardware",
    status: "in_stock",
    serial_number: "",
    model: "",
    manufacturer: "",
    vendor: "",
    location: "",
    purchase_date: "",
    purchase_cost: "",
    warranty_expires_at: "",
    notes: "",
  });

  const update = (k: string, v: string) => setForm({ ...form, [k]: v });

  const submit = async () => {
    if (!currentOrganization?.id || !form.asset_tag || !form.name) {
      toast.error("Asset tag and name are required");
      return;
    }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const payload: any = {
      organization_id: currentOrganization.id,
      asset_tag: form.asset_tag,
      name: form.name,
      category: form.category,
      status: form.status,
      serial_number: form.serial_number || null,
      model: form.model || null,
      manufacturer: form.manufacturer || null,
      vendor: form.vendor || null,
      location: form.location || null,
      purchase_date: form.purchase_date || null,
      purchase_cost: form.purchase_cost ? Number(form.purchase_cost) : null,
      warranty_expires_at: form.warranty_expires_at || null,
      notes: form.notes || null,
      created_by: user?.id,
    };
    const { error } = await supabase.from("assets").insert(payload);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Asset created");
    qc.invalidateQueries({ queryKey: ["assets"] });
    onOpenChange(false);
    setForm({ ...form, asset_tag: "", name: "", serial_number: "", model: "", notes: "" });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>New Asset</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2"><Label>Asset Tag *</Label><Input value={form.asset_tag} onChange={(e) => update("asset_tag", e.target.value)} placeholder="LAP-0001" /></div>
          <div className="space-y-2"><Label>Name *</Label><Input value={form.name} onChange={(e) => update("name", e.target.value)} /></div>
          <div className="space-y-2"><Label>Category</Label>
            <Select value={form.category} onValueChange={(v) => update("category", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="hardware">Hardware</SelectItem>
                <SelectItem value="software">Software</SelectItem>
                <SelectItem value="network">Network</SelectItem>
                <SelectItem value="mobile">Mobile</SelectItem>
                <SelectItem value="peripheral">Peripheral</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2"><Label>Status</Label>
            <Select value={form.status} onValueChange={(v) => update("status", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="in_stock">In Stock</SelectItem>
                <SelectItem value="deployed">Deployed</SelectItem>
                <SelectItem value="in_repair">In Repair</SelectItem>
                <SelectItem value="retired">Retired</SelectItem>
                <SelectItem value="disposed">Disposed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2"><Label>Serial Number</Label><Input value={form.serial_number} onChange={(e) => update("serial_number", e.target.value)} /></div>
          <div className="space-y-2"><Label>Model</Label><Input value={form.model} onChange={(e) => update("model", e.target.value)} /></div>
          <div className="space-y-2"><Label>Manufacturer</Label><Input value={form.manufacturer} onChange={(e) => update("manufacturer", e.target.value)} /></div>
          <div className="space-y-2"><Label>Vendor</Label><Input value={form.vendor} onChange={(e) => update("vendor", e.target.value)} /></div>
          <div className="space-y-2"><Label>Location</Label><Input value={form.location} onChange={(e) => update("location", e.target.value)} /></div>
          <div className="space-y-2"><Label>Purchase Date</Label><Input type="date" value={form.purchase_date} onChange={(e) => update("purchase_date", e.target.value)} /></div>
          <div className="space-y-2"><Label>Purchase Cost ($)</Label><Input type="number" step="0.01" value={form.purchase_cost} onChange={(e) => update("purchase_cost", e.target.value)} /></div>
          <div className="space-y-2"><Label>Warranty Expires</Label><Input type="date" value={form.warranty_expires_at} onChange={(e) => update("warranty_expires_at", e.target.value)} /></div>
          <div className="col-span-2 space-y-2"><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => update("notes", e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>{saving ? "Saving..." : "Create Asset"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
