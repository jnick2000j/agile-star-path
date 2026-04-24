import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { useAuth } from "@/hooks/useAuth";
import { addDays, addMonths, format, parseISO } from "date-fns";

type Frequency = "daily" | "weekly" | "monthly";

interface RecurringTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
  // Optional seed values when launching from an existing task
  seedTask?: {
    name?: string;
    description?: string | null;
    priority?: string | null;
    project_id?: string | null;
    programme_id?: string | null;
    product_id?: string | null;
    work_package_id?: string | null;
    estimated_hours?: number | null;
    assigned_to?: string | null;
  } | null;
}

const WEEKDAYS = [
  { value: 0, short: "Sun", long: "Sunday" },
  { value: 1, short: "Mon", long: "Monday" },
  { value: 2, short: "Tue", long: "Tuesday" },
  { value: 3, short: "Wed", long: "Wednesday" },
  { value: 4, short: "Thu", long: "Thursday" },
  { value: 5, short: "Fri", long: "Friday" },
  { value: 6, short: "Sat", long: "Saturday" },
];

const MAX_OCCURRENCES = 200;

export function RecurringTaskDialog({
  open,
  onOpenChange,
  onCreated,
  seedTask,
}: RecurringTaskDialogProps) {
  const { currentOrganization } = useOrganization();
  const { user } = useAuth();

  const [name, setName] = useState(seedTask?.name ?? "");
  const [description, setDescription] = useState(seedTask?.description ?? "");
  const [priority, setPriority] = useState(seedTask?.priority ?? "medium");
  const [estimatedHours, setEstimatedHours] = useState<string>(
    seedTask?.estimated_hours != null ? String(seedTask.estimated_hours) : "",
  );
  const [frequency, setFrequency] = useState<Frequency>("weekly");
  const [interval, setInterval] = useState<string>("1");
  const [startDate, setStartDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState<string>("");
  const [weekdays, setWeekdays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [durationDays, setDurationDays] = useState<string>("0");
  const [submitting, setSubmitting] = useState(false);

  // Reset state when re-opening with a new seed
  const reset = () => {
    setName(seedTask?.name ?? "");
    setDescription(seedTask?.description ?? "");
    setPriority(seedTask?.priority ?? "medium");
    setEstimatedHours(
      seedTask?.estimated_hours != null ? String(seedTask.estimated_hours) : "",
    );
    setFrequency("weekly");
    setInterval("1");
    setStartDate(format(new Date(), "yyyy-MM-dd"));
    setEndDate("");
    setWeekdays([1, 2, 3, 4, 5]);
    setDurationDays("0");
  };

  const toggleWeekday = (day: number) => {
    setWeekdays((current) =>
      current.includes(day)
        ? current.filter((d) => d !== day)
        : [...current, day].sort((a, b) => a - b),
    );
  };

  const computeOccurrences = (): Date[] => {
    if (!startDate) return [];
    const start = parseISO(startDate);
    const end = endDate ? parseISO(endDate) : addMonths(start, 12);
    const stepInterval = Math.max(1, parseInt(interval, 10) || 1);
    const dates: Date[] = [];

    if (frequency === "daily") {
      let cursor = start;
      while (cursor <= end && dates.length < MAX_OCCURRENCES) {
        dates.push(cursor);
        cursor = addDays(cursor, stepInterval);
      }
    } else if (frequency === "weekly") {
      if (weekdays.length === 0) return [];
      // Walk one week at a time (interval = weeks between occurrence sets)
      let weekStart = start;
      while (weekStart <= end && dates.length < MAX_OCCURRENCES) {
        for (let i = 0; i < 7; i++) {
          const candidate = addDays(weekStart, i);
          if (candidate < start || candidate > end) continue;
          if (weekdays.includes(candidate.getDay())) {
            dates.push(candidate);
            if (dates.length >= MAX_OCCURRENCES) break;
          }
        }
        weekStart = addDays(weekStart, 7 * stepInterval);
      }
    } else if (frequency === "monthly") {
      let cursor = start;
      while (cursor <= end && dates.length < MAX_OCCURRENCES) {
        dates.push(cursor);
        cursor = addMonths(cursor, stepInterval);
      }
    }

    return dates;
  };

  const previewDates = computeOccurrences();

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error("Please enter a task name");
      return;
    }
    if (!currentOrganization?.id || !user?.id) {
      toast.error("Missing organization or user context");
      return;
    }
    const occurrences = computeOccurrences();
    if (occurrences.length === 0) {
      toast.error("No occurrences match those settings");
      return;
    }

    const span = Math.max(0, parseInt(durationDays, 10) || 0);
    const rows = occurrences.map((date) => {
      const startISO = format(date, "yyyy-MM-dd");
      const endISO = format(addDays(date, span), "yyyy-MM-dd");
      return {
        name: name.trim(),
        description: description?.toString().trim() || null,
        priority,
        status: "not_started" as const,
        organization_id: currentOrganization.id,
        created_by: user.id,
        project_id: seedTask?.project_id ?? null,
        programme_id: seedTask?.programme_id ?? null,
        product_id: seedTask?.product_id ?? null,
        work_package_id: seedTask?.work_package_id ?? null,
        assigned_to: seedTask?.assigned_to ?? null,
        estimated_hours: estimatedHours ? parseFloat(estimatedHours) : null,
        planned_start: startISO,
        planned_end: endISO,
        completion_percentage: 0,
      };
    });

    setSubmitting(true);
    const { error } = await supabase.from("tasks").insert(rows);
    setSubmitting(false);

    if (error) {
      toast.error(`Failed to create recurring tasks: ${error.message}`);
      return;
    }
    toast.success(`Created ${rows.length} recurring task${rows.length > 1 ? "s" : ""}`);
    reset();
    onOpenChange(false);
    onCreated?.();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value) reset();
        onOpenChange(value);
      }}
    >
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Recurring Tasks</DialogTitle>
          <DialogDescription>
            Generate a series of tasks on a schedule. Each occurrence becomes a separate task you
            can edit independently.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="rec-name">Task Name *</Label>
              <Input
                id="rec-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Weekly status report"
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="rec-description">Description</Label>
              <Textarea
                id="rec-description"
                value={description ?? ""}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
            </div>
            <div>
              <Label htmlFor="rec-priority">Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger id="rec-priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="rec-est">Estimated Hours (per task)</Label>
              <Input
                id="rec-est"
                type="number"
                min="0"
                step="0.25"
                value={estimatedHours}
                onChange={(e) => setEstimatedHours(e.target.value)}
              />
            </div>
          </div>

          <div className="rounded-lg border p-4 space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <Label htmlFor="rec-freq">Frequency</Label>
                <Select value={frequency} onValueChange={(v) => setFrequency(v as Frequency)}>
                  <SelectTrigger id="rec-freq">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="rec-interval">
                  Repeat every {frequency === "daily" ? "(days)" : frequency === "weekly" ? "(weeks)" : "(months)"}
                </Label>
                <Input
                  id="rec-interval"
                  type="number"
                  min="1"
                  value={interval}
                  onChange={(e) => setInterval(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="rec-duration">Duration per task (days)</Label>
                <Input
                  id="rec-duration"
                  type="number"
                  min="0"
                  value={durationDays}
                  onChange={(e) => setDurationDays(e.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="rec-start">Start Date *</Label>
                <Input
                  id="rec-start"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="rec-end">End Date</Label>
                <Input
                  id="rec-end"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Leave blank to default to 12 months out.
                </p>
              </div>
            </div>

            {frequency === "weekly" && (
              <div>
                <Label className="mb-2 block">Days of week</Label>
                <div className="flex flex-wrap gap-3">
                  {WEEKDAYS.map((day) => (
                    <label
                      key={day.value}
                      className="flex items-center gap-2 rounded-md border px-3 py-1.5 cursor-pointer hover:bg-accent"
                    >
                      <Checkbox
                        checked={weekdays.includes(day.value)}
                        onCheckedChange={() => toggleWeekday(day.value)}
                      />
                      <span className="text-sm">{day.short}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="rounded-lg border bg-muted/30 p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Preview</span>
              <span className="text-xs text-muted-foreground">
                {previewDates.length} occurrence{previewDates.length === 1 ? "" : "s"}
                {previewDates.length >= MAX_OCCURRENCES ? " (capped)" : ""}
              </span>
            </div>
            {previewDates.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Adjust the schedule to see upcoming occurrences.
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                {previewDates.slice(0, 24).map((d) => (
                  <span
                    key={d.toISOString()}
                    className="text-xs rounded bg-background border px-2 py-0.5"
                  >
                    {format(d, "EEE, MMM d")}
                  </span>
                ))}
                {previewDates.length > 24 && (
                  <span className="text-xs text-muted-foreground self-center">
                    +{previewDates.length - 24} more
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || previewDates.length === 0}>
            {submitting
              ? "Creating..."
              : `Create ${previewDates.length} Task${previewDates.length === 1 ? "" : "s"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
