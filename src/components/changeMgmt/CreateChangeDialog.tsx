import { useState } from "react";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useOrganization } from "@/hooks/useOrganization";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}

export function CreateChangeDialog({ open, onOpenChange, onCreated }: Props) {
  const { currentOrganization } = useOrganization();
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    change_type: "normal",
    urgency: "medium",
    impact: "medium",
    category: "",
    reason: "",
    rollback_plan: "",
    planned_start_at: "",
    planned_end_at: "",
    downtime_required: false,
    programme_id: "",
    project_id: "",
    product_id: "",
  });

  const { data: programmes = [] } = useQuery({
    queryKey: ["programmes-min", currentOrganization?.id],
    queryFn: async () => {
      const { data } = await supabase.from("programmes").select("id, name").eq("organization_id", currentOrganization!.id).order("name");
      return data ?? [];
    },
    enabled: !!currentOrganization?.id && open,
  });
  const { data: projects = [] } = useQuery({
    queryKey: ["projects-min", currentOrganization?.id],
    queryFn: async () => {
      const { data } = await supabase.from("projects").select("id, name").eq("organization_id", currentOrganization!.id).order("name");
      return data ?? [];
    },
    enabled: !!currentOrganization?.id && open,
  });
  const { data: products = [] } = useQuery({
    queryKey: ["products-min", currentOrganization?.id],
    queryFn: async () => {
      const { data } = await supabase.from("products").select("id, name").eq("organization_id", currentOrganization!.id).order("name");
      return data ?? [];
    },
    enabled: !!currentOrganization?.id && open,
  });

  const handleSubmit = async () => {
    if (!currentOrganization?.id || !form.title.trim()) {
      toast.error("Title is required");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("change_management_requests").insert({
      organization_id: currentOrganization.id,
      title: form.title.trim(),
      description: form.description || null,
      change_type: form.change_type as any,
      urgency: form.urgency as any,
      impact: form.impact as any,
      category: form.category || null,
      reason: form.reason || null,
      rollback_plan: form.rollback_plan || null,
      planned_start_at: form.planned_start_at || null,
      planned_end_at: form.planned_end_at || null,
      downtime_required: form.downtime_required,
      programme_id: form.programme_id || null,
      project_id: form.project_id || null,
      product_id: form.product_id || null,
      requested_by: user?.id ?? null,
      owner_id: user?.id ?? null,
      created_by: user?.id ?? null,
      status: "draft" as any,
    });
    setSubmitting(false);
    if (error) {
      toast.error("Failed: " + error.message);
      return;
    }
    toast.success("Change request created");
    onOpenChange(false);
    setForm({
      title: "", description: "", change_type: "normal", urgency: "medium", impact: "medium",
      category: "", reason: "", rollback_plan: "", planned_start_at: "", planned_end_at: "",
      downtime_required: false, programme_id: "", project_id: "", product_id: "",
    });
    onCreated?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>New Change Request</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Title *</Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={form.change_type} onValueChange={(v) => setForm({ ...form, change_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">Standard</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="emergency">Emergency</SelectItem>
                  <SelectItem value="operational">Operational</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Urgency</Label>
              <Select value={form.urgency} onValueChange={(v) => setForm({ ...form, urgency: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["low","medium","high","critical"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Impact</Label>
              <Select value={form.impact} onValueChange={(v) => setForm({ ...form, impact: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["low","medium","high","critical"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Reason for change</Label>
            <Textarea rows={2} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Rollback plan</Label>
            <Textarea rows={2} value={form.rollback_plan} onChange={(e) => setForm({ ...form, rollback_plan: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Planned start</Label>
              <Input type="datetime-local" value={form.planned_start_at} onChange={(e) => setForm({ ...form, planned_start_at: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Planned end</Label>
              <Input type="datetime-local" value={form.planned_end_at} onChange={(e) => setForm({ ...form, planned_end_at: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>Programme</Label>
              <Select value={form.programme_id || "none"} onValueChange={(v) => setForm({ ...form, programme_id: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {programmes.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Project</Label>
              <Select value={form.project_id || "none"} onValueChange={(v) => setForm({ ...form, project_id: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {projects.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Product</Label>
              <Select value={form.product_id || "none"} onValueChange={(v) => setForm({ ...form, product_id: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {products.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Creating..." : "Create Change"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
