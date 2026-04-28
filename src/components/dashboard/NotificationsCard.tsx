import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Bell,
  AlertTriangle,
  FileText,
  TrendingUp,
  CheckCheck,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string | null;
  read: boolean;
  link: string | null;
  created_at: string;
}

const typeIcons: Record<string, React.ElementType> = {
  weekly_report_due: FileText,
  risk_escalated: AlertTriangle,
  benefit_milestone: TrendingUp,
  default: Bell,
};

const typeColors: Record<string, string> = {
  weekly_report_due: "text-primary",
  risk_escalated: "text-destructive",
  benefit_milestone: "text-success",
  default: "text-muted-foreground",
};

export function NotificationsCard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ["notifications", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(8);
      if (error) throw error;
      return data as Notification[];
    },
    enabled: !!user,
    refetchInterval: 30000,
  });

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAsRead = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
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
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Bell className="h-4 w-4" />
          Notifications
        </CardTitle>
        <div className="flex items-center gap-1">
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs"
              onClick={() => markAllAsRead.mutate()}
            >
              <CheckCheck className="h-3.5 w-3.5 mr-1.5" />
              Mark all read
            </Button>
          )}
          <Button asChild variant="ghost" size="sm" className="h-8 text-xs">
            <Link to="/notifications">
              View all
              <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </Link>
          </Button>
          {notifications.length > 0 && (
            <Badge variant="secondary" className="font-normal ml-1">
              {notifications.length}
            </Badge>
          )}
          {unreadCount > 0 && (
            <Badge variant="destructive" className="h-5 px-1.5 text-[10px]">
              {unreadCount} new
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0 max-h-[180px] overflow-y-auto">
        {isLoading ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            Loading…
          </div>
        ) : notifications.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            <Bell className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">You're all caught up</p>
          </div>
        ) : (
          <div className="divide-y">
            {notifications.map((n) => {
              const Icon = typeIcons[n.type] || typeIcons.default;
              const colorClass = typeColors[n.type] || typeColors.default;
              const Wrapper: any = n.link ? Link : "div";
              const wrapperProps = n.link ? { to: n.link } : {};

              return (
                <Wrapper
                  key={n.id}
                  {...wrapperProps}
                  onClick={() => {
                    if (!n.read) markAsRead.mutate(n.id);
                  }}
                  className={cn(
                    "flex items-start gap-3 py-3 px-1 -mx-1 rounded-md transition-colors",
                    n.link && "hover:bg-muted/50 cursor-pointer",
                    !n.read && "bg-primary/5",
                  )}
                >
                  <div
                    className={cn(
                      "h-8 w-8 shrink-0 rounded-full bg-muted flex items-center justify-center",
                      colorClass,
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p
                        className={cn(
                          "text-sm leading-tight",
                          !n.read ? "font-semibold" : "font-medium",
                        )}
                      >
                        {n.title}
                      </p>
                      {!n.read && (
                        <span className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1.5" />
                      )}
                    </div>
                    {n.message && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {n.message}
                      </p>
                    )}
                    <p className="text-[11px] text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(n.created_at), {
                        addSuffix: true,
                      })}
                    </p>
                  </div>
                </Wrapper>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
