import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
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
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Save, Trash2 } from "lucide-react";

interface BacklogItemData {
  id: string;
  name: string;
  description: string | null;
  status: string;
  priority: string;
  story_points: number | null;
  item_type: "task" | "feature";
  entity_type: string;
  entity_name: string;
}

interface EditBacklogItemDialogProps {
  item: BacklogItemData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: () => void;
}

export function EditBacklogItemDialog({ item, open, onOpenChange, onUpdate }: EditBacklogItemDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [status, setStatus] = useState("");
  const [storyPoints, setStoryPoints] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (item) {
      setName(item.name);
      setDescription(item.description || "");
      setPriority(item.priority);
      setStatus(item.status);
      setStoryPoints(item.story_points?.toString() || "");
    }
  }, [item]);

  if (!item) return null;

  const isTask = item.item_type === "task";
  const table = isTask ? "tasks" : "product_features";

  const taskStatuses = [
    { value: "not_started", label: "Not Started" },
    { value: "in_progress", label: "In Progress" },
    { value: "on_hold", label: "On Hold" },
    { value: "completed", label: "Completed" },
    { value: "cancelled", label: "Cancelled" },
  ];

  const featureStatuses = [
    { value: "backlog", label: "Backlog" },
    { value: "planned", label: "Planned" },
    { value: "in_progress", label: "In Progress" },
    { value: "review", label: "Review" },
    { value: "done", label: "Done" },
  ];

  const statuses = isTask ? taskStatuses : featureStatuses;

  const handleSave = async () => {
    setSaving(true);
    const updateData: Record<string, unknown> = {
      name,
      description: description || null,
      priority,
      status,
      story_points: storyPoints ? Number(storyPoints) : null,
    };

    const { error } = await supabase.from(table).update(updateData).eq("id", item.id);

    if (error) {
      toast.error("Failed to update item");
      console.error(error);
    } else {
      toast.success("Item updated");
      onOpenChange(false);
      onUpdate();
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    const { error } = await supabase.from(table).delete().eq("id", item.id);
    if (error) {
      toast.error("Failed to delete item");
    } else {
      toast.success("Item deleted");
      onOpenChange(false);
      onUpdate();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Edit {isTask ? "Task" : "Feature"}
            <span className="text-sm font-normal text-muted-foreground">
              ({item.entity_type}: {item.entity_name})
            </span>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {statuses.map(s => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Story Points</Label>
              <Input
                type="number"
                value={storyPoints}
                onChange={(e) => setStoryPoints(e.target.value)}
                placeholder="—"
              />
            </div>
          </div>
          <div className="flex justify-between pt-2">
            <Button variant="destructive" size="sm" onClick={handleDelete}>
              <Trash2 className="h-4 w-4 mr-1" /> Delete
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              <Save className="h-4 w-4 mr-1" /> Save Changes
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
