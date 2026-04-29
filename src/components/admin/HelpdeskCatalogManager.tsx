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
  parent_item_id: string | null;
  metadata: { default_category?: string; default_priority?: string; default_ticket_type?: string } | null;
};

const PRIORITIES = ["low", "medium", "high", "urgent"];

export function HelpdeskCatalogManager() {
  const { currentOrganization } = useOrganization();
  const qc = useQueryClient();
  const [expandedListIds, setExpandedListIds] = useState<Record<string, boolean>>({});
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

  // Fetch ALL items for the org once, then group by list_id (parent/child tree)
  const { data: allItems = [] } = useQuery({
    queryKey: ["hd-catalog-items-all", currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization?.id) return [];
      const { data } = await supabase
        .from("helpdesk_catalog_items")
        .select("*")
        .eq("organization_id", currentOrganization.id)
        .order("sort_order")
        .order("name");
      return (data ?? []) as ItemRow[];
    },
    enabled: !!currentOrganization?.id,
  });

  const itemsByList = allItems.reduce<Record<string, ItemRow[]>>((acc, it) => {
    (acc[it.list_id] ||= []).push(it);
    return acc;
  }, {});

  const currentList = activeListId ? lists.find((l) => l.id === activeListId) ?? null : null;
  const toggleList = (id: string) =>
    setExpandedListIds((s) => ({ ...s, [id]: !s[id] }));

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

  const openNewItem = (list: ListRow, parent?: ItemRow) => {
    setActiveListId(list.id);
    const listItems = itemsByList[list.id] ?? [];
    setEditingItem({
      name: "",
      description: "",
      is_active: true,
      sort_order: (listItems[listItems.length - 1]?.sort_order ?? 0) + 10,
      parent_item_id: parent?.id ?? null,
      metadata: {},
    });
    setItemDialogOpen(true);
  };

  const editItem = (item: ItemRow) => {
    setActiveListId(item.list_id);
    setEditingItem({ ...item });
    setItemDialogOpen(true);
  };

  // Build a Set of ids that cannot be selected as a parent for the editing item
  // (the item itself + all of its descendants — to prevent cycles).
  const blockedParentIds = (() => {
    if (!editingItem?.id || !currentList) return new Set<string>();
    const siblings = itemsByList[currentList.id] ?? [];
    const childrenOf = (pid: string) => siblings.filter((s) => s.parent_item_id === pid);
    const blocked = new Set<string>([editingItem.id]);
    const walk = (id: string) => {
      for (const c of childrenOf(id)) {
        if (!blocked.has(c.id)) {
          blocked.add(c.id);
          walk(c.id);
        }
      }
    };
    walk(editingItem.id);
    return blocked;
  })();

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
      parent_item_id: editingItem.parent_item_id ?? null,
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
    qc.invalidateQueries({ queryKey: ["hd-catalog-items-all"] });
  };

  const deleteItem = async (id: string) => {
    if (!confirm("Delete this item?")) return;
    const { error } = await supabase.from("helpdesk_catalog_items").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["hd-catalog-items-all"] });
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
        <div className="space-y-2">
          {lists.map((l) => {
            const Icon = (l.icon && ICONS[l.icon]) || ListIcon;
            const listItems = itemsByList[l.id] ?? [];
            const expanded = expandedListIds[l.id] ?? true;
            return (
              <Collapsible
                key={l.id}
                open={expanded}
                onOpenChange={() => toggleList(l.id)}
                className="border rounded-lg bg-card"
              >
                <div className="flex items-center justify-between gap-2 p-3">
                  <CollapsibleTrigger className="flex items-center gap-2 flex-1 min-w-0 text-left hover:opacity-80">
                    <ChevronRight
                      className={`h-4 w-4 shrink-0 transition-transform ${expanded ? "rotate-90" : ""}`}
                    />
                    <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="font-medium truncate">{l.name}</span>
                    <Badge variant="outline" className="text-[10px] shrink-0">
                      {listItems.length} {listItems.length === 1 ? "item" : "items"}
                    </Badge>
                    {!l.is_active && (
                      <Badge variant="outline" className="text-[10px] shrink-0">Inactive</Badge>
                    )}
                    {l.allow_multiple ? (
                      <Badge variant="outline" className="text-[10px] shrink-0 hidden sm:inline-flex">Multi</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] shrink-0 hidden sm:inline-flex">Single</Badge>
                    )}
                  </CollapsibleTrigger>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="sm" onClick={() => openNewItem(l)} className="gap-1.5">
                      <Plus className="h-3.5 w-3.5" /> Item
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => editList(l)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => deleteList(l.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>

                <CollapsibleContent>
                  {(l.description || l.required_for_types.length > 0) && (
                    <div className="px-3 pb-2 pl-10 space-y-1">
                      {l.description && (
                        <p className="text-xs text-muted-foreground max-w-2xl">{l.description}</p>
                      )}
                      {l.required_for_types.length > 0 && (
                        <p className="text-[11px] text-muted-foreground">
                          Required for: {l.required_for_types.map((t) => t.replace("_", " ")).join(", ")}
                        </p>
                      )}
                    </div>
                  )}
                  <div className="border-t bg-muted/20">
                    {listItems.length === 0 ? (
                      <p className="text-xs text-muted-foreground py-4 pl-10">
                        No items yet — add one so it appears in the ticket dropdown.
                      </p>
                    ) : (
                      <ul className="divide-y">
                        {listItems.map((item) => (
                          <li
                            key={item.id}
                            className="flex items-center gap-2 py-2 pl-10 pr-3 hover:bg-muted/40"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium truncate">{item.name}</span>
                                {!item.is_active && (
                                  <Badge variant="outline" className="text-[10px]">Inactive</Badge>
                                )}
                              </div>
                              {item.description && (
                                <p className="text-xs text-muted-foreground truncate">{item.description}</p>
                              )}
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => editItem(item)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => deleteItem(item.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </div>
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
