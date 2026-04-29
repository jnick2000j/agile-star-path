import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Check, ChevronsUpDown, X, AppWindow, Server, Users, Laptop, Wrench, Building, Briefcase, List as ListIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  AppWindow, Server, Users, Laptop, Wrench, Building, Briefcase, ListIcon,
};

type ListRow = {
  id: string;
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
  name: string;
  description: string | null;
  is_active: boolean;
  metadata?: {
    default_category?: string;
    default_priority?: string;
    default_ticket_type?: string;
  } | null;
};

export type CatalogSelection = Record<string, string[]>; // list_id -> item ids

export type CatalogItemDefaults = {
  default_category?: string;
  default_priority?: string;
  default_ticket_type?: string;
};

interface Props {
  /** Selection map of list_id -> item ids */
  value: CatalogSelection;
  onChange: (next: CatalogSelection) => void;
  /** Current ticket type — used to enforce per-list "required_for_types". */
  ticketType?: string;
  /** When true, shows compact card titles only (no description). */
  compact?: boolean;
  /**
   * Fired when an item is newly added to the selection. Provides the item's
   * configured defaults so the parent form can auto-fill matching fields.
   */
  onItemAdded?: (defaults: CatalogItemDefaults, itemName: string) => void;
}

export function CatalogPicker({ value, onChange, ticketType, compact = false }: Props) {
  const { currentOrganization } = useOrganization();

  const { data: lists = [] } = useQuery({
    queryKey: ["hd-catalog-lists-active", currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization?.id) return [];
      const { data } = await supabase
        .from("helpdesk_catalog_lists")
        .select("*")
        .eq("organization_id", currentOrganization.id)
        .eq("is_active", true)
        .order("sort_order");
      return (data ?? []) as ListRow[];
    },
    enabled: !!currentOrganization?.id,
  });

  const { data: itemsByList = {} } = useQuery({
    queryKey: ["hd-catalog-items-active", currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization?.id) return {};
      const { data } = await supabase
        .from("helpdesk_catalog_items")
        .select("*")
        .eq("organization_id", currentOrganization.id)
        .eq("is_active", true)
        .order("sort_order")
        .order("name");
      const map: Record<string, ItemRow[]> = {};
      for (const item of (data ?? []) as ItemRow[]) {
        (map[item.list_id] ||= []).push(item);
      }
      return map;
    },
    enabled: !!currentOrganization?.id,
  });

  if (lists.length === 0) return null;

  const setList = (listId: string, ids: string[]) => {
    onChange({ ...value, [listId]: ids });
  };

  return (
    <div className={cn("space-y-3", compact && "space-y-2")}>
      {lists.map((list) => {
        const Icon = (list.icon && ICONS[list.icon]) || ListIcon;
        const items = itemsByList[list.id] ?? [];
        const selectedIds = value[list.id] ?? [];
        const required = !!ticketType && list.required_for_types.includes(ticketType);
        const isInvalid = required && selectedIds.length === 0;

        return (
          <div key={list.id} className="space-y-1.5">
            <Label className="text-xs flex items-center gap-1.5">
              <Icon className="h-3.5 w-3.5 text-muted-foreground" />
              {list.name}
              {required && <span className="text-destructive">*</span>}
              {!list.allow_multiple && <span className="text-muted-foreground text-[10px]">(single)</span>}
            </Label>
            {list.description && !compact && (
              <p className="text-[11px] text-muted-foreground">{list.description}</p>
            )}
            {list.allow_multiple ? (
              <MultiSelect
                items={items}
                selected={selectedIds}
                onChange={(ids) => setList(list.id, ids)}
                placeholder={`Select ${list.name.toLowerCase()}…`}
                invalid={isInvalid}
              />
            ) : (
              <Select
                value={selectedIds[0] ?? "none"}
                onValueChange={(v) => setList(list.id, v === "none" ? [] : [v])}
              >
                <SelectTrigger className={cn(isInvalid && "border-destructive")}>
                  <SelectValue placeholder={`Select ${list.name.toLowerCase()}…`} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— None —</SelectItem>
                  {items.map((it) => (
                    <SelectItem key={it.id} value={it.id}>{it.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {isInvalid && (
              <p className="text-[11px] text-destructive">Required for {ticketType?.replace("_", " ")} tickets</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

function MultiSelect({
  items, selected, onChange, placeholder, invalid,
}: {
  items: ItemRow[];
  selected: string[];
  onChange: (ids: string[]) => void;
  placeholder: string;
  invalid?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selectedItems = useMemo(
    () => items.filter((i) => selected.includes(i.id)),
    [items, selected],
  );

  const toggle = (id: string) => {
    if (selected.includes(id)) onChange(selected.filter((x) => x !== id));
    else onChange([...selected, id]);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between font-normal h-auto min-h-9 py-1.5",
            invalid && "border-destructive",
          )}
        >
          <div className="flex flex-wrap gap-1 items-center">
            {selectedItems.length === 0 ? (
              <span className="text-muted-foreground">{placeholder}</span>
            ) : (
              selectedItems.map((it) => (
                <Badge key={it.id} variant="secondary" className="gap-1">
                  {it.name}
                  <span
                    role="button"
                    onClick={(e) => { e.stopPropagation(); toggle(it.id); }}
                    className="hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </span>
                </Badge>
              ))
            )}
          </div>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[var(--radix-popover-trigger-width)]" align="start">
        <Command>
          <CommandInput placeholder="Search…" />
          <CommandList>
            <CommandEmpty>No items found.</CommandEmpty>
            <CommandGroup>
              {items.map((it) => (
                <CommandItem
                  key={it.id}
                  value={it.name}
                  onSelect={() => toggle(it.id)}
                  className="cursor-pointer"
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      selected.includes(it.id) ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <div className="flex-1">
                    <p className="text-sm">{it.name}</p>
                    {it.description && (
                      <p className="text-[11px] text-muted-foreground">{it.description}</p>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/** Read-only display of selected catalog items grouped by list. */
export function CatalogSummary({ ticketId }: { ticketId: string }) {
  const { data: rows = [] } = useQuery({
    queryKey: ["hd-ticket-catalog", ticketId],
    queryFn: async () => {
      const { data } = await supabase
        .from("helpdesk_ticket_catalog_items")
        .select(`
          catalog_item_id,
          list_id,
          helpdesk_catalog_items!inner(name),
          helpdesk_catalog_lists!inner(name, icon)
        `)
        .eq("ticket_id", ticketId);
      return data ?? [];
    },
    enabled: !!ticketId,
  });

  if (rows.length === 0) return null;

  const grouped = rows.reduce<Record<string, { listName: string; icon: string | null; items: string[] }>>(
    (acc, row: any) => {
      const listId = row.list_id as string;
      if (!acc[listId]) {
        acc[listId] = {
          listName: row.helpdesk_catalog_lists.name,
          icon: row.helpdesk_catalog_lists.icon,
          items: [],
        };
      }
      acc[listId].items.push(row.helpdesk_catalog_items.name);
      return acc;
    },
    {},
  );

  return (
    <div className="space-y-2">
      {Object.entries(grouped).map(([id, g]) => {
        const Icon = (g.icon && ICONS[g.icon]) || ListIcon;
        return (
          <div key={id}>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
              <Icon className="h-3 w-3" /> {g.listName}
            </p>
            <div className="flex flex-wrap gap-1 mt-1">
              {g.items.map((n) => (
                <Badge key={n} variant="secondary" className="text-[11px]">{n}</Badge>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Save selection: replaces the ticket's catalog item links. */
export async function saveTicketCatalogSelection(
  ticketId: string,
  organizationId: string,
  selection: CatalogSelection,
  userId?: string | null,
) {
  // Wipe current links
  await supabase.from("helpdesk_ticket_catalog_items").delete().eq("ticket_id", ticketId);

  // Insert new ones
  const rows = Object.entries(selection).flatMap(([listId, ids]) =>
    ids.map((catalogItemId) => ({
      ticket_id: ticketId,
      catalog_item_id: catalogItemId,
      list_id: listId,
      organization_id: organizationId,
      created_by: userId ?? null,
    })),
  );
  if (rows.length === 0) return;
  const { error } = await supabase.from("helpdesk_ticket_catalog_items").insert(rows);
  if (error) throw error;
}

/** Loads existing selection for a ticket. */
export function useTicketCatalogSelection(ticketId: string | undefined) {
  return useQuery({
    queryKey: ["hd-ticket-catalog-selection", ticketId],
    queryFn: async (): Promise<CatalogSelection> => {
      if (!ticketId) return {};
      const { data } = await supabase
        .from("helpdesk_ticket_catalog_items")
        .select("catalog_item_id, list_id")
        .eq("ticket_id", ticketId);
      const map: CatalogSelection = {};
      for (const row of data ?? []) {
        (map[(row as any).list_id] ||= []).push((row as any).catalog_item_id);
      }
      return map;
    },
    enabled: !!ticketId,
  });
}
