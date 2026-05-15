import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { ArrowLeft, Award } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { toast } from "sonner";
import { gradeBand } from "@/lib/okr";

export default function OKRGrading() {
  const { currentOrganization } = useOrganization();
  const [cycles, setCycles] = useState<any[]>([]);
  const [cycleId, setCycleId] = useState<string>("");
  const [objs, setObjs] = useState<any[]>([]);

  useEffect(() => { (async () => {
    if (!currentOrganization?.id) return;
    const { data } = await supabase.from("okr_cycles").select("*").eq("organization_id", currentOrganization.id).in("status", ["active", "closed"]).order("end_date", { ascending: false });
    setCycles(data ?? []);
    if (data?.length && !cycleId) setCycleId(data[0].id);
  })(); }, [currentOrganization?.id]);

  const load = async () => {
    if (!cycleId) return;
    const { data } = await supabase.from("okr_objectives").select("*").eq("cycle_id", cycleId).order("created_at");
    setObjs(data ?? []);
  };
  useEffect(() => { load(); }, [cycleId]);

  const setGrade = async (id: string, grade: number, commentary: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("okr_objectives").update({
      final_grade: grade, final_commentary: commentary, graded_by: user?.id, graded_at: new Date().toISOString(),
      status: grade >= 0.7 ? "achieved" : grade >= 0.4 ? "off_track" : "missed",
    }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Grade saved"); load();
  };

  return (
    <AppLayout title="OKRs">
      <div className="p-6 space-y-4">
        <Button variant="ghost" asChild><Link to="/okrs"><ArrowLeft className="h-4 w-4 mr-2" />Back</Link></Button>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-3xl font-bold flex items-center gap-2"><Award className="h-7 w-7" /> End-of-Cycle Grading</h1>
          <Select value={cycleId} onValueChange={setCycleId}>
            <SelectTrigger className="w-[260px]"><SelectValue placeholder="Cycle" /></SelectTrigger>
            <SelectContent>{cycles.map(c => <SelectItem key={c.id} value={c.id}>{c.name} ({c.status})</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <p className="text-muted-foreground text-sm">Suggested grade is the auto-rolled progress (0.0–1.0). 0.7+ is considered achieved.</p>
        <div className="grid gap-3">
          {objs.length === 0 && <Card><CardContent className="p-8 text-center text-muted-foreground">No objectives in this cycle.</CardContent></Card>}
          {objs.map(o => <GradeRow key={o.id} obj={o} onSave={setGrade} />)}
        </div>
      </div>
    </AppLayout>
  );
}

function GradeRow({ obj, onSave }: any) {
  const suggested = Math.max(0, Math.min(1, Number(obj.progress_pct) / 100));
  const [grade, setGrade] = useState<number>(obj.final_grade != null ? Number(obj.final_grade) : suggested);
  const [commentary, setCommentary] = useState<string>(obj.final_commentary ?? "");
  const band = gradeBand(grade);
  return (
    <Card><CardContent className="p-5 space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="font-semibold flex-1">{obj.title}</div>
        <Badge className={band.className}>{band.label}</Badge>
        <span className="text-sm text-muted-foreground">Auto-progress: {Number(obj.progress_pct).toFixed(0)}%</span>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <Label>Final grade: {grade.toFixed(2)}</Label>
          <Slider value={[grade]} min={0} max={1} step={0.05} onValueChange={v => setGrade(v[0])} />
        </div>
        <div>
          <Label>Commentary</Label>
          <Textarea value={commentary} onChange={e => setCommentary(e.target.value)} rows={2} />
        </div>
      </div>
      <div className="flex justify-end"><Button size="sm" onClick={() => onSave(obj.id, grade, commentary)}>Save grade</Button></div>
    </CardContent></Card>
  );
}
