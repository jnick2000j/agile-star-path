import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { CheckCircle, XCircle, Clock, RefreshCw, Archive, Plus, ArrowRight } from "lucide-react";

interface StatusHistoryEntry {
  id: string;
  old_status: string | null;
  new_status: string;
  action: string;
  reason: string | null;
  changed_by: string | null;
  changed_at: string;
  changer_name?: string;
}

interface StatusHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityType: "project" | "program" | "product";
  entityId: string;
  entityName: string;
}

const actionIcons: Record<string, React.ReactNode> = {
  created: <Plus className="h-4 w-4 text-blue-500" />,
  approved: <CheckCircle className="h-4 w-4 text-green-500" />,
  rejected: <XCircle className="h-4 w-4 text-red-500" />,
  deferred: <Clock className="h-4 w-4 text-yellow-500" />,
  reopened: <RefreshCw className="h-4 w-4 text-blue-500" />,
  closed: <Archive className="h-4 w-4 text-gray-500" />,
  on_hold: <Clock className="h-4 w-4 text-orange-500" />,
  status_change: <ArrowRight className="h-4 w-4 text-muted-foreground" />,
};

const actionLabels: Record<string, string> = {
  created: "Created",
  approved: "Approved",
  rejected: "Rejected",
  deferred: "Deferred",
  reopened: "Reopened",
  closed: "Closed",
  on_hold: "Put On Hold",
  status_change: "Status Changed",
};

export function StatusHistoryDialog({
  open,
  onOpenChange,
  entityType,
  entityId,
  entityName,
}: StatusHistoryDialogProps) {
  const [history, setHistory] = useState<StatusHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open && entityId) {
      fetchHistory();
    }
  }, [open, entityId]);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("status_history")
        .select("*")
        .eq("entity_type", entityType)
        .eq("entity_id", entityId)
        .order("changed_at", { ascending: false });

      if (error) throw error;

      // Fetch user names for changed_by
      const userIds = [...new Set(data?.map(h => h.changed_by).filter(Boolean))];
      let userMap: Record<string, string> = {};
      
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name, email")
          .in("user_id", userIds);
        
        if (profiles) {
          userMap = profiles.reduce((acc, p) => {
            acc[p.user_id] = p.full_name || p.email;
            return acc;
          }, {} as Record<string, string>);
        }
      }

      setHistory((data || []).map(h => ({
        ...h,
        changer_name: h.changed_by ? userMap[h.changed_by] || "Unknown User" : "System",
      })));
    } catch (error) {
      console.error("Error fetching status history:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>Status History</DialogTitle>
          <DialogDescription>
            Audit trail for {entityType}: {entityName}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[400px] pr-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No status history found
            </div>
          ) : (
            <div className="space-y-4">
              {history.map((entry, index) => (
                <div key={entry.id} className="relative pl-6 pb-4">
                  {/* Timeline line */}
                  {index < history.length - 1 && (
                    <div className="absolute left-[11px] top-6 bottom-0 w-px bg-border" />
                  )}
                  
                  {/* Timeline dot */}
                  <div className="absolute left-0 top-1 flex items-center justify-center w-6 h-6 rounded-full bg-background border-2 border-border">
                    {actionIcons[entry.action] || actionIcons.status_change}
                  </div>

                  <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">
                        {actionLabels[entry.action] || entry.action}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(entry.changed_at), "MMM d, yyyy 'at' h:mm a")}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-sm">
                      {entry.old_status && (
                        <>
                          <Badge variant="outline" className="text-xs">{entry.old_status}</Badge>
                          <ArrowRight className="h-3 w-3 text-muted-foreground" />
                        </>
                      )}
                      <Badge variant="secondary" className="text-xs">{entry.new_status}</Badge>
                    </div>

                    {entry.reason && (
                      <p className="text-sm text-muted-foreground bg-background rounded p-2">
                        {entry.reason}
                      </p>
                    )}

                    <p className="text-xs text-muted-foreground">
                      by {entry.changer_name}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
