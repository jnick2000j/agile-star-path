import { useEffect, useState } from "react";
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
import { CategoryIcon, CategoryIconPicker } from "@/components/catalog/CategoryIconPicker";

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
  const [editingCategory, setEditingCategory] = useState<any | null>(null);
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

  const handleSaveCategory = async (form: { name: string; description: string; color: string; icon: string | null }) => {
    if (!currentOrganization?.id) return;
    const payload = {
      name: form.name,
      description: form.description || null,
      color: form.color || "#64748b",
      icon: form.icon || null,
    };
    const { error } = editingCategory
      ? await supabase.from("service_catalog_categories").update(payload).eq("id", editingCategory.id)
      : await supabase.from("service_catalog_categories").insert({
          organization_id: currentOrganization.id,
          ...payload,
        });
    if (error) { toast.error(error.message); return; }
    toast.success(editingCategory ? "Category updated" : "Category created");
    qc.invalidateQueries({ queryKey: ["svc-categories"] });
    setCatOpen(false);
    setEditingCategory(null);
  };

  const handleDeleteCategory = async (cat: any) => {
    const inUse = items.some((i: any) => i.category_id === cat.id);
    const msg = inUse
      ? `"${cat.name}" is used by one or more catalog items. Delete anyway? Items will keep working but become uncategorized.`
      : `Delete category "${cat.name}"?`;
    if (!confirm(msg)) return;
    const { error } = await supabase.from("service_catalog_categories").delete().eq("id", cat.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Category deleted");
    qc.invalidateQueries({ queryKey: ["svc-categories"] });
    qc.invalidateQueries({ queryKey: ["svc-items"] });
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
            <Button size="sm" onClick={() => { setEditingCategory(null); setCatOpen(true); }}>
              <Plus className="h-4 w-4 mr-1" /> Category
            </Button>
          </div>
          <Card className="p-3">
            {categories.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">No categories yet.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {categories.map((c) => (
                  <div
                    key={c.id}
                    className="inline-flex items-center gap-1 rounded-md border bg-card pl-2 pr-1 py-0.5"
                    style={{ borderColor: c.color }}
                  >
                    <CategoryIcon name={c.icon} size={14} color={c.color} />
                    <span className="text-sm">{c.name}</span>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      onClick={() => { setEditingCategory(c); setCatOpen(true); }}
                      aria-label={`Edit ${c.name}`}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      onClick={() => handleDeleteCategory(c)}
                      aria-label={`Delete ${c.name}`}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
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

      <CategoryDialog
        open={catOpen}
        onOpenChange={(v: boolean) => { setCatOpen(v); if (!v) setEditingCategory(null); }}
        category={editingCategory}
        onSave={handleSaveCategory}
      />
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

function CategoryDialog({ open, onOpenChange, category, onSave }: any) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#64748b");
  const [icon, setIcon] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName(category?.name ?? "");
      setDescription(category?.description ?? "");
      setColor(category?.color ?? "#64748b");
      setIcon(category?.icon ?? null);
    }
  }, [open, category]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{category ? "Edit category" : "New category"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div><Label>Description</Label><Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
          <div className="flex items-end gap-3">
            <div>
              <Label>Color</Label>
              <Input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-9 w-20" />
            </div>
            <div className="flex-1">
              <Label>Icon</Label>
              <div><CategoryIconPicker value={icon} onChange={setIcon} color={color} /></div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => onSave({ name, description, color, icon })} disabled={!name.trim()}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


function ItemDialog({ open, onOpenChange, categories, item, onSave }: any) {
  const empty = {
    name: "", short_description: "", description: "", category_id: "",
    default_priority: "medium", approval_policy: "none", approver_user_ids: [],
    cost_estimate: "", estimated_fulfillment_hours: "", is_active: true,
  };
  const [form, setForm] = useState<any>(item ?? empty);
  useEffect(() => {
    if (open) setForm(item ?? empty);
  }, [open, item]);

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
  const { data: members = [], isLoading } = useQuery({
    queryKey: ["org-members-picker", currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization?.id) return [];
      // Step 1: org members
      const { data: access, error: accessErr } = await supabase
        .from("user_organization_access")
        .select("user_id")
        .eq("organization_id", currentOrganization.id);
      if (accessErr || !access?.length) return [];
      const ids = access.map((a) => a.user_id);
      // Step 2: profiles for those users (no FK on user_organization_access -> profiles)
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, first_name, last_name, email, archived")
        .in("user_id", ids);
      return (profiles ?? [])
        .filter((p: any) => !p.archived)
        .sort((a: any, b: any) =>
          `${a.first_name ?? ""} ${a.last_name ?? ""}`.localeCompare(`${b.first_name ?? ""} ${b.last_name ?? ""}`)
        );
    },
    enabled: !!currentOrganization?.id,
  });
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter(v => v !== id) : [...value, id]);
  return (
    <div>
      <div className="flex items-center justify-between">
        <Label>Approvers (in order)</Label>
        <span className="text-xs text-muted-foreground">{value.length} selected</span>
      </div>
      <div className="mt-2 max-h-48 overflow-auto border rounded-md p-2 space-y-1">
        {isLoading && <p className="text-xs text-muted-foreground">Loading members…</p>}
        {!isLoading && members.length === 0 && (
          <p className="text-xs text-muted-foreground">No members found in this organization.</p>
        )}
        {members.map((m: any) => {
          const display = [m.first_name, m.last_name].filter(Boolean).join(" ") || m.email;
          return (
            <label key={m.user_id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5">
              <input type="checkbox" checked={value.includes(m.user_id)} onChange={() => toggle(m.user_id)} />
              <span className="flex-1">{display}</span>
              {m.email && display !== m.email && <span className="text-muted-foreground text-xs">{m.email}</span>}
            </label>
          );
        })}
      </div>
      {value.length > 0 && (
        <p className="text-xs text-muted-foreground mt-1">Approvals are processed sequentially in the order shown above.</p>
      )}
    </div>
  );
}

function TasksDialog({ itemId, orgId, open, onOpenChange }: { itemId: string; orgId?: string; open: boolean; onOpenChange: (v: boolean) => void }) {
  const qc = useQueryClient();
  const { currentOrganization } = useOrganization();
  const effectiveOrg = orgId ?? currentOrganization?.id;

  const { data: tasks = [] } = useQuery({
    queryKey: ["svc-item-tasks", itemId],
    queryFn: async () => {
      const { data } = await supabase
        .from("service_catalog_item_tasks")
        .select("*")
        .eq("item_id", itemId)
        .order("step_order", { ascending: true });
      return data ?? [];
    },
  });

  const { data: members = [] } = useQuery({
    queryKey: ["org-members-picker", effectiveOrg],
    queryFn: async () => {
      if (!effectiveOrg) return [];
      const { data: access } = await supabase
        .from("user_organization_access")
        .select("user_id")
        .eq("organization_id", effectiveOrg);
      const ids = (access ?? []).map((a) => a.user_id);
      if (ids.length === 0) return [];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, first_name, last_name, email")
        .in("user_id", ids);
      return profiles ?? [];
    },
    enabled: !!effectiveOrg,
  });

  const [form, setForm] = useState<any>({ title: "", description: "", default_assignee_id: "", default_priority: "medium", estimated_hours: "" });

  const refetch = () => qc.invalidateQueries({ queryKey: ["svc-item-tasks", itemId] });

  const addTask = async () => {
    if (!form.title.trim() || !effectiveOrg) { toast.error("Task title required"); return; }
    const nextOrder = (tasks[tasks.length - 1]?.step_order ?? 0) + 1;
    const { error } = await supabase.from("service_catalog_item_tasks").insert({
      organization_id: effectiveOrg,
      item_id: itemId,
      step_order: nextOrder,
      title: form.title.trim(),
      description: form.description.trim() || null,
      default_assignee_id: form.default_assignee_id || null,
      default_priority: form.default_priority,
      estimated_hours: form.estimated_hours ? Number(form.estimated_hours) : null,
    });
    if (error) { toast.error(error.message); return; }
    setForm({ title: "", description: "", default_assignee_id: "", default_priority: "medium", estimated_hours: "" });
    refetch();
  };

  const removeTask = async (id: string) => {
    await supabase.from("service_catalog_item_tasks").delete().eq("id", id);
    refetch();
  };

  const move = async (id: string, dir: -1 | 1) => {
    const idx = tasks.findIndex((t: any) => t.id === id);
    const swap = tasks[idx + dir];
    if (!swap) return;
    await supabase.from("service_catalog_item_tasks").update({ step_order: swap.step_order }).eq("id", id);
    await supabase.from("service_catalog_item_tasks").update({ step_order: tasks[idx].step_order }).eq("id", swap.id);
    refetch();
  };

  const memberLabel = (uid: string) => {
    const m: any = members.find((x: any) => x.user_id === uid);
    if (!m) return "Unknown";
    return [m.first_name, m.last_name].filter(Boolean).join(" ") || m.email;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Fulfillment tasks</DialogTitle>
          <DialogDescription>
            Each task becomes a child Help Desk ticket. They open one at a time — the next task ticket is created when the previous one is resolved.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            {tasks.length === 0 && (
              <p className="text-sm text-muted-foreground">No tasks defined yet — approved requests will only create the parent ticket.</p>
            )}
            {tasks.map((t: any, idx: number) => (
              <div key={t.id} className="flex items-center gap-2 border rounded-md p-2 text-sm">
                <Badge variant="outline" className="text-xs">Step {idx + 1}</Badge>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{t.title}</div>
                  <div className="text-xs text-muted-foreground flex flex-wrap gap-2">
                    <span className="capitalize">{t.default_priority}</span>
                    {t.default_assignee_id && <span>· {memberLabel(t.default_assignee_id)}</span>}
                    {t.estimated_hours != null && <span>· {t.estimated_hours}h</span>}
                  </div>
                </div>
                <Button size="icon" variant="ghost" disabled={idx === 0} onClick={() => move(t.id, -1)}><ArrowUp className="h-3.5 w-3.5" /></Button>
                <Button size="icon" variant="ghost" disabled={idx === tasks.length - 1} onClick={() => move(t.id, 1)}><ArrowDown className="h-3.5 w-3.5" /></Button>
                <Button size="icon" variant="ghost" onClick={() => removeTask(t.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
            ))}
          </div>
          <div className="border-t pt-3 space-y-2">
            <h4 className="text-sm font-semibold">Add task</h4>
            <Input placeholder="Task title (e.g. Provision laptop)" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <Textarea rows={2} placeholder="Description / instructions for the assignee" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="text-xs">Assignee</Label>
                <Select value={form.default_assignee_id || "_none"} onValueChange={(v) => setForm({ ...form, default_assignee_id: v === "_none" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">Unassigned</SelectItem>
                    {members.map((m: any) => {
                      const label = [m.first_name, m.last_name].filter(Boolean).join(" ") || m.email;
                      return <SelectItem key={m.user_id} value={m.user_id}>{label}</SelectItem>;
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Priority</Label>
                <Select value={form.default_priority} onValueChange={(v) => setForm({ ...form, default_priority: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["low","medium","high","urgent"].map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Est. hours</Label>
                <Input type="number" value={form.estimated_hours} onChange={(e) => setForm({ ...form, estimated_hours: e.target.value })} />
              </div>
            </div>
            <Button size="sm" onClick={addTask}><Plus className="h-4 w-4 mr-1" /> Add task</Button>
          </div>
        </div>
        <DialogFooter><Button onClick={() => onOpenChange(false)}>Done</Button></DialogFooter>
      </DialogContent>
    </Dialog>
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
