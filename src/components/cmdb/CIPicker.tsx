import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Plus, Search } from "lucide-react";

interface CIPickerProps {
  excludeIds?: string[];
  onSelect: (ciId: string, ci: { id: string; name: string; reference_number: string | null }) => void;
  triggerLabel?: string;
}

export function CIPicker({ excludeIds = [], onSelect, triggerLabel = "Link CI" }: CIPickerProps) {
  const { currentOrganization } = useOrganization();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const { data: cis = [] } = useQuery({
    queryKey: ["ci-picker", currentOrganization?.id, query],
    queryFn: async () => {
      if (!currentOrganization?.id) return [];
      let q = supabase
        .from("configuration_items")
        .select("id, name, reference_number, ci_type_id, environment, criticality, cmdb_ci_types(label, color)")
        .eq("organization_id", currentOrganization.id)
        .neq("status", "retired")
        .order("name")
        .limit(50);
      if (query) q = q.ilike("name", `%${query}%`);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!currentOrganization?.id && open,
  });

  const filtered = cis.filter((c) => !excludeIds.includes(c.id));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Plus className="h-3.5 w-3.5" />
          {triggerLabel}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <Command shouldFilter={false}>
          <div className="flex items-center border-b px-3">
            <Search className="h-4 w-4 text-muted-foreground" />
            <CommandInput
              placeholder="Search configuration items…"
              value={query}
              onValueChange={setQuery}
              className="border-0 focus:ring-0"
            />
          </div>
          <CommandList>
            <CommandEmpty>No matching CIs.</CommandEmpty>
            <CommandGroup>
              {filtered.map((ci: any) => (
                <CommandItem
                  key={ci.id}
                  value={ci.id}
                  onSelect={() => {
                    onSelect(ci.id, ci);
                    setOpen(false);
                    setQuery("");
                  }}
                  className="flex items-start gap-2"
                >
                  <span
                    className="mt-1 h-2 w-2 rounded-full"
                    style={{ background: ci.cmdb_ci_types?.color ?? "hsl(var(--muted-foreground))" }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{ci.name}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {ci.reference_number} · {ci.cmdb_ci_types?.label}
                      {ci.environment ? ` · ${ci.environment}` : ""}
                    </div>
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
