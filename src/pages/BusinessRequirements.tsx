import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  FileText,
  Filter,
  Edit,
  Trash2,
  Building2,
  Briefcase,
  Package,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { toast } from "sonner";

interface BusinessRequirement {
  id: string;
  reference_number: string;
  name: string;
  description: string | null;
  category: string;
  priority: string;
  status: string;
  source: string | null;
  rationale: string | null;
  acceptance_criteria: string | null;
  programme_id: string | null;
  project_id: string | null;
  product_id: string | null;
}

interface Programme { id: string; name: string; }
interface Project { id: string; name: string; programme_id: string | null; }
interface Product { id: string; name: string; programme_id: string | null; }

const categories = ["functional", "non-functional", "regulatory", "business_process", "integration"];
const priorities = ["critical", "high", "medium", "low"];
const statuses = ["draft", "approved", "in_progress", "implemented", "verified", "rejected"];

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  approved: "bg-info/10 text-info",
  in_progress: "bg-warning/10 text-warning",
  implemented: "bg-success/10 text-success",
  verified: "bg-success text-success-foreground",
  rejected: "bg-destructive/10 text-destructive",
};

const defaultFormState = {
  reference_number: "",
  name: "",
  description: "",
  category: "functional",
  priority: "medium",
  status: "draft",
  source: "",
  rationale: "",
  acceptance_criteria: "",
  programme_id: "",
  project_id: "",
  product_id: "",
};

export default function BusinessRequirements() {
  const [requirements, setRequirements] = useState<BusinessRequirement[]>([]);
  const [programmes, setProgrammes] = useState<Programme[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selected, setSelected] = useState<BusinessRequirement | null>(null);
  const [formData, setFormData] = useState(defaultFormState);
  const [filterProgramme, setFilterProgramme] = useState<string>("all");
  const { currentOrganization } = useOrganization();

  const fetchData = async () => {
    setLoading(true);

    let reqQuery = supabase.from("business_requirements").select("*").order("reference_number");
    if (currentOrganization) {
      reqQuery = reqQuery.eq("organization_id", currentOrganization.id);
    }

    let progQuery = supabase.from("programmes").select("id, name").order("name");
    if (currentOrganization) {
      progQuery = progQuery.eq("organization_id", currentOrganization.id);
    }

    let projQuery = supabase.from("projects").select("id, name, programme_id").order("name");
    if (currentOrganization) {
      projQuery = projQuery.eq("organization_id", currentOrganization.id);
    }

    let prodQuery = supabase.from("products").select("id, name, programme_id").order("name");
    if (currentOrganization) {
      prodQuery = prodQuery.eq("organization_id", currentOrganization.id);
    }

    const [reqRes, progRes, projRes, prodRes] = await Promise.all([reqQuery, progQuery, projQuery, prodQuery]);

    setRequirements((reqRes.data as BusinessRequirement[]) || []);
    setProgrammes(progRes.data || []);
    setProjects(projRes.data || []);
    setProducts(prodRes.data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [currentOrganization]);

  const getNextRefNumber = () => {
    const existing = requirements.map(r => {
      const match = r.reference_number.match(/BR-(\d+)/);
      return match ? parseInt(match[1]) : 0;
    });
    const max = Math.max(0, ...existing);
    return `BR-${String(max + 1).padStart(4, "0")}`;
  };

  const handleCreate = async () => {
    if (!formData.name) {
      toast.error("Please fill in required fields");
      return;
    }

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      toast.error("You must be logged in");
      return;
    }

    const { error } = await supabase.from("business_requirements").insert({
      reference_number: formData.reference_number || getNextRefNumber(),
      name: formData.name,
      description: formData.description || null,
      category: formData.category,
      priority: formData.priority,
      status: formData.status,
      source: formData.source || null,
      rationale: formData.rationale || null,
      acceptance_criteria: formData.acceptance_criteria || null,
      programme_id: formData.programme_id || null,
      project_id: formData.project_id || null,
      product_id: formData.product_id || null,
      organization_id: currentOrganization?.id || null,
      created_by: userData.user.id,
    });

    if (error) {
      toast.error("Failed to create requirement");
      return;
    }

    toast.success("Requirement created");
    setIsCreateOpen(false);
    setFormData({ ...defaultFormState, reference_number: getNextRefNumber() });
    fetchData();
  };

  const handleUpdate = async () => {
    if (!selected || !formData.name) {
      toast.error("Please fill in required fields");
      return;
    }

    const { error } = await supabase
      .from("business_requirements")
      .update({
        name: formData.name,
        description: formData.description || null,
        category: formData.category,
        priority: formData.priority,
        status: formData.status,
        source: formData.source || null,
        rationale: formData.rationale || null,
        acceptance_criteria: formData.acceptance_criteria || null,
        programme_id: formData.programme_id || null,
        project_id: formData.project_id || null,
        product_id: formData.product_id || null,
      })
      .eq("id", selected.id);

    if (error) {
      toast.error("Failed to update requirement");
      return;
    }

    toast.success("Requirement updated");
    setIsEditOpen(false);
    setSelected(null);
    setFormData(defaultFormState);
    fetchData();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("business_requirements").delete().eq("id", id);
    if (error) {
      toast.error("Failed to delete requirement");
      return;
    }
    toast.success("Requirement deleted");
    fetchData();
  };

  const openEditDialog = (req: BusinessRequirement) => {
    setSelected(req);
    setFormData({
      reference_number: req.reference_number,
      name: req.name,
      description: req.description || "",
      category: req.category,
      priority: req.priority,
      status: req.status,
      source: req.source || "",
      rationale: req.rationale || "",
      acceptance_criteria: req.acceptance_criteria || "",
      programme_id: req.programme_id || "",
      project_id: req.project_id || "",
      product_id: req.product_id || "",
    });
    setIsEditOpen(true);
  };

  const filteredRequirements = filterProgramme === "all"
    ? requirements
    : requirements.filter(r => r.programme_id === filterProgramme);

  const RequirementForm = ({ isEdit = false }: { isEdit?: boolean }) => (
    <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Reference Number</Label>
          <Input
            value={formData.reference_number}
            onChange={(e) => setFormData({ ...formData, reference_number: e.target.value })}
            placeholder="BR-0001"
            disabled={isEdit}
          />
        </div>
        <div className="space-y-2">
          <Label>Name *</Label>
          <Input
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Requirement name"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Description</Label>
        <Textarea
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Detailed description"
        />
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>Category</Label>
          <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {categories.map(c => <SelectItem key={c} value={c} className="capitalize">{c.replace("_", " ")}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Priority</Label>
          <Select value={formData.priority} onValueChange={(v) => setFormData({ ...formData, priority: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {priorities.map(p => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Status</Label>
          <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {statuses.map(s => <SelectItem key={s} value={s} className="capitalize">{s.replace("_", " ")}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>Programme</Label>
          <Select value={formData.programme_id} onValueChange={(v) => setFormData({ ...formData, programme_id: v })}>
            <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">None</SelectItem>
              {programmes.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Project</Label>
          <Select value={formData.project_id} onValueChange={(v) => setFormData({ ...formData, project_id: v })}>
            <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">None</SelectItem>
              {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Product</Label>
          <Select value={formData.product_id} onValueChange={(v) => setFormData({ ...formData, product_id: v })}>
            <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">None</SelectItem>
              {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-2">
        <Label>Source</Label>
        <Input
          value={formData.source}
          onChange={(e) => setFormData({ ...formData, source: e.target.value })}
          placeholder="Where did this requirement come from?"
        />
      </div>
      <div className="space-y-2">
        <Label>Rationale</Label>
        <Textarea
          value={formData.rationale}
          onChange={(e) => setFormData({ ...formData, rationale: e.target.value })}
          placeholder="Why is this requirement needed?"
          rows={2}
        />
      </div>
      <div className="space-y-2">
        <Label>Acceptance Criteria</Label>
        <Textarea
          value={formData.acceptance_criteria}
          onChange={(e) => setFormData({ ...formData, acceptance_criteria: e.target.value })}
          placeholder="How will we know this is met?"
          rows={2}
        />
      </div>
      <Button onClick={isEdit ? handleUpdate : handleCreate} className="w-full">
        {isEdit ? "Update Requirement" : "Create Requirement"}
      </Button>
    </div>
  );

  return (
    <AppLayout title="Business Requirements" subtitle="MSP Business Requirements Register">
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <div className="metric-card text-center">
            <p className="text-2xl font-bold">{requirements.length}</p>
            <p className="text-sm text-muted-foreground">Total Requirements</p>
          </div>
          <div className="metric-card text-center">
            <p className="text-2xl font-bold text-info">{requirements.filter(r => r.status === "approved").length}</p>
            <p className="text-sm text-muted-foreground">Approved</p>
          </div>
          <div className="metric-card text-center">
            <p className="text-2xl font-bold text-warning">{requirements.filter(r => r.status === "in_progress").length}</p>
            <p className="text-sm text-muted-foreground">In Progress</p>
          </div>
          <div className="metric-card text-center">
            <p className="text-2xl font-bold text-success">{requirements.filter(r => r.status === "verified").length}</p>
            <p className="text-sm text-muted-foreground">Verified</p>
          </div>
        </div>

        {/* Info */}
        <div className="p-4 rounded-lg bg-info/5 border border-info/20">
          <h4 className="font-medium text-sm mb-2 text-info">MSP Business Requirements</h4>
          <p className="text-sm text-muted-foreground">
            Business requirements capture what the organization needs to achieve. They can be linked to programmes,
            projects, and products to ensure traceability throughout the delivery lifecycle.
          </p>
        </div>

        {/* Filters and Actions */}
        <div className="flex justify-between gap-4">
          <Select value={filterProgramme} onValueChange={setFilterProgramme}>
            <SelectTrigger className="w-[250px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Filter by programme" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Programmes</SelectItem>
              {programmes.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>

          <Dialog open={isCreateOpen} onOpenChange={(open) => {
            setIsCreateOpen(open);
            if (open) setFormData({ ...defaultFormState, reference_number: getNextRefNumber() });
          }}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />New Requirement</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create Business Requirement</DialogTitle>
              </DialogHeader>
              <RequirementForm />
            </DialogContent>
          </Dialog>
        </div>

        {/* Edit Dialog */}
        <Dialog open={isEditOpen} onOpenChange={(open) => {
          setIsEditOpen(open);
          if (!open) { setSelected(null); setFormData(defaultFormState); }
        }}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit Business Requirement</DialogTitle>
            </DialogHeader>
            <RequirementForm isEdit />
          </DialogContent>
        </Dialog>

        {/* Table */}
        <div className="metric-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reference</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Links</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8">Loading...</TableCell></TableRow>
              ) : filteredRequirements.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    <FileText className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-muted-foreground">No requirements found</p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredRequirements.map(req => (
                  <TableRow key={req.id}>
                    <TableCell className="font-mono text-sm">{req.reference_number}</TableCell>
                    <TableCell className="font-medium">{req.name}</TableCell>
                    <TableCell className="capitalize">{req.category.replace("_", " ")}</TableCell>
                    <TableCell>
                      <Badge variant={req.priority === "critical" ? "destructive" : req.priority === "high" ? "default" : "secondary"} className="capitalize">
                        {req.priority}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={statusColors[req.status] || "bg-muted"}>
                        {req.status.replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {req.programme_id && <Building2 className="h-4 w-4 text-muted-foreground" />}
                        {req.project_id && <Briefcase className="h-4 w-4 text-muted-foreground" />}
                        {req.product_id && <Package className="h-4 w-4 text-muted-foreground" />}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEditDialog(req)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(req.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </AppLayout>
  );
}
