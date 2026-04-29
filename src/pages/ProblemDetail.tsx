import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, BookOpen, Link2Off, Save, Server, Ticket, History } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { CIPicker } from "@/components/cmdb/CIPicker";

const STATUS_STYLES: Record<string, string> = {
  new: "bg-info/10 text-info",
  investigating: "bg-warning/10 text-warning",
  known_error: "bg-primary/10 text-primary",
  resolved: "bg-success/10 text-success",
  closed: "bg-muted text-muted-foreground",
};

export default function ProblemDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentOrganization } = useOrganization();
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: problem, isLoading } = useQuery({
    queryKey: ["problem", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("problems").select("*").eq("id", id!).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: incidents = [] } = useQuery({
    queryKey: ["problem-incidents", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("helpdesk_tickets")
        .select("id, reference_number, subject, status, priority, ticket_type, created_at")
        .eq("parent_problem_id", id!)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!id,
  });

  const { data: ciLinks = [] } = useQuery({
    queryKey: ["problem-cis", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("problem_ci_links")
        .select("id, link_type, ci_id, configuration_items(id, name, reference_number, environment, criticality)")
        .eq("problem_id", id!);
      return data ?? [];
    },
    enabled: !!id,
  });

  const { data: history = [] } = useQuery({
    queryKey: ["problem-history", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("problem_status_history")
        .select("*")
        .eq("problem_id", id!)
        .order("changed_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!id,
  });

  // local editable state for description, root cause, workaround, resolution
  const [draft, setDraft] = useState<any>({});
  useEffect(() => { if (problem) setDraft(problem); }, [problem]);

  const update = async (patch: any) => {
    if (!id) return;
    const { error } = await supabase.from("problems").update(patch).eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["problem", id] });
    qc.invalidateQueries({ queryKey: ["problems"] });
    qc.invalidateQueries({ queryKey: ["problem-history", id] });
  };

  const saveText = async (field: string, value: string) => {
    if ((problem as any)?.[field] === (value || null)) return;
    await update({ [field]: value || null });
    toast.success("Saved");
  };

  const handleLinkCi = async (ciId: string) => {
    if (!currentOrganization?.id) return;
    const { error } = await supabase.from("problem_ci_links").insert({
      organization_id: currentOrganization.id,
      problem_id: id!,
      ci_id: ciId,
      link_type: "affected",
      created_by: user?.id ?? null,
    });
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["problem-cis", id] });
  };
  const handleUnlinkCi = async (linkId: string) => {
    await supabase.from("problem_ci_links").delete().eq("id", linkId);
    qc.invalidateQueries({ queryKey: ["problem-cis", id] });
  };
  const handleUnlinkIncident = async (ticketId: string) => {
    await supabase.from("helpdesk_tickets").update({ parent_problem_id: null }).eq("id", ticketId);
    qc.invalidateQueries({ queryKey: ["problem-incidents", id] });
  };

  if (isLoading || !problem) return <AppLayout title="Problem"><div className="text-muted-foreground p-6">Loading…</div></AppLayout>;

  return (
    <AppLayout title={problem.title} subtitle={problem.reference_number ?? "Problem"}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate("/problems")}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <div className="ml-auto flex items-center gap-2">
            {problem.is_known_error && <Badge variant="outline" className="gap-1"><BookOpen className="h-3 w-3" /> Known error</Badge>}
            <Select value={problem.status} onValueChange={(v) => update({ status: v })}>
              <SelectTrigger className={`w-44 ${STATUS_STYLES[problem.status] ?? ""}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["new","investigating","known_error","resolved","closed"].map(s =>
                  <SelectItem key={s} value={s}>{s.replace("_"," ")}</SelectItem>
                )}
              </SelectContent>
            </Select>
            <Select value={problem.priority} onValueChange={(v) => update({ priority: v })}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                {["low","medium","high","critical"].map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="incidents"><Ticket className="h-3.5 w-3.5 mr-1" /> Incidents ({incidents.length})</TabsTrigger>
            <TabsTrigger value="cis"><Server className="h-3.5 w-3.5 mr-1" /> CIs ({ciLinks.length})</TabsTrigger>
            <TabsTrigger value="history"><History className="h-3.5 w-3.5 mr-1" /> History</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-3">
            <Card className="p-4 space-y-3">
              <div>
                <Label>Description</Label>
                <Textarea
                  rows={4}
                  value={draft.description ?? ""}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                  onBlur={(e) => saveText("description", e.target.value)}
                />
              </div>
              <div className="grid md:grid-cols-2 gap-3">
                <div>
                  <Label>Root cause</Label>
                  <Textarea
                    rows={4}
                    placeholder="What is causing the recurring incidents?"
                    value={draft.root_cause ?? ""}
                    onChange={(e) => setDraft({ ...draft, root_cause: e.target.value })}
                    onBlur={(e) => saveText("root_cause", e.target.value)}
                  />
                </div>
                <div>
                  <Label>Workaround</Label>
                  <Textarea
                    rows={4}
                    placeholder="Temporary mitigation users/agents can apply."
                    value={draft.workaround ?? ""}
                    onChange={(e) => setDraft({ ...draft, workaround: e.target.value })}
                    onBlur={(e) => saveText("workaround", e.target.value)}
                  />
                </div>
              </div>
              <div>
                <Label>Resolution</Label>
                <Textarea
                  rows={3}
                  placeholder="The permanent fix once available."
                  value={draft.resolution ?? ""}
                  onChange={(e) => setDraft({ ...draft, resolution: e.target.value })}
                  onBlur={(e) => saveText("resolution", e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div>
                  <Label>Category</Label>
                  <Input
                    value={draft.category ?? ""}
                    onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                    onBlur={(e) => saveText("category", e.target.value)}
                  />
                </div>
                <div>
                  <Label>Identified</Label>
                  <p className="text-sm pt-2">{problem.identified_at ? format(new Date(problem.identified_at), "PP") : "—"}</p>
                </div>
                <div>
                  <Label>Resolved</Label>
                  <p className="text-sm pt-2">{problem.resolved_at ? format(new Date(problem.resolved_at), "PP") : "—"}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="kedb"
                  checked={!!problem.is_known_error}
                  onChange={(e) => update({ is_known_error: e.target.checked })}
                />
                <Label htmlFor="kedb" className="!mt-0 cursor-pointer">
                  Publish as known error (visible in Known Error Database)
                </Label>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="incidents">
            <Card className="p-4">
              <p className="text-xs text-muted-foreground mb-3">Tickets linked to this problem as recurring incidents.</p>
              {incidents.length === 0 ? (
                <p className="text-sm text-muted-foreground">No incidents linked yet. From any ticket, set its parent problem to this one.</p>
              ) : (
                <div className="space-y-1">
                  {incidents.map((t: any) => (
                    <div key={t.id} className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-muted">
                      <span className="font-mono text-xs text-muted-foreground w-24">{t.reference_number}</span>
                      <Link to={`/support/tickets/${t.id}`} className="flex-1 truncate text-sm hover:underline">{t.subject}</Link>
                      <Badge variant="outline" className="capitalize text-xs">{t.ticket_type.replace("_"," ")}</Badge>
                      <Badge variant="secondary" className="capitalize text-xs">{t.status}</Badge>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleUnlinkIncident(t.id)}>
                        <Link2Off className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="cis">
            <Card className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">Configuration items affected by this problem.</p>
                <CIPicker excludeIds={ciLinks.map((l: any) => l.ci_id)} onSelect={handleLinkCi} triggerLabel="Link CI" />
              </div>
              {ciLinks.length === 0 ? (
                <p className="text-sm text-muted-foreground">No CIs linked.</p>
              ) : (
                <div className="space-y-1">
                  {ciLinks.map((l: any) => (
                    <div key={l.id} className="flex items-center gap-2 border rounded-md p-2">
                      <Link to={`/cmdb/${l.ci_id}`} className="text-sm font-medium hover:underline flex-1 truncate">
                        {l.configuration_items?.name}
                      </Link>
                      <span className="text-xs text-muted-foreground">{l.configuration_items?.reference_number}</span>
                      <Badge variant="outline" className="text-[10px] capitalize">{l.link_type.replace("_"," ")}</Badge>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleUnlinkCi(l.id)}>
                        <Link2Off className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="history">
            <Card className="p-4">
              {history.length === 0 ? (
                <p className="text-sm text-muted-foreground">No status changes yet.</p>
              ) : (
                <div className="space-y-2">
                  {history.map((h: any) => (
                    <div key={h.id} className="flex items-center gap-2 text-sm">
                      <span className="text-xs text-muted-foreground w-32">{format(new Date(h.changed_at), "MMM d, p")}</span>
                      {h.from_status && <Badge variant="outline" className="text-[10px] capitalize">{h.from_status.replace("_"," ")}</Badge>}
                      <span className="text-muted-foreground">→</span>
                      <Badge className={`text-[10px] capitalize ${STATUS_STYLES[h.to_status] ?? ""}`}>{h.to_status.replace("_"," ")}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
