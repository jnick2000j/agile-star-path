import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Briefcase } from "lucide-react";
import { toast } from "sonner";

export default function Engagements() {
  const { currentOrganization } = useOrganization();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    engagement_code: "", client_name: "", engagement_type: "time_and_materials",
    status: "active", start_date: "", end_date: "", contract_value: 0, notes: "",
  });

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["engagements", currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization?.id) return [];
      const { data, error } = await supabase
        .from("client_engagements")
        .select("*")
        .eq("organization_id", currentOrganization.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!currentOrganization?.id,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!currentOrganization?.id) throw new Error("No organization");
      const { error } = await supabase.from("client_engagements").insert({
        organization_id: currentOrganization.id,
        engagement_code: form.engagement_code || `ENG-${Date.now().toString().slice(-6)}`,
        client_name: form.client_name,
        engagement_type: form.engagement_type,
        status: form.status,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        contract_value: form.contract_value || 0,
        notes: form.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Engagement created");
      qc.invalidateQueries({ queryKey: ["engagements"] });
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <AppLayout title="Client Engagements">
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2"><Briefcase className="h-7 w-7" /> Client Engagements</h1>
            <p className="text-muted-foreground">Track contracts, billed value and engagement status.</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button className="gap-2"><Plus className="h-4 w-4" /> New Engagement</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New Engagement</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Code</Label><Input value={form.engagement_code} onChange={(e) => setForm({ ...form, engagement_code: e.target.value })} placeholder="Auto if blank" /></div>
                  <div><Label>Client Name</Label><Input value={form.client_name} onChange={(e) => setForm({ ...form, client_name: e.target.value })} /></div>
                  <div>
                    <Label>Type</Label>
                    <Select value={form.engagement_type} onValueChange={(v) => setForm({ ...form, engagement_type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="time_and_materials">Time & Materials</SelectItem>
                        <SelectItem value="fixed_price">Fixed Price</SelectItem>
                        <SelectItem value="retainer">Retainer</SelectItem>
                        <SelectItem value="milestone_based">Milestone Based</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Status</Label>
                    <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="proposed">Proposed</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="on_hold">On hold</SelectItem>
                        <SelectItem value="closed">Closed</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>Start</Label><Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></div>
                  <div><Label>End</Label><Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></div>
                  <div className="col-span-2"><Label>Contract Value</Label><Input type="number" step="0.01" value={form.contract_value} onChange={(e) => setForm({ ...form, contract_value: Number(e.target.value) })} /></div>
                  <div className="col-span-2"><Label>Notes</Label><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
                </div>
              </div>
              <DialogFooter><Button onClick={() => createMutation.mutate()} disabled={!form.client_name || createMutation.isPending}>Create</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-3">
          {isLoading && <p className="text-muted-foreground">Loading…</p>}
          {!isLoading && rows.length === 0 && <Card className="p-12 text-center text-muted-foreground">No engagements yet.</Card>}
          {rows.map((e: any) => {
            const pct = e.contract_value > 0 ? Math.min(100, (Number(e.billed_to_date) / Number(e.contract_value)) * 100) : 0;
            return (
              <Card key={e.id} className="p-4">
                <div className="flex items-start justify-between gap-4 mb-2">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-sm text-muted-foreground">{e.engagement_code}</span>
                      <Badge variant="outline">{e.status}</Badge>
                      <Badge variant="secondary">{e.engagement_type.replace(/_/g, " ")}</Badge>
                    </div>
                    <h3 className="font-semibold text-lg">{e.client_name}</h3>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-muted-foreground">Contract</div>
                    <div className="font-semibold">${Number(e.contract_value).toLocaleString()}</div>
                  </div>
                </div>
                {e.contract_value > 0 && (
                  <div>
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>Billed: ${Number(e.billed_to_date).toLocaleString()}</span>
                      <span>{pct.toFixed(0)}%</span>
                    </div>
                    <Progress value={pct} />
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
}
