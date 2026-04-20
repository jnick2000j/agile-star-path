import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, Check, X, FileText, Clock, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import { usePermissions } from "@/hooks/usePermissions";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

interface AuditEntry {
  id: string;
  action_type: string;
  entity_type: string | null;
  entity_id: string | null;
  model: string | null;
  prompt_summary: string | null;
  output_summary: string | null;
  target_field: string | null;
  draft_payload: { content?: string; inputs?: Record<string, unknown> } | null;
  status: string;
  user_id: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

const STATUS_TABS = [
  { key: "pending", label: "Pending", icon: Clock },
  { key: "approved", label: "Approved", icon: Check },
  { key: "rejected", label: "Rejected", icon: X },
];

export default function AIApprovals() {
  const { user } = useAuth();
  const { currentOrganization } = useOrganization();
  const { can, isAdmin, loading: permsLoading } = usePermissions();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("pending");
  const [selected, setSelected] = useState<AuditEntry | null>(null);
  const [editedDraft, setEditedDraft] = useState("");

  const canApprove = isAdmin || can("ai_approval", "approve");

  const fetchEntries = async () => {
    if (!currentOrganization?.id) {
      setEntries([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("ai_audit_log")
      .select("*")
      .eq("organization_id", currentOrganization.id)
      .eq("status", activeTab)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) {
      console.error(error);
      toast.error("Couldn't load AI audit log.");
    }
    setEntries((data ?? []) as AuditEntry[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchEntries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOrganization?.id, activeTab]);

  const openEntry = (entry: AuditEntry) => {
    setSelected(entry);
    setEditedDraft(entry.draft_payload?.content ?? entry.output_summary ?? "");
  };

  const decide = async (entry: AuditEntry, status: "approved" | "rejected") => {
    if (!user) return;
    const { error } = await supabase
      .from("ai_audit_log")
      .update({
        status,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        draft_payload: { ...(entry.draft_payload ?? {}), content: editedDraft } as never,
      })
      .eq("id", entry.id);
    if (error) {
      toast.error(`Couldn't ${status === "approved" ? "approve" : "reject"} draft.`);
      console.error(error);
      return;
    }
    toast.success(status === "approved" ? "Draft approved." : "Draft rejected.");
    setSelected(null);
    fetchEntries();
  };

  if (permsLoading) {
    return (
      <AppLayout title="AI Approvals" subtitle="Review AI-generated drafts before they go live">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout
      title="AI Approvals"
      subtitle="Every AI-generated suggestion is queued here for human review before it's published."
    >
      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-primary" />
              AI Audit Log
            </CardTitle>
            <CardDescription>
              {canApprove
                ? "You can approve or reject pending drafts. Approved drafts can then be applied to their source entity."
                : "You can view drafts and their status. Approval requires the AI Approval permission."}
            </CardDescription>
          </CardHeader>
        </Card>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            {STATUS_TABS.map((t) => {
              const Icon = t.icon;
              return (
                <TabsTrigger key={t.key} value={t.key} className="gap-1.5">
                  <Icon className="h-3.5 w-3.5" />
                  {t.label}
                </TabsTrigger>
              );
            })}
          </TabsList>

          {STATUS_TABS.map((t) => (
            <TabsContent key={t.key} value={t.key} className="space-y-2 mt-4">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : entries.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center text-sm text-muted-foreground">
                    No {t.label.toLowerCase()} drafts.
                  </CardContent>
                </Card>
              ) : (
                entries.map((entry) => (
                  <Card key={entry.id} className="cursor-pointer hover:border-primary/40 transition-colors" onClick={() => openEntry(entry)}>
                    <CardContent className="py-3 px-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <Badge variant="secondary" className="text-xs">{entry.action_type}</Badge>
                            {entry.entity_type && (
                              <Badge variant="outline" className="text-xs">{entry.entity_type}</Badge>
                            )}
                            {entry.model && (
                              <Badge variant="outline" className="text-xs">{entry.model}</Badge>
                            )}
                          </div>
                          <p className="text-sm line-clamp-2">{entry.output_summary || "(no preview)"}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}
                          </p>
                        </div>
                        <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>
          ))}
        </Tabs>
      </div>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Review AI Draft
              {selected && <Badge variant="secondary" className="text-xs">{selected.action_type}</Badge>}
            </DialogTitle>
            <DialogDescription>
              {selected?.entity_type && selected?.target_field
                ? `Target: ${selected.entity_type} • ${selected.target_field}`
                : "Review the AI's suggestion. You can edit before approving."}
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 pr-3">
            <div className="space-y-4 py-2">
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Prompt</p>
                <Textarea value={selected?.prompt_summary ?? ""} readOnly className="min-h-[80px] text-xs" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">AI Draft (editable)</p>
                <Textarea
                  value={editedDraft}
                  onChange={(e) => setEditedDraft(e.target.value)}
                  className="min-h-[300px] text-sm font-mono"
                  readOnly={selected?.status !== "pending" || !canApprove}
                />
              </div>
            </div>
          </ScrollArea>

          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setSelected(null)}>Close</Button>
            {selected?.status === "pending" && canApprove && (
              <>
                <Button variant="outline" onClick={() => selected && decide(selected, "rejected")}>
                  <X className="h-4 w-4 mr-1.5" /> Reject
                </Button>
                <Button onClick={() => selected && decide(selected, "approved")}>
                  <Check className="h-4 w-4 mr-1.5" /> Approve
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
