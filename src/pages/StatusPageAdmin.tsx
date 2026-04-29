import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";

const STATUS_STYLES: Record<string, string> = {
  operational: "bg-success/10 text-success",
  degraded: "bg-warning/10 text-warning",
  partial_outage: "bg-warning text-warning-foreground",
  major_outage: "bg-destructive text-destructive-foreground",
  maintenance: "bg-info/10 text-info",
};

export default function StatusPageAdmin() {
  const { currentOrganization } = useOrganization();
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [groupName, setGroupName] = useState("");

  const { data: components = [] } = useQuery({
    queryKey: ["status-components", currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization?.id) return [];
      const { data, error } = await supabase
        .from("status_page_components")
        .select("*")
        .eq("organization_id", currentOrganization.id)
        .order("display_order", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!currentOrganization?.id,
  });

  const { data: subscribers = [] } = useQuery({
    queryKey: ["status-subscribers", currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization?.id) return [];
      const { data, error } = await supabase
        .from("status_page_subscribers")
        .select("*")
        .eq("organization_id", currentOrganization.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!currentOrganization?.id,
  });

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("status_page_components").insert({
        organization_id: currentOrganization!.id,
        name,
        group_name: groupName || null,
        display_order: components.length,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["status-components"] });
      setCreateOpen(false);
      setName("");
      setGroupName("");
      toast.success("Component created");
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("status_page_components").update({ current_status: status } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["status-components"] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("status_page_components").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["status-components"] }),
  });

  return (
    <AppLayout>
      <div className="p-6 space-y-6 max-w-5xl mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Status Page Admin</h1>
            <p className="text-sm text-muted-foreground">Manage public status components and subscribers</p>
          </div>
          <Button variant="outline" asChild>
            <Link to="/status"><ExternalLink className="h-4 w-4 mr-2" /> View Public Page</Link>
          </Button>
        </div>

        <Tabs defaultValue="components">
          <TabsList>
            <TabsTrigger value="components">Components</TabsTrigger>
            <TabsTrigger value="subscribers">Subscribers ({subscribers.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="components" className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4 mr-2" /> Add Component</Button>
            </div>
            <Card className="p-4 space-y-2">
              {components.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No components yet. Add services/systems to display on your public status page.</p>
              ) : components.map((c: any) => (
                <div key={c.id} className="flex items-center justify-between p-3 border rounded">
                  <div>
                    <div className="font-medium">{c.name}</div>
                    {c.group_name && <div className="text-xs text-muted-foreground">{c.group_name}</div>}
                  </div>
                  <div className="flex items-center gap-2">
                    <Select value={c.current_status} onValueChange={(v) => updateStatus.mutate({ id: c.id, status: v })}>
                      <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="operational">Operational</SelectItem>
                        <SelectItem value="degraded">Degraded Performance</SelectItem>
                        <SelectItem value="partial_outage">Partial Outage</SelectItem>
                        <SelectItem value="major_outage">Major Outage</SelectItem>
                        <SelectItem value="maintenance">Maintenance</SelectItem>
                      </SelectContent>
                    </Select>
                    <Badge className={STATUS_STYLES[c.current_status]} variant="outline">{c.current_status}</Badge>
                    <Button size="icon" variant="ghost" onClick={() => remove.mutate(c.id)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
              ))}
            </Card>
          </TabsContent>

          <TabsContent value="subscribers">
            <Card className="p-4 space-y-2">
              {subscribers.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No subscribers yet</p>
              ) : subscribers.map((s: any) => (
                <div key={s.id} className="flex items-center justify-between p-2 border rounded text-sm">
                  <span>{s.email}</span>
                  <Badge variant={s.confirmed_at ? "default" : "secondary"}>{s.confirmed_at ? "Confirmed" : "Pending"}</Badge>
                </div>
              ))}
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Status Component</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. API, Web App, Database" /></div>
            <div><Label>Group (optional)</Label><Input value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="e.g. Core Services" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={() => create.mutate()} disabled={!name || create.isPending}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
