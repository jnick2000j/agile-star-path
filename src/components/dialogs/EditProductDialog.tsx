import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { toast } from "sonner";

interface Product {
  id: string;
  name: string;
  description: string | null;
  stage: string;
  product_type: string;
  status: string;
  vision: string | null;
  value_proposition: string | null;
  target_market: string | null;
  primary_metric: string | null;
  launch_date: string | null;
  revenue_target: string | null;
  organization_id: string | null;
  programme_id?: string | null;
  project_id?: string | null;
  product_owner_id?: string | null;
}

interface EditProductDialogProps {
  product: Product;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function EditProductDialog({ product, open, onOpenChange, onSuccess }: EditProductDialogProps) {
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { user } = useAuth();
  const { isAdmin, canManage } = usePermissions();
  const [organizations, setOrganizations] = useState<{ id: string; name: string }[]>([]);
  const [programmes, setProgrammes] = useState<{ id: string; name: string }[]>([]);
  const [projects, setProjects] = useState<{ id: string; name: string; programme_id: string | null }[]>([]);
  const [teamMembers, setTeamMembers] = useState<{ user_id: string; full_name: string | null; email: string }[]>([]);

  const [formData, setFormData] = useState({
    name: product.name,
    description: product.description || "",
    organization_id: product.organization_id || "",
    programme_id: product.programme_id || "",
    project_id: product.project_id || "",
    stage: product.stage,
    product_type: product.product_type,
    status: product.status,
    vision: product.vision || "",
    value_proposition: product.value_proposition || "",
    target_market: product.target_market || "",
    primary_metric: product.primary_metric || "",
    revenue_target: product.revenue_target || "",
    launch_date: product.launch_date || "",
    product_owner_id: product.product_owner_id || "",
  });

  useEffect(() => {
    if (open) {
      setFormData({
        name: product.name,
        description: product.description || "",
        organization_id: product.organization_id || "",
        programme_id: product.programme_id || "",
        project_id: product.project_id || "",
        stage: product.stage,
        product_type: product.product_type,
        status: product.status,
        vision: product.vision || "",
        value_proposition: product.value_proposition || "",
        target_market: product.target_market || "",
        primary_metric: product.primary_metric || "",
        revenue_target: product.revenue_target || "",
        launch_date: product.launch_date || "",
        product_owner_id: product.product_owner_id || "",
      });
      Promise.all([
        supabase.from("organizations").select("id, name").order("name"),
        supabase.from("programmes").select("id, name").order("name"),
        supabase.from("projects").select("id, name, programme_id").order("name"),
        supabase.from("profiles").select("user_id, full_name, email").eq("archived", false),
      ]).then(([orgsRes, progsRes, projsRes, membersRes]) => {
        if (orgsRes.data) setOrganizations(orgsRes.data);
        if (progsRes.data) setProgrammes(progsRes.data);
        if (projsRes.data) setProjects(projsRes.data);
        if (membersRes.data) setTeamMembers(membersRes.data);
      });
    }
  }, [open, product]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from("products")
        .update({
          name: formData.name,
          description: formData.description || null,
          organization_id: formData.organization_id || null,
          programme_id: formData.programme_id || null,
          project_id: formData.project_id || null,
          stage: formData.stage,
          product_type: formData.product_type,
          status: formData.status,
          vision: formData.vision || null,
          value_proposition: formData.value_proposition || null,
          target_market: formData.target_market || null,
          primary_metric: formData.primary_metric || null,
          revenue_target: formData.revenue_target || null,
          launch_date: formData.launch_date || null,
          product_owner_id: formData.product_owner_id || null,
        })
        .eq("id", product.id);
      if (error) throw error;
      toast.success("Product updated successfully");
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error("Error updating product:", error);
      toast.error("Failed to update product");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!isAdmin) {
      toast.error("Only administrators can delete products");
      return;
    }
    setDeleting(true);
    try {
      const { error } = await supabase.from("products").delete().eq("id", product.id);
      if (error) throw error;
      toast.success("Product deleted successfully");
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error("Error deleting product:", error);
      toast.error("Failed to delete product");
    } finally {
      setDeleting(false);
    }
  };

  const canEdit = canManage("products");
  const filteredProjects = projects.filter(
    (p) => !formData.programme_id || p.programme_id === formData.programme_id || !p.programme_id
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Product</DialogTitle>
          <DialogDescription>Update product details and link to an organization, program, or project.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label>Product Name *</Label>
              <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required disabled={!canEdit} />
            </div>
            <div className="sm:col-span-2">
              <Label>Description</Label>
              <Textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} rows={2} disabled={!canEdit} />
            </div>
            <div>
              <Label>Organization</Label>
              <Select value={formData.organization_id || "none"} onValueChange={(v) => setFormData({ ...formData, organization_id: v === "none" ? "" : v })} disabled={!canEdit}>
                <SelectTrigger><SelectValue placeholder="Select organization" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {organizations.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Related Program</Label>
              <Select value={formData.programme_id || "none"} onValueChange={(v) => setFormData({ ...formData, programme_id: v === "none" ? "" : v, project_id: "" })} disabled={!canEdit}>
                <SelectTrigger><SelectValue placeholder="Select program" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {programmes.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Related Project</Label>
              <Select value={formData.project_id || "none"} onValueChange={(v) => setFormData({ ...formData, project_id: v === "none" ? "" : v })} disabled={!canEdit}>
                <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {filteredProjects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Product Owner</Label>
              <Select value={formData.product_owner_id || "none"} onValueChange={(v) => setFormData({ ...formData, product_owner_id: v === "none" ? "" : v })} disabled={!canEdit}>
                <SelectTrigger><SelectValue placeholder="Select owner" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Unassigned</SelectItem>
                  {teamMembers.map((m) => <SelectItem key={m.user_id} value={m.user_id}>{m.full_name || m.email}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Stage</Label>
              <Select value={formData.stage} onValueChange={(v) => setFormData({ ...formData, stage: v })} disabled={!canEdit}>
                <SelectTrigger><SelectValue /></SelectTrigger>
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
              <Label>Type</Label>
              <Select value={formData.product_type} onValueChange={(v) => setFormData({ ...formData, product_type: v })} disabled={!canEdit}>
                <SelectTrigger><SelectValue /></SelectTrigger>
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
              <Label>Status</Label>
              <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })} disabled={!canEdit}>
                <SelectTrigger><SelectValue /></SelectTrigger>
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
              <Label>Launch Date</Label>
              <Input type="date" value={formData.launch_date} onChange={(e) => setFormData({ ...formData, launch_date: e.target.value })} disabled={!canEdit} />
            </div>
            <div className="sm:col-span-2">
              <Label>Vision</Label>
              <Textarea value={formData.vision} onChange={(e) => setFormData({ ...formData, vision: e.target.value })} rows={2} disabled={!canEdit} />
            </div>
            <div className="sm:col-span-2">
              <Label>Value Proposition</Label>
              <Textarea value={formData.value_proposition} onChange={(e) => setFormData({ ...formData, value_proposition: e.target.value })} rows={2} disabled={!canEdit} />
            </div>
            <div>
              <Label>Target Market</Label>
              <Input value={formData.target_market} onChange={(e) => setFormData({ ...formData, target_market: e.target.value })} disabled={!canEdit} />
            </div>
            <div>
              <Label>Primary Metric</Label>
              <Input value={formData.primary_metric} onChange={(e) => setFormData({ ...formData, primary_metric: e.target.value })} disabled={!canEdit} />
            </div>
            <div>
              <Label>Revenue Target</Label>
              <Input value={formData.revenue_target} onChange={(e) => setFormData({ ...formData, revenue_target: e.target.value })} disabled={!canEdit} />
            </div>
          </div>
          <div className="flex justify-between pt-4">
            {isAdmin && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button type="button" variant="destructive" className="gap-2">
                    <Trash2 className="h-4 w-4" /> Delete Product
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Product</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete "{product.name}"? This cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} disabled={deleting}>
                      {deleting ? "Deleting..." : "Delete"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            <div className="flex gap-2 ml-auto">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              {canEdit && <Button type="submit" disabled={loading}>{loading ? "Saving..." : "Save Changes"}</Button>}
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
