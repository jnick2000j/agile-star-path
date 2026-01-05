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

interface CreateBenefitDialogProps {
  onSuccess?: () => void;
}

export function CreateBenefitDialog({ onSuccess }: CreateBenefitDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const { currentOrganization } = useOrganization();

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    programme_id: "",
    project_id: "",
    product_id: "",
    type: "quantitative",
    category: "operational",
    status: "identified",
    target_value: "",
    current_value: "",
    start_date: "",
    end_date: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    try {
      const { error } = await supabase.from("benefits").insert({
        name: formData.name,
        description: formData.description || null,
        programme_id: formData.programme_id || null,
        project_id: formData.project_id || null,
        product_id: formData.product_id || null,
        type: formData.type,
        category: formData.category,
        status: formData.status,
        target_value: formData.target_value || null,
        current_value: formData.current_value || null,
        start_date: formData.start_date || null,
        end_date: formData.end_date || null,
        organization_id: currentOrganization?.id,
        created_by: user.id,
        owner_id: user.id,
        realization: 0,
      });

      if (error) throw error;

      toast.success("Benefit created successfully");
      setOpen(false);
      setFormData({
        name: "",
        description: "",
        programme_id: "",
        project_id: "",
        product_id: "",
        type: "quantitative",
        category: "operational",
        status: "identified",
        target_value: "",
        current_value: "",
        start_date: "",
        end_date: "",
      });
      onSuccess?.();
    } catch (error) {
      console.error("Error creating benefit:", error);
      toast.error("Failed to create benefit");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Add Benefit
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Benefit</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="name">Benefit Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
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
                  <SelectItem value="quantitative">Quantitative</SelectItem>
                  <SelectItem value="qualitative">Qualitative</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="category">Category</Label>
              <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="operational">Operational</SelectItem>
                  <SelectItem value="financial">Financial</SelectItem>
                  <SelectItem value="strategic">Strategic</SelectItem>
                  <SelectItem value="customer">Customer</SelectItem>
                  <SelectItem value="compliance">Compliance</SelectItem>
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
                  <SelectItem value="identified">Identified</SelectItem>
                  <SelectItem value="expected">Expected</SelectItem>
                  <SelectItem value="realized">Realized</SelectItem>
                  <SelectItem value="measured">Measured</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="target_value">Target Value</Label>
              <Input
                id="target_value"
                value={formData.target_value}
                onChange={(e) => setFormData({ ...formData, target_value: e.target.value })}
                placeholder="e.g., £500K or 20%"
              />
            </div>
            <div>
              <Label htmlFor="current_value">Current Value</Label>
              <Input
                id="current_value"
                value={formData.current_value}
                onChange={(e) => setFormData({ ...formData, current_value: e.target.value })}
                placeholder="e.g., £200K or 8%"
              />
            </div>
            <div>
              <Label htmlFor="start_date">Start Date</Label>
              <Input
                id="start_date"
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="end_date">Expected Realization Date</Label>
              <Input
                id="end_date"
                type="date"
                value={formData.end_date}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Creating..." : "Add Benefit"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}