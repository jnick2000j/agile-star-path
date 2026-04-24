import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Repeat } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export default function Retainers() {
  const { currentOrganization } = useOrganization();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    client_name: "", period_start: "", period_end: "",
    hours_allocated: 0, monthly_value: 0, rollover_allowed: false,
  });

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["retainers", currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization?.id) return [];
      const { data, error } = await supabase
        .from("retainers")
        .select("*")
        .eq("organization_id", currentOrganization.id)
        .order("period_start", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!currentOrganization?.id,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!currentOrganization?.id) throw new Error("No organization");
      const { error } = await supabase.from("retainers").insert({
        organization_id: currentOrganization.id,
        client_name: form.client_name,
        period_start: form.period_start,
        period_end: form.period_end,
        hours_allocated: form.hours_allocated,
        monthly_value: form.monthly_value,
        rollover_allowed: form.rollover_allowed,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Retainer created");
      qc.invalidateQueries({ queryKey: ["retainers"] });
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <AppLayout title="Retainers">
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2"><Repeat className="h-7 w-7" /> Retainers</h1>
            <p className="text-muted-foreground">Monthly retainer hours, burn rate and renewal tracking.</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button className="gap-2"><Plus className="h-4 w-4" /> New Retainer</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New Retainer</DialogTitle></DialogHeader>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2"><Label>Client</Label><Input value={form.client_name} onChange={(e) => setForm({ ...form, client_name: e.target.value })} /></div>
                <div><Label>Period Start</Label><Input type="date" value={form.period_start} onChange={(e) => setForm({ ...form, period_start: e.target.value })} /></div>
                <div><Label>Period End</Label><Input type="date" value={form.period_end} onChange={(e) => setForm({ ...form, period_end: e.target.value })} /></div>
                <div><Label>Hours Allocated</Label><Input type="number" step="0.5" value={form.hours_allocated} onChange={(e) => setForm({ ...form, hours_allocated: Number(e.target.value) })} /></div>
                <div><Label>Monthly Value</Label><Input type="number" step="0.01" value={form.monthly_value} onChange={(e) => setForm({ ...form, monthly_value: Number(e.target.value) })} /></div>
              </div>
              <DialogFooter>
                <Button onClick={() => createMutation.mutate()} disabled={!form.client_name || !form.period_start || !form.period_end || createMutation.isPending}>Create</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-3">
          {isLoading && <p className="text-muted-foreground">Loading…</p>}
          {!isLoading && rows.length === 0 && <Card className="p-12 text-center text-muted-foreground">No retainers yet.</Card>}
          {rows.map((r: any) => {
            const pct = r.hours_allocated > 0 ? Math.min(100, (Number(r.hours_consumed) / Number(r.hours_allocated)) * 100) : 0;
            return (
              <Card key={r.id} className="p-4">
                <div className="flex items-start justify-between gap-4 mb-2">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline">{r.status}</Badge>
                      {r.rollover_allowed && <Badge variant="secondary">Rollover</Badge>}
                    </div>
                    <h3 className="font-semibold text-lg">{r.client_name}</h3>
                    <div className="text-sm text-muted-foreground">
                      {format(new Date(r.period_start), "MMM d")} – {format(new Date(r.period_end), "MMM d, yyyy")}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-muted-foreground">Monthly</div>
                    <div className="font-semibold">${Number(r.monthly_value).toLocaleString()}</div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs text-muted-foreground mb-1">
                    <span>{r.hours_consumed} / {r.hours_allocated} hours</span>
                    <span>{pct.toFixed(0)}% used</span>
                  </div>
                  <Progress value={pct} />
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
}
