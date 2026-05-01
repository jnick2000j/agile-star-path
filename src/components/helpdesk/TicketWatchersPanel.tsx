import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Eye, Plus, X, Check } from "lucide-react";
import { toast } from "sonner";

interface OrgUser {
  user_id: string;
  full_name?: string | null;
  email?: string | null;
}

interface Props {
  ticketId: string;
  organizationId: string;
  orgUsers: OrgUser[];
}

export function TicketWatchersPanel({ ticketId, organizationId, orgUsers }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: watchers = [] } = useQuery({
    queryKey: ["helpdesk-watchers", ticketId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("helpdesk_ticket_watchers")
        .select("id, user_id, created_at")
        .eq("ticket_id", ticketId);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!ticketId,
  });

  const watcherIds = useMemo(() => new Set(watchers.map((w: any) => w.user_id)), [watchers]);
  const userMap = useMemo(() => {
    const m = new Map<string, OrgUser>();
    orgUsers.forEach((u) => m.set(u.user_id, u));
    return m;
  }, [orgUsers]);

  const addWatcher = async (userId: string) => {
    const { error } = await supabase.from("helpdesk_ticket_watchers").insert({
      ticket_id: ticketId,
      organization_id: organizationId,
      user_id: userId,
      added_by: user?.id ?? null,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["helpdesk-watchers", ticketId] });
    toast.success("Watcher added");
  };

  const removeWatcher = async (id: string) => {
    const { error } = await supabase.from("helpdesk_ticket_watchers").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["helpdesk-watchers", ticketId] });
    toast.success("Watcher removed");
  };

  const toggle = async (userId: string) => {
    const existing = watchers.find((w: any) => w.user_id === userId);
    if (existing) await removeWatcher(existing.id);
    else await addWatcher(userId);
  };

  const isSelfWatching = user?.id ? watcherIds.has(user.id) : false;

  const displayName = (u?: OrgUser | null) => u?.full_name || u?.email || "Unknown";

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2">
          <Eye className="h-4 w-4" /> Watchers
          {watchers.length > 0 && <Badge variant="secondary">{watchers.length}</Badge>}
        </h3>
        <div className="flex items-center gap-2">
          {user && (
            <Button size="sm" variant="ghost" onClick={() => toggle(user.id)}>
              {isSelfWatching ? "Unwatch" : "Watch"}
            </Button>
          )}
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button size="sm" variant="outline">
                <Plus className="h-4 w-4 mr-1" /> Add
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-0" align="end">
              <Command>
                <CommandInput placeholder="Search users…" />
                <CommandList>
                  <CommandEmpty>No users found.</CommandEmpty>
                  <CommandGroup>
                    {orgUsers.map((u) => {
                      const checked = watcherIds.has(u.user_id);
                      return (
                        <CommandItem
                          key={u.user_id}
                          value={`${u.full_name ?? ""} ${u.email ?? ""}`}
                          onSelect={() => toggle(u.user_id)}
                          className="flex items-center justify-between"
                        >
                          <span className="truncate">{displayName(u)}</span>
                          {checked && <Check className="h-4 w-4 text-primary" />}
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {watchers.length === 0 ? (
        <p className="text-xs text-muted-foreground">No watchers yet. Add team members to keep them in the loop.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {watchers.map((w: any) => {
            const u = userMap.get(w.user_id);
            return (
              <Badge key={w.id} variant="secondary" className="gap-1 pr-1">
                <span className="truncate max-w-[140px]">{displayName(u)}</span>
                <button
                  type="button"
                  className="ml-1 rounded-full hover:bg-background/40 p-0.5"
                  onClick={() => removeWatcher(w.id)}
                  aria-label="Remove watcher"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            );
          })}
        </div>
      )}
    </Card>
  );
}
