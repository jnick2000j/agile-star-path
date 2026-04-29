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

export function CreateContractDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { currentOrganization } = useOrganization();
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "", contract_type: "support", vendor: "", contract_number: "",
    start_date: "", end_date: "", renewal_date: "", cost: "", auto_renew: false, notes: "",
  });

  const submit = async () => {
    if (!currentOrganization?.id || !form.name) { toast.error("Name is required"); return; }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("asset_contracts").insert({
      organization_id: currentOrganization.id,
      name: form.name,
      contract_type: form.contract_type,
      vendor: form.vendor || null,
      contract_number: form.contract_number || null,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      renewal_date: form.renewal_date || null,
      cost: form.cost ? Number(form.cost) : null,
      auto_renew: form.auto_renew,
      notes: form.notes || null,
      created_by: user?.id,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Contract created");
    qc.invalidateQueries({ queryKey: ["contracts"] });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>New Contract</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2 col-span-2"><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div className="space-y-2"><Label>Type</Label>
            <Select value={form.contract_type} onValueChange={(v) => setForm({ ...form, contract_type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="support">Support</SelectItem>
                <SelectItem value="maintenance">Maintenance</SelectItem>
                <SelectItem value="lease">Lease</SelectItem>
                <SelectItem value="warranty">Warranty</SelectItem>
                <SelectItem value="service">Service</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2"><Label>Vendor</Label><Input value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} /></div>
          <div className="space-y-2"><Label>Contract Number</Label><Input value={form.contract_number} onChange={(e) => setForm({ ...form, contract_number: e.target.value })} /></div>
          <div className="space-y-2"><Label>Cost ($)</Label><Input type="number" step="0.01" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} /></div>
          <div className="space-y-2"><Label>Start</Label><Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></div>
          <div className="space-y-2"><Label>End</Label><Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></div>
          <div className="space-y-2"><Label>Renewal</Label><Input type="date" value={form.renewal_date} onChange={(e) => setForm({ ...form, renewal_date: e.target.value })} /></div>
          <div className="flex items-center gap-2 col-span-2"><Switch checked={form.auto_renew} onCheckedChange={(v) => setForm({ ...form, auto_renew: v })} /><Label>Auto-renew</Label></div>
          <div className="col-span-2 space-y-2"><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>{saving ? "Saving..." : "Create Contract"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
