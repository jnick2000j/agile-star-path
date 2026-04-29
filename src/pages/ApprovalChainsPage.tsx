import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, ShieldCheck, Edit, GripVertical } from "lucide-react";
import { toast } from "sonner";

interface ChainForm {
  id?: string;
  name: string;
  description: string;
  is_active: boolean;
  trigger_ticket_type: string;
  trigger_category: string;
  trigger_priority: string;
  mode: "sequential" | "parallel";
  required_approvals: number;
  priority: number;
}

interface StepForm {
  id?: string;
  step_order: number;
  name: string;
  approver_type: "user" | "role" | "reporter_manager";
  approver_user_id: string | null;
  approver_role: string | null;
  is_optional: boolean;
}

const empty: ChainForm = {
  name: "",
  description: "",
  is_active: true,
  trigger_ticket_type: "",
  trigger_category: "",
  trigger_priority: "",
  mode: "sequential",
  required_approvals: 0,
  priority: 100,
};

export default function ApprovalChainsPage() {
  const { user } = useAuth();
  const { currentOrganization } = useOrganization();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<ChainForm | null>(null);
  const [steps, setSteps] = useState<StepForm[]>([]);

  const orgId = currentOrganization?.id;

  const { data: chains = [] } = useQuery({
    queryKey: ["approval-chains", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data: chainData } = await supabase
        .from("helpdesk_approval_chains")
        .select("*")
        .eq("organization_id", orgId!)
        .order("priority", { ascending: true });
      const ids = (chainData ?? []).map((c) => c.id);
      const { data: stepData } = ids.length
        ? await supabase
            .from("helpdesk_approval_chain_steps")
            .select("*")
            .in("chain_id", ids)
        : { data: [] as any[] };
      return (chainData ?? []).map((c) => ({
        ...c,
        helpdesk_approval_chain_steps: (stepData ?? []).filter((s: any) => s.chain_id === c.id),
      }));
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["org-profiles-min", orgId],
    enabled: !!orgId,
    queryFn: async (): Promise<any[]> => {
      const { data } = await (supabase as any)
        .from("profiles")
        .select("id, first_name, last_name, email")
        .eq("organization_id", orgId!)
        .limit(500);
      return data ?? [];
    },
  });

  const saveChain = useMutation({
    mutationFn: async () => {
      if (!editing || !orgId) throw new Error("Missing data");
      const payload = {
        organization_id: orgId,
        name: editing.name,
        description: editing.description || null,
        is_active: editing.is_active,
        trigger_ticket_type: editing.trigger_ticket_type || null,
        trigger_category: editing.trigger_category || null,
        trigger_priority: editing.trigger_priority || null,
        mode: editing.mode,
        required_approvals: editing.required_approvals,
        priority: editing.priority,
        created_by: user?.id ?? null,
      };
      let chainId = editing.id;
      if (chainId) {
        const { error } = await supabase.from("helpdesk_approval_chains").update(payload).eq("id", chainId);
        if (error) throw error;
        await supabase.from("helpdesk_approval_chain_steps").delete().eq("chain_id", chainId);
      } else {
        const { data, error } = await supabase.from("helpdesk_approval_chains").insert(payload).select("id").single();
        if (error) throw error;
        chainId = data.id;
      }
      if (steps.length) {
        const stepRows = steps.map((s, i) => ({
          chain_id: chainId!,
          organization_id: orgId,
          step_order: i + 1,
          name: s.name || `Step ${i + 1}`,
          approver_type: s.approver_type,
          approver_user_id: s.approver_type === "user" ? s.approver_user_id : null,
          approver_role: s.approver_type === "role" ? s.approver_role : null,
          is_optional: s.is_optional,
        }));
        const { error } = await supabase.from("helpdesk_approval_chain_steps").insert(stepRows);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Approval chain saved");
      qc.invalidateQueries({ queryKey: ["approval-chains", orgId] });
      setEditing(null);
      setSteps([]);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteChain = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("helpdesk_approval_chains").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Chain deleted");
      qc.invalidateQueries({ queryKey: ["approval-chains", orgId] });
    },
  });

  const startEdit = (chain?: any) => {
    if (chain) {
      setEditing({
        id: chain.id,
        name: chain.name,
        description: chain.description ?? "",
        is_active: chain.is_active,
        trigger_ticket_type: chain.trigger_ticket_type ?? "",
        trigger_category: chain.trigger_category ?? "",
        trigger_priority: chain.trigger_priority ?? "",
        mode: chain.mode,
        required_approvals: chain.required_approvals,
        priority: chain.priority,
      });
      setSteps(
        (chain.helpdesk_approval_chain_steps ?? [])
          .sort((a: any, b: any) => a.step_order - b.step_order)
          .map((s: any) => ({
            step_order: s.step_order,
            name: s.name,
            approver_type: s.approver_type,
            approver_user_id: s.approver_user_id,
            approver_role: s.approver_role,
            is_optional: s.is_optional,
          }))
      );
    } else {
      setEditing({ ...empty });
      setSteps([]);
    }
  };

  const addStep = () =>
    setSteps([...steps, { step_order: steps.length + 1, name: "", approver_type: "user", approver_user_id: null, approver_role: null, is_optional: false }]);

  const removeStep = (i: number) => setSteps(steps.filter((_, idx) => idx !== i));

  const profileLabel = (id: string | null) => {
    const p = profiles.find((x: any) => x.id === id);
    return p ? `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || p.email : "—";
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShieldCheck className="h-6 w-6" />Approval Workflows
          </h1>
          <p className="text-muted-foreground text-sm">
            Define multi-step approval chains that trigger automatically on matching tickets.
          </p>
        </div>
        <Button onClick={() => startEdit()}><Plus className="h-4 w-4 mr-1" />New Chain</Button>
      </div>

      <div className="grid gap-3">
        {chains.length === 0 && (
          <Card className="p-8 text-center text-muted-foreground">
            No approval chains defined yet. Create one to require sign-off on service requests.
          </Card>
        )}
        {chains.map((c: any) => (
          <Card key={c.id} className="p-4">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">{c.name}</h3>
                  {c.is_active ? <Badge variant="outline" className="text-success border-success/40">Active</Badge> : <Badge variant="outline">Inactive</Badge>}
                  <Badge variant="outline" className="capitalize">{c.mode}</Badge>
                </div>
                {c.description && <p className="text-sm text-muted-foreground">{c.description}</p>}
                <div className="flex flex-wrap gap-1 text-xs text-muted-foreground">
                  {c.trigger_ticket_type && <Badge variant="secondary">type: {c.trigger_ticket_type}</Badge>}
                  {c.trigger_category && <Badge variant="secondary">category: {c.trigger_category}</Badge>}
                  {c.trigger_priority && <Badge variant="secondary">priority: {c.trigger_priority}</Badge>}
                  <Badge variant="secondary">{c.helpdesk_approval_chain_steps?.length ?? 0} steps</Badge>
                </div>
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => startEdit(c)}><Edit className="h-4 w-4" /></Button>
                <Button size="sm" variant="ghost" onClick={() => deleteChain.mutate(c.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Edit" : "New"} Approval Chain</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Label>Name</Label>
                  <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
                </div>
                <div className="col-span-2">
                  <Label>Description</Label>
                  <Textarea rows={2} value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
                </div>
                <div>
                  <Label>Trigger: ticket type</Label>
                  <Select value={editing.trigger_ticket_type || "any"} onValueChange={(v) => setEditing({ ...editing, trigger_ticket_type: v === "any" ? "" : v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any</SelectItem>
                      <SelectItem value="incident">Incident</SelectItem>
                      <SelectItem value="service_request">Service Request</SelectItem>
                      <SelectItem value="problem">Problem</SelectItem>
                      <SelectItem value="change">Change</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Trigger: priority</Label>
                  <Select value={editing.trigger_priority || "any"} onValueChange={(v) => setEditing({ ...editing, trigger_priority: v === "any" ? "" : v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Trigger: category (exact)</Label>
                  <Input value={editing.trigger_category} onChange={(e) => setEditing({ ...editing, trigger_category: e.target.value })} />
                </div>
                <div>
                  <Label>Mode</Label>
                  <Select value={editing.mode} onValueChange={(v: any) => setEditing({ ...editing, mode: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sequential">Sequential</SelectItem>
                      <SelectItem value="parallel">Parallel</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Required approvals (0 = all)</Label>
                  <Input type="number" min={0} value={editing.required_approvals}
                    onChange={(e) => setEditing({ ...editing, required_approvals: parseInt(e.target.value) || 0 })} />
                </div>
                <div>
                  <Label>Match priority (lower runs first)</Label>
                  <Input type="number" value={editing.priority}
                    onChange={(e) => setEditing({ ...editing, priority: parseInt(e.target.value) || 100 })} />
                </div>
                <div className="col-span-2 flex items-center gap-2">
                  <Switch checked={editing.is_active} onCheckedChange={(v) => setEditing({ ...editing, is_active: v })} />
                  <Label>Active</Label>
                </div>
              </div>

              <div className="space-y-2 border-t pt-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold">Approval Steps</h4>
                  <Button size="sm" variant="outline" onClick={addStep}><Plus className="h-4 w-4 mr-1" />Add step</Button>
                </div>
                {steps.map((s, i) => (
                  <div key={i} className="border rounded-md p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <GripVertical className="h-4 w-4 text-muted-foreground" />
                      <Badge variant="outline">Step {i + 1}</Badge>
                      <Input className="flex-1" placeholder="Step name" value={s.name}
                        onChange={(e) => { const n = [...steps]; n[i].name = e.target.value; setSteps(n); }} />
                      <Button size="sm" variant="ghost" onClick={() => removeStep(i)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Select value={s.approver_type} onValueChange={(v: any) => {
                        const n = [...steps]; n[i].approver_type = v; setSteps(n);
                      }}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="user">Specific user</SelectItem>
                          <SelectItem value="role">By role</SelectItem>
                          <SelectItem value="reporter_manager">Reporter</SelectItem>
                        </SelectContent>
                      </Select>
                      {s.approver_type === "user" && (
                        <Select value={s.approver_user_id ?? ""} onValueChange={(v) => {
                          const n = [...steps]; n[i].approver_user_id = v; setSteps(n);
                        }}>
                          <SelectTrigger><SelectValue placeholder="Pick user" /></SelectTrigger>
                          <SelectContent>
                            {profiles.map((p: any) => (
                              <SelectItem key={p.id} value={p.id}>
                                {`${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || p.email}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      {s.approver_type === "role" && (
                        <Select value={s.approver_role ?? ""} onValueChange={(v) => {
                          const n = [...steps]; n[i].approver_role = v; setSteps(n);
                        }}>
                          <SelectTrigger><SelectValue placeholder="Pick role" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Administrator</SelectItem>
                            <SelectItem value="manager">Manager</SelectItem>
                            <SelectItem value="member">Member</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch checked={s.is_optional} onCheckedChange={(v) => {
                        const n = [...steps]; n[i].is_optional = v; setSteps(n);
                      }} />
                      <Label className="text-sm">Optional (skipped in count)</Label>
                    </div>
                  </div>
                ))}
                {steps.length === 0 && <p className="text-sm text-muted-foreground">No steps yet — add at least one.</p>}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={() => saveChain.mutate()} disabled={saveChain.isPending || !editing?.name}>
              {saveChain.isPending ? "Saving..." : "Save chain"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
