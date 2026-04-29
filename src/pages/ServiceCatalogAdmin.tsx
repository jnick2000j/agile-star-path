import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, GripVertical, Settings2, ListChecks, ArrowUp, ArrowDown } from "lucide-react";
import { toast } from "sonner";

const FIELD_TYPES = [
  { value: "text", label: "Short text" },
  { value: "textarea", label: "Long text" },
  { value: "select", label: "Single select" },
  { value: "multiselect", label: "Multi select" },
  { value: "number", label: "Number" },
  { value: "checkbox", label: "Checkbox" },
  { value: "date", label: "Date" },
  { value: "user", label: "User picker" },
];

export default function ServiceCatalogAdmin({ embedded = false }: { embedded?: boolean } = {}) {
  const { currentOrganization } = useOrganization();
  const { user } = useAuth();
  const qc = useQueryClient();

  const [catOpen, setCatOpen] = useState(false);
  const [itemOpen, setItemOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [fieldsOpen, setFieldsOpen] = useState<string | null>(null);
  const [tasksOpen, setTasksOpen] = useState<string | null>(null);

  const { data: categories = [] } = useQuery({
    queryKey: ["svc-categories", currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization?.id) return [];
      const { data } = await supabase
        .from("service_catalog_categories")
        .select("*")
        .eq("organization_id", currentOrganization.id)
        .order("sort_order");
      return data ?? [];
    },
    enabled: !!currentOrganization?.id,
  });

  const { data: items = [] } = useQuery({
    queryKey: ["svc-items", currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization?.id) return [];
      const { data } = await supabase
        .from("service_catalog_items")
        .select("*, service_catalog_categories(name, color)")
        .eq("organization_id", currentOrganization.id)
        .order("sort_order");
      return data ?? [];
    },
    enabled: !!currentOrganization?.id,
  });

  const handleSaveCategory = async (form: { name: string; description: string; color: string }) => {
    if (!currentOrganization?.id) return;
    const { error } = await supabase.from("service_catalog_categories").insert({
      organization_id: currentOrganization.id,
      name: form.name, description: form.description || null, color: form.color || "#64748b",
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Category created");
    qc.invalidateQueries({ queryKey: ["svc-categories"] });
    setCatOpen(false);
  };

  const handleSaveItem = async (form: any) => {
    if (!currentOrganization?.id) return;
    const payload = {
      organization_id: currentOrganization.id,
      category_id: form.category_id || null,
      name: form.name,
      short_description: form.short_description || null,
      description: form.description || null,
      default_priority: form.default_priority,
      approval_policy: form.approval_policy,
      approver_user_ids: form.approver_user_ids ?? [],
      cost_estimate: form.cost_estimate ? Number(form.cost_estimate) : null,
      estimated_fulfillment_hours: form.estimated_fulfillment_hours ? Number(form.estimated_fulfillment_hours) : null,
      is_active: form.is_active,
      created_by: user?.id ?? null,
    };
    const { error } = editingItem
      ? await supabase.from("service_catalog_items").update(payload).eq("id", editingItem.id)
      : await supabase.from("service_catalog_items").insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success(editingItem ? "Item updated" : "Item created");
    qc.invalidateQueries({ queryKey: ["svc-items"] });
    setItemOpen(false); setEditingItem(null);
  };

  const handleDeleteItem = async (id: string) => {
    if (!confirm("Delete this catalog item?")) return;
    const { error } = await supabase.from("service_catalog_items").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Deleted");
    qc.invalidateQueries({ queryKey: ["svc-items"] });
  };

  const body = (
    <>
    <div className="space-y-6">
        <section>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-lg font-semibold">Categories</h2>
              <p className="text-xs text-muted-foreground">Group catalog items for browsing.</p>
            </div>
            <Button size="sm" onClick={() => setCatOpen(true)}><Plus className="h-4 w-4 mr-1" /> Category</Button>
          </div>
          <Card className="p-3">
            {categories.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">No categories yet.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {categories.map((c) => (
                  <Badge key={c.id} variant="outline" style={{ borderColor: c.color }} className="gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ background: c.color }} />
                    {c.name}
                  </Badge>
                ))}
              </div>
            )}
          </Card>
        </section>

        <section>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-lg font-semibold">Catalog items</h2>
              <p className="text-xs text-muted-foreground">Each item becomes a service request ticket when ordered.</p>
            </div>
            <Button size="sm" onClick={() => { setEditingItem(null); setItemOpen(true); }}>
              <Plus className="h-4 w-4 mr-1" /> Item
            </Button>
          </div>
          <Card>
            <div className="divide-y">
              {items.length === 0 ? (
                <p className="text-sm text-muted-foreground p-4">No items yet.</p>
              ) : items.map((item: any) => (
                <div key={item.id} className="flex items-center gap-3 p-3">
                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{item.name}</span>
                      {!item.is_active && <Badge variant="secondary">Inactive</Badge>}
                      {item.service_catalog_categories?.name && (
                        <Badge variant="outline" style={{ borderColor: item.service_catalog_categories.color }}>
                          {item.service_catalog_categories.name}
                        </Badge>
                      )}
                      <Badge variant="outline" className="capitalize">{item.approval_policy.replace("_"," ")}</Badge>
                    </div>
                    {item.short_description && <p className="text-xs text-muted-foreground truncate">{item.short_description}</p>}
                  </div>
                  {item.cost_estimate != null && <span className="text-sm text-muted-foreground">${Number(item.cost_estimate).toLocaleString()}</span>}
                  <Button size="sm" variant="outline" onClick={() => setFieldsOpen(item.id)}>
                    <Settings2 className="h-3.5 w-3.5 mr-1" /> Fields
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setTasksOpen(item.id)}>
                    <ListChecks className="h-3.5 w-3.5 mr-1" /> Tasks
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => { setEditingItem(item); setItemOpen(true); }}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => handleDeleteItem(item.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </Card>
        </section>
      </div>

      <CategoryDialog open={catOpen} onOpenChange={setCatOpen} onSave={handleSaveCategory} />
      <ItemDialog
        open={itemOpen}
        onOpenChange={(v) => { setItemOpen(v); if (!v) setEditingItem(null); }}
        categories={categories}
        item={editingItem}
        onSave={handleSaveItem}
      />
      {fieldsOpen && (
        <FieldsDialog itemId={fieldsOpen} open={!!fieldsOpen} onOpenChange={(v) => !v && setFieldsOpen(null)} />
      )}
      {tasksOpen && (
        <TasksDialog itemId={tasksOpen} orgId={currentOrganization?.id} open={!!tasksOpen} onOpenChange={(v) => !v && setTasksOpen(null)} />
      )}
    </>
  );

  return embedded ? body : <AppLayout title="Service Catalog Admin" subtitle="Define orderable services with approval workflows">{body}</AppLayout>;
}

function CategoryDialog({ open, onOpenChange, onSave }: any) {
  const [name, setName] = useState(""); const [description, setDescription] = useState(""); const [color, setColor] = useState("#64748b");
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { setName(""); setDescription(""); } onOpenChange(v); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>New category</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div><Label>Description</Label><Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
          <div><Label>Color</Label><Input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-9 w-20" /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => onSave({ name, description, color })} disabled={!name.trim()}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ItemDialog({ open, onOpenChange, categories, item, onSave }: any) {
  const [form, setForm] = useState<any>(() => item ?? {
    name: "", short_description: "", description: "", category_id: "",
    default_priority: "medium", approval_policy: "none", approver_user_ids: [],
    cost_estimate: "", estimated_fulfillment_hours: "", is_active: true,
  });
  // re-sync when item changes
  useState(() => setForm(item ?? form));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{item ? "Edit catalog item" : "New catalog item"}</DialogTitle>
          <DialogDescription>Configure how users request this service.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div><Label>Short description</Label><Input value={form.short_description ?? ""} onChange={(e) => setForm({ ...form, short_description: e.target.value })} /></div>
          <div><Label>Full description</Label><Textarea rows={3} value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Category</Label>
              <Select value={form.category_id ?? ""} onValueChange={(v) => setForm({ ...form, category_id: v })}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  {categories.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Default priority</Label>
              <Select value={form.default_priority} onValueChange={(v) => setForm({ ...form, default_priority: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["low","medium","high","urgent"].map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Approval policy</Label>
              <Select value={form.approval_policy} onValueChange={(v) => setForm({ ...form, approval_policy: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No approval</SelectItem>
                  <SelectItem value="manager">Requester's manager</SelectItem>
                  <SelectItem value="specific_users">Specific approvers</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Cost estimate (USD)</Label>
              <Input type="number" value={form.cost_estimate ?? ""} onChange={(e) => setForm({ ...form, cost_estimate: e.target.value })} />
            </div>
            <div>
              <Label>Est. fulfillment (hours)</Label>
              <Input type="number" value={form.estimated_fulfillment_hours ?? ""} onChange={(e) => setForm({ ...form, estimated_fulfillment_hours: e.target.value })} />
            </div>
            <div className="flex items-end gap-2">
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
              <Label className="!mt-0">Active</Label>
            </div>
          </div>
          {form.approval_policy === "specific_users" && (
            <ApproverPicker
              value={form.approver_user_ids ?? []}
              onChange={(ids) => setForm({ ...form, approver_user_ids: ids })}
            />
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => onSave(form)} disabled={!form.name?.trim()}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ApproverPicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const { currentOrganization } = useOrganization();
  const { data: members = [] } = useQuery({
    queryKey: ["org-members-picker", currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization?.id) return [];
      const { data } = await supabase
        .from("user_organization_access")
        .select("user_id, profiles(first_name, last_name, email)")
        .eq("organization_id", currentOrganization.id);
      return data ?? [];
    },
    enabled: !!currentOrganization?.id,
  });
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter(v => v !== id) : [...value, id]);
  return (
    <div>
      <Label>Approvers (in order)</Label>
      <div className="mt-2 max-h-48 overflow-auto border rounded-md p-2 space-y-1">
        {members.map((m: any) => (
          <label key={m.user_id} className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={value.includes(m.user_id)} onChange={() => toggle(m.user_id)} />
            <span>{m.profiles?.first_name ?? ""} {m.profiles?.last_name ?? ""}</span>
            <span className="text-muted-foreground text-xs">{m.profiles?.email}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

function FieldsDialog({ itemId, open, onOpenChange }: { itemId: string; open: boolean; onOpenChange: (v: boolean) => void }) {
  const qc = useQueryClient();
  const { data: fields = [] } = useQuery({
    queryKey: ["svc-fields", itemId],
    queryFn: async () => {
      const { data } = await supabase.from("service_catalog_item_fields").select("*").eq("item_id", itemId).order("sort_order");
      return data ?? [];
    },
  });
  const [form, setForm] = useState({ field_key: "", label: "", field_type: "text", is_required: false, options_text: "" });

  const addField = async () => {
    if (!form.field_key.trim() || !form.label.trim()) { toast.error("Key and label required"); return; }
    const options = ["select", "multiselect"].includes(form.field_type)
      ? form.options_text.split("\n").map(s => s.trim()).filter(Boolean).map(s => ({ value: s, label: s }))
      : [];
    const { error } = await supabase.from("service_catalog_item_fields").insert({
      item_id: itemId,
      field_key: form.field_key.trim(),
      label: form.label.trim(),
      field_type: form.field_type,
      is_required: form.is_required,
      options,
      sort_order: fields.length * 10 + 10,
    });
    if (error) { toast.error(error.message); return; }
    setForm({ field_key: "", label: "", field_type: "text", is_required: false, options_text: "" });
    qc.invalidateQueries({ queryKey: ["svc-fields", itemId] });
  };
  const removeField = async (id: string) => {
    await supabase.from("service_catalog_item_fields").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["svc-fields", itemId] });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader><DialogTitle>Form fields</DialogTitle><DialogDescription>Questions asked when a user orders this item.</DialogDescription></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            {fields.length === 0 && <p className="text-sm text-muted-foreground">No fields yet — the request form will be just a description box.</p>}
            {fields.map((f: any) => (
              <div key={f.id} className="flex items-center gap-2 border rounded-md p-2 text-sm">
                <span className="font-medium">{f.label}</span>
                <Badge variant="outline" className="text-xs">{f.field_type}</Badge>
                {f.is_required && <Badge variant="secondary" className="text-xs">Required</Badge>}
                <span className="text-xs text-muted-foreground ml-auto">{f.field_key}</span>
                <Button size="icon" variant="ghost" onClick={() => removeField(f.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
            ))}
          </div>
          <div className="border-t pt-3 space-y-2">
            <h4 className="text-sm font-semibold">Add field</h4>
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Field key (e.g. laptop_model)" value={form.field_key} onChange={(e) => setForm({ ...form, field_key: e.target.value })} />
              <Input placeholder="Label" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
              <Select value={form.field_type} onValueChange={(v) => setForm({ ...form, field_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{FIELD_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.is_required} onChange={(e) => setForm({ ...form, is_required: e.target.checked })} />
                Required
              </label>
            </div>
            {(form.field_type === "select" || form.field_type === "multiselect") && (
              <Textarea rows={3} placeholder="Options (one per line)" value={form.options_text} onChange={(e) => setForm({ ...form, options_text: e.target.value })} />
            )}
            <Button size="sm" onClick={addField}><Plus className="h-4 w-4 mr-1" /> Add field</Button>
          </div>
        </div>
        <DialogFooter><Button onClick={() => onOpenChange(false)}>Done</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
