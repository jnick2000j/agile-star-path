import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ArrowLeft, Plus, ClipboardCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { toast } from "sonner";
import { METRIC_TYPES, statusMeta, confidenceMeta, formatKrValue } from "@/lib/okr";

export default function OKRObjectiveDetail() {
  const { id } = useParams();
  const { currentOrganization } = useOrganization();
  const [obj, setObj] = useState<any>(null);
  const [krs, setKrs] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [showKr, setShowKr] = useState(false);
  const [showCheckin, setShowCheckin] = useState<string | null>(null);

  const load = async () => {
    if (!id) return;
    const { data: o } = await supabase.from("okr_objectives").select("*").eq("id", id).maybeSingle();
    setObj(o);
    const { data: k } = await supabase.from("okr_key_results").select("*").eq("objective_id", id).order("created_at");
    setKrs(k ?? []);
    if (k && k.length) {
      const { data: h } = await supabase.from("okr_checkins").select("*").in("key_result_id", k.map(x => x.id)).order("checkin_date", { ascending: false }).limit(50);
      setHistory(h ?? []);
    }
  };
  useEffect(() => { load(); }, [id]);

  if (!obj) return <AppLayout><div className="p-6">Loading…</div></AppLayout>;
  const sm = statusMeta(obj.status);
  const cm = confidenceMeta(Number(obj.confidence));

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <Button variant="ghost" asChild><Link to="/okrs"><ArrowLeft className="h-4 w-4 mr-2" />Back</Link></Button>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-3xl font-bold">{obj.title}</h1>
            <Badge className={sm.className}>{sm.label}</Badge>
            <Badge className={cm.className}>Confidence {Number(obj.confidence).toFixed(2)}</Badge>
          </div>
          {obj.description && <p className="text-muted-foreground mt-2">{obj.description}</p>}
          <div className="mt-4 max-w-md">
            <div className="flex justify-between text-sm mb-1"><span>Overall progress</span><span className="font-medium">{Number(obj.progress_pct).toFixed(0)}%</span></div>
            <Progress value={Number(obj.progress_pct)} />
          </div>
        </div>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Key Results</CardTitle>
            <NewKrDialog open={showKr} onOpenChange={setShowKr} orgId={currentOrganization?.id} objectiveId={obj.id} onCreated={load} />
          </CardHeader>
          <CardContent className="space-y-3">
            {krs.length === 0 && <div className="text-muted-foreground text-sm">No key results yet.</div>}
            {krs.map(kr => {
              const ksm = statusMeta(kr.status);
              const kcm = confidenceMeta(Number(kr.confidence));
              return (
                <div key={kr.id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start gap-4 flex-wrap">
                    <div className="flex-1 min-w-[280px]">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{kr.title}</span>
                        <Badge className={ksm.className}>{ksm.label}</Badge>
                        <Badge className={kcm.className}>{kcm.label}</Badge>
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">
                        {formatKrValue(Number(kr.current_value), kr.metric_type, kr.unit)} / {formatKrValue(Number(kr.target_value), kr.metric_type, kr.unit)} (start {formatKrValue(Number(kr.start_value), kr.metric_type, kr.unit)})
                      </div>
                    </div>
                    <div className="w-[220px]">
                      <Progress value={Number(kr.progress_pct)} />
                      <div className="text-xs text-right mt-1">{Number(kr.progress_pct).toFixed(0)}%</div>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => setShowCheckin(kr.id)}><ClipboardCheck className="h-3 w-3 mr-1" />Check in</Button>
                  </div>
                  <div className="text-xs text-muted-foreground mt-2">
                    {history.filter(h => h.key_result_id === kr.id).slice(0, 3).map(h => (
                      <div key={h.id}>· {h.checkin_date}: {formatKrValue(Number(h.new_value), kr.metric_type, kr.unit)} (confidence {Number(h.confidence).toFixed(2)}){h.commentary ? ` — ${h.commentary}` : ""}</div>
                    ))}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
      {showCheckin && <CheckinDialog krId={showCheckin} orgId={currentOrganization?.id} onClose={() => setShowCheckin(null)} onDone={load} />}
    </AppLayout>
  );
}

function NewKrDialog({ open, onOpenChange, orgId, objectiveId, onCreated }: any) {
  const [f, setF] = useState({ title: "", metric_type: "number", start_value: 0, target_value: 100, unit: "", weight: 1 });
  const submit = async () => {
    if (!f.title) { toast.error("Title required"); return; }
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("okr_key_results").insert({
      ...f, organization_id: orgId, objective_id: objectiveId, owner_user_id: user?.id, created_by: user?.id, current_value: f.start_value,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Key result added"); onOpenChange(false); onCreated();
    setF({ title: "", metric_type: "number", start_value: 0, target_value: 100, unit: "", weight: 1 });
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-2" />Add Key Result</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>New Key Result</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Title</Label><Input value={f.title} onChange={e => setF({ ...f, title: e.target.value })} /></div>
          <div><Label>Metric type</Label>
            <Select value={f.metric_type} onValueChange={v => setF({ ...f, metric_type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{METRIC_TYPES.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div><Label>Start</Label><Input type="number" value={f.start_value} onChange={e => setF({ ...f, start_value: Number(e.target.value) })} /></div>
            <div><Label>Target</Label><Input type="number" value={f.target_value} onChange={e => setF({ ...f, target_value: Number(e.target.value) })} /></div>
            <div><Label>Weight</Label><Input type="number" value={f.weight} onChange={e => setF({ ...f, weight: Number(e.target.value) })} /></div>
          </div>
          <div><Label>Unit (optional)</Label><Input value={f.unit} onChange={e => setF({ ...f, unit: e.target.value })} placeholder="users, NPS, etc." /></div>
        </div>
        <DialogFooter><Button onClick={submit}>Create</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CheckinDialog({ krId, orgId, onClose, onDone }: any) {
  const [f, setF] = useState({ new_value: 0, confidence: 0.7, commentary: "", blockers: "" });
  const submit = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("okr_checkins").insert({
      key_result_id: krId, organization_id: orgId, user_id: user?.id, ...f,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Check-in saved"); onClose(); onDone();
  };
  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>Weekly Check-in</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div><Label>Current value</Label><Input type="number" value={f.new_value} onChange={e => setF({ ...f, new_value: Number(e.target.value) })} /></div>
          <div>
            <Label>Confidence: {f.confidence.toFixed(2)}</Label>
            <Slider value={[f.confidence]} min={0} max={1} step={0.05} onValueChange={v => setF({ ...f, confidence: v[0] })} />
          </div>
          <div><Label>Commentary</Label><Textarea value={f.commentary} onChange={e => setF({ ...f, commentary: e.target.value })} /></div>
          <div><Label>Blockers</Label><Textarea value={f.blockers} onChange={e => setF({ ...f, blockers: e.target.value })} /></div>
        </div>
        <DialogFooter><Button onClick={submit}>Save check-in</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
