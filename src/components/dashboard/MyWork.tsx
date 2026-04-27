import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ListTodo, AlertTriangle, GitBranch, Clock, ChevronRight } from "lucide-react";
import { format, differenceInDays, isPast } from "date-fns";

function dueLabel(date?: string | null) {
  if (!date) return null;
  const d = new Date(date);
  const days = differenceInDays(d, new Date());
  if (isPast(d) && days < 0) return { text: `Overdue ${Math.abs(days)}d`, tone: "destructive" as const };
  if (days === 0) return { text: "Due today", tone: "warning" as const };
  if (days <= 7) return { text: `Due in ${days}d`, tone: "warning" as const };
  return { text: format(d, "MMM d"), tone: "muted" as const };
}

function badgeClasses(tone: "destructive" | "warning" | "muted") {
  if (tone === "destructive") return "bg-destructive/15 text-destructive border-destructive/30";
  if (tone === "warning") return "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30";
  return "bg-muted text-muted-foreground border-border";
}

export function MyWork() {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["my-work", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<{
      tasks: Array<{ id: string; name: string; planned_end: string | null }>;
      risks: Array<{ id: string; title: string; impact: string }>;
      changes: Array<{ id: string; reference_number: string; status: string }>;
    }> => {
      if (!user) return { tasks: [], risks: [], changes: [] };

      const tasksRes: any = await supabase
        .from("tasks")
        .select("id, name, planned_end")
        .eq("assigned_to", user.id)
        .not("status", "in", "(done,cancelled)")
        .order("planned_end", { ascending: true, nullsFirst: false })
        .limit(8);
      const risksRes: any = await supabase
        .from("risks")
        .select("id, title, impact")
        .eq("owner_id", user.id)
        .in("status", ["open", "mitigating"])
        .limit(5);
      const changesRes: any = await supabase
        .from("change_requests")
        .select("id, reference_number, status")
        .eq("raised_by", user.id)
        .not("status", "in", "(approved,rejected,closed)")
        .order("created_at", { ascending: false })
        .limit(5);

      return {
        tasks: tasksRes.data || [],
        risks: risksRes.data || [],
        changes: changesRes.data || [],
      };
    },
  });

  const tasks = data?.tasks || [];
  const risks = data?.risks || [];
  const changes = data?.changes || [];
  const totalCount = tasks.length + risks.length + changes.length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          My Work
          {totalCount > 0 && (
            <Badge variant="secondary" className="font-normal">{totalCount}</Badge>
          )}
        </CardTitle>
        <Button variant="ghost" size="sm" asChild className="h-8">
          <Link to="/tasks">View all <ChevronRight className="h-3.5 w-3.5 ml-1" /></Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="text-sm text-muted-foreground py-6 text-center">Loading…</div>
        ) : totalCount === 0 ? (
          <div className="text-sm text-muted-foreground py-6 text-center">
            🎉 Nothing assigned to you right now. Enjoy the calm.
          </div>
        ) : (
          <>
            {tasks.length > 0 && (
              <div>
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                  <ListTodo className="h-3.5 w-3.5" /> Tasks
                </div>
                <div className="space-y-1">
                  {tasks.map((t) => {
                    const due = dueLabel(t.planned_end);
                    return (
                      <Link
                        key={t.id}
                        to={`/tasks?id=${t.id}`}
                        className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50 transition-colors"
                      >
                        <span className="text-sm truncate flex-1">{t.name}</span>
                        {due && (
                          <Badge variant="outline" className={`text-xs font-normal shrink-0 ${badgeClasses(due.tone)}`}>
                            <Clock className="h-3 w-3 mr-1" />{due.text}
                          </Badge>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}

            {risks.length > 0 && (
              <div>
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                  <AlertTriangle className="h-3.5 w-3.5" /> Risks I own
                </div>
                <div className="space-y-1">
                  {risks.map((r) => (
                    <Link
                      key={r.id}
                      to={`/registers?type=risk&id=${r.id}`}
                      className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50 transition-colors"
                    >
                      <span className="text-sm truncate flex-1">{r.title}</span>
                      <Badge variant="outline" className={`text-xs font-normal shrink-0 ${r.impact === "high" ? badgeClasses("destructive") : badgeClasses("muted")}`}>
                        {r.impact}
                      </Badge>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {changes.length > 0 && (
              <div>
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                  <GitBranch className="h-3.5 w-3.5" /> My change requests
                </div>
                <div className="space-y-1">
                  {changes.map((c) => (
                    <Link
                      key={c.id}
                      to={`/change-management/${c.id}`}
                      className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50 transition-colors"
                    >
                      <span className="text-sm truncate flex-1">{c.title}</span>
                      <Badge variant="outline" className="text-xs font-normal shrink-0">{c.status}</Badge>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
