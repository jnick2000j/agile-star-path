import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { toast } from "sonner";

export default function OKRCycles() {
  const { currentOrganization } = useOrganization();
  const [cycles, setCycles] = useState<any[]>([]);
  const orgId = currentOrganization?.id;

  const load = async () => {
    if (!orgId) return;
    const { data } = await supabase.from("okr_cycles").select("*").eq("organization_id", orgId).order("start_date", { ascending: false });
    setCycles(data ?? []);
  };
  useEffect(() => { load(); }, [orgId]);

  const setStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("okr_cycles").update({ status }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success(`Cycle ${status}`); load();
  };

  return (
    <AppLayout title="OKRs">
      <div className="p-6 space-y-4">
        <Button variant="ghost" asChild className="mb-2"><Link to="/okrs"><ArrowLeft className="h-4 w-4 mr-2" />Back to OKRs</Link></Button>
        <h1 className="text-3xl font-bold flex items-center gap-2"><Calendar className="h-7 w-7" /> OKR Cycles</h1>
        <div className="grid gap-3">
          {cycles.length === 0 && <Card><CardContent className="p-8 text-center text-muted-foreground">No cycles yet.</CardContent></Card>}
          {cycles.map(c => (
            <Card key={c.id}><CardContent className="p-5 flex items-center justify-between flex-wrap gap-3">
              <div>
                <div className="font-semibold">{c.name} <Badge variant="outline" className="ml-2">{c.period_type}</Badge> <Badge className="ml-1">{c.status}</Badge></div>
                <div className="text-sm text-muted-foreground">{c.start_date} → {c.end_date}</div>
              </div>
              <div className="flex gap-2">
                {c.status !== "active" && <Button size="sm" variant="outline" onClick={() => setStatus(c.id, "active")}>Activate</Button>}
                {c.status !== "closed" && <Button size="sm" variant="outline" onClick={() => setStatus(c.id, "closed")}>Close</Button>}
              </div>
            </CardContent></Card>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
