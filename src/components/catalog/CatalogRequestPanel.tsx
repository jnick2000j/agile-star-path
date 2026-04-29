import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ShieldCheck, Check, X, Clock } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { format } from "date-fns";

interface Props { ticketId: string }

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-warning/10 text-warning",
  approved: "bg-success/10 text-success",
  rejected: "bg-destructive/10 text-destructive",
  skipped: "bg-muted text-muted-foreground",
};

export function CatalogRequestPanel({ ticketId }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [comment, setComment] = useState<Record<string, string>>({});

  const { data: request } = useQuery({
    queryKey: ["svc-request", ticketId],
    queryFn: async () => {
      const { data } = await supabase
        .from("service_catalog_request_data")
        .select("*, service_catalog_items(name, short_description, service_catalog_item_fields(field_key, label, field_type))")
        .eq("ticket_id", ticketId)
        .maybeSingle();
      return data;
    },
  });

  const { data: approvals = [] } = useQuery({
    queryKey: ["svc-approvals", ticketId],
    queryFn: async () => {
      const { data } = await supabase
        .from("service_catalog_request_approvals")
        .select("*, profiles:approver_user_id(first_name, last_name, email)")
        .eq("ticket_id", ticketId)
        .order("step_order");
      return data ?? [];
    },
  });

  const decide = async (id: string, status: "approved" | "rejected") => {
    const { error } = await supabase
      .from("service_catalog_request_approvals")
      .update({ status, comment: comment[id] ?? null, decided_at: new Date().toISOString() })
      .eq("id", id);
    if (error) { toast.error(error.message); return; }

    // Recompute aggregate state and progress ticket
    const updated = approvals.map((a: any) => a.id === id ? { ...a, status } : a);
    const allDone = updated.every((a: any) => a.status !== "pending");
    const anyRejected = updated.some((a: any) => a.status === "rejected");
    if (anyRejected) {
      await supabase.from("helpdesk_tickets").update({ status: "cancelled" }).eq("id", ticketId);
      toast.success("Request rejected");
    } else if (allDone) {
      await supabase.from("helpdesk_tickets").update({ status: "open" }).eq("id", ticketId);
      toast.success("All approvals complete — fulfillment can begin");
    } else {
      toast.success("Decision recorded");
    }
    qc.invalidateQueries({ queryKey: ["svc-approvals", ticketId] });
    qc.invalidateQueries({ queryKey: ["hd-ticket", ticketId] });
  };

  if (!request) return null;

  const item = (request as any).service_catalog_items;
  const fieldDefs = item?.service_catalog_item_fields ?? [];
  const answers = (request as any).answers ?? {};

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">Catalog request</h3>
        <Badge variant="outline" className="ml-auto">{item?.name}</Badge>
      </div>

      {fieldDefs.length > 0 && (
        <div className="space-y-1.5 text-sm border rounded-md p-2 bg-muted/30">
          {fieldDefs.map((f: any) => {
            const v = answers[f.field_key];
            const display = Array.isArray(v) ? v.join(", ") : (v === true ? "Yes" : v === false ? "No" : v ?? "—");
            return (
              <div key={f.field_key} className="flex gap-2">
                <span className="text-muted-foreground min-w-[120px]">{f.label}:</span>
                <span className="flex-1 break-words">{String(display)}</span>
              </div>
            );
          })}
        </div>
      )}

      {approvals.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-medium text-muted-foreground">Approval workflow</div>
          {approvals.map((a: any) => {
            const isMyTurn = a.approver_user_id === user?.id && a.status === "pending";
            const name = [a.profiles?.first_name, a.profiles?.last_name].filter(Boolean).join(" ") || a.profiles?.email || "Approver";
            return (
              <div key={a.id} className="border rounded-md p-2 space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Badge variant="outline" className="text-[10px]">Step {a.step_order}</Badge>
                  <span className="font-medium flex-1 truncate">{name}</span>
                  <Badge variant="secondary" className={STATUS_STYLES[a.status]}>
                    {a.status === "pending" && <Clock className="h-3 w-3 mr-1 inline" />}
                    {a.status === "approved" && <Check className="h-3 w-3 mr-1 inline" />}
                    {a.status === "rejected" && <X className="h-3 w-3 mr-1 inline" />}
                    {a.status}
                  </Badge>
                </div>
                {a.comment && <p className="text-xs text-muted-foreground italic">"{a.comment}"</p>}
                {a.decided_at && <p className="text-[10px] text-muted-foreground">{format(new Date(a.decided_at), "MMM d, p")}</p>}
                {isMyTurn && (
                  <div className="space-y-2 pt-1">
                    <Textarea
                      rows={2}
                      placeholder="Optional comment"
                      value={comment[a.id] ?? ""}
                      onChange={(e) => setComment({ ...comment, [a.id]: e.target.value })}
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => decide(a.id, "approved")} className="flex-1">
                        <Check className="h-3.5 w-3.5 mr-1" /> Approve
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => decide(a.id, "rejected")} className="flex-1">
                        <X className="h-3.5 w-3.5 mr-1" /> Reject
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
