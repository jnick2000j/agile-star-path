import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import { format } from "date-fns";
import { Plus, BookOpen, Ticket, ArrowRight } from "lucide-react";
import { STATUS_BADGE } from "@/lib/portalStatus";

export default function PortalDashboard() {
  const { user } = useAuth();
  const { currentOrganization } = useOrganization();

  const { data: tickets = [] } = useQuery({
    queryKey: ["portal-tickets", user?.id, currentOrganization?.id],
    enabled: !!user?.id && !!currentOrganization?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("helpdesk_tickets")
        .select("id, reference_number, subject, status, priority, updated_at, created_at")
        .eq("organization_id", currentOrganization!.id)
        .eq("reporter_user_id", user!.id)
        .order("updated_at", { ascending: false })
        .limit(5);
      return data ?? [];
    },
  });

  const { data: articles = [] } = useQuery({
    queryKey: ["portal-kb-popular", currentOrganization?.id],
    enabled: !!currentOrganization?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("kb_articles")
        .select("id, title, summary, category, view_count")
        .eq("organization_id", currentOrganization!.id)
        .eq("status", "published")
        .order("view_count", { ascending: false })
        .limit(5);
      return data ?? [];
    },
  });

  const open = tickets.filter((t: any) => !["resolved", "closed", "cancelled"].includes(t.status));
  const closed = tickets.filter((t: any) => ["resolved", "closed", "cancelled"].includes(t.status));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Welcome back</h1>
        <p className="text-sm text-muted-foreground">
          Submit a request, track your open tickets, or search the knowledge base.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="text-3xl font-bold">{open.length}</div>
          <div className="text-sm text-muted-foreground">Open requests</div>
        </Card>
        <Card className="p-4">
          <div className="text-3xl font-bold">{closed.length}</div>
          <div className="text-sm text-muted-foreground">Recently resolved</div>
        </Card>
        <Card className="p-4 flex items-center justify-between">
          <div>
            <div className="font-medium">Need help?</div>
            <div className="text-sm text-muted-foreground">Submit a new request</div>
          </div>
          <Link to="/portal/new">
            <Button size="sm"><Plus className="h-4 w-4 mr-1" /> New</Button>
          </Link>
        </Card>
      </div>

      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold flex items-center gap-2">
            <Ticket className="h-4 w-4" /> Recent Tickets
          </h2>
          <Link to="/portal/tickets" className="text-sm text-primary hover:underline">
            View all →
          </Link>
        </div>
        {tickets.length === 0 ? (
          <p className="text-sm text-muted-foreground">You haven't submitted any tickets yet.</p>
        ) : (
          <div className="divide-y">
            {tickets.map((t: any) => (
              <Link
                key={t.id}
                to={`/portal/tickets/${t.id}`}
                className="flex items-center justify-between py-2 hover:bg-accent/50 px-2 -mx-2 rounded transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-muted-foreground">
                      {t.reference_number ?? t.id.slice(0, 8)}
                    </span>
                    <span className="font-medium truncate">{t.subject}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Updated {format(new Date(t.updated_at), "PP p")}
                  </div>
                </div>
                <Badge className={STATUS_BADGE[t.status] ?? ""}>{t.status}</Badge>
              </Link>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold flex items-center gap-2">
            <BookOpen className="h-4 w-4" /> Popular Articles
          </h2>
          <Link to="/portal/kb" className="text-sm text-primary hover:underline">
            Browse KB →
          </Link>
        </div>
        {articles.length === 0 ? (
          <p className="text-sm text-muted-foreground">No published articles yet.</p>
        ) : (
          <div className="divide-y">
            {articles.map((a: any) => (
              <Link
                key={a.id}
                to={`/portal/kb/${a.id}`}
                className="flex items-center justify-between py-2 hover:bg-accent/50 px-2 -mx-2 rounded transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">{a.title}</div>
                  {a.summary && (
                    <div className="text-xs text-muted-foreground truncate">{a.summary}</div>
                  )}
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
