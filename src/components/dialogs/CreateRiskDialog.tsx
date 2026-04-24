import { useState, useEffect } from "react";
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

interface CreateRiskDialogProps {
  onSuccess?: () => void;
}

const probabilityValues = { "very-low": 1, low: 2, medium: 3, high: 4, "very-high": 5 };
const impactValues = { "very-low": 1, low: 2, medium: 3, high: 4, "very-high": 5 };

export function CreateRiskDialog({ onSuccess }: CreateRiskDialogProps) {
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
    category: "",
    probability: "medium",
    impact: "medium",
    status: "open",
    response: "",
    review_date: "",
  });

  const calculateScore = () => {
    const p = probabilityValues[formData.probability as keyof typeof probabilityValues] || 3;
    const i = impactValues[formData.impact as keyof typeof impactValues] || 3;
    return p * i;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    try {
      const { data: created, error } = await supabase.from("risks").insert({
        title: formData.title,
        description: formData.description || null,
        programme_id: formData.programme_id || null,
        project_id: formData.project_id || null,
        product_id: formData.product_id || null,
        category: formData.category || null,
        probability: formData.probability,
        impact: formData.impact,
        status: formData.status,
        response: formData.response || null,
        review_date: formData.review_date || null,
        score: calculateScore(),
        organization_id: currentOrganization?.id,
        created_by: user.id,
        owner_id: user.id,
      }).select("id, organization_id").single();

      if (error) throw error;

      if (created?.organization_id) {
        dispatchAutomation({
          organization_id: created.organization_id,
          module: "risk",
          trigger_event: "created",
          entity_type: "risk",
          entity_id: created.id,
          payload: { ...formData, score: calculateScore() },
          triggered_by: user.id,
        });
      }

      toast.success("Risk created successfully");
      setOpen(false);
      setFormData({
        title: "",
        description: "",
        programme_id: "",
        project_id: "",
        product_id: "",
        category: "",
        probability: "medium",
        impact: "medium",
        status: "open",
        response: "",
        review_date: "",
      });
      onSuccess?.();
    } catch (error) {
      console.error("Error creating risk:", error);
      toast.error("Failed to create risk");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Add Risk
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Risk</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="title">Risk Title *</Label>
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
              <Label htmlFor="category">Category</Label>
              <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Technical">Technical</SelectItem>
                  <SelectItem value="Resource">Resource</SelectItem>
                  <SelectItem value="Financial">Financial</SelectItem>
                  <SelectItem value="Commercial">Commercial</SelectItem>
                  <SelectItem value="Compliance">Compliance</SelectItem>
                  <SelectItem value="Stakeholder">Stakeholder</SelectItem>
                  <SelectItem value="Quality">Quality</SelectItem>
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
                  <SelectItem value="mitigating">Mitigating</SelectItem>
                  <SelectItem value="accepted">Accepted</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="probability">Probability</Label>
              <Select value={formData.probability} onValueChange={(v) => setFormData({ ...formData, probability: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="very-low">Very Low (1)</SelectItem>
                  <SelectItem value="low">Low (2)</SelectItem>
                  <SelectItem value="medium">Medium (3)</SelectItem>
                  <SelectItem value="high">High (4)</SelectItem>
                  <SelectItem value="very-high">Very High (5)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="impact">Impact</Label>
              <Select value={formData.impact} onValueChange={(v) => setFormData({ ...formData, impact: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="very-low">Very Low (1)</SelectItem>
                  <SelectItem value="low">Low (2)</SelectItem>
                  <SelectItem value="medium">Medium (3)</SelectItem>
                  <SelectItem value="high">High (4)</SelectItem>
                  <SelectItem value="very-high">Very High (5)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Risk Score</Label>
              <div className="mt-2 text-2xl font-bold text-primary">{calculateScore()}</div>
            </div>
            <div>
              <Label htmlFor="review_date">Review Date</Label>
              <Input
                id="review_date"
                type="date"
                value={formData.review_date}
                onChange={(e) => setFormData({ ...formData, review_date: e.target.value })}
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="response">Response Strategy</Label>
              <Select value={formData.response} onValueChange={(v) => setFormData({ ...formData, response: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select response" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Avoid">Avoid</SelectItem>
                  <SelectItem value="Reduce">Reduce</SelectItem>
                  <SelectItem value="Transfer">Transfer</SelectItem>
                  <SelectItem value="Accept">Accept</SelectItem>
                  <SelectItem value="Contingency">Contingency</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Creating..." : "Add Risk"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}