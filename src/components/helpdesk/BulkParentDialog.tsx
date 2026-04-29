import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronsUpDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface BulkParentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** IDs of the tickets to be re-parented. */
  selectedIds: string[];
  /** Called with the chosen new parent id (or null for top-level). */
  onConfirm: (newParentId: string | null) => Promise<void> | void;
}

/**
 * Lets the user pick a single new parent ticket for a batch of selected tickets.
 * Excludes any of the selected tickets from the candidate list to prevent
 * trivially making one of the selected tickets its own parent.
 */
export function BulkParentDialog({ open, onOpenChange, selectedIds, onConfirm }: BulkParentDialogProps) {
  const { currentOrganization } = useOrganization();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [chosen, setChosen] = useState<{ id: string; reference_number: string | null; subject: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const { data: candidates = [] } = useQuery({
    queryKey: ["bulk-parent-candidates", currentOrganization?.id, selectedIds.join(","), search],
    queryFn: async () => {
      if (!currentOrganization?.id) return [] as any[];
      let q = supabase
        .from("helpdesk_tickets")
        .select("id, reference_number, subject, status")
        .eq("organization_id", currentOrganization.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (selectedIds.length) q = q.not("id", "in", `(${selectedIds.join(",")})`);
      if (search.trim()) {
        const s = `%${search.trim()}%`;
        q = q.or(`subject.ilike.${s},reference_number.ilike.${s}`);
      }
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!currentOrganization?.id && open,
  });

  const reset = () => {
    setChosen(null);
    setSearch("");
    setPickerOpen(false);
  };

  const handleClose = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const handleApply = async (parentId: string | null) => {
    setBusy(true);
    try {
      await onConfirm(parentId);
      reset();
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Set parent for {selectedIds.length} ticket{selectedIds.length === 1 ? "" : "s"}</DialogTitle>
          <DialogDescription>
            Choose a single parent ticket. All selected tickets will be moved underneath it.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                role="combobox"
                className="w-full justify-between font-normal"
              >
                <span className="truncate text-left">
                  {chosen
                    ? `${chosen.reference_number ?? ""} ${chosen.subject}`.trim()
                    : <span className="text-muted-foreground">Search for a parent ticket...</span>}
                </span>
                <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[360px] p-0" align="start">
              <Command shouldFilter={false}>
                <CommandInput
                  placeholder="Search by reference or subject..."
                  value={search}
                  onValueChange={setSearch}
                />
                <CommandList>
                  <CommandEmpty>No tickets found.</CommandEmpty>
                  <CommandGroup>
                    {candidates.map((t: any) => (
                      <CommandItem
                        key={t.id}
                        value={t.id}
                        onSelect={() => {
                          setChosen({ id: t.id, reference_number: t.reference_number, subject: t.subject });
                          setPickerOpen(false);
                        }}
                      >
                        <Check className={cn("mr-2 h-4 w-4", chosen?.id === t.id ? "opacity-100" : "opacity-0")} />
                        <div className="flex-1 min-w-0">
                          <div className="font-mono text-[11px] text-muted-foreground">
                            {t.reference_number ?? t.id.slice(0, 8)}
                          </div>
                          <div className="text-sm truncate">{t.subject}</div>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={() => handleApply(null)}
            disabled={busy}
            className="sm:mr-auto"
          >
            Move to top level
          </Button>
          <Button variant="ghost" onClick={() => handleClose(false)} disabled={busy}>
            Cancel
          </Button>
          <Button
            onClick={() => chosen && handleApply(chosen.id)}
            disabled={!chosen || busy}
          >
            {busy ? "Applying..." : "Set parent"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
