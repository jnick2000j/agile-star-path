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
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { useVertical } from "@/hooks/useVertical";
import { UpgradePrompt } from "@/components/UpgradePrompt";
import { toast } from "sonner";
import { dispatchAutomation } from "@/lib/automations";

interface CreateProjectDialogProps {
  onSuccess?: () => void;
}

interface Organization {
  id: string;
  name: string;
}

export function CreateProjectDialog({ onSuccess }: CreateProjectDialogProps) {
  const [open, setOpen] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const { currentOrganization } = useOrganization();
  const { canCreate, limits } = usePlanLimits();
  const { hasModule } = useVertical();
  const isConstruction = hasModule("rfis");
  const [programmes, setProgrammes] = useState<{ id: string; name: string }[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);

  const handleOpen = (newOpen: boolean) => {
    if (newOpen && !canCreate("projects")) {
      setShowUpgrade(true);
      return;
    }
    setOpen(newOpen);
  };

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    programme_id: "",
    organization_id: "",
    stage: "initiating",
    priority: "medium",
    health: "green",
    methodology: "PRINCE2",
    project_kind: "standard",
    client_name: "",
    contract_value: "",
    contract_currency: "USD",
    contract_form: "",
    start_date: "",
    end_date: "",
  });

  useEffect(() => {
    const fetchData = async () => {
      const [progsRes, orgsRes] = await Promise.all([
        supabase.from("programmes").select("id, name, organization_id"),
        supabase.from("organizations").select("id, name").order("name"),
      ]);
      if (progsRes.data) setProgrammes(progsRes.data);
      if (orgsRes.data) setOrganizations(orgsRes.data);
    };
    if (open) fetchData();
  }, [open]);

  // Pre-fill organization with the current active organization when dialog opens
  useEffect(() => {
    if (open && currentOrganization?.id && !formData.organization_id) {
      setFormData((f) => ({ ...f, organization_id: currentOrganization.id }));
    }
  }, [open, currentOrganization?.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!formData.organization_id) {
      toast.error("Please select an organization");
      return;
    }

    setLoading(true);
    try {
      const { data: created, error } = await supabase.from("projects").insert({
        name: formData.name,
        description: formData.description || null,
        stage: formData.stage,
        priority: formData.priority,
        health: formData.health,
        methodology: formData.methodology,
        project_kind: formData.project_kind,
        client_name: formData.client_name || null,
        contract_value: formData.contract_value ? Number(formData.contract_value) : null,
        contract_currency: formData.contract_currency || null,
        contract_form: formData.contract_form || null,
        programme_id: formData.programme_id || null,
        organization_id: formData.organization_id,
        start_date: formData.start_date || null,
        end_date: formData.end_date || null,
        created_by: user.id,
        manager_id: user.id,
      }).select("id, organization_id").single();

      if (error) throw error;

      if (created?.organization_id) {
        dispatchAutomation({
          organization_id: created.organization_id,
          module: "project",
          trigger_event: "created",
          entity_type: "project",
          entity_id: created.id,
          payload: { ...formData },
          triggered_by: user.id,
        });
      }

      toast.success("Project created successfully");
      setOpen(false);
      setFormData({
        name: "",
        description: "",
        programme_id: "",
        organization_id: "",
        stage: "initiating",
        priority: "medium",
        health: "green",
        methodology: "PRINCE2",
        project_kind: "standard",
        client_name: "",
        contract_value: "",
        contract_currency: "USD",
        contract_form: "",
        start_date: "",
        end_date: "",
      });
      onSuccess?.();
    } catch (error) {
      console.error("Error creating project:", error);
      toast.error("Failed to create project");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          New Project
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Project</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="name">Project Name *</Label>
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
              <Label htmlFor="organization">Organization *</Label>
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
              <Label htmlFor="program">Program</Label>
              <Select value={formData.programme_id || "none"} onValueChange={(v) => setFormData({ ...formData, programme_id: v === "none" ? "" : v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select program" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {programmes
                    .filter((p: any) => !formData.organization_id || p.organization_id === formData.organization_id || !p.organization_id)
                    .map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="stage">Stage</Label>
              <Select value={formData.stage} onValueChange={(v) => setFormData({ ...formData, stage: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="initiating">Initiating</SelectItem>
                  <SelectItem value="planning">Planning</SelectItem>
                  <SelectItem value="executing">Executing</SelectItem>
                  <SelectItem value="closing">Closing</SelectItem>
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
              <Label htmlFor="health">Health</Label>
              <Select value={formData.health} onValueChange={(v) => setFormData({ ...formData, health: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="green">Green</SelectItem>
                  <SelectItem value="amber">Amber</SelectItem>
                  <SelectItem value="red">Red</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="methodology">Methodology</Label>
              <Select value={formData.methodology} onValueChange={(v) => setFormData({ ...formData, methodology: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PRINCE2">PRINCE2</SelectItem>
                  <SelectItem value="Agile">Agile</SelectItem>
                  <SelectItem value="Hybrid">Hybrid</SelectItem>
                  <SelectItem value="Waterfall">Waterfall</SelectItem>
                </SelectContent>
              </Select>
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
              {loading ? "Creating..." : "Create Project"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
    <UpgradePrompt
      open={showUpgrade}
      onOpenChange={setShowUpgrade}
      resource="project"
      currentPlan={limits?.planName}
      limit={limits?.maxProjects}
    />
    </>
  );
}
