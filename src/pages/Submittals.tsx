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
import { Plus, FileCheck2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export default function Submittals() {
  const { currentOrganization } = useOrganization();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ submittal_number: "", title: "", spec_section: "", description: "", status: "pending", due_date: "" });

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["submittals", currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization?.id) return [];
      const { data, error } = await supabase
        .from("submittals")
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
      const { error } = await supabase.from("submittals").insert({
        organization_id: currentOrganization.id,
        submittal_number: form.submittal_number || `SUB-${Date.now().toString().slice(-6)}`,
        title: form.title,
        spec_section: form.spec_section || null,
        description: form.description || null,
        status: form.status,
        due_date: form.due_date || null,
        submitted_by: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Submittal created");
      qc.invalidateQueries({ queryKey: ["submittals"] });
      setOpen(false);
      setForm({ submittal_number: "", title: "", spec_section: "", description: "", status: "pending", due_date: "" });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <AppLayout title="Submittals">
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <FileCheck2 className="h-7 w-7" /> Submittals
            </h1>
            <p className="text-muted-foreground">Manage shop drawings, samples and product data submittals.</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button className="gap-2"><Plus className="h-4 w-4" /> New Submittal</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New Submittal</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Number</Label><Input value={form.submittal_number} onChange={(e) => setForm({ ...form, submittal_number: e.target.value })} placeholder="Auto-generated if blank" /></div>
                <div><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
                <div><Label>Spec Section</Label><Input value={form.spec_section} onChange={(e) => setForm({ ...form, spec_section: e.target.value })} placeholder="e.g. 03 30 00" /></div>
                <div><Label>Description</Label><Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Status</Label>
                    <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="under_review">Under review</SelectItem>
                        <SelectItem value="approved">Approved</SelectItem>
                        <SelectItem value="rejected">Rejected</SelectItem>
                        <SelectItem value="revise_resubmit">Revise & resubmit</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>Due Date</Label><Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></div>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={() => createMutation.mutate()} disabled={!form.title || createMutation.isPending}>Create</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-3">
          {isLoading && <p className="text-muted-foreground">Loading…</p>}
          {!isLoading && rows.length === 0 && <Card className="p-12 text-center text-muted-foreground">No submittals yet.</Card>}
          {rows.map((r: any) => (
            <Card key={r.id} className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-sm text-muted-foreground">{r.submittal_number}</span>
                    <Badge variant="outline">{r.status.replace(/_/g, " ")}</Badge>
                    {r.spec_section && <Badge variant="secondary">{r.spec_section}</Badge>}
                  </div>
                  <h3 className="font-semibold">{r.title}</h3>
                  {r.description && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{r.description}</p>}
                </div>
                <div className="text-right text-sm text-muted-foreground shrink-0">
                  {r.due_date && <div>Due {format(new Date(r.due_date), "MMM d")}</div>}
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
