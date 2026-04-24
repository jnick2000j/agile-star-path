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
import { Plus, FileQuestion } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  draft: "outline",
  open: "default",
  answered: "secondary",
  closed: "outline",
  void: "destructive",
};

export default function RFIs() {
  const { currentOrganization } = useOrganization();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ rfi_number: "", subject: "", question: "", priority: "medium", due_date: "" });

  const { data: rfis = [], isLoading } = useQuery({
    queryKey: ["rfis", currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization?.id) return [];
      const { data, error } = await supabase
        .from("rfis")
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
      const { error } = await supabase.from("rfis").insert({
        organization_id: currentOrganization.id,
        rfi_number: form.rfi_number || `RFI-${Date.now().toString().slice(-6)}`,
        subject: form.subject,
        question: form.question,
        priority: form.priority,
        due_date: form.due_date || null,
        submitted_by: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("RFI created");
      qc.invalidateQueries({ queryKey: ["rfis"] });
      setOpen(false);
      setForm({ rfi_number: "", subject: "", question: "", priority: "medium", due_date: "" });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <AppLayout>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <FileQuestion className="h-7 w-7" /> Requests for Information
            </h1>
            <p className="text-muted-foreground">Track formal RFIs from contractors and design teams.</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="h-4 w-4" /> New RFI</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New RFI</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>RFI Number</Label>
                  <Input value={form.rfi_number} onChange={(e) => setForm({ ...form, rfi_number: e.target.value })} placeholder="Auto-generated if blank" />
                </div>
                <div>
                  <Label>Subject</Label>
                  <Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
                </div>
                <div>
                  <Label>Question</Label>
                  <Textarea rows={4} value={form.question} onChange={(e) => setForm({ ...form, question: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
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
                  <div>
                    <Label>Due Date</Label>
                    <Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={() => createMutation.mutate()} disabled={!form.subject || !form.question || createMutation.isPending}>
                  Create RFI
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-3">
          {isLoading && <p className="text-muted-foreground">Loading…</p>}
          {!isLoading && rfis.length === 0 && (
            <Card className="p-12 text-center text-muted-foreground">No RFIs yet. Create your first one above.</Card>
          )}
          {rfis.map((r: any) => (
            <Card key={r.id} className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-sm text-muted-foreground">{r.rfi_number}</span>
                    <Badge variant={STATUS_VARIANT[r.status] || "outline"}>{r.status}</Badge>
                    <Badge variant="outline">{r.priority}</Badge>
                  </div>
                  <h3 className="font-semibold">{r.subject}</h3>
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{r.question}</p>
                </div>
                <div className="text-right text-sm text-muted-foreground shrink-0">
                  {r.due_date && <div>Due {format(new Date(r.due_date), "MMM d")}</div>}
                  <div className="text-xs">{format(new Date(r.created_at), "MMM d, yyyy")}</div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
