import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, MessageSquarePlus, Inbox } from "lucide-react";
import { format } from "date-fns";

const STATUS_STYLES: Record<string, string> = {
  open: "bg-info/10 text-info",
  in_progress: "bg-warning/10 text-warning",
  pending: "bg-muted text-muted-foreground",
  resolved: "bg-success/10 text-success",
  closed: "bg-muted text-muted-foreground",
  cancelled: "bg-muted text-muted-foreground",
};

export default function HelpMyTickets() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ["help-my-tickets", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from("helpdesk_tickets")
        .select("id, ticket_number, subject, status, priority, created_at, updated_at")
        .eq("reporter_user_id", userId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!userId,
  });

  if (!userId) {
    return (
      <div className="min-h-screen p-6">
        <Card className="max-w-md mx-auto p-8 text-center mt-20">
          <Inbox className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
          <p className="font-medium mb-2">Please sign in</p>
          <p className="text-sm text-muted-foreground mb-4">You need to sign in to view your support requests.</p>
          <Button asChild><Link to="/auth">Sign In</Link></Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate("/help")}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Help Center
          </Button>
          <Button asChild>
            <Link to="/help/submit"><MessageSquarePlus className="h-4 w-4 mr-1" /> New Request</Link>
          </Button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-bold mb-1">My Requests</h1>
        <p className="text-sm text-muted-foreground mb-6">Track the status of your submitted requests</p>

        {isLoading ? (
          <Card className="p-8 text-center text-muted-foreground">Loading...</Card>
        ) : tickets.length === 0 ? (
          <Card className="p-12 text-center">
            <Inbox className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
            <p className="font-medium mb-2">No requests yet</p>
            <p className="text-sm text-muted-foreground mb-4">When you submit a support request, it'll show up here.</p>
            <Button asChild><Link to="/help/submit">Submit a Request</Link></Button>
          </Card>
        ) : (
          <div className="space-y-3">
            {tickets.map((t: any) => (
              <Card
                key={t.id}
                className="p-4 cursor-pointer hover:border-primary/40 transition"
                onClick={() => navigate(`/support/tickets/${t.id}`)}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-xs text-muted-foreground">{t.ticket_number}</span>
                      <Badge className={STATUS_STYLES[t.status] ?? "bg-muted"} variant="outline">{t.status}</Badge>
                      <Badge variant="outline" className="text-xs">{t.priority}</Badge>
                    </div>
                    <div className="font-medium">{t.subject}</div>
                  </div>
                  <div className="text-xs text-muted-foreground text-right">
                    <div>Opened {format(new Date(t.created_at), "MMM d, yyyy")}</div>
                    <div>Updated {format(new Date(t.updated_at), "MMM d")}</div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
