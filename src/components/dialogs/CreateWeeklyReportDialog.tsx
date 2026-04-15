import { useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
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
  report_type: string;
  entity_id: string;
  week_ending: string;
  overall_health: string;
  highlights: string;
  risks_issues: string;
  next_week: string;
}

export function CreateWeeklyReportDialog({ open, onOpenChange }: CreateWeeklyReportDialogProps) {
  const { user } = useAuth();
  const { currentOrganization } = useOrganization();
  const queryClient = useQueryClient();
  const { register, handleSubmit, reset, setValue, watch } = useForm<FormData>({
    defaultValues: { report_type: "programme", overall_health: "green" },
  });

  const reportType = watch("report_type");

  const { data: programmes } = useQuery({
    queryKey: ["programmes-for-report"],
    queryFn: async () => {
      let query = supabase.from("programmes").select("id, name").order("name");
      if (currentOrganization) query = query.eq("organization_id", currentOrganization.id);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const { data: projects } = useQuery({
    queryKey: ["projects-for-report"],
    queryFn: async () => {
      let query = supabase.from("projects").select("id, name").order("name");
      if (currentOrganization) query = query.eq("organization_id", currentOrganization.id);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const { data: products } = useQuery({
    queryKey: ["products-for-report"],
    queryFn: async () => {
      let query = supabase.from("products").select("id, name").order("name");
      if (currentOrganization) query = query.eq("organization_id", currentOrganization.id);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const getEntityOptions = () => {
    if (reportType === "programme") return programmes || [];
    if (reportType === "project") return projects || [];
    if (reportType === "product") return products || [];
    return [];
  };

  const createReport = useMutation({
    mutationFn: async (data: FormData) => {
      const highlights = data.highlights?.split("\n").filter(Boolean) || [];
      const risksIssues = data.risks_issues?.split("\n").filter(Boolean) || [];
      const nextWeek = data.next_week?.split("\n").filter(Boolean) || [];

      const insertData: Record<string, unknown> = {
        report_type: data.report_type,
        week_ending: data.week_ending,
        overall_health: data.overall_health,
        highlights,
        risks_issues: risksIssues,
        next_week: nextWeek,
        submitted_by: user?.id,
        status: "draft",
        organization_id: currentOrganization?.id || null,
      };

      if (data.report_type === "programme") insertData.programme_id = data.entity_id;
      if (data.report_type === "project") insertData.project_id = data.entity_id;
      if (data.report_type === "product") insertData.product_id = data.entity_id;

      const { error } = await supabase.from("weekly_reports").insert(insertData);
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

  const getDefaultWeekEnding = () => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const daysUntilFriday = (5 - dayOfWeek + 7) % 7 || 7;
    const friday = new Date(today);
    friday.setDate(today.getDate() + daysUntilFriday);
    return friday.toISOString().split("T")[0];
  };

  const entityLabel = reportType === "programme" ? "Program" : reportType === "project" ? "Project" : "Product";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Weekly Report</DialogTitle>
          <DialogDescription>
            Create a new weekly status report for a program, project, or product.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Report Type</Label>
              <Select
                defaultValue="programme"
                onValueChange={(value) => {
                  setValue("report_type", value);
                  setValue("entity_id", "");
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="programme">Program</SelectItem>
                  <SelectItem value="project">Project</SelectItem>
                  <SelectItem value="product">Product</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{entityLabel}</Label>
              <Select onValueChange={(value) => setValue("entity_id", value)}>
                <SelectTrigger>
                  <SelectValue placeholder={`Select ${entityLabel.toLowerCase()}`} />
                </SelectTrigger>
                <SelectContent>
                  {getEntityOptions().map((entity) => (
                    <SelectItem key={entity.id} value={entity.id}>
                      {entity.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Week Ending</Label>
              <Input
                type="date"
                defaultValue={getDefaultWeekEnding()}
                {...register("week_ending", { required: true })}
              />
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
