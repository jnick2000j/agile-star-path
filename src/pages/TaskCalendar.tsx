import { useState, useEffect, useMemo } from "react";
import { Calendar, dateFnsLocalizer, View, Event as RBCEvent } from "react-big-calendar";
import withDragAndDrop from "react-big-calendar/lib/addons/dragAndDrop";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { enUS } from "date-fns/locale";
import "react-big-calendar/lib/css/react-big-calendar.css";
import "react-big-calendar/lib/addons/dragAndDrop/styles.css";

import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

const locales = { "en-US": enUS };
const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales });
const DnDCalendar = withDragAndDrop<TaskEvent>(Calendar as any);

interface TaskRow {
  id: string;
  name: string;
  status: string;
  priority: string | null;
  planned_start: string | null;
  planned_end: string | null;
  assigned_to: string | null;
}

interface TaskEvent extends RBCEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resource: TaskRow;
}

const PRIORITY_COLOR: Record<string, string> = {
  critical: "hsl(var(--destructive))",
  high: "hsl(var(--destructive))",
  medium: "hsl(var(--primary))",
  low: "hsl(var(--muted-foreground))",
};

export default function TaskCalendar() {
  const { currentOrganization } = useOrganization();
  const { user } = useAuth();
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>("month");
  const [date, setDate] = useState<Date>(new Date());
  const [scope, setScope] = useState<"mine" | "all">("all");

  useEffect(() => {
    if (!currentOrganization?.id) return;
    let active = true;
    (async () => {
      setLoading(true);
      let q = supabase
        .from("tasks")
        .select("id, name, status, priority, planned_start, planned_end, assigned_to")
        .eq("organization_id", currentOrganization.id)
        .not("planned_start", "is", null)
        .limit(1000);
      if (scope === "mine" && user?.id) q = q.eq("assigned_to", user.id);
      const { data, error } = await q;
      if (!active) return;
      if (error) {
        toast.error(`Failed to load tasks: ${error.message}`);
        setTasks([]);
      } else {
        setTasks((data ?? []) as TaskRow[]);
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [currentOrganization?.id, user?.id, scope]);

  const events = useMemo<TaskEvent[]>(() => {
    return tasks
      .filter((t) => !!t.planned_start)
      .map((t) => {
        const start = new Date(t.planned_start!);
        const end = t.planned_end ? new Date(t.planned_end) : new Date(start.getTime() + 60 * 60 * 1000);
        return {
          id: t.id,
          title: t.name,
          start,
          end: end > start ? end : new Date(start.getTime() + 30 * 60 * 1000),
          resource: t,
        };
      });
  }, [tasks]);

  const handleEventDrop = async ({ event, start, end }: { event: TaskEvent; start: Date | string; end: Date | string }) => {
    const s = new Date(start);
    const e = new Date(end);
    const previous = tasks;
    setTasks((prev) =>
      prev.map((t) => (t.id === event.id ? { ...t, planned_start: s.toISOString(), planned_end: e.toISOString() } : t))
    );
    const { error } = await supabase
      .from("tasks")
      .update({ planned_start: s.toISOString().slice(0, 10), planned_end: e.toISOString().slice(0, 10) })
      .eq("id", event.id);
    if (error) {
      toast.error("Failed to reschedule");
      setTasks(previous);
    } else {
      toast.success("Task rescheduled");
    }
  };

  const eventStyleGetter = (event: TaskEvent) => {
    const completed = event.resource.status === "completed";
    const color = PRIORITY_COLOR[event.resource.priority || "medium"] || PRIORITY_COLOR.medium;
    return {
      style: {
        backgroundColor: color,
        opacity: completed ? 0.55 : 0.95,
        textDecoration: completed ? "line-through" : "none",
        border: "none",
        color: "hsl(var(--primary-foreground))",
      },
    };
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <Label className="text-xs">Show</Label>
          <Select value={scope} onValueChange={(v) => setScope(v as "mine" | "all")}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All organisation tasks</SelectItem>
              <SelectItem value="mine">My tasks only</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="text-xs text-muted-foreground ml-auto">
          {events.length} scheduled task{events.length === 1 ? "" : "s"} • Drag to reschedule
        </div>
      </div>

      <Card className="p-4">
        {loading ? (
          <div className="flex items-center justify-center h-[600px]">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div style={{ height: 700 }}>
            <DnDCalendar
              localizer={localizer}
              events={events}
              startAccessor="start"
              endAccessor="end"
              view={view}
              onView={setView}
              date={date}
              onNavigate={setDate}
              views={["month", "week", "day", "agenda"]}
              popup
              resizable
              onEventDrop={handleEventDrop as any}
              onEventResize={handleEventDrop as any}
              eventPropGetter={eventStyleGetter as any}
            />
          </div>
        )}
      </Card>
    </div>
  );
}
