import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, FileText } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface FieldDef {
  key: string;
  label: string;
  type: "text" | "textarea" | "number" | "date" | "select";
  options?: string[];
  required?: boolean;
}

export default function VerticalEntityRegister() {
  const { slug } = useParams<{ slug: string }>();
  const { currentOrganization } = useOrganization();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<{ title: string; status: string; data: Record<string, any> }>({ title: "", status: "open", data: {} });

  const { data: entity, isLoading: entityLoading } = useQuery({
    queryKey: ["vertical-entity", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vertical_entities")
        .select("*")
        .eq("slug", slug!)
        .eq("is_active", true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!slug,
  });

  const { data: records = [], isLoading } = useQuery({
    queryKey: ["entity-records", entity?.id, currentOrganization?.id],
    queryFn: async () => {
      if (!entity || !currentOrganization?.id) return [];
      const { data, error } = await supabase
        .from("vertical_entity_records")
        .select("*")
        .eq("entity_id", entity.id)
        .eq("organization_id", currentOrganization.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!entity?.id && !!currentOrganization?.id,
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!entity || !currentOrganization?.id || !user) throw new Error("Missing context");
      const { error } = await supabase.from("vertical_entity_records").insert({
        entity_id: entity.id,
        organization_id: currentOrganization.id,
        record_number: `${entity.slug.toUpperCase().slice(0, 3)}-${Date.now().toString().slice(-6)}`,
        title: form.title,
        status: form.status,
        data: form.data,
        created_by: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Record created");
      qc.invalidateQueries({ queryKey: ["entity-records"] });
      setOpen(false);
      setForm({ title: "", status: entity?.default_status_options?.[0] ?? "open", data: {} });
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (entityLoading) {
    return <AppLayout title="Loading…"><div className="p-6 text-muted-foreground">Loading entity…</div></AppLayout>;
  }

  if (!entity) {
    return (
      <AppLayout title="Not Found">
        <div className="p-6">
          <Card className="p-8 text-center">
            <FileText className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <h2 className="text-xl font-semibold">Custom register not found</h2>
            <p className="text-sm text-muted-foreground">Either the slug is wrong or the entity has been disabled.</p>
          </Card>
        </div>
      </AppLayout>
    );
  }

  const fields = (entity.fields as FieldDef[]) || [];
  const statusOptions = entity.default_status_options || ["open", "in_progress", "closed"];

  return (
    <AppLayout title={entity.name_plural}>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <FileText className="h-7 w-7" /> {entity.name_plural}
            </h1>
            {entity.description && <p className="text-muted-foreground">{entity.description}</p>}
          </div>
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (v) setForm({ title: "", status: statusOptions[0], data: {} }); }}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="h-4 w-4" /> New {entity.name}</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New {entity.name}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Title</Label>
                  <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                </div>
                <div>
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {statusOptions.map((s: string) => <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                {fields.map((field) => (
                  <div key={field.key}>
                    <Label>{field.label}{field.required && " *"}</Label>
                    {field.type === "textarea" ? (
                      <Textarea rows={3} value={form.data[field.key] ?? ""} onChange={(e) => setForm({ ...form, data: { ...form.data, [field.key]: e.target.value } })} />
                    ) : field.type === "select" ? (
                      <Select value={form.data[field.key] ?? ""} onValueChange={(v) => setForm({ ...form, data: { ...form.data, [field.key]: v } })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {(field.options ?? []).map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
                        value={form.data[field.key] ?? ""}
                        onChange={(e) => setForm({ ...form, data: { ...form.data, [field.key]: field.type === "number" ? Number(e.target.value) : e.target.value } })}
                      />
                    )}
                  </div>
                ))}
              </div>
              <DialogFooter>
                <Button onClick={() => create.mutate()} disabled={!form.title || create.isPending}>Create</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-3">
          {isLoading && <p className="text-muted-foreground">Loading…</p>}
          {!isLoading && records.length === 0 && (
            <Card className="p-12 text-center text-muted-foreground">
              No {entity.name_plural.toLowerCase()} yet. Create your first one above.
            </Card>
          )}
          {records.map((r: any) => (
            <Card key={r.id} className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-xs text-muted-foreground">{r.record_number}</span>
                    <Badge variant="outline">{r.status.replace(/_/g, " ")}</Badge>
                  </div>
                  <h3 className="font-semibold">{r.title}</h3>
                  {fields.length > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2 text-sm">
                      {fields.map((f) => (
                        r.data?.[f.key] !== undefined && r.data?.[f.key] !== "" && (
                          <div key={f.key}>
                            <span className="text-muted-foreground">{f.label}: </span>
                            <span>{String(r.data[f.key])}</span>
                          </div>
                        )
                      ))}
                    </div>
                  )}
                </div>
                <div className="text-xs text-muted-foreground shrink-0">
                  {format(new Date(r.created_at), "MMM d, yyyy")}
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
