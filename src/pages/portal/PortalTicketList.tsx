import { useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import { format } from "date-fns";
import { Search, Plus, Ticket } from "lucide-react";
import { STATUS_BADGE, PRIORITY_BADGE } from "@/lib/portalStatus";

export default function PortalTicketList() {
  const { user } = useAuth();
  const { currentOrganization } = useOrganization();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ["portal-tickets-all", user?.id, currentOrganization?.id],
    enabled: !!user?.id && !!currentOrganization?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("helpdesk_tickets")
        .select("id, reference_number, subject, status, priority, updated_at, created_at")
        .eq("organization_id", currentOrganization!.id)
        .eq("reporter_user_id", user!.id)
        .order("updated_at", { ascending: false })
        .limit(200);
      return data ?? [];
    },
  });

  const filtered = tickets.filter((t: any) => {
    if (statusFilter === "open" && ["resolved", "closed", "cancelled"].includes(t.status)) return false;
    if (statusFilter === "closed" && !["resolved", "closed", "cancelled"].includes(t.status)) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      return (
        t.subject?.toLowerCase().includes(q) ||
        t.reference_number?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Ticket className="h-6 w-6" /> My Tickets
          </h1>
          <p className="text-sm text-muted-foreground">All requests you've submitted.</p>
        </div>
        <Link to="/portal/new">
          <Button><Plus className="h-4 w-4 mr-2" /> New Request</Button>
        </Link>
      </div>

      <Card className="p-3 flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search subject or reference…"
            className="pl-8"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
          </SelectContent>
        </Select>
      </Card>

      <Card className="divide-y">
        {isLoading && <p className="p-4 text-sm text-muted-foreground">Loading…</p>}
        {!isLoading && filtered.length === 0 && (
          <p className="p-8 text-sm text-muted-foreground text-center">No tickets match your filters.</p>
        )}
        {filtered.map((t: any) => (
          <Link
            key={t.id}
            to={`/portal/tickets/${t.id}`}
            className="block px-4 py-3 hover:bg-accent/50 transition-colors"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs text-muted-foreground">
                    {t.reference_number ?? t.id.slice(0, 8)}
                  </span>
                  <span className="font-medium">{t.subject}</span>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Created {format(new Date(t.created_at), "PP")} · Updated {format(new Date(t.updated_at), "PP p")}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <Badge className={STATUS_BADGE[t.status] ?? ""}>{t.status}</Badge>
                <Badge variant="outline" className={PRIORITY_BADGE[t.priority] ?? ""}>{t.priority}</Badge>
              </div>
            </div>
          </Link>
        ))}
      </Card>
    </div>
  );
}
