import { AppLayout } from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Headset, Sparkles, Inbox } from "lucide-react";
import { ViewSwitcher } from "@/components/ViewSwitcher";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { cn, formatLabel } from "@/lib/utils";

const STATUS_STYLES: Record<string, string> = {
  new: "bg-info/10 text-info",
  open: "bg-primary/10 text-primary",
  pending: "bg-warning/10 text-warning",
  on_hold: "bg-muted text-muted-foreground",
  resolved: "bg-success/10 text-success",
  closed: "bg-muted text-muted-foreground",
};

export default function MyTickets() {
  const { user } = useAuth();
  const { currentOrganization } = useOrganization();
  const navigate = useNavigate();

  const { data: tickets = [] } = useQuery({
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
    <AppLayout title="My Tickets" subtitle="Tickets you've raised">
      <div className="space-y-6 max-w-4xl">
        <ViewSwitcher
          current="mine"
          tabs={[
            { key: "console", label: "Agent console", to: "/support", icon: Headset },
            { key: "portal", label: "Get support (AI)", to: "/support/portal", icon: Sparkles },
            { key: "mine", label: "My tickets", to: "/support/my-tickets", icon: Inbox },
          ]}
        />

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
                        <Badge className={cn(STATUS_STYLES[t.status])}>{formatLabel(t.status)}</Badge>
                        <Badge variant="outline" className="text-xs">{formatLabel(t.ticket_type)}</Badge>
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
                    <Badge className={cn(STATUS_STYLES[t.status])}>{formatLabel(t.status)}</Badge>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
