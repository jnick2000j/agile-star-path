import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function CreateLicenseDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { currentOrganization } = useOrganization();
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "", software_name: "", vendor: "", license_type: "subscription",
    license_key: "", total_seats: "1", purchase_date: "", expires_at: "",
    cost: "", auto_renew: false, notes: "",
  });

  const submit = async () => {
    if (!currentOrganization?.id || !form.name || !form.software_name) {
      toast.error("Name and software name are required");
      return;
    }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("software_licenses").insert({
      organization_id: currentOrganization.id,
      name: form.name,
      software_name: form.software_name,
      vendor: form.vendor || null,
      license_type: form.license_type,
      license_key: form.license_key || null,
      total_seats: Number(form.total_seats) || 1,
      purchase_date: form.purchase_date || null,
      expires_at: form.expires_at || null,
      cost: form.cost ? Number(form.cost) : null,
      auto_renew: form.auto_renew,
      notes: form.notes || null,
      created_by: user?.id,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("License created");
    qc.invalidateQueries({ queryKey: ["licenses"] });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>New Software License</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2"><Label>License Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Adobe CC – Marketing" /></div>
          <div className="space-y-2"><Label>Software *</Label><Input value={form.software_name} onChange={(e) => setForm({ ...form, software_name: e.target.value })} placeholder="Adobe Creative Cloud" /></div>
          <div className="space-y-2"><Label>Vendor</Label><Input value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} /></div>
          <div className="space-y-2"><Label>Type</Label>
            <Select value={form.license_type} onValueChange={(v) => setForm({ ...form, license_type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="subscription">Subscription</SelectItem>
                <SelectItem value="perpetual">Perpetual</SelectItem>
                <SelectItem value="oem">OEM</SelectItem>
                <SelectItem value="volume">Volume</SelectItem>
                <SelectItem value="open_source">Open Source</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 col-span-2"><Label>License Key</Label><Input value={form.license_key} onChange={(e) => setForm({ ...form, license_key: e.target.value })} placeholder="XXXX-XXXX-XXXX-XXXX" /></div>
          <div className="space-y-2"><Label>Total Seats</Label><Input type="number" value={form.total_seats} onChange={(e) => setForm({ ...form, total_seats: e.target.value })} /></div>
          <div className="space-y-2"><Label>Cost ($)</Label><Input type="number" step="0.01" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} /></div>
          <div className="space-y-2"><Label>Purchase Date</Label><Input type="date" value={form.purchase_date} onChange={(e) => setForm({ ...form, purchase_date: e.target.value })} /></div>
          <div className="space-y-2"><Label>Expires At</Label><Input type="date" value={form.expires_at} onChange={(e) => setForm({ ...form, expires_at: e.target.value })} /></div>
          <div className="flex items-center gap-2 col-span-2"><Switch checked={form.auto_renew} onCheckedChange={(v) => setForm({ ...form, auto_renew: v })} /><Label>Auto-renew</Label></div>
          <div className="col-span-2 space-y-2"><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>{saving ? "Saving..." : "Create License"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
