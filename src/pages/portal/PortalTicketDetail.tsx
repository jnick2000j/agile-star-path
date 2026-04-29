import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Send, Loader2 } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import { format } from "date-fns";
import { toast } from "sonner";
import { STATUS_BADGE, PRIORITY_BADGE } from "@/lib/portalStatus";

export default function PortalTicketDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentOrganization } = useOrganization();
  const qc = useQueryClient();
  const [reply, setReply] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { data: ticket, isLoading } = useQuery({
    queryKey: ["portal-ticket", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("helpdesk_tickets")
        .select("*")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: comments = [] } = useQuery({
    queryKey: ["portal-ticket-comments", id],
    enabled: !!id,
    queryFn: async () => {
      const { data } = await supabase
        .from("helpdesk_ticket_comments")
        .select("*")
        .eq("ticket_id", id!)
        .eq("is_internal", false) // never expose internal notes to customers
        .order("created_at", { ascending: true });
      return data ?? [];
    },
  });

  const post = async () => {
    if (!reply.trim() || !ticket || !user) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from("helpdesk_ticket_comments").insert({
        ticket_id: ticket.id,
        organization_id: ticket.organization_id,
        author_id: user.id,
        body: reply.trim(),
        is_internal: false,
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      // Reopen if it was resolved
      if (["resolved", "closed"].includes(ticket.status)) {
        await supabase
          .from("helpdesk_tickets")
          .update({ status: "open" })
          .eq("id", ticket.id);
        qc.invalidateQueries({ queryKey: ["portal-ticket", id] });
      }
      setReply("");
      qc.invalidateQueries({ queryKey: ["portal-ticket-comments", id] });
      toast.success("Reply sent");
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!ticket) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Ticket not found or you don't have access.</p>
        <Link to="/portal/tickets">
          <Button variant="link">Back to my tickets</Button>
        </Link>
      </div>
    );
  }

  const isClosed = ["closed", "cancelled"].includes(ticket.status);

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <Button variant="ghost" size="sm" onClick={() => navigate("/portal/tickets")}>
        <ArrowLeft className="h-4 w-4 mr-2" /> Back
      </Button>

      <Card className="p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="font-mono text-xs text-muted-foreground">
              {ticket.reference_number ?? ticket.id.slice(0, 8)}
            </div>
            <h1 className="text-xl font-semibold mt-1">{ticket.subject}</h1>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <Badge className={STATUS_BADGE[ticket.status] ?? ""}>{ticket.status}</Badge>
              <Badge variant="outline" className={PRIORITY_BADGE[ticket.priority] ?? ""}>
                {ticket.priority}
              </Badge>
              <span className="text-xs text-muted-foreground">
                Submitted {format(new Date(ticket.created_at), "PPp")}
              </span>
            </div>
          </div>
        </div>

        {ticket.description && (
          <div className="mt-4 bg-muted/40 rounded p-3 text-sm whitespace-pre-wrap">
            {ticket.description}
          </div>
        )}
      </Card>

      <div className="space-y-3">
        <h2 className="font-semibold">Conversation</h2>
        {comments.length === 0 && (
          <p className="text-sm text-muted-foreground">No replies yet — we'll be in touch soon.</p>
        )}
        {comments.map((c: any) => {
          const mine = c.author_id === user?.id;
          return (
            <div
              key={c.id}
              className={`flex ${mine ? "justify-end" : "justify-start"}`}
            >
              <Card className={`p-3 max-w-[85%] ${mine ? "bg-primary/5" : ""}`}>
                <div className="text-xs text-muted-foreground mb-1">
                  {mine ? "You" : "Support team"} · {format(new Date(c.created_at), "PPp")}
                </div>
                <p className="text-sm whitespace-pre-wrap">{c.body}</p>
              </Card>
            </div>
          );
        })}
      </div>

      {!isClosed ? (
        <Card className="p-4 space-y-3">
          <Textarea
            rows={4}
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder={ticket.status === "resolved" ? "Reply will reopen this ticket…" : "Add a reply…"}
          />
          <div className="flex justify-end">
            <Button onClick={post} disabled={!reply.trim() || submitting}>
              {submitting ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Sending…</>
              ) : (
                <><Send className="h-4 w-4 mr-2" /> Send Reply</>
              )}
            </Button>
          </div>
        </Card>
      ) : (
        <Card className="p-4 text-center text-sm text-muted-foreground">
          This ticket is {ticket.status}. <Link to="/portal/new" className="text-primary hover:underline">Open a new request</Link> if you need further help.
        </Card>
      )}
    </div>
  );
}
