import { useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/use-toast";

interface CreateWeeklyReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface FormData {
  programme_id: string;
  week_ending: string;
  overall_health: string;
  highlights: string;
  risks_issues: string;
  next_week: string;
}

export function CreateWeeklyReportDialog({ open, onOpenChange }: CreateWeeklyReportDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { register, handleSubmit, reset, setValue, watch } = useForm<FormData>();

  const { data: programmes } = useQuery({
    queryKey: ["programmes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("programmes").select("id, name").order("name");
      if (error) throw error;
      return data;
    },
  });

  const createReport = useMutation({
    mutationFn: async (data: FormData) => {
      const highlights = data.highlights.split("\n").filter(Boolean);
      const risksIssues = data.risks_issues.split("\n").filter(Boolean);
      const nextWeek = data.next_week.split("\n").filter(Boolean);

      const { error } = await supabase.from("weekly_reports").insert({
        programme_id: data.programme_id,
        week_ending: data.week_ending,
        overall_health: data.overall_health,
        highlights,
        risks_issues: risksIssues,
        next_week: nextWeek,
        submitted_by: user?.id,
        status: "draft",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["weekly-reports"] });
      toast({ title: "Report created", description: "Weekly report has been created as a draft." });
      reset();
      onOpenChange(false);
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const onSubmit = (data: FormData) => {
    createReport.mutate(data);
  };

  // Default to current week ending (Friday)
  const getDefaultWeekEnding = () => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const daysUntilFriday = (5 - dayOfWeek + 7) % 7 || 7;
    const friday = new Date(today);
    friday.setDate(today.getDate() + daysUntilFriday);
    return friday.toISOString().split("T")[0];
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Create Weekly Report</DialogTitle>
          <DialogDescription>
            Create a new weekly status report for a program.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Program</Label>
              <Select onValueChange={(value) => setValue("programme_id", value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select program" />
                </SelectTrigger>
                <SelectContent>
                  {programmes?.map((programme) => (
                    <SelectItem key={programme.id} value={programme.id}>
                      {programme.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Week Ending</Label>
              <Input
                type="date"
                defaultValue={getDefaultWeekEnding()}
                {...register("week_ending", { required: true })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Overall Health</Label>
            <Select onValueChange={(value) => setValue("overall_health", value)} defaultValue="green">
              <SelectTrigger>
                <SelectValue placeholder="Select health" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="green">Green - On Track</SelectItem>
                <SelectItem value="amber">Amber - At Risk</SelectItem>
                <SelectItem value="red">Red - Delayed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Highlights (one per line)</Label>
            <Textarea
              placeholder="Enter key achievements and highlights..."
              rows={3}
              {...register("highlights")}
            />
          </div>

          <div className="space-y-2">
            <Label>Risks & Issues (one per line)</Label>
            <Textarea
              placeholder="Enter risks and issues..."
              rows={3}
              {...register("risks_issues")}
            />
          </div>

          <div className="space-y-2">
            <Label>Next Week Plans (one per line)</Label>
            <Textarea
              placeholder="Enter plans for next week..."
              rows={3}
              {...register("next_week")}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createReport.isPending}>
              {createReport.isPending ? "Creating..." : "Create Report"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
