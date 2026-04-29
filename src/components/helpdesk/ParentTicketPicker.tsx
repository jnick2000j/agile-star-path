import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface ParentTicketPickerProps {
  /** The ticket whose parent we are choosing — excluded from the list to prevent self-parenting. */
  currentTicketId: string;
  value: string | null | undefined;
  onChange: (parentId: string | null) => void;
  disabled?: boolean;
}

/**
 * Searchable picker for selecting a parent ticket. Excludes the current ticket
 * and any tickets that already have it as their parent (to prevent simple cycles).
 */
export function ParentTicketPicker({ currentTicketId, value, onChange, disabled }: ParentTicketPickerProps) {
  const { currentOrganization } = useOrganization();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const { data: candidates = [] } = useQuery({
    queryKey: ["helpdesk-parent-candidates", currentOrganization?.id, currentTicketId, search],
    queryFn: async () => {
      if (!currentOrganization?.id) return [] as any[];
      let q = supabase
        .from("helpdesk_tickets")
        .select("id, reference_number, subject, status, parent_ticket_id")
        .eq("organization_id", currentOrganization.id)
        .neq("id", currentTicketId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (search.trim()) {
        const s = `%${search.trim()}%`;
        q = q.or(`subject.ilike.${s},reference_number.ilike.${s}`);
      }
      const { data, error } = await q;
      if (error) throw error;
      // Prevent simple cycles: hide tickets whose parent is the current one.
      return (data ?? []).filter((t: any) => t.parent_ticket_id !== currentTicketId);
    },
    enabled: !!currentOrganization?.id && open,
  });

  const { data: selected } = useQuery({
    queryKey: ["helpdesk-ticket-summary", value],
    queryFn: async () => {
      if (!value) return null;
      const { data } = await supabase
        .from("helpdesk_tickets")
        .select("id, reference_number, subject")
        .eq("id", value)
        .maybeSingle();
      return data;
    },
    enabled: !!value,
  });

  return (
    <div className="flex items-center gap-1.5">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            disabled={disabled}
            className="flex-1 justify-between h-9 font-normal"
          >
            <span className="truncate text-left">
              {selected
                ? `${selected.reference_number ?? ""} ${selected.subject ?? ""}`.trim()
                : <span className="text-muted-foreground">No parent (top-level)</span>}
            </span>
            <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[360px] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput placeholder="Search by reference or subject..." value={search} onValueChange={setSearch} />
            <CommandList>
              <CommandEmpty>No tickets found.</CommandEmpty>
              <CommandGroup>
                {candidates.map((t: any) => (
                  <CommandItem
                    key={t.id}
                    value={t.id}
                    onSelect={() => {
                      onChange(t.id);
                      setOpen(false);
                    }}
                  >
                    <Check className={cn("mr-2 h-4 w-4", value === t.id ? "opacity-100" : "opacity-0")} />
                    <div className="flex-1 min-w-0">
                      <div className="font-mono text-[11px] text-muted-foreground">{t.reference_number ?? t.id.slice(0, 8)}</div>
                      <div className="text-sm truncate">{t.subject}</div>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {value && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0"
          onClick={() => onChange(null)}
          disabled={disabled}
          title="Clear parent"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
