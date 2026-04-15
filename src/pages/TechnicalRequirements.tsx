import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Cpu,
  Filter,
  Edit,
  Trash2,
  Building2,
  Briefcase,
  Package,
  Link2,
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

interface TechnicalRequirement {
  id: string;
  reference_number: string;
  name: string;
  description: string | null;
  category: string;
  priority: string;
  status: string;
  technical_specification: string | null;
  acceptance_criteria: string | null;
  dependencies: string | null;
  programme_id: string | null;
  project_id: string | null;
  product_id: string | null;
  business_requirement_id: string | null;
}

interface BusinessRequirement { id: string; reference_number: string; name: string; }
interface Program { id: string; name: string; }
interface Project { id: string; name: string; }
interface Product { id: string; name: string; }

const categories = ["architecture", "infrastructure", "security", "integration", "performance", "data", "interface"];
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
  category: "architecture",
  priority: "medium",
  status: "draft",
  technical_specification: "",
  acceptance_criteria: "",
  dependencies: "",
  programme_id: "",
  project_id: "",
  product_id: "",
  business_requirement_id: "",
};

export default function TechnicalRequirements() {
  const [requirements, setRequirements] = useState<TechnicalRequirement[]>([]);
  const [businessReqs, setBusinessReqs] = useState<BusinessRequirement[]>([]);
  const [programmes, setProgrammes] = useState<Program[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selected, setSelected] = useState<TechnicalRequirement | null>(null);
  const [formData, setFormData] = useState(defaultFormState);
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const { currentOrganization } = useOrganization();

  const fetchData = async () => {
    setLoading(true);

    let reqQuery = supabase.from("technical_requirements").select("*").order("reference_number");
    if (currentOrganization) reqQuery = reqQuery.eq("organization_id", currentOrganization.id);

    let brQuery = supabase.from("business_requirements").select("id, reference_number, name").order("reference_number");
    if (currentOrganization) brQuery = brQuery.eq("organization_id", currentOrganization.id);

    let progQuery = supabase.from("programmes").select("id, name").order("name");
    if (currentOrganization) progQuery = progQuery.eq("organization_id", currentOrganization.id);

    let projQuery = supabase.from("projects").select("id, name").order("name");
    if (currentOrganization) projQuery = projQuery.eq("organization_id", currentOrganization.id);

    let prodQuery = supabase.from("products").select("id, name").order("name");
    if (currentOrganization) prodQuery = prodQuery.eq("organization_id", currentOrganization.id);

    const [reqRes, brRes, progRes, projRes, prodRes] = await Promise.all([reqQuery, brQuery, progQuery, projQuery, prodQuery]);

    setRequirements((reqRes.data as TechnicalRequirement[]) || []);
    setBusinessReqs(brRes.data || []);
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
      const match = r.reference_number.match(/TR-(\d+)/);
      return match ? parseInt(match[1]) : 0;
    });
    const max = Math.max(0, ...existing);
    return `TR-${String(max + 1).padStart(4, "0")}`;
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

    const { error } = await supabase.from("technical_requirements").insert({
      reference_number: formData.reference_number || getNextRefNumber(),
      name: formData.name,
      description: formData.description || null,
      category: formData.category,
      priority: formData.priority,
      status: formData.status,
      technical_specification: formData.technical_specification || null,
      acceptance_criteria: formData.acceptance_criteria || null,
      dependencies: formData.dependencies || null,
      programme_id: formData.programme_id || null,
      project_id: formData.project_id || null,
      product_id: formData.product_id || null,
      business_requirement_id: formData.business_requirement_id || null,
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
      .from("technical_requirements")
      .update({
        name: formData.name,
        description: formData.description || null,
        category: formData.category,
        priority: formData.priority,
        status: formData.status,
        technical_specification: formData.technical_specification || null,
        acceptance_criteria: formData.acceptance_criteria || null,
        dependencies: formData.dependencies || null,
        programme_id: formData.programme_id || null,
        project_id: formData.project_id || null,
        product_id: formData.product_id || null,
        business_requirement_id: formData.business_requirement_id || null,
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
    const { error } = await supabase.from("technical_requirements").delete().eq("id", id);
    if (error) {
      toast.error("Failed to delete requirement");
      return;
    }
    toast.success("Requirement deleted");
    fetchData();
  };

  const openEditDialog = (req: TechnicalRequirement) => {
    setSelected(req);
    setFormData({
      reference_number: req.reference_number,
      name: req.name,
      description: req.description || "",
      category: req.category,
      priority: req.priority,
      status: req.status,
      technical_specification: req.technical_specification || "",
      acceptance_criteria: req.acceptance_criteria || "",
      dependencies: req.dependencies || "",
      programme_id: req.programme_id || "",
      project_id: req.project_id || "",
      product_id: req.product_id || "",
      business_requirement_id: req.business_requirement_id || "",
    });
    setIsEditOpen(true);
  };

  const filteredRequirements = filterCategory === "all"
    ? requirements
    : requirements.filter(r => r.category === filterCategory);

  const getBusinessReqRef = (id: string | null) => {
    if (!id) return null;
    return businessReqs.find(br => br.id === id)?.reference_number;
  };

  const RequirementForm = ({ isEdit = false }: { isEdit?: boolean }) => (
    <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Reference Number</Label>
          <Input
            value={formData.reference_number}
            onChange={(e) => setFormData({ ...formData, reference_number: e.target.value })}
            placeholder="TR-0001"
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
              {categories.map(c => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}
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
      <div className="space-y-2">
        <Label>Linked Business Requirement</Label>
        <Select value={formData.business_requirement_id || "none"} onValueChange={(v) => setFormData({ ...formData, business_requirement_id: v === "none" ? "" : v })}>
          <SelectTrigger><SelectValue placeholder="Select business requirement" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            {businessReqs.map(br => <SelectItem key={br.id} value={br.id}>{br.reference_number}: {br.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>Program</Label>
          <Select value={formData.programme_id || "none"} onValueChange={(v) => setFormData({ ...formData, programme_id: v === "none" ? "" : v })}>
            <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              {programmes.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Project</Label>
          <Select value={formData.project_id || "none"} onValueChange={(v) => setFormData({ ...formData, project_id: v === "none" ? "" : v })}>
            <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Product</Label>
          <Select value={formData.product_id || "none"} onValueChange={(v) => setFormData({ ...formData, product_id: v === "none" ? "" : v })}>
            <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-2">
        <Label>Technical Specification</Label>
        <Textarea
          value={formData.technical_specification}
          onChange={(e) => setFormData({ ...formData, technical_specification: e.target.value })}
          placeholder="Technical details and specifications"
          rows={3}
        />
      </div>
      <div className="space-y-2">
        <Label>Acceptance Criteria</Label>
        <Textarea
          value={formData.acceptance_criteria}
          onChange={(e) => setFormData({ ...formData, acceptance_criteria: e.target.value })}
          placeholder="How will we verify this is met?"
          rows={2}
        />
      </div>
      <div className="space-y-2">
        <Label>Dependencies</Label>
        <Textarea
          value={formData.dependencies}
          onChange={(e) => setFormData({ ...formData, dependencies: e.target.value })}
          placeholder="Other requirements or systems this depends on"
          rows={2}
        />
      </div>
      <Button onClick={isEdit ? handleUpdate : handleCreate} className="w-full">
        {isEdit ? "Update Requirement" : "Create Requirement"}
      </Button>
    </div>
  );

  return (
    <AppLayout title="Technical Requirements" subtitle="MSP Technical Requirements Register">
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <div className="metric-card text-center">
            <p className="text-2xl font-bold">{requirements.length}</p>
            <p className="text-sm text-muted-foreground">Total Requirements</p>
          </div>
          <div className="metric-card text-center">
            <p className="text-2xl font-bold text-info">{requirements.filter(r => r.business_requirement_id).length}</p>
            <p className="text-sm text-muted-foreground">Linked to Business</p>
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
          <h4 className="font-medium text-sm mb-2 text-info">MSP Technical Requirements</h4>
          <p className="text-sm text-muted-foreground">
            Technical requirements define how business needs will be met through technical solutions.
            They can be linked to business requirements for full traceability.
          </p>
        </div>

        {/* Filters and Actions */}
        <div className="flex justify-between gap-4">
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-[200px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Filter by category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map(c => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}
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
                <DialogTitle>Create Technical Requirement</DialogTitle>
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
              <DialogTitle>Edit Technical Requirement</DialogTitle>
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
                    <Cpu className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-muted-foreground">No requirements found</p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredRequirements.map(req => (
                  <TableRow key={req.id}>
                    <TableCell className="font-mono text-sm">{req.reference_number}</TableCell>
                    <TableCell className="font-medium">{req.name}</TableCell>
                    <TableCell className="capitalize">{req.category}</TableCell>
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
                        {req.business_requirement_id && (
                          <Badge variant="outline" className="text-xs">
                            <Link2 className="h-3 w-3 mr-1" />
                            {getBusinessReqRef(req.business_requirement_id)}
                          </Badge>
                        )}
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
