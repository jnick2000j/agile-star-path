import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Target, Plus, ClipboardCheck, Calendar, Award } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { toast } from "sonner";
import { statusMeta, confidenceMeta, SCOPES, PERIOD_TYPES } from "@/lib/okr";
import { cn } from "@/lib/utils";

interface Cycle { id: string; name: string; period_type: string; start_date: string; end_date: string; status: string; }
interface Objective {
  id: string; cycle_id: string; title: string; description: string | null;
  scope: string; status: string; progress_pct: number; confidence: number;
  owner_user_id: string | null; final_grade: number | null;
}

export default function OKRs() {
  const { currentOrganization } = useOrganization();
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [activeCycleId, setActiveCycleId] = useState<string>("");
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCycle, setShowCycle] = useState(false);
  const [showObjective, setShowObjective] = useState(false);

  const orgId = currentOrganization?.id;

  const loadCycles = async () => {
    if (!orgId) return;
    const { data } = await supabase.from("okr_cycles").select("*").eq("organization_id", orgId).order("start_date", { ascending: false });
    setCycles((data ?? []) as Cycle[]);
    if (data && data.length && !activeCycleId) {
      const active = data.find((c: any) => c.status === "active") ?? data[0];
      setActiveCycleId(active.id);
    }
  };

  const loadObjectives = async () => {
    if (!orgId || !activeCycleId) { setObjectives([]); return; }
    setLoading(true);
    const { data } = await supabase.from("okr_objectives").select("*").eq("organization_id", orgId).eq("cycle_id", activeCycleId).order("created_at");
    setObjectives((data ?? []) as Objective[]);
    setLoading(false);
  };

  useEffect(() => { loadCycles(); }, [orgId]);
  useEffect(() => { loadObjectives(); }, [orgId, activeCycleId]);

  const stats = useMemo(() => {
    const total = objectives.length;
    const avgProgress = total ? objectives.reduce((s, o) => s + Number(o.progress_pct || 0), 0) / total : 0;
    const avgConfidence = total ? objectives.reduce((s, o) => s + Number(o.confidence || 0), 0) / total : 0;
    const atRisk = objectives.filter((o) => o.status === "at_risk" || o.status === "off_track" || Number(o.confidence) < 0.4).length;
    return { total, avgProgress, avgConfidence, atRisk };
  }, [objectives]);

  const activeCycle = cycles.find((c) => c.id === activeCycleId);

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2"><Target className="h-7 w-7 text-primary" /> OKRs</h1>
            <p className="text-muted-foreground">Objectives, key results, weekly check-ins and end-of-cycle grading.</p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={activeCycleId} onValueChange={setActiveCycleId}>
              <SelectTrigger className="w-[240px]"><SelectValue placeholder="Select cycle" /></SelectTrigger>
              <SelectContent>
                {cycles.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name} ({c.status})</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" asChild><Link to="/okrs/cycles"><Calendar className="h-4 w-4 mr-2" />Cycles</Link></Button>
            <Button variant="outline" asChild><Link to="/okrs/checkins"><ClipboardCheck className="h-4 w-4 mr-2" />Check-ins</Link></Button>
            <Button variant="outline" asChild><Link to="/okrs/grading"><Award className="h-4 w-4 mr-2" />Grading</Link></Button>
            <NewCycleDialog open={showCycle} onOpenChange={setShowCycle} orgId={orgId} onCreated={loadCycles} />
            {activeCycleId && <NewObjectiveDialog open={showObjective} onOpenChange={setShowObjective} orgId={orgId} cycleId={activeCycleId} onCreated={loadObjectives} />}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard label="Objectives" value={stats.total.toString()} />
          <StatCard label="Avg progress" value={`${stats.avgProgress.toFixed(0)}%`} />
          <StatCard label="Avg confidence" value={stats.avgConfidence.toFixed(2)} />
          <StatCard label="At risk" value={stats.atRisk.toString()} tone={stats.atRisk > 0 ? "warning" : "default"} />
        </div>

        {activeCycle && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-normal text-muted-foreground">
                Cycle: {activeCycle.name} · {activeCycle.start_date} → {activeCycle.end_date} · {activeCycle.status}
              </CardTitle>
            </CardHeader>
          </Card>
        )}

        <div className="space-y-3">
          {loading && <div className="text-muted-foreground text-sm">Loading…</div>}
          {!loading && objectives.length === 0 && (
            <Card><CardContent className="p-8 text-center text-muted-foreground">
              {activeCycleId ? "No objectives in this cycle yet. Create your first objective." : "Create a cycle to get started."}
            </CardContent></Card>
          )}
          {objectives.map((o) => {
            const sm = statusMeta(o.status);
            const cm = confidenceMeta(Number(o.confidence));
            return (
              <Card key={o.id}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex-1 min-w-[300px]">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link to={`/okrs/objectives/${o.id}`} className="font-semibold hover:underline">{o.title}</Link>
                        <Badge variant="outline">{SCOPES.find(s => s.value === o.scope)?.label ?? o.scope}</Badge>
                        <Badge className={sm.className}>{sm.label}</Badge>
                        <Badge className={cm.className}>Confidence: {cm.label} ({Number(o.confidence).toFixed(2)})</Badge>
                      </div>
                      {o.description && <p className="text-sm text-muted-foreground mt-2">{o.description}</p>}
                    </div>
                    <div className="w-[260px]">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-muted-foreground">Progress</span>
                        <span className="font-medium">{Number(o.progress_pct).toFixed(0)}%</span>
                      </div>
                      <Progress value={Number(o.progress_pct)} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
}

function StatCard({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "warning" }) {
  return (
    <Card><CardContent className="p-5">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className={cn("text-3xl font-bold mt-1", tone === "warning" && "text-warning")}>{value}</div>
    </CardContent></Card>
  );
}

function NewCycleDialog({ open, onOpenChange, orgId, onCreated }: any) {
  const [form, setForm] = useState({ name: "", period_type: "quarterly", start_date: "", end_date: "", status: "active" });
  const submit = async () => {
    if (!orgId || !form.name || !form.start_date || !form.end_date) { toast.error("Name and dates required"); return; }
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("okr_cycles").insert({ ...form, organization_id: orgId, created_by: user?.id });
    if (error) { toast.error(error.message); return; }
    toast.success("Cycle created"); onOpenChange(false); onCreated();
    setForm({ name: "", period_type: "quarterly", start_date: "", end_date: "", status: "active" });
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild><Button variant="outline"><Plus className="h-4 w-4 mr-2" />New Cycle</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>New OKR Cycle</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Name</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Q1 2026" /></div>
          <div><Label>Period</Label>
            <Select value={form.period_type} onValueChange={v => setForm({ ...form, period_type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{PERIOD_TYPES.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Start</Label><Input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} /></div>
            <div><Label>End</Label><Input type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} /></div>
          </div>
          <div><Label>Status</Label>
            <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="planned">Planned</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter><Button onClick={submit}>Create</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NewObjectiveDialog({ open, onOpenChange, orgId, cycleId, onCreated }: any) {
  const [form, setForm] = useState({ title: "", description: "", scope: "org" });
  const submit = async () => {
    if (!form.title) { toast.error("Title required"); return; }
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("okr_objectives").insert({
      title: form.title, description: form.description, scope: form.scope,
      organization_id: orgId, cycle_id: cycleId, owner_user_id: user?.id, created_by: user?.id,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Objective created"); onOpenChange(false); onCreated();
    setForm({ title: "", description: "", scope: "org" });
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />New Objective</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>New Objective</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Title</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Increase customer retention" /></div>
          <div><Label>Description</Label><Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
          <div><Label>Scope</Label>
            <Select value={form.scope} onValueChange={v => setForm({ ...form, scope: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{SCOPES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter><Button onClick={submit}>Create</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
