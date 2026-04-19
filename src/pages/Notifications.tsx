import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Bell,
  Check,
  AlertTriangle,
  FileText,
  TrendingUp,
  Clock,
  CheckCircle2,
  XCircle,
  ClipboardCheck,
  UserPlus,
  Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string | null;
  read: boolean;
  link: string | null;
  created_at: string;
}

const typeMeta: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  weekly_report_due: { icon: FileText, color: "text-primary", label: "Report Due" },
  update_reminder: { icon: Clock, color: "text-primary", label: "Update Reminder" },
  update_overdue: { icon: AlertTriangle, color: "text-warning", label: "Update Overdue" },
  risk_escalated: { icon: AlertTriangle, color: "text-destructive", label: "Risk Escalated" },
  benefit_milestone: { icon: TrendingUp, color: "text-success", label: "Benefit Milestone" },
  workflow_assignment: { icon: ClipboardCheck, color: "text-primary", label: "Assignment" },
  approval_pending: { icon: ClipboardCheck, color: "text-warning", label: "Pending Approval" },
  approval_approved: { icon: CheckCircle2, color: "text-success", label: "Approved" },
  approval_denied: { icon: XCircle, color: "text-destructive", label: "Denied" },
  timesheet_pending: { icon: Clock, color: "text-warning", label: "Timesheet" },
  invitation: { icon: UserPlus, color: "text-primary", label: "Invitation" },
  sso_request: { icon: Shield, color: "text-primary", label: "SSO Request" },
  default: { icon: Bell, color: "text-muted-foreground", label: "Notification" },
};

export default function Notifications() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ["notifications-page", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data as Notification[];
    },
    enabled: !!user,
    refetchInterval: 30000,
  });

  // Realtime updates
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("notifications-page")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => queryClient.invalidateQueries({ queryKey: ["notifications-page"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);

  const markAsRead = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("notifications").update({ read: true }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications-page"] });
      queryClient.invalidateQueries({ queryKey: ["notifications-unread"] });
    },
  });

  const markAllAsRead = useMutation({
    mutationFn: async () => {
      if (!user) return;
      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("user_id", user.id)
        .eq("read", false);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications-page"] });
      queryClient.invalidateQueries({ queryKey: ["notifications-unread"] });
      toast.success("All notifications marked as read");
    },
  });

  const unread = notifications.filter((n) => !n.read);
  const read = notifications.filter((n) => n.read);

  const renderList = (items: Notification[]) => {
    if (items.length === 0) {
      return (
        <div className="p-12 text-center text-muted-foreground">
          <Bell className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">You're all caught up.</p>
        </div>
      );
    }
    return (
      <div className="divide-y">
        {items.map((n) => {
          const meta = typeMeta[n.type] || typeMeta.default;
          const Icon = meta.icon;
          return (
            <button
              key={n.id}
              onClick={() => {
                if (!n.read) markAsRead.mutate(n.id);
                if (n.link) navigate(n.link);
              }}
              className={cn(
                "w-full text-left flex gap-4 p-4 hover:bg-muted/50 transition-colors",
                !n.read && "bg-primary/5",
              )}
            >
              <div className={cn("mt-1", meta.color)}>
                <Icon className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p className={cn("text-sm font-medium", !n.read && "text-foreground")}>{n.title}</p>
                  <Badge variant="outline" className="shrink-0 text-xs">
                    {meta.label}
                  </Badge>
                </div>
                {n.message && (
                  <p className="text-sm text-muted-foreground mt-0.5">{n.message}</p>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                </p>
              </div>
              {!n.read && <div className="h-2 w-2 rounded-full bg-primary mt-2 shrink-0" />}
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <AppLayout title="Notifications">
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Bell className="h-6 w-6 text-primary" />
              <h1 className="text-3xl font-bold">Notifications</h1>
              {unread.length > 0 && (
                <Badge variant="destructive">{unread.length}</Badge>
              )}
            </div>
            <p className="text-muted-foreground text-sm mt-1">
              In-app alerts for approvals, assignments, timesheets, reports, and other actions that need your attention.
              These are also delivered by email when configured.
            </p>
          </div>
          {unread.length > 0 && (
            <Button variant="outline" size="sm" onClick={() => markAllAsRead.mutate()}>
              <Check className="h-4 w-4 mr-2" />
              Mark all read
            </Button>
          )}
        </div>

        <Card>
          <Tabs defaultValue="unread" className="w-full">
            <TabsList className="m-3">
              <TabsTrigger value="unread">
                Unread {unread.length > 0 && <Badge variant="secondary" className="ml-2">{unread.length}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="read">Read</TabsTrigger>
            </TabsList>
            <TabsContent value="unread" className="m-0">
              {isLoading ? <div className="p-8 text-center text-muted-foreground">Loading...</div> : renderList(unread)}
            </TabsContent>
            <TabsContent value="all" className="m-0">
              {isLoading ? <div className="p-8 text-center text-muted-foreground">Loading...</div> : renderList(notifications)}
            </TabsContent>
            <TabsContent value="read" className="m-0">
              {isLoading ? <div className="p-8 text-center text-muted-foreground">Loading...</div> : renderList(read)}
            </TabsContent>
          </Tabs>
        </Card>

        <p className="text-xs text-muted-foreground text-center">
          Manage email frequency and reminders in <Link to="/settings" className="underline">Settings</Link>.
        </p>
      </div>
    </AppLayout>
  );
}
