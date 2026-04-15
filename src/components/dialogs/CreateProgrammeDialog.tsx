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
import { toast } from "sonner";

interface CreateProgrammeDialogProps {
  onSuccess?: () => void;
}

interface Organization {
  id: string;
  name: string;
}

export function CreateProgrammeDialog({ onSuccess }: CreateProgrammeDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const { user } = useAuth();

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    status: "active",
    sponsor: "",
    budget: "",
    benefits_target: "",
    tranche: "",
    start_date: "",
    end_date: "",
    organization_id: "",
  });

  useEffect(() => {
    const fetchOrganizations = async () => {
      const { data } = await supabase.from("organizations").select("id, name").order("name");
      if (data) setOrganizations(data);
    };
    if (open) fetchOrganizations();
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    try {
      const { error } = await supabase.from("programmes").insert({
        ...formData,
        organization_id: formData.organization_id || null,
        created_by: user.id,
        manager_id: user.id,
        progress: 0,
      });

      if (error) throw error;

      toast.success("Program created successfully");
      setOpen(false);
      setFormData({
        name: "",
        description: "",
        status: "active",
        sponsor: "",
        budget: "",
        benefits_target: "",
        tranche: "",
        start_date: "",
        end_date: "",
        organization_id: "",
      });
      onSuccess?.();
    } catch (error) {
      console.error("Error creating programme:", error);
      toast.error("Failed to create program");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          New Program
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Program</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="organization">Organization</Label>
              <Select value={formData.organization_id} onValueChange={(v) => setFormData({ ...formData, organization_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select organization (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {organizations.map((org) => (
                    <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="name">Program Name *</Label>
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
            <div>
              <Label htmlFor="status">Status</Label>
              <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="on-hold">On Hold</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="tranche">Tranche</Label>
              <Input
                id="tranche"
                value={formData.tranche}
                onChange={(e) => setFormData({ ...formData, tranche: e.target.value })}
                placeholder="e.g., Tranche 1"
              />
            </div>
            <div>
              <Label htmlFor="sponsor">Sponsor</Label>
              <Input
                id="sponsor"
                value={formData.sponsor}
                onChange={(e) => setFormData({ ...formData, sponsor: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="budget">Budget</Label>
              <Input
                id="budget"
                value={formData.budget}
                onChange={(e) => setFormData({ ...formData, budget: e.target.value })}
                placeholder="e.g., $1.5M"
              />
            </div>
            <div>
              <Label htmlFor="benefits_target">Benefits Target</Label>
              <Input
                id="benefits_target"
                value={formData.benefits_target}
                onChange={(e) => setFormData({ ...formData, benefits_target: e.target.value })}
                placeholder="e.g., $2.5M"
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
              <Label htmlFor="end_date">End Date</Label>
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
              {loading ? "Creating..." : "Create Program"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
