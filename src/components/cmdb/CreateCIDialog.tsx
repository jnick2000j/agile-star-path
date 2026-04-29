import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface CreateCIDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated?: (ciId: string) => void;
}

export function CreateCIDialog({ open, onOpenChange, onCreated }: CreateCIDialogProps) {
  const { currentOrganization } = useOrganization();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [ciTypeId, setCiTypeId] = useState<string>("");
  const [environment, setEnvironment] = useState<string>("production");
  const [criticality, setCriticality] = useState<string>("medium");
  const [businessService, setBusinessService] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [saving, setSaving] = useState(false);

  const { data: types = [] } = useQuery({
    queryKey: ["ci-types"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cmdb_ci_types")
        .select("id, key, label, category")
        .order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });

  const reset = () => {
    setName(""); setDescription(""); setCiTypeId(""); setEnvironment("production");
    setCriticality("medium"); setBusinessService(""); setIsPublic(false);
  };

  const handleCreate = async () => {
    if (!currentOrganization?.id || !name.trim() || !ciTypeId) {
      toast.error("Name and type are required");
      return;
    }
    setSaving(true);
    const { data, error } = await supabase
      .from("configuration_items")
      .insert({
        organization_id: currentOrganization.id,
        name: name.trim(),
        description: description.trim() || null,
        ci_type_id: ciTypeId,
        environment,
        criticality,
        business_service: businessService.trim() || null,
        is_public_facing: isPublic,
        created_by: user?.id ?? null,
      })
      .select("id")
      .single();
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Configuration item created");
    qc.invalidateQueries({ queryKey: ["cis"] });
    qc.invalidateQueries({ queryKey: ["ci-picker"] });
    reset();
    onOpenChange(false);
    onCreated?.(data.id);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New configuration item</DialogTitle>
          <DialogDescription>Track a service, system, or asset in your CMDB.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Name *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Customer API" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Type *</Label>
              <Select value={ciTypeId} onValueChange={setCiTypeId}>
                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  {types.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Environment</Label>
              <Select value={environment} onValueChange={setEnvironment}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="production">Production</SelectItem>
                  <SelectItem value="staging">Staging</SelectItem>
                  <SelectItem value="development">Development</SelectItem>
                  <SelectItem value="test">Test</SelectItem>
                  <SelectItem value="dr">DR</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Criticality</Label>
              <Select value={criticality} onValueChange={setCriticality}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Business service</Label>
              <Input value={businessService} onChange={(e) => setBusinessService(e.target.value)} placeholder="Optional" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
            Public-facing (show on public status page)
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={handleCreate} disabled={saving}>{saving ? "Creating…" : "Create"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
