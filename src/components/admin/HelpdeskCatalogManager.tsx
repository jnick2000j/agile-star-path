import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Plus, Trash2, Pencil, List as ListIcon, Server, AppWindow, Users, Laptop,
  Wrench, Building, Briefcase, ChevronRight,
} from "lucide-react";
import { toast } from "sonner";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  AppWindow, Server, Users, Laptop, Wrench, Building, Briefcase, ListIcon,
};
const ICON_OPTIONS = ["ListIcon", "AppWindow", "Server", "Users", "Laptop", "Wrench", "Building", "Briefcase"];
const TICKET_TYPES = ["support", "incident", "service_request", "question", "problem"];

type ListRow = {
  id: string;
  organization_id: string;
  key: string;
  name: string;
  description: string | null;
  icon: string | null;
  is_active: boolean;
  allow_multiple: boolean;
  required_for_types: string[];
  sort_order: number;
};

type ItemRow = {
  id: string;
  list_id: string;
  organization_id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  sort_order: number;
  metadata: { default_category?: string; default_priority?: string; default_ticket_type?: string } | null;
};

const PRIORITIES = ["low", "medium", "high", "urgent"];

export function HelpdeskCatalogManager() {
  const { currentOrganization } = useOrganization();
  const qc = useQueryClient();
  const [activeListId, setActiveListId] = useState<string | null>(null);
  const [listDialogOpen, setListDialogOpen] = useState(false);
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [editingList, setEditingList] = useState<Partial<ListRow> | null>(null);
  const [editingItem, setEditingItem] = useState<Partial<ItemRow> | null>(null);

  const { data: lists = [] } = useQuery({
    queryKey: ["hd-catalog-lists", currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization?.id) return [];
      const { data } = await supabase
        .from("helpdesk_catalog_lists")
        .select("*")
        .eq("organization_id", currentOrganization.id)
        .order("sort_order");
      return (data ?? []) as ListRow[];
    },
    enabled: !!currentOrganization?.id,
  });

  const currentList = activeListId
    ? lists.find((l) => l.id === activeListId)
    : lists[0];

  const { data: items = [] } = useQuery({
    queryKey: ["hd-catalog-items", currentList?.id],
    queryFn: async () => {
      if (!currentList?.id) return [];
      const { data } = await supabase
        .from("helpdesk_catalog_items")
        .select("*")
        .eq("list_id", currentList.id)
        .order("sort_order")
        .order("name");
      return (data ?? []) as ItemRow[];
    },
    enabled: !!currentList?.id,
  });

  const openNewList = () => {
    setEditingList({
      key: "",
      name: "",
      description: "",
      icon: "ListIcon",
      is_active: true,
      allow_multiple: true,
      required_for_types: [],
      sort_order: (lists[lists.length - 1]?.sort_order ?? 0) + 10,
    });
    setListDialogOpen(true);
  };

  const editList = (list: ListRow) => {
    setEditingList({ ...list });
    setListDialogOpen(true);
  };

  const saveList = async () => {
    if (!currentOrganization?.id || !editingList) return;
    if (!editingList.name?.trim()) return toast.error("Name is required");
    if (!editingList.key?.trim()) {
      editingList.key = (editingList.name ?? "")
        .trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
    }
    const payload = {
      organization_id: currentOrganization.id,
      key: editingList.key,
      name: editingList.name.trim(),
      description: editingList.description?.trim() || null,
      icon: editingList.icon || null,
      is_active: editingList.is_active ?? true,
      allow_multiple: editingList.allow_multiple ?? true,
      required_for_types: editingList.required_for_types ?? [],
      sort_order: editingList.sort_order ?? 0,
    };
    let error;
    if (editingList.id) {
      ({ error } = await supabase.from("helpdesk_catalog_lists").update(payload).eq("id", editingList.id));
    } else {
      ({ error } = await supabase.from("helpdesk_catalog_lists").insert(payload));
    }
    if (error) return toast.error(error.message);
    toast.success("List saved");
    setListDialogOpen(false);
    setEditingList(null);
    qc.invalidateQueries({ queryKey: ["hd-catalog-lists"] });
  };

  const deleteList = async (id: string) => {
    if (!confirm("Delete this list and all its items? Tickets will lose their links.")) return;
    const { error } = await supabase.from("helpdesk_catalog_lists").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("List deleted");
    if (activeListId === id) setActiveListId(null);
    qc.invalidateQueries({ queryKey: ["hd-catalog-lists"] });
  };

  const openNewItem = () => {
    if (!currentList) return;
    setEditingItem({
      name: "",
      description: "",
      is_active: true,
      sort_order: (items[items.length - 1]?.sort_order ?? 0) + 10,
      metadata: {},
    });
    setItemDialogOpen(true);
  };

  const editItem = (item: ItemRow) => {
    setEditingItem({ ...item });
    setItemDialogOpen(true);
  };

  const saveItem = async () => {
    if (!currentList || !editingItem || !currentOrganization?.id) return;
    if (!editingItem.name?.trim()) return toast.error("Name is required");
    const payload = {
      list_id: currentList.id,
      organization_id: currentOrganization.id,
      name: editingItem.name.trim(),
      description: editingItem.description?.trim() || null,
      is_active: editingItem.is_active ?? true,
      sort_order: editingItem.sort_order ?? 0,
      metadata: editingItem.metadata ?? {},
    };
    let error;
    if (editingItem.id) {
      ({ error } = await supabase.from("helpdesk_catalog_items").update(payload).eq("id", editingItem.id));
    } else {
      ({ error } = await supabase.from("helpdesk_catalog_items").insert(payload));
    }
    if (error) return toast.error(error.message);
    toast.success("Item saved");
    setItemDialogOpen(false);
    setEditingItem(null);
    qc.invalidateQueries({ queryKey: ["hd-catalog-items", currentList.id] });
  };

  const deleteItem = async (id: string) => {
    if (!confirm("Delete this item?")) return;
    const { error } = await supabase.from("helpdesk_catalog_items").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["hd-catalog-items", currentList?.id] });
  };

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold">Helpdesk Catalogs</h3>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Define dropdown lists that appear on every helpdesk ticket — applications, IT services,
            internal teams, hardware and any other category your team needs to triage and report on.
            Lists are scoped to this organization.
          </p>
        </div>
        <Button onClick={openNewList} className="gap-2">
          <Plus className="h-4 w-4" /> New List
        </Button>
      </div>

      {lists.length === 0 ? (
        <div className="text-center py-12 border border-dashed rounded-lg text-muted-foreground">
          <ListIcon className="h-10 w-10 mx-auto mb-3 opacity-50" />
          <p className="text-sm">No catalog lists yet — create your first one to start tagging tickets.</p>
        </div>
      ) : (
        <Tabs value={currentList?.id} onValueChange={setActiveListId}>
          <TabsList className="flex flex-wrap h-auto bg-secondary">
            {lists.map((l) => {
              const Icon = (l.icon && ICONS[l.icon]) || ListIcon;
              return (
                <TabsTrigger key={l.id} value={l.id} className="gap-2">
                  <Icon className="h-3.5 w-3.5" />
                  {l.name}
                  {!l.is_active && <Badge variant="outline" className="text-[10px]">off</Badge>}
                </TabsTrigger>
              );
            })}
          </TabsList>

          {currentList && (
            <TabsContent value={currentList.id} className="space-y-4 mt-4">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <h4 className="font-medium flex items-center gap-2">
                    {currentList.name}
                    {!currentList.is_active && <Badge variant="outline">Inactive</Badge>}
                    {currentList.allow_multiple ? (
                      <Badge variant="outline" className="text-[10px]">Multi-select</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px]">Single</Badge>
                    )}
                  </h4>
                  {currentList.description && (
                    <p className="text-xs text-muted-foreground mt-1 max-w-2xl">{currentList.description}</p>
                  )}
                  {currentList.required_for_types.length > 0 && (
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Required when ticket type is: {currentList.required_for_types.map(t => t.replace("_", " ")).join(", ")}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => editList(currentList)} className="gap-2">
                    <Pencil className="h-3.5 w-3.5" /> Edit list
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => deleteList(currentList.id)} className="gap-2 text-destructive hover:text-destructive">
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </Button>
                  <Button size="sm" onClick={openNewItem} className="gap-2">
                    <Plus className="h-3.5 w-3.5" /> Add item
                  </Button>
                </div>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="w-[80px]">Order</TableHead>
                    <TableHead className="w-[100px]">Status</TableHead>
                    <TableHead className="w-[120px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        No items yet — add some so they appear in the ticket dropdown.
                      </TableCell>
                    </TableRow>
                  ) : items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{item.description || "—"}</TableCell>
                      <TableCell className="text-xs">{item.sort_order}</TableCell>
                      <TableCell>
                        {item.is_active
                          ? <Badge className="bg-success/10 text-success">Active</Badge>
                          : <Badge variant="outline">Inactive</Badge>}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => editItem(item)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => deleteItem(item.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>
          )}
        </Tabs>
      )}

      {/* List dialog */}
      <Dialog open={listDialogOpen} onOpenChange={setListDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingList?.id ? "Edit list" : "New catalog list"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Display name *</Label>
                <Input
                  value={editingList?.name ?? ""}
                  onChange={(e) => setEditingList({ ...editingList!, name: e.target.value })}
                  placeholder="Applications & Software"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Key (auto if empty)</Label>
                <Input
                  value={editingList?.key ?? ""}
                  onChange={(e) => setEditingList({ ...editingList!, key: e.target.value })}
                  placeholder="applications"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea
                rows={2}
                value={editingList?.description ?? ""}
                onChange={(e) => setEditingList({ ...editingList!, description: e.target.value })}
                placeholder="Helps users pick the right context for the ticket."
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Icon</Label>
                <Select
                  value={editingList?.icon ?? "ListIcon"}
                  onValueChange={(v) => setEditingList({ ...editingList!, icon: v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ICON_OPTIONS.map((i) => {
                      const Ic = ICONS[i] || ListIcon;
                      return (
                        <SelectItem key={i} value={i}>
                          <span className="flex items-center gap-2"><Ic className="h-3.5 w-3.5" /> {i}</span>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Sort order</Label>
                <Input
                  type="number"
                  value={editingList?.sort_order ?? 0}
                  onChange={(e) => setEditingList({ ...editingList!, sort_order: Number(e.target.value) })}
                />
              </div>
            </div>
            <div className="flex items-center justify-between border rounded-md p-3">
              <div>
                <Label className="text-sm">Active</Label>
                <p className="text-[11px] text-muted-foreground">Show this list on tickets</p>
              </div>
              <Switch
                checked={editingList?.is_active ?? true}
                onCheckedChange={(v) => setEditingList({ ...editingList!, is_active: v })}
              />
            </div>
            <div className="flex items-center justify-between border rounded-md p-3">
              <div>
                <Label className="text-sm">Allow multiple selections</Label>
                <p className="text-[11px] text-muted-foreground">If off, only one value per ticket</p>
              </div>
              <Switch
                checked={editingList?.allow_multiple ?? true}
                onCheckedChange={(v) => setEditingList({ ...editingList!, allow_multiple: v })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Required for ticket types</Label>
              <p className="text-[11px] text-muted-foreground">
                If a type is selected here, the ticket can't be saved without picking a value.
              </p>
              <div className="flex flex-wrap gap-2">
                {TICKET_TYPES.map((t) => {
                  const checked = (editingList?.required_for_types ?? []).includes(t);
                  return (
                    <Badge
                      key={t}
                      variant={checked ? "default" : "outline"}
                      className="cursor-pointer capitalize"
                      onClick={() => {
                        const cur = editingList?.required_for_types ?? [];
                        const next = checked ? cur.filter((x) => x !== t) : [...cur, t];
                        setEditingList({ ...editingList!, required_for_types: next });
                      }}
                    >
                      {t.replace("_", " ")}
                    </Badge>
                  );
                })}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setListDialogOpen(false)}>Cancel</Button>
            <Button onClick={saveList}>Save list</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Item dialog */}
      <Dialog open={itemDialogOpen} onOpenChange={setItemDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingItem?.id ? "Edit item" : `Add to ${currentList?.name ?? "list"}`}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Name *</Label>
              <Input
                value={editingItem?.name ?? ""}
                onChange={(e) => setEditingItem({ ...editingItem!, name: e.target.value })}
                placeholder="e.g. Salesforce"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea
                rows={2}
                value={editingItem?.description ?? ""}
                onChange={(e) => setEditingItem({ ...editingItem!, description: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Sort order</Label>
                <Input
                  type="number"
                  value={editingItem?.sort_order ?? 0}
                  onChange={(e) => setEditingItem({ ...editingItem!, sort_order: Number(e.target.value) })}
                />
              </div>
              <div className="flex items-end justify-between border rounded-md p-3">
                <Label className="text-sm">Active</Label>
                <Switch
                  checked={editingItem?.is_active ?? true}
                  onCheckedChange={(v) => setEditingItem({ ...editingItem!, is_active: v })}
                />
              </div>
            </div>

            <div className="border-t pt-3 space-y-3">
              <div>
                <Label className="text-sm">Auto-fill defaults (optional)</Label>
                <p className="text-[11px] text-muted-foreground">
                  When a user picks this item on a new ticket, these values will be applied automatically
                  if the field is still empty / unchanged.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Default category</Label>
                <Input
                  value={editingItem?.metadata?.default_category ?? ""}
                  onChange={(e) => setEditingItem({
                    ...editingItem!,
                    metadata: { ...(editingItem?.metadata ?? {}), default_category: e.target.value },
                  })}
                  placeholder="e.g. Access, Performance, Bug"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Default priority</Label>
                  <Select
                    value={editingItem?.metadata?.default_priority ?? "none"}
                    onValueChange={(v) => setEditingItem({
                      ...editingItem!,
                      metadata: {
                        ...(editingItem?.metadata ?? {}),
                        default_priority: v === "none" ? undefined : v,
                      },
                    })}
                  >
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— None —</SelectItem>
                      {PRIORITIES.map((p) => (
                        <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Default ticket type</Label>
                  <Select
                    value={editingItem?.metadata?.default_ticket_type ?? "none"}
                    onValueChange={(v) => setEditingItem({
                      ...editingItem!,
                      metadata: {
                        ...(editingItem?.metadata ?? {}),
                        default_ticket_type: v === "none" ? undefined : v,
                      },
                    })}
                  >
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— None —</SelectItem>
                      {TICKET_TYPES.map((t) => (
                        <SelectItem key={t} value={t} className="capitalize">{t.replace("_", " ")}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setItemDialogOpen(false)}>Cancel</Button>
            <Button onClick={saveItem}>Save item</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
