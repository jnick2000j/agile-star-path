import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Inbox,
  FileQuestion,
  ClipboardCheck,
  ListChecks,
  GitBranch,
  Check,
  X,
  Eye,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow, isPast } from "date-fns";

type ApprovalKind = "rfi" | "submittal" | "punch" | "change";

interface ApprovalItem {
  kind: ApprovalKind;
  id: string;
  title: string;
  reference?: string | null;
  due_date?: string | null;
  status: string;
  href: string;
}

const KIND_META: Record<ApprovalKind, { label: string; icon: React.ElementType; color: string }> = {
  rfi: { label: "RFI", icon: FileQuestion, color: "text-blue-600" },
  submittal: { label: "Submittal", icon: ClipboardCheck, color: "text-purple-600" },
  punch: { label: "Punch", icon: ListChecks, color: "text-amber-600" },
  change: { label: "Change", icon: GitBranch, color: "text-rose-600" },
};

export function ActionInbox() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["action-inbox", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<ApprovalItem[]> => {
      if (!user) return [];

      const rfisRes: any = await supabase
        .from("rfis")
        .select("id, subject, rfi_number, due_date, status")
        .eq("assigned_to", user.id)
        .in("status", ["open", "submitted", "in_review"])
        .order("due_date", { ascending: true, nullsFirst: false })
        .limit(15);

      const submittalsRes: any = await supabase
        .from("submittals")
        .select("id, title, submittal_number, due_date, status")
        .eq("reviewer", user.id)
        .in("status", ["pending", "submitted", "under_review"])
        .order("due_date", { ascending: true, nullsFirst: false })
        .limit(15);

      const punchRes: any = await supabase
        .from("punch_list_items")
        .select("id, description, item_number, due_date, status")
        .eq("assigned_to", user.id)
        .in("status", ["open", "in_progress", "ready_for_verification"])
        .order("due_date", { ascending: true, nullsFirst: false })
        .limit(15);

      const changesRes: any = await (supabase as any)
        .from("change_requests")
        .select("id, reference_number, title, status")
        .eq("approver_id", user.id)
        .in("status", ["pending", "under_review", "needs_information"])
        .limit(15);

      const items: ApprovalItem[] = [
        ...(rfisRes.data || []).map((r: any) => ({
          kind: "rfi" as const,
          id: r.id,
          title: r.subject,
          reference: r.rfi_number,
          due_date: r.due_date,
          status: r.status,
          href: "/construction/rfis",
        })),
        ...(submittalsRes.data || []).map((s: any) => ({
          kind: "submittal" as const,
          id: s.id,
          title: s.title,
          reference: s.submittal_number,
          due_date: s.due_date,
          status: s.status,
          href: "/construction/submittals",
        })),
        ...(punchRes.data || []).map((p: any) => ({
          kind: "punch" as const,
          id: p.id,
          title: p.description,
          reference: p.item_number,
          due_date: p.due_date,
          status: p.status,
          href: "/construction/punch-list",
        })),
        ...(changesRes.data || []).map((c: any) => ({
          kind: "change" as const,
          id: c.id,
          title: c.title,
          reference: c.reference_number,
          due_date: null,
          status: c.status,
          href: `/change-management/${c.id}`,
        })),
      ];

      return items;
    },
  });

  const items = data || [];

  const updateStatus = useMutation({
    mutationFn: async (args: { item: ApprovalItem; newStatus: string; extraFields?: Record<string, any> }) => {
      const { item, newStatus, extraFields = {} } = args;
      const tableMap: Record<ApprovalKind, string> = {
        rfi: "rfis",
        submittal: "submittals",
        punch: "punch_list_items",
        change: "change_requests",
      };
      const { error } = await (supabase as any)
        .from(tableMap[item.kind])
        .update({ status: newStatus, ...extraFields })
        .eq("id", item.id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      toast.success(`${KIND_META[vars.item.kind].label} ${vars.item.reference || ""} updated`);
      qc.invalidateQueries({ queryKey: ["action-inbox", user?.id] });
    },
    onError: (e: any) => toast.error(e.message || "Failed to update"),
  });

  const renderActions = (item: ApprovalItem) => {
    const now = new Date().toISOString();
    if (item.kind === "rfi") {
      return (
        <>
          <Button size="sm" variant="outline" className="h-7" onClick={() => updateStatus.mutate({ item, newStatus: "answered", extraFields: { responded_at: now } })}>
            <Check className="h-3 w-3 mr-1" /> Mark Answered
          </Button>
          <Button size="sm" variant="ghost" className="h-7" onClick={() => updateStatus.mutate({ item, newStatus: "in_review" })}>
            In Review
          </Button>
        </>
      );
    }
    if (item.kind === "submittal") {
      return (
        <>
          <Button size="sm" variant="outline" className="h-7 text-emerald-600 hover:text-emerald-700" onClick={() => updateStatus.mutate({ item, newStatus: "approved", extraFields: { reviewed_at: now } })}>
            <Check className="h-3 w-3 mr-1" /> Approve
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-amber-600" onClick={() => updateStatus.mutate({ item, newStatus: "revise_resubmit", extraFields: { reviewed_at: now } })}>
            Revise
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-destructive" onClick={() => updateStatus.mutate({ item, newStatus: "rejected", extraFields: { reviewed_at: now } })}>
            <X className="h-3 w-3" />
          </Button>
        </>
      );
    }
    if (item.kind === "punch") {
      return (
        <>
          <Button size="sm" variant="outline" className="h-7" onClick={() => updateStatus.mutate({ item, newStatus: "ready_for_verification", extraFields: { completed_at: now } })}>
            <Check className="h-3 w-3 mr-1" /> Complete
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-emerald-600" onClick={() => updateStatus.mutate({ item, newStatus: "verified", extraFields: { verified_at: now } })}>
            Verify & Close
          </Button>
        </>
      );
    }
    // change
    return (
      <>
        <Button size="sm" variant="outline" className="h-7 text-emerald-600 hover:text-emerald-700" onClick={() => updateStatus.mutate({ item, newStatus: "approved" })}>
          <Check className="h-3 w-3 mr-1" /> Approve
        </Button>
        <Button size="sm" variant="ghost" className="h-7 text-destructive" onClick={() => updateStatus.mutate({ item, newStatus: "rejected" })}>
          <X className="h-3 w-3 mr-1" /> Reject
        </Button>
      </>
    );
  };

  const filterByKind = (k: ApprovalKind | "all") =>
    k === "all" ? items : items.filter((i) => i.kind === k);

  const counts = {
    all: items.length,
    rfi: items.filter((i) => i.kind === "rfi").length,
    submittal: items.filter((i) => i.kind === "submittal").length,
    punch: items.filter((i) => i.kind === "punch").length,
    change: items.filter((i) => i.kind === "change").length,
  };

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Inbox className="h-4 w-4" /> Action Inbox
        </CardTitle>
        {counts.all > 0 && <Badge variant="secondary" className="font-normal">{counts.all}</Badge>}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin inline mr-2" /> Loading…
          </div>
        ) : counts.all === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            ✅ No items waiting on your decision.
          </div>
        ) : (
          <Tabs defaultValue="all">
            <TabsList className="grid grid-cols-5 w-full mb-3">
              <TabsTrigger value="all">All ({counts.all})</TabsTrigger>
              <TabsTrigger value="rfi" disabled={counts.rfi === 0}>RFIs {counts.rfi > 0 && `(${counts.rfi})`}</TabsTrigger>
              <TabsTrigger value="submittal" disabled={counts.submittal === 0}>Submittals {counts.submittal > 0 && `(${counts.submittal})`}</TabsTrigger>
              <TabsTrigger value="punch" disabled={counts.punch === 0}>Punch {counts.punch > 0 && `(${counts.punch})`}</TabsTrigger>
              <TabsTrigger value="change" disabled={counts.change === 0}>Changes {counts.change > 0 && `(${counts.change})`}</TabsTrigger>
            </TabsList>

            {(["all", "rfi", "submittal", "punch", "change"] as const).map((k) => (
              <TabsContent key={k} value={k} className="space-y-2 mt-0">
                {filterByKind(k).map((item) => {
                  const meta = KIND_META[item.kind];
                  const overdue = item.due_date && isPast(new Date(item.due_date));
                  return (
                    <div
                      key={`${item.kind}-${item.id}`}
                      className="flex items-start gap-3 p-3 rounded-md border hover:border-primary/40 hover:bg-muted/30 transition-colors"
                    >
                      <meta.icon className={`h-4 w-4 mt-0.5 shrink-0 ${meta.color}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="text-xs font-mono">{meta.label}{item.reference ? ` ${item.reference}` : ""}</Badge>
                          <Badge variant="outline" className="text-xs">{item.status.replace(/_/g, " ")}</Badge>
                          {item.due_date && (
                            <span className={`text-xs ${overdue ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                              {overdue ? "Overdue " : "Due "}
                              {formatDistanceToNow(new Date(item.due_date), { addSuffix: true })}
                            </span>
                          )}
                        </div>
                        <div className="text-sm font-medium mt-1 truncate">{item.title}</div>
                        <div className="flex items-center gap-1 mt-2 flex-wrap">
                          {renderActions(item)}
                          <Button asChild size="sm" variant="ghost" className="h-7 text-muted-foreground">
                            <Link to={item.href}>
                              <Eye className="h-3 w-3 mr-1" /> Open
                            </Link>
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </TabsContent>
            ))}
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
}
