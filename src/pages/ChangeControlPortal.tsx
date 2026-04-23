import { AppLayout } from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GitBranch, Sparkles, Lock, ListChecks } from "lucide-react";
import { ViewSwitcher } from "@/components/ViewSwitcher";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { AIIntakeChat } from "@/components/intake/AIIntakeChat";
import { useOrgAccessLevel } from "@/hooks/useOrgAccessLevel";

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  submitted: "bg-info/10 text-info",
  in_review: "bg-warning/10 text-warning",
  cab_review: "bg-warning/10 text-warning",
  needs_information: "bg-warning/10 text-warning",
  approved: "bg-success/10 text-success",
  rejected: "bg-destructive/10 text-destructive",
  scheduled: "bg-primary/10 text-primary",
  in_progress: "bg-primary/10 text-primary",
  implemented: "bg-success/10 text-success",
  closed: "bg-muted text-muted-foreground",
  cancelled: "bg-muted text-muted-foreground",
  failed: "bg-destructive/10 text-destructive",
};

export default function ChangeControlPortal() {
  const { user } = useAuth();
  const { currentOrganization } = useOrganization();
  const navigate = useNavigate();
  const { accessLevel, loading: accessLoading } = useOrgAccessLevel();

  const canRaise = ["admin", "manager", "editor"].includes(accessLevel ?? "");

  const { data: changes = [] } = useQuery({
    queryKey: ["my-cm-requests", user?.id, currentOrganization?.id],
    queryFn: async () => {
      if (!user?.id || !currentOrganization?.id) return [];
      const { data } = await supabase
        .from("change_management_requests")
        .select("id, reference_number, title, status, change_type, impact, urgency, created_at")
        .eq("organization_id", currentOrganization.id)
        .or(`requested_by.eq.${user.id},created_by.eq.${user.id}`)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!user?.id && !!currentOrganization?.id,
  });

  const open = changes.filter(
    (c: any) => !["closed", "cancelled", "implemented", "rejected", "failed"].includes(c.status),
  );
  const closed = changes.filter(
    (c: any) => ["closed", "cancelled", "implemented", "rejected", "failed"].includes(c.status),
  );

  return (
    <AppLayout title="Change Control Portal" subtitle="Raise and track your change requests">
      <div className="space-y-6 max-w-4xl">
        <ViewSwitcher
          current="portal"
          tabs={[
            { key: "register", label: "Change Register", to: "/change-management", icon: ListChecks },
            { key: "portal", label: "Raise a change (AI)", to: "/change-management/portal", icon: Sparkles },
          ]}
        />
        <Card className="p-6 bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <GitBranch className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold flex items-center gap-2">
                Need to raise a change?
                <Badge variant="secondary" className="text-xs">
                  <Sparkles className="h-3 w-3 mr-1" /> AI-assisted
                </Badge>
              </h2>
              <p className="text-sm text-muted-foreground">
                Chat with the assistant — it'll capture the details and draft a CAB-ready change request.
              </p>
            </div>
          </div>
        </Card>

        {accessLoading ? (
          <Card className="p-6 text-center text-muted-foreground text-sm">Loading…</Card>
        ) : canRaise ? (
          <AIIntakeChat
            intent="change_request"
            greeting="Hi! I'll help you draft a change request. What change are you proposing, and why is it needed?"
          />
        ) : (
          <Card className="p-6 flex items-center gap-3 border-warning/30 bg-warning/5">
            <Lock className="h-5 w-5 text-warning" />
            <div>
              <p className="font-medium text-sm">You don't have permission to raise change requests.</p>
              <p className="text-xs text-muted-foreground">
                Ask an organization admin or manager to grant you editor access.
              </p>
            </div>
          </Card>
        )}

        <div>
          <h3 className="font-semibold mb-3">My open changes ({open.length})</h3>
          {open.length === 0 ? (
            <Card className="p-6 text-center text-muted-foreground text-sm">
              You haven't raised any open changes.
            </Card>
          ) : (
            <div className="space-y-2">
              {open.map((c: any) => (
                <Card
                  key={c.id}
                  className="p-4 cursor-pointer hover:bg-accent/30 transition"
                  onClick={() => navigate(`/change-management/${c.id}`)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-mono text-xs text-muted-foreground">{c.reference_number}</span>
                        <Badge className={cn(STATUS_STYLES[c.status])}>{c.status.replace("_", " ")}</Badge>
                        <Badge variant="outline" className="text-xs">{c.change_type}</Badge>
                        <Badge variant="outline" className="text-xs">impact: {c.impact}</Badge>
                      </div>
                      <p className="font-medium">{c.title}</p>
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {format(new Date(c.created_at), "MMM d")}
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
              {closed.slice(0, 10).map((c: any) => (
                <Card
                  key={c.id}
                  className="p-3 cursor-pointer hover:bg-accent/30 transition opacity-70"
                  onClick={() => navigate(`/change-management/${c.id}`)}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">{c.reference_number}</span>
                      <span className="text-sm">{c.title}</span>
                    </div>
                    <Badge className={cn(STATUS_STYLES[c.status])}>{c.status}</Badge>
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
