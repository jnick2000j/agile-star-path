import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { CheckCircle2, XCircle, Clock, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

interface Props {
  ticketId: string;
}

export function ApprovalsPanel({ ticketId }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [comments, setComments] = useState<Record<string, string>>({});

  const { data: approvals = [] } = useQuery({
    queryKey: ["ticket-approvals", ticketId],
    queryFn: async () => {
      const { data } = await supabase
        .from("service_catalog_request_approvals")
        .select("*")
        .eq("ticket_id", ticketId)
        .order("step_order", { ascending: true });
      return data ?? [];
    },
  });

  const decide = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "approved" | "rejected" }) => {
      const { data: row, error } = await supabase
        .from("service_catalog_request_approvals")
        .update({
          status,
          comment: comments[id] || null,
          decided_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select("organization_id, step_order, ticket_id")
        .single();
      if (error) throw error;

      // Re-evaluate the chain if one exists, otherwise we still continue with simple sequential approvals
      const { data: outcome } = await supabase.rpc("helpdesk_evaluate_approvals", { _ticket_id: ticketId });

      // Pull the ticket to access reporter + catalog metadata for notifications
      const { data: ticket } = await supabase
        .from("helpdesk_tickets")
        .select("id, subject, reporter_user_id, metadata")
        .eq("id", ticketId)
        .maybeSingle();
      const itemName = (ticket?.metadata as any)?.catalog_item_name ?? "your request";

      // Re-fetch the latest approval list to know what to do next
      const { data: latest } = await supabase
        .from("service_catalog_request_approvals")
        .select("approver_user_id, status, step_order")
        .eq("ticket_id", ticketId)
        .order("step_order", { ascending: true });
      const all = latest ?? [];
      const anyRejected = all.some((a) => a.status === "rejected");
      const allApproved = all.length > 0 && all.every((a) => a.status === "approved");
      const nextPending = all.find((a) => a.status === "pending");

      // Notify the requester on a final outcome
      if (ticket?.reporter_user_id && (anyRejected || allApproved || outcome === "rejected" || outcome === "approved")) {
        await supabase.from("notifications").insert({
          user_id: ticket.reporter_user_id,
          type: "approval_decision",
          title: anyRejected || outcome === "rejected" ? `Request rejected: ${itemName}` : `Request approved: ${itemName}`,
          message: anyRejected || outcome === "rejected"
            ? `Your service request was rejected at step ${row.step_order}.`
            : `All approvals complete — fulfillment is starting now.`,
          link: `/support?ticket=${ticketId}`,
          metadata: { ticket_id: ticketId },
        });
      }

      // Notify next approver in sequential mode
      if (status === "approved" && !anyRejected && nextPending) {
        await supabase.from("notifications").insert({
          user_id: nextPending.approver_user_id,
          type: "approval_request",
          title: `Approval needed: ${itemName}`,
          message: `It's your turn to review this service request (step ${nextPending.step_order}).`,
          link: `/support?ticket=${ticketId}`,
          metadata: { ticket_id: ticketId, step: nextPending.step_order },
        });
      }

      // On full approval → reopen ticket and spawn the first fulfillment task
      if (allApproved || outcome === "approved") {
        await supabase
          .from("helpdesk_tickets")
          .update({ status: "open" })
          .eq("id", ticketId);
        await supabase.rpc("helpdesk_spawn_next_catalog_task", { _parent_ticket_id: ticketId });
      }

      // On rejection → cancel the ticket
      if (anyRejected || outcome === "rejected") {
        await supabase
          .from("helpdesk_tickets")
          .update({ status: "cancelled" })
          .eq("id", ticketId);
      }
    },
    onSuccess: () => {
      toast.success("Decision recorded");
      qc.invalidateQueries({ queryKey: ["ticket-approvals", ticketId] });
      qc.invalidateQueries({ queryKey: ["helpdesk-ticket", ticketId] });
      qc.invalidateQueries({ queryKey: ["helpdesk-tickets"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (approvals.length === 0) return null;

  const statusBadge = (s: string) => {
    if (s === "approved") return <Badge className="bg-success/15 text-success border-success/30"><CheckCircle2 className="h-3 w-3 mr-1" />Approved</Badge>;
    if (s === "rejected") return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Rejected</Badge>;
    return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
  };

  // For sequential mode, only the lowest-step pending approval is actionable
  const mode = approvals[0]?.mode || "sequential";
  const firstPendingStep = approvals.find((a) => a.status === "pending")?.step_order;

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-primary" />
        <h3 className="font-semibold">Approval Workflow</h3>
        <Badge variant="outline" className="ml-auto capitalize">{mode}</Badge>
      </div>
      <div className="space-y-2">
        {approvals.map((a: any) => {
          const isMyTurn =
            user?.id === a.approver_user_id &&
            a.status === "pending" &&
            (mode === "parallel" || a.step_order === firstPendingStep);

          return (
            <div key={a.id} className="border rounded-md p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-sm">
                  <span className="font-medium">Step {a.step_order}</span>
                  {a.step_name && <span className="text-muted-foreground"> · {a.step_name}</span>}
                  {a.is_optional && <Badge variant="outline" className="ml-2 text-xs">Optional</Badge>}
                </div>
                {statusBadge(a.status)}
              </div>
              {a.comment && (
                <p className="text-xs text-muted-foreground italic">"{a.comment}"</p>
              )}
              {isMyTurn && (
                <div className="space-y-2 pt-2 border-t">
                  <Textarea
                    placeholder="Add a comment (optional)..."
                    value={comments[a.id] || ""}
                    onChange={(e) => setComments({ ...comments, [a.id]: e.target.value })}
                    rows={2}
                    className="text-sm"
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => decide.mutate({ id: a.id, status: "approved" })}
                      disabled={decide.isPending}
                    >
                      <CheckCircle2 className="h-4 w-4 mr-1" />Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => decide.mutate({ id: a.id, status: "rejected" })}
                      disabled={decide.isPending}
                    >
                      <XCircle className="h-4 w-4 mr-1" />Reject
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
