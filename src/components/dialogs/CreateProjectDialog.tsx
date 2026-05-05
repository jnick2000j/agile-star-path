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
  const [teamMembers, setTeamMembers] = useState<{ user_id: string; full_name: string | null; email: string }[]>([]);

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
    sponsor: "",
    start_date: "",
    end_date: "",
  });

  useEffect(() => {
    const fetchData = async () => {
      const [progsRes, orgsRes, membersRes] = await Promise.all([
        supabase.from("programmes").select("id, name, organization_id"),
        supabase.from("organizations").select("id, name").order("name"),
        supabase.from("profiles").select("user_id, full_name, email").eq("archived", false),
      ]);
      if (progsRes.data) setProgrammes(progsRes.data);
      if (orgsRes.data) setOrganizations(orgsRes.data);
      if (membersRes.data) setTeamMembers(membersRes.data);
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
        sponsor: formData.sponsor || null,
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
        sponsor: "",
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
                  {isConstruction && <SelectItem value="Construction">Construction</SelectItem>}
                </SelectContent>
              </Select>
            </div>
            {isConstruction && (
              <div>
                <Label htmlFor="project_kind">Project Type</Label>
                <Select value={formData.project_kind} onValueChange={(v) => setFormData({ ...formData, project_kind: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standard">Standard</SelectItem>
                    <SelectItem value="pursuit">Pursuit / Capture</SelectItem>
                    <SelectItem value="bid">Live Bid</SelectItem>
                    <SelectItem value="preconstruction">Preconstruction</SelectItem>
                    <SelectItem value="construction">Construction Delivery</SelectItem>
                    <SelectItem value="closeout">Closeout / DLP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            {isConstruction && formData.project_kind !== "standard" && (
              <>
                <div>
                  <Label htmlFor="client_name">Client / Owner</Label>
                  <Input
                    id="client_name"
                    value={formData.client_name}
                    onChange={(e) => setFormData({ ...formData, client_name: e.target.value })}
                    placeholder="e.g. Acme Developments"
                  />
                </div>
                <div>
                  <Label htmlFor="contract_form">Contract Form</Label>
                  <Select value={formData.contract_form || "none"} onValueChange={(v) => setFormData({ ...formData, contract_form: v === "none" ? "" : v })}>
                    <SelectTrigger><SelectValue placeholder="Select form" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Not selected</SelectItem>
                      <SelectItem value="nec4_eccs_optionA">NEC4 ECC Option A</SelectItem>
                      <SelectItem value="nec4_eccs_optionC">NEC4 ECC Option C</SelectItem>
                      <SelectItem value="jct_d_and_b_2024">JCT D&B 2024</SelectItem>
                      <SelectItem value="jct_standard_2024">JCT Standard 2024</SelectItem>
                      <SelectItem value="fidic_red_book">FIDIC Red Book</SelectItem>
                      <SelectItem value="fidic_yellow_book">FIDIC Yellow Book</SelectItem>
                      <SelectItem value="aia_a101">AIA A101</SelectItem>
                      <SelectItem value="aia_a102_cm_at_risk">AIA A102 CM-at-Risk</SelectItem>
                      <SelectItem value="consensusdocs_500">ConsensusDocs 500</SelectItem>
                      <SelectItem value="bespoke">Bespoke</SelectItem>
                      <SelectItem value="framework_call_off">Framework Call-off</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="contract_value">Contract Value</Label>
                  <Input
                    id="contract_value"
                    type="number"
                    value={formData.contract_value}
                    onChange={(e) => setFormData({ ...formData, contract_value: e.target.value })}
                    placeholder="0"
                  />
                </div>
                <div>
                  <Label htmlFor="contract_currency">Currency</Label>
                  <Select value={formData.contract_currency} onValueChange={(v) => setFormData({ ...formData, contract_currency: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="GBP">GBP</SelectItem>
                      <SelectItem value="EUR">EUR</SelectItem>
                      <SelectItem value="AUD">AUD</SelectItem>
                      <SelectItem value="CAD">CAD</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
            <div>
              <Label htmlFor="sponsor">Sponsor</Label>
              <Select value={formData.sponsor || "none"} onValueChange={(v) => setFormData({ ...formData, sponsor: v === "none" ? "" : v })}>
                <SelectTrigger id="sponsor"><SelectValue placeholder="Select sponsor" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Unassigned</SelectItem>
                  {teamMembers.map((m) => (
                    <SelectItem key={m.user_id} value={m.user_id}>{m.full_name || m.email}</SelectItem>
                  ))}
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
