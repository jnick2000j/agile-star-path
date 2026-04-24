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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, NotebookPen, Cloud } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export default function DailyLogs() {
  const { currentOrganization } = useOrganization();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    log_date: format(new Date(), "yyyy-MM-dd"),
    weather: "",
    crew_count: 0,
    hours_worked: 0,
    work_performed: "",
    delays: "",
    safety_incidents: "",
    visitors: "",
    notes: "",
  });

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["daily-logs", currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization?.id) return [];
      const { data, error } = await supabase
        .from("daily_logs")
        .select("*")
        .eq("organization_id", currentOrganization.id)
        .order("log_date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!currentOrganization?.id,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!currentOrganization?.id || !user) throw new Error("No organization");
      const { error } = await supabase.from("daily_logs").insert({
        organization_id: currentOrganization.id,
        ...form,
        created_by: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Daily log saved");
      qc.invalidateQueries({ queryKey: ["daily-logs"] });
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <AppLayout>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2"><NotebookPen className="h-7 w-7" /> Daily Logs</h1>
            <p className="text-muted-foreground">Site diary entries: weather, crew, work performed, delays, safety.</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button className="gap-2"><Plus className="h-4 w-4" /> New Log</Button></DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader><DialogTitle>New Daily Log</DialogTitle></DialogHeader>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Date</Label><Input type="date" value={form.log_date} onChange={(e) => setForm({ ...form, log_date: e.target.value })} /></div>
                <div><Label>Weather</Label><Input value={form.weather} onChange={(e) => setForm({ ...form, weather: e.target.value })} placeholder="Sunny, 22°C" /></div>
                <div><Label>Crew Count</Label><Input type="number" value={form.crew_count} onChange={(e) => setForm({ ...form, crew_count: Number(e.target.value) })} /></div>
                <div><Label>Hours Worked</Label><Input type="number" step="0.5" value={form.hours_worked} onChange={(e) => setForm({ ...form, hours_worked: Number(e.target.value) })} /></div>
                <div className="col-span-2"><Label>Work Performed</Label><Textarea rows={3} value={form.work_performed} onChange={(e) => setForm({ ...form, work_performed: e.target.value })} /></div>
                <div className="col-span-2"><Label>Delays</Label><Textarea rows={2} value={form.delays} onChange={(e) => setForm({ ...form, delays: e.target.value })} /></div>
                <div className="col-span-2"><Label>Safety Incidents</Label><Textarea rows={2} value={form.safety_incidents} onChange={(e) => setForm({ ...form, safety_incidents: e.target.value })} /></div>
                <div className="col-span-2"><Label>Visitors</Label><Input value={form.visitors} onChange={(e) => setForm({ ...form, visitors: e.target.value })} /></div>
                <div className="col-span-2"><Label>Notes</Label><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
              </div>
              <DialogFooter>
                <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>Save Log</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-3">
          {isLoading && <p className="text-muted-foreground">Loading…</p>}
          {!isLoading && logs.length === 0 && <Card className="p-12 text-center text-muted-foreground">No daily logs yet.</Card>}
          {logs.map((l: any) => (
            <Card key={l.id} className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="font-semibold">{format(new Date(l.log_date), "EEEE, MMM d, yyyy")}</div>
                {l.weather && (
                  <div className="text-sm text-muted-foreground flex items-center gap-1">
                    <Cloud className="h-4 w-4" /> {l.weather}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mb-2">
                <div><span className="text-muted-foreground">Crew:</span> {l.crew_count}</div>
                <div><span className="text-muted-foreground">Hours:</span> {l.hours_worked}</div>
              </div>
              {l.work_performed && <p className="text-sm"><span className="text-muted-foreground">Work:</span> {l.work_performed}</p>}
              {l.delays && <p className="text-sm mt-1"><span className="text-muted-foreground">Delays:</span> {l.delays}</p>}
              {l.safety_incidents && <p className="text-sm mt-1 text-destructive"><span className="text-muted-foreground">Safety:</span> {l.safety_incidents}</p>}
            </Card>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
