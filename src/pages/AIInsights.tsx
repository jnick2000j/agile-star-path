import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Lightbulb, RefreshCw, X, CheckCircle2, AlertTriangle, AlertCircle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

interface Insight {
  id: string;
  insight_type: string;
  severity: "low" | "medium" | "high";
  scope_type: string | null;
  scope_id: string | null;
  title: string;
  description: string | null;
  recommendation: string | null;
  evidence: Record<string, unknown> | null;
  dismissed: boolean;
  resolved: boolean;
  detected_at: string;
}

const SEVERITY_CONFIG = {
  high: { color: "text-destructive", bg: "bg-destructive/10", icon: AlertCircle, label: "High" },
  medium: { color: "text-warning", bg: "bg-warning/10", icon: AlertTriangle, label: "Medium" },
  low: { color: "text-info", bg: "bg-info/10", icon: Lightbulb, label: "Low" },
} as const;

export default function AIInsights() {
  const { user } = useAuth();
  const { currentOrganization } = useOrganization();
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [tab, setTab] = useState<"open" | "dismissed" | "resolved">("open");

  const fetchInsights = async () => {
    if (!currentOrganization?.id) return;
    setLoading(true);
    const q = supabase
      .from("ai_insights")
      .select("*")
      .eq("organization_id", currentOrganization.id)
      .order("severity", { ascending: false })
      .order("detected_at", { ascending: false })
      .limit(200);
    const { data } = tab === "open"
      ? await q.eq("dismissed", false).eq("resolved", false)
      : tab === "dismissed"
        ? await q.eq("dismissed", true)
        : await q.eq("resolved", true);
    setInsights((data ?? []) as Insight[]);
    setLoading(false);
  };

  useEffect(() => { fetchInsights(); /* eslint-disable-next-line */ }, [currentOrganization?.id, tab]);

  const scanNow = async () => {
    if (!currentOrganization?.id) return;
    setScanning(true);
    const { data, error } = await supabase.functions.invoke("ai-insights-scan", {
      body: { organization_id: currentOrganization.id, triggered_by: "manual" },
    });
    setScanning(false);
    if (error || data?.error) {
      toast.error(data?.error ?? "Scan failed");
      return;
    }
    toast.success(`Scan complete — ${data?.inserted ?? 0} new findings.`);
    fetchInsights();
  };

  const update = async (id: string, fields: Partial<Insight>) => {
    if (!user) return;
    const payload: Record<string, unknown> = { ...fields };
    if (fields.dismissed) { payload.dismissed_by = user.id; payload.dismissed_at = new Date().toISOString(); }
    const { error } = await supabase.from("ai_insights").update(payload as never).eq("id", id);
    if (error) { toast.error("Couldn't update insight"); return; }
    fetchInsights();
  };

  const counts = { open: insights.filter((i) => !i.dismissed && !i.resolved).length };

  return (
    <AppLayout title="AI Insights" subtitle="Proactive findings: unowned items, slipping milestones, stale registers, benefit shortfalls.">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Tabs value={tab} onValueChange={(v) => setTab(v as never)}>
            <TabsList>
              <TabsTrigger value="open">
                Open
                {tab === "open" && counts.open > 0 && (
                  <Badge variant="secondary" className="ml-1.5 h-4 px-1 text-[10px]">{counts.open}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="dismissed">Dismissed</TabsTrigger>
              <TabsTrigger value="resolved">Resolved</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button onClick={scanNow} disabled={scanning} variant="outline" size="sm">
            {scanning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            <span className="ml-1.5">Scan now</span>
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : insights.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              <Lightbulb className="h-10 w-10 mx-auto mb-3 text-primary/40" />
              {tab === "open"
                ? "No open insights — everything looks healthy. Try 'Scan now' to refresh."
                : `No ${tab} insights.`}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {insights.map((i) => {
              const sev = SEVERITY_CONFIG[i.severity] ?? SEVERITY_CONFIG.medium;
              const SevIcon = sev.icon;
              return (
                <Card key={i.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className={`p-2 rounded-md ${sev.bg}`}>
                          <SevIcon className={`h-4 w-4 ${sev.color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-sm flex items-center gap-2 flex-wrap">
                            {i.title}
                            <Badge variant="outline" className="text-[10px] h-4">{i.insight_type.replace(/_/g, " ")}</Badge>
                            {i.scope_type && (
                              <Badge variant="secondary" className="text-[10px] h-4">{i.scope_type}</Badge>
                            )}
                          </CardTitle>
                          <p className="text-xs text-muted-foreground mt-1">
                            Detected {formatDistanceToNow(new Date(i.detected_at), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                      {!i.dismissed && !i.resolved && (
                        <div className="flex gap-1">
                          <Button size="sm" variant="outline" onClick={() => update(i.id, { resolved: true })}>
                            <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Resolve
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => update(i.id, { dismissed: true })}>
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardHeader>
                  {(i.description || i.recommendation) && (
                    <CardContent className="pt-0 pl-14">
                      {i.description && <p className="text-sm">{i.description}</p>}
                      {i.recommendation && (
                        <p className="text-sm mt-1.5"><strong>Recommendation:</strong> {i.recommendation}</p>
                      )}
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
