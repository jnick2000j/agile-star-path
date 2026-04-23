import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LifeBuoy, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { CreateTicketDialog } from "@/components/helpdesk/CreateTicketDialog";
import { KBAssistant } from "@/components/kb/KBAssistant";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<string, string> = {
  new: "bg-info/10 text-info",
  open: "bg-primary/10 text-primary",
  pending: "bg-warning/10 text-warning",
  on_hold: "bg-muted text-muted-foreground",
  resolved: "bg-success/10 text-success",
  closed: "bg-muted text-muted-foreground",
};

export default function SupportPortal() {
  const { user } = useAuth();
  const { currentOrganization } = useOrganization();
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);

  const { data: tickets = [], refetch } = useQuery({
    queryKey: ["my-tickets", user?.id, currentOrganization?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data } = await supabase
        .from("helpdesk_tickets")
        .select("*")
        .eq("reporter_user_id", user.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!user?.id,
  });

  const open = tickets.filter((t: any) => !["closed", "cancelled"].includes(t.status));
  const closed = tickets.filter((t: any) => ["closed", "cancelled"].includes(t.status));

  return (
    <AppLayout title="Support Portal" subtitle="Submit and track your support requests">
      <div className="space-y-6 max-w-4xl">
        <Card className="p-6 bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <LifeBuoy className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Need help?</h2>
                <p className="text-sm text-muted-foreground">Submit a ticket and our team will get back to you.</p>
              </div>
            </div>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New Ticket
            </Button>
          </div>
        </Card>

        <KBAssistant surface="user_portal" placeholder="Search the knowledgebase before raising a ticket…" />

        <div>
          <h3 className="font-semibold mb-3">Open tickets ({open.length})</h3>
          {open.length === 0 ? (
            <Card className="p-6 text-center text-muted-foreground text-sm">No open tickets.</Card>
          ) : (
            <div className="space-y-2">
              {open.map((t: any) => (
                <Card
                  key={t.id}
                  className="p-4 cursor-pointer hover:bg-accent/30 transition"
                  onClick={() => navigate(`/support/tickets/${t.id}`)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-xs text-muted-foreground">{t.reference_number}</span>
                        <Badge className={cn(STATUS_STYLES[t.status])}>{t.status.replace("_", " ")}</Badge>
                        <Badge variant="outline" className="text-xs">{t.ticket_type.replace("_", " ")}</Badge>
                      </div>
                      <p className="font-medium">{t.subject}</p>
                      {t.description && <p className="text-sm text-muted-foreground line-clamp-1 mt-1">{t.description}</p>}
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {format(new Date(t.created_at), "MMM d")}
                    </span>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        {closed.length > 0 && (
          <div>
            <h3 className="font-semibold mb-3 text-muted-foreground">Closed ({closed.length})</h3>
            <div className="space-y-2">
              {closed.slice(0, 10).map((t: any) => (
                <Card
                  key={t.id}
                  className="p-3 cursor-pointer hover:bg-accent/30 transition opacity-70"
                  onClick={() => navigate(`/support/tickets/${t.id}`)}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">{t.reference_number}</span>
                      <span className="text-sm">{t.subject}</span>
                    </div>
                    <Badge className={cn(STATUS_STYLES[t.status])}>{t.status}</Badge>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>

      <CreateTicketDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={() => refetch()} />
    </AppLayout>
  );
}
