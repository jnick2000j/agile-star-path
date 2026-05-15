import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ClipboardCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import { confidenceMeta, formatKrValue } from "@/lib/okr";

export default function OKRCheckins() {
  const { user } = useAuth();
  const { currentOrganization } = useOrganization();
  const [krs, setKrs] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      if (!user || !currentOrganization?.id) return;
      const { data } = await supabase.from("okr_key_results")
        .select("*, okr_objectives!inner(title, cycle_id, organization_id)")
        .eq("organization_id", currentOrganization.id)
        .eq("owner_user_id", user.id)
        .order("last_checkin_at", { ascending: true, nullsFirst: true });
      setKrs(data ?? []);
    })();
  }, [user, currentOrganization?.id]);

  return (
    <AppLayout title="OKRs">
      <div className="p-6 space-y-4">
        <Button variant="ghost" asChild><Link to="/okrs"><ArrowLeft className="h-4 w-4 mr-2" />Back</Link></Button>
        <h1 className="text-3xl font-bold flex items-center gap-2"><ClipboardCheck className="h-7 w-7" /> My Check-ins</h1>
        <p className="text-muted-foreground">Key results you own. Sorted by oldest check-in first.</p>
        <div className="grid gap-3">
          {krs.length === 0 && <Card><CardContent className="p-8 text-center text-muted-foreground">You don't own any key results.</CardContent></Card>}
          {krs.map((kr: any) => {
            const cm = confidenceMeta(Number(kr.confidence));
            const stale = !kr.last_checkin_at || (Date.now() - new Date(kr.last_checkin_at).getTime() > 7 * 86400000);
            return (
              <Card key={kr.id}><CardContent className="p-5 flex items-center justify-between gap-4 flex-wrap">
                <div className="flex-1 min-w-[280px]">
                  <div className="text-sm text-muted-foreground">{kr.okr_objectives?.title}</div>
                  <div className="font-medium">{kr.title}</div>
                  <div className="text-sm text-muted-foreground mt-1">
                    {formatKrValue(Number(kr.current_value), kr.metric_type, kr.unit)} / {formatKrValue(Number(kr.target_value), kr.metric_type, kr.unit)} · {Number(kr.progress_pct).toFixed(0)}%
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={cm.className}>{cm.label}</Badge>
                  {stale && <Badge className="bg-warning/10 text-warning">Check-in due</Badge>}
                  <Button size="sm" asChild><Link to={`/okrs/objectives/${kr.objective_id}`}>Open</Link></Button>
                </div>
              </CardContent></Card>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
}
