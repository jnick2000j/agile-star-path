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

interface CreateProductDialogProps {
  onSuccess?: () => void;
}

interface Organization {
  id: string;
  name: string;
}

interface Programme {
  id: string;
  name: string;
}

export function CreateProductDialog({ onSuccess }: CreateProductDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [programmes, setProgrammes] = useState<Programme[]>([]);
  const { user } = useAuth();

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    organization_id: "",
    programme_id: "",
    stage: "discovery",
    product_type: "digital",
    status: "concept",
    vision: "",
    value_proposition: "",
    target_market: "",
    primary_metric: "",
    revenue_target: "",
    launch_date: "",
  });

  useEffect(() => {
    const fetchData = async () => {
      const [orgsRes, progsRes] = await Promise.all([
        supabase.from("organizations").select("id, name").order("name"),
        supabase.from("programmes").select("id, name").order("name"),
      ]);
      if (orgsRes.data) setOrganizations(orgsRes.data);
      if (progsRes.data) setProgrammes(progsRes.data);
    };
    if (open) fetchData();
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    try {
      const { error } = await supabase.from("products").insert({
        ...formData,
        organization_id: formData.organization_id || null,
        programme_id: formData.programme_id || null,
        launch_date: formData.launch_date || null,
        created_by: user.id,
        product_owner_id: user.id,
      });

      if (error) throw error;

      toast.success("Product created successfully");
      setOpen(false);
      setFormData({
        name: "",
        description: "",
        organization_id: "",
        programme_id: "",
        stage: "discovery",
        product_type: "digital",
        status: "concept",
        vision: "",
        value_proposition: "",
        target_market: "",
        primary_metric: "",
        revenue_target: "",
        launch_date: "",
      });
      onSuccess?.();
    } catch (error) {
      console.error("Error creating product:", error);
      toast.error("Failed to create product");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          New Product
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Product</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="name">Product Name *</Label>
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
                rows={2}
              />
            </div>
            <div>
              <Label htmlFor="organization">Organization</Label>
              <Select value={formData.organization_id} onValueChange={(v) => setFormData({ ...formData, organization_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select organization" />
                </SelectTrigger>
                <SelectContent>
                  {organizations.map((org) => (
                    <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="program">Related Program</Label>
              <Select value={formData.programme_id} onValueChange={(v) => setFormData({ ...formData, programme_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select program" />
                </SelectTrigger>
                <SelectContent>
                  {programmes.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="stage">Lifecycle Stage</Label>
              <Select value={formData.stage} onValueChange={(v) => setFormData({ ...formData, stage: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="discovery">Discovery</SelectItem>
                  <SelectItem value="definition">Definition</SelectItem>
                  <SelectItem value="development">Development</SelectItem>
                  <SelectItem value="launch">Launch</SelectItem>
                  <SelectItem value="growth">Growth</SelectItem>
                  <SelectItem value="maturity">Maturity</SelectItem>
                  <SelectItem value="decline">Decline</SelectItem>
                  <SelectItem value="retired">Retired</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="product_type">Product Type</Label>
              <Select value={formData.product_type} onValueChange={(v) => setFormData({ ...formData, product_type: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="digital">Digital</SelectItem>
                  <SelectItem value="physical">Physical</SelectItem>
                  <SelectItem value="service">Service</SelectItem>
                  <SelectItem value="platform">Platform</SelectItem>
                  <SelectItem value="hybrid">Hybrid</SelectItem>
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
                  <SelectItem value="concept">Concept</SelectItem>
                  <SelectItem value="in_development">In Development</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="on_hold">On Hold</SelectItem>
                  <SelectItem value="deprecated">Deprecated</SelectItem>
                  <SelectItem value="retired">Retired</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="launch_date">Target Launch Date</Label>
              <Input
                id="launch_date"
                type="date"
                value={formData.launch_date}
                onChange={(e) => setFormData({ ...formData, launch_date: e.target.value })}
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="vision">Product Vision</Label>
              <Textarea
                id="vision"
                value={formData.vision}
                onChange={(e) => setFormData({ ...formData, vision: e.target.value })}
                placeholder="What is the long-term vision for this product?"
                rows={2}
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="value_proposition">Value Proposition</Label>
              <Textarea
                id="value_proposition"
                value={formData.value_proposition}
                onChange={(e) => setFormData({ ...formData, value_proposition: e.target.value })}
                placeholder="What unique value does this product provide?"
                rows={2}
              />
            </div>
            <div>
              <Label htmlFor="target_market">Target Market</Label>
              <Input
                id="target_market"
                value={formData.target_market}
                onChange={(e) => setFormData({ ...formData, target_market: e.target.value })}
                placeholder="e.g., Enterprise B2B"
              />
            </div>
            <div>
              <Label htmlFor="primary_metric">Primary Success Metric (North Star)</Label>
              <Input
                id="primary_metric"
                value={formData.primary_metric}
                onChange={(e) => setFormData({ ...formData, primary_metric: e.target.value })}
                placeholder="e.g., Monthly Active Users"
              />
            </div>
            <div>
              <Label htmlFor="revenue_target">Revenue Target</Label>
              <Input
                id="revenue_target"
                value={formData.revenue_target}
                onChange={(e) => setFormData({ ...formData, revenue_target: e.target.value })}
                placeholder="e.g., $1M ARR"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Creating..." : "Create Product"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
