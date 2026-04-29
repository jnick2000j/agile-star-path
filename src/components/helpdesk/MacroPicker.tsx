import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText, Search, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import { renderMacro, type MacroContext } from "@/lib/macros";
import { toast } from "sonner";

interface Props {
  ticketId?: string;
  context: MacroContext;
  onInsert: (text: string) => void;
}

export function MacroPicker({ ticketId, context, onInsert }: Props) {
  const { user } = useAuth();
  const { currentOrganization } = useOrganization();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const { data: macros = [], isLoading } = useQuery({
    queryKey: ["helpdesk-macros", currentOrganization?.id],
    enabled: !!currentOrganization?.id && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("helpdesk_macros")
        .select("*")
        .eq("organization_id", currentOrganization!.id)
        .order("usage_count", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return macros;
    return macros.filter(
      (m: any) =>
        m.name?.toLowerCase().includes(q) ||
        m.description?.toLowerCase().includes(q) ||
        m.category?.toLowerCase().includes(q) ||
        m.shortcut?.toLowerCase().includes(q)
    );
  }, [macros, search]);

  const insert = async (m: any) => {
    const rendered = renderMacro(m.body, context);
    onInsert(rendered);
    setOpen(false);
    try {
      await supabase.from("helpdesk_macro_usage").insert({
        macro_id: m.id,
        ticket_id: ticketId ?? null,
        used_by: user?.id,
        organization_id: currentOrganization!.id,
      });
      await supabase
        .from("helpdesk_macros")
        .update({
          usage_count: (m.usage_count ?? 0) + 1,
          last_used_at: new Date().toISOString(),
        })
        .eq("id", m.id);
    } catch (e: any) {
      // Non-blocking
      console.warn("Macro usage tracking failed", e?.message);
    }
    toast.success(`Inserted "${m.name}"`);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" type="button">
          <FileText className="h-4 w-4 mr-2" />
          Macros
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end">
        <div className="p-2 border-b">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              autoFocus
              placeholder="Search macros or shortcut…"
              className="pl-8 h-8"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        <ScrollArea className="max-h-80">
          {isLoading && (
            <div className="p-4 text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          )}
          {!isLoading && filtered.length === 0 && (
            <div className="p-4 text-sm text-muted-foreground">
              No macros found. Create some at <span className="font-mono">/support/macros</span>.
            </div>
          )}
          <div className="divide-y">
            {filtered.map((m: any) => (
              <button
                key={m.id}
                type="button"
                onClick={() => insert(m)}
                className="w-full text-left p-3 hover:bg-accent transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="font-medium text-sm">{m.name}</div>
                  <div className="flex items-center gap-1">
                    {m.shortcut && (
                      <Badge variant="outline" className="text-xs font-mono">
                        {m.shortcut}
                      </Badge>
                    )}
                    {m.category && (
                      <Badge variant="secondary" className="text-xs">
                        {m.category}
                      </Badge>
                    )}
                  </div>
                </div>
                {m.description && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                    {m.description}
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2 italic">
                  {m.body}
                </p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Used {m.usage_count ?? 0} time{m.usage_count === 1 ? "" : "s"}
                </p>
              </button>
            ))}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
