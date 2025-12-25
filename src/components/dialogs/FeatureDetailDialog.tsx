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
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Calculator, Save, Trash2 } from "lucide-react";

interface Feature {
  id: string;
  name: string;
  description: string | null;
  status: string;
  priority: string;
  moscow: string | null;
  product_id: string;
  target_release: string | null;
  reach_score: number | null;
  impact_score: number | null;
  confidence_score: number | null;
  effort_score: number | null;
  story_points?: number | null;
  sprint_id?: string | null;
}

interface FeatureDetailDialogProps {
  feature: Feature | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: () => void;
  products: { id: string; name: string }[];
}

const priorityOptions = [
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

const moscowOptions = [
  { value: "must", label: "Must Have" },
  { value: "should", label: "Should Have" },
  { value: "could", label: "Could Have" },
  { value: "wont", label: "Won't Have" },
];

const statusOptions = [
  { value: "backlog", label: "Backlog" },
  { value: "planned", label: "Planned" },
  { value: "in_progress", label: "In Progress" },
  { value: "review", label: "Review" },
  { value: "done", label: "Done" },
];

export function FeatureDetailDialog({
  feature,
  open,
  onOpenChange,
  onUpdate,
  products,
}: FeatureDetailDialogProps) {
  const [formData, setFormData] = useState<Partial<Feature>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (feature) {
      setFormData({
        name: feature.name,
        description: feature.description,
        status: feature.status,
        priority: feature.priority,
        moscow: feature.moscow,
        product_id: feature.product_id,
        target_release: feature.target_release,
        reach_score: feature.reach_score ?? 5,
        impact_score: feature.impact_score ?? 5,
        confidence_score: feature.confidence_score ?? 5,
        effort_score: feature.effort_score ?? 5,
        story_points: feature.story_points,
      });
    }
  }, [feature]);

  const calculateRICEScore = () => {
    const { reach_score, impact_score, confidence_score, effort_score } = formData;
    if (!reach_score || !impact_score || !confidence_score || !effort_score) return null;
    return Math.round((reach_score * impact_score * (confidence_score / 10)) / effort_score);
  };

  const handleSave = async () => {
    if (!feature) return;
    setSaving(true);

    const { error } = await supabase
      .from("product_features")
      .update({
        name: formData.name,
        description: formData.description,
        status: formData.status,
        priority: formData.priority,
        moscow: formData.moscow,
        product_id: formData.product_id,
        target_release: formData.target_release,
        reach_score: formData.reach_score,
        impact_score: formData.impact_score,
        confidence_score: formData.confidence_score,
        effort_score: formData.effort_score,
        story_points: formData.story_points,
      })
      .eq("id", feature.id);

    setSaving(false);

    if (error) {
      toast.error("Failed to update feature");
      console.error(error);
    } else {
      toast.success("Feature updated successfully");
      onUpdate();
      onOpenChange(false);
    }
  };

  const handleDelete = async () => {
    if (!feature) return;
    
    const { error } = await supabase
      .from("product_features")
      .delete()
      .eq("id", feature.id);

    if (error) {
      toast.error("Failed to delete feature");
    } else {
      toast.success("Feature deleted");
      onUpdate();
      onOpenChange(false);
    }
  };

  const riceScore = calculateRICEScore();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Feature Details</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="details" className="mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="rice">RICE Calculator</TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Feature Name</Label>
              <Input
                value={formData.name || ""}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={formData.description || ""}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Product</Label>
                <Select
                  value={formData.product_id}
                  onValueChange={(v) => setFormData({ ...formData, product_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(v) => setFormData({ ...formData, status: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select
                  value={formData.priority}
                  onValueChange={(v) => setFormData({ ...formData, priority: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {priorityOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>MoSCoW</Label>
                <Select
                  value={formData.moscow || ""}
                  onValueChange={(v) => setFormData({ ...formData, moscow: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {moscowOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Story Points</Label>
                <Select
                  value={String(formData.story_points || "")}
                  onValueChange={(v) => setFormData({ ...formData, story_points: Number(v) })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 5, 8, 13, 21].map((pts) => (
                      <SelectItem key={pts} value={String(pts)}>{pts}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Target Release</Label>
              <Select
                value={formData.target_release || ""}
                onValueChange={(v) => setFormData({ ...formData, target_release: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select quarter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Q1">Q1</SelectItem>
                  <SelectItem value="Q2">Q2</SelectItem>
                  <SelectItem value="Q3">Q3</SelectItem>
                  <SelectItem value="Q4">Q4</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </TabsContent>

          <TabsContent value="rice" className="space-y-6 py-4">
            <div className="text-center p-4 rounded-lg bg-primary/10 border border-primary/30">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Calculator className="h-5 w-5 text-primary" />
                <span className="text-sm font-medium text-primary">RICE Score</span>
              </div>
              <p className="text-4xl font-bold text-primary">
                {riceScore !== null ? riceScore : "—"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                (Reach × Impact × Confidence) / Effort
              </p>
            </div>

            <div className="space-y-6">
              <div className="space-y-3">
                <div className="flex justify-between">
                  <Label>Reach (How many users?)</Label>
                  <Badge variant="secondary">{formData.reach_score || 0}</Badge>
                </div>
                <Slider
                  value={[formData.reach_score || 5]}
                  onValueChange={([v]) => setFormData({ ...formData, reach_score: v })}
                  max={10}
                  min={1}
                  step={1}
                />
                <p className="text-xs text-muted-foreground">
                  1 = Few users, 10 = All users
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between">
                  <Label>Impact (How much will it help?)</Label>
                  <Badge variant="secondary">{formData.impact_score || 0}</Badge>
                </div>
                <Slider
                  value={[formData.impact_score || 5]}
                  onValueChange={([v]) => setFormData({ ...formData, impact_score: v })}
                  max={10}
                  min={1}
                  step={1}
                />
                <p className="text-xs text-muted-foreground">
                  1 = Minimal impact, 10 = Massive impact
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between">
                  <Label>Confidence (How sure are you?)</Label>
                  <Badge variant="secondary">{formData.confidence_score || 0}%</Badge>
                </div>
                <Slider
                  value={[formData.confidence_score || 5]}
                  onValueChange={([v]) => setFormData({ ...formData, confidence_score: v })}
                  max={10}
                  min={1}
                  step={1}
                />
                <p className="text-xs text-muted-foreground">
                  1 = Low confidence, 10 = High confidence
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between">
                  <Label>Effort (How much work?)</Label>
                  <Badge variant="secondary">{formData.effort_score || 0}</Badge>
                </div>
                <Slider
                  value={[formData.effort_score || 5]}
                  onValueChange={([v]) => setFormData({ ...formData, effort_score: v })}
                  max={10}
                  min={1}
                  step={1}
                />
                <p className="text-xs text-muted-foreground">
                  1 = Very easy, 10 = Very difficult
                </p>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-between pt-4 border-t">
          <Button variant="destructive" size="sm" onClick={handleDelete}>
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
