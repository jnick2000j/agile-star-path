import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { AlertOctagon, BookOpen, Link2Off, Plus, ExternalLink, Search } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { CreateProblemDialog } from "./CreateProblemDialog";

interface Props {
  ticketId: string;
  ticketSubject: string;
  ticketDescription?: string | null;
  parentProblemId: string | null;
}

export function TicketProblemPanel({ ticketId, ticketSubject, ticketDescription, parentProblemId }: Props) {
  const { currentOrganization } = useOrganization();
  const qc = useQueryClient();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [query, setQuery] = useState("");

  const { data: parent } = useQuery({
    queryKey: ["ticket-parent-problem", parentProblemId],
    queryFn: async () => {
      if (!parentProblemId) return null;
      const { data } = await supabase
        .from("problems")
        .select("id, reference_number, title, status, priority, is_known_error, workaround")
        .eq("id", parentProblemId)
        .maybeSingle();
      return data;
    },
    enabled: !!parentProblemId,
  });

  const { data: candidates = [] } = useQuery({
    queryKey: ["problem-search", currentOrganization?.id, query],
    queryFn: async () => {
      if (!currentOrganization?.id) return [];
      let q = supabase
        .from("problems")
        .select("id, reference_number, title, status")
        .eq("organization_id", currentOrganization.id)
        .neq("status", "closed")
        .order("created_at", { ascending: false })
        .limit(30);
      if (query) q = q.ilike("title", `%${query}%`);
      const { data } = await q;
      return data ?? [];
    },
    enabled: !!currentOrganization?.id && pickerOpen,
  });

  const link = async (problemId: string) => {
    const { error } = await supabase.from("helpdesk_tickets").update({ parent_problem_id: problemId }).eq("id", ticketId);
    if (error) { toast.error(error.message); return; }
    toast.success("Linked to problem");
    qc.invalidateQueries({ queryKey: ["hd-ticket", ticketId] });
    qc.invalidateQueries({ queryKey: ["ticket-parent-problem"] });
    setPickerOpen(false);
  };
  const unlink = async () => {
    const { error } = await supabase.from("helpdesk_tickets").update({ parent_problem_id: null }).eq("id", ticketId);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["hd-ticket", ticketId] });
  };

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center gap-2">
        <AlertOctagon className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">Problem record</h3>
        {!parent && (
          <div className="ml-auto flex gap-1">
            <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
              <PopoverTrigger asChild>
                <Button size="sm" variant="outline" className="h-7"><Plus className="h-3.5 w-3.5 mr-1" /> Link</Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-0" align="end">
                <Command shouldFilter={false}>
                  <div className="flex items-center border-b px-3">
                    <Search className="h-4 w-4 text-muted-foreground" />
                    <CommandInput value={query} onValueChange={setQuery} placeholder="Search problems…" className="border-0 focus:ring-0" />
                  </div>
                  <CommandList>
                    <CommandEmpty>No matching problems.</CommandEmpty>
                    <CommandGroup>
                      {candidates.map((p: any) => (
                        <CommandItem key={p.id} value={p.id} onSelect={() => link(p.id)} className="flex items-center gap-2">
                          <span className="font-mono text-xs text-muted-foreground">{p.reference_number}</span>
                          <span className="flex-1 truncate text-sm">{p.title}</span>
                          <Badge variant="outline" className="capitalize text-[10px]">{p.status.replace("_"," ")}</Badge>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            <Button size="sm" variant="outline" className="h-7" onClick={() => setCreateOpen(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" /> New
            </Button>
          </div>
        )}
      </div>

      {parent ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Link to={`/problems/${parent.id}`} className="font-medium text-sm hover:underline flex-1 truncate flex items-center gap-1">
              {parent.title}
              <ExternalLink className="h-3 w-3 text-muted-foreground" />
            </Link>
            {parent.is_known_error && <Badge variant="outline" className="gap-1 text-[10px]"><BookOpen className="h-3 w-3" /> KEDB</Badge>}
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={unlink}>
              <Link2Off className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="font-mono text-muted-foreground">{parent.reference_number}</span>
            <Badge variant="secondary" className="capitalize text-[10px]">{parent.status.replace("_"," ")}</Badge>
            <Badge variant="outline" className="capitalize text-[10px]">{parent.priority}</Badge>
          </div>
          {parent.workaround && (
            <div className="rounded-md bg-primary/5 border border-primary/20 p-2 text-xs">
              <div className="font-semibold mb-1 flex items-center gap-1"><BookOpen className="h-3 w-3" /> Workaround available</div>
              <p className="text-muted-foreground whitespace-pre-wrap">{parent.workaround}</p>
            </div>
          )}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Not linked to a problem. Link if this is part of a recurring issue.</p>
      )}

      <CreateProblemDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        fromTicketId={ticketId}
        initialTitle={ticketSubject}
        initialDescription={ticketDescription ?? ""}
      />
    </Card>
  );
}
