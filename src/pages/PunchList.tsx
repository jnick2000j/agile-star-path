import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, ListChecks } from "lucide-react";
import { toast } from "sonner";

export default function PunchList() {
  const { currentOrganization } = useOrganization();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ description: "", location: "", trade: "", priority: "medium", status: "open", due_date: "" });

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["punch-list", currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization?.id) return [];
      const { data, error } = await supabase
        .from("punch_list_items")
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
      if (!currentOrganization?.id || !user) throw new Error("No organization");
      const { error } = await supabase.from("punch_list_items").insert({
        organization_id: currentOrganization.id,
        item_number: `PL-${Date.now().toString().slice(-6)}`,
        description: form.description,
        location: form.location || null,
        trade: form.trade || null,
        priority: form.priority,
        status: form.status,
        due_date: form.due_date || null,
        identified_by: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Punch item added");
      qc.invalidateQueries({ queryKey: ["punch-list"] });
      setOpen(false);
      setForm({ description: "", location: "", trade: "", priority: "medium", status: "open", due_date: "" });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const update: any = { status };
      if (status === "complete") update.completed_at = new Date().toISOString();
      if (status === "verified") update.verified_at = new Date().toISOString();
      const { error } = await supabase.from("punch_list_items").update(update).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["punch-list"] }),
  });

  return (
    <AppLayout title="Punch List">
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2"><ListChecks className="h-7 w-7" /> Punch List</h1>
            <p className="text-muted-foreground">Track outstanding items, snags and final close-out work.</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button className="gap-2"><Plus className="h-4 w-4" /> Add Item</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New Punch List Item</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Description</Label><Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Location</Label><Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Room 204, Level 3" /></div>
                  <div><Label>Trade</Label><Input value={form.trade} onChange={(e) => setForm({ ...form, trade: e.target.value })} placeholder="Electrical" /></div>
                  <div>
                    <Label>Priority</Label>
                    <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="critical">Critical</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>Due Date</Label><Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></div>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={() => createMutation.mutate()} disabled={!form.description || createMutation.isPending}>Add</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-3">
          {isLoading && <p className="text-muted-foreground">Loading…</p>}
          {!isLoading && items.length === 0 && <Card className="p-12 text-center text-muted-foreground">No punch list items yet.</Card>}
          {items.map((i: any) => (
            <Card key={i.id} className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-mono text-xs text-muted-foreground">{i.item_number}</span>
                    <Badge variant="outline">{i.status.replace(/_/g, " ")}</Badge>
                    <Badge variant={i.priority === "critical" ? "destructive" : "secondary"}>{i.priority}</Badge>
                    {i.location && <Badge variant="outline">{i.location}</Badge>}
                    {i.trade && <Badge variant="outline">{i.trade}</Badge>}
                  </div>
                  <p className="text-sm">{i.description}</p>
                </div>
                <Select value={i.status} onValueChange={(v) => updateStatus.mutate({ id: i.id, status: v })}>
                  <SelectTrigger className="w-36 shrink-0"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="in_progress">In progress</SelectItem>
                    <SelectItem value="complete">Complete</SelectItem>
                    <SelectItem value="verified">Verified</SelectItem>
                    <SelectItem value="void">Void</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
