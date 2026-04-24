import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import { toast } from "sonner";
import { EntitySelector } from "@/components/EntitySelector";
import { dispatchAutomation } from "@/lib/automations";

interface CreateIssueDialogProps {
  onSuccess?: () => void;
}

export function CreateIssueDialog({ onSuccess }: CreateIssueDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const { currentOrganization } = useOrganization();

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    programme_id: "",
    project_id: "",
    product_id: "",
    type: "problem",
    priority: "medium",
    status: "open",
    resolution: "",
    target_date: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    try {
      const { data: created, error } = await supabase.from("issues").insert({
        title: formData.title,
        description: formData.description || null,
        programme_id: formData.programme_id || null,
        project_id: formData.project_id || null,
        product_id: formData.product_id || null,
        type: formData.type,
        priority: formData.priority,
        status: formData.status,
        resolution: formData.resolution || null,
        target_date: formData.target_date || null,
        organization_id: currentOrganization?.id,
        created_by: user.id,
        owner_id: user.id,
      }).select("id, organization_id").single();

      if (error) throw error;

      if (created?.organization_id) {
        dispatchAutomation({
          organization_id: created.organization_id,
          module: "issue",
          trigger_event: "created",
          entity_type: "issue",
          entity_id: created.id,
          payload: { ...formData },
          triggered_by: user.id,
        });
      }

      toast.success("Issue created successfully");
      setOpen(false);
      setFormData({
        title: "",
        description: "",
        programme_id: "",
        project_id: "",
        product_id: "",
        type: "problem",
        priority: "medium",
        status: "open",
        resolution: "",
        target_date: "",
      });
      onSuccess?.();
    } catch (error) {
      console.error("Error creating issue:", error);
      toast.error("Failed to create issue");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Add Issue
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Issue</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="title">Issue Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </div>

            <div className="sm:col-span-2">
              <EntitySelector
                programmeId={formData.programme_id}
                projectId={formData.project_id}
                productId={formData.product_id}
                onProgrammeChange={(v) => setFormData({ ...formData, programme_id: v })}
                onProjectChange={(v) => setFormData({ ...formData, project_id: v })}
                onProductChange={(v) => setFormData({ ...formData, product_id: v })}
              />
            </div>

            <div>
              <Label htmlFor="type">Type</Label>
              <Select value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="problem">Problem</SelectItem>
                  <SelectItem value="concern">Concern</SelectItem>
                  <SelectItem value="change-request">Change Request</SelectItem>
                  <SelectItem value="off-specification">Off-Specification</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="priority">Priority</Label>
              <Select value={formData.priority} onValueChange={(v) => setFormData({ ...formData, priority: v })}>
                <SelectTrigger>
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
              <Label htmlFor="status">Status</Label>
              <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="investigating">Investigating</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="target_date">Target Resolution Date</Label>
              <Input
                id="target_date"
                type="date"
                value={formData.target_date}
                onChange={(e) => setFormData({ ...formData, target_date: e.target.value })}
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="resolution">Proposed Resolution</Label>
              <Textarea
                id="resolution"
                value={formData.resolution}
                onChange={(e) => setFormData({ ...formData, resolution: e.target.value })}
                rows={2}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Creating..." : "Add Issue"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}