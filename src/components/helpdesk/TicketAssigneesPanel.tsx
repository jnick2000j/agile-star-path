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
import { Users, Plus, X, Check, Star } from "lucide-react";
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

export function TicketAssigneesPanel({ ticketId, organizationId, orgUsers }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: assignees = [] } = useQuery({
    queryKey: ["helpdesk-assignees", ticketId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("helpdesk_ticket_assignees")
        .select("id, user_id, is_primary, created_at")
        .eq("ticket_id", ticketId)
        .order("is_primary", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!ticketId,
  });

  const assigneeIds = useMemo(() => new Set(assignees.map((a: any) => a.user_id)), [assignees]);
  const userMap = useMemo(() => {
    const m = new Map<string, OrgUser>();
    orgUsers.forEach((u) => m.set(u.user_id, u));
    return m;
  }, [orgUsers]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["helpdesk-assignees", ticketId] });
    qc.invalidateQueries({ queryKey: ["helpdesk-ticket", ticketId] });
  };

  const addAssignee = async (userId: string) => {
    const isFirst = assignees.length === 0;
    const { error } = await supabase.from("helpdesk_ticket_assignees").insert({
      ticket_id: ticketId,
      organization_id: organizationId,
      user_id: userId,
      is_primary: isFirst,
      added_by: user?.id ?? null,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    invalidate();
    toast.success("Assignee added");
  };

  const removeAssignee = async (id: string) => {
    const { error } = await supabase.from("helpdesk_ticket_assignees").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    invalidate();
    toast.success("Assignee removed");
  };

  const setPrimary = async (id: string) => {
    // Clear current primary, then set this one
    await supabase
      .from("helpdesk_ticket_assignees")
      .update({ is_primary: false })
      .eq("ticket_id", ticketId);
    const { error } = await supabase
      .from("helpdesk_ticket_assignees")
      .update({ is_primary: true })
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    invalidate();
    toast.success("Primary assignee updated");
  };

  const toggle = async (userId: string) => {
    const existing = assignees.find((a: any) => a.user_id === userId);
    if (existing) await removeAssignee(existing.id);
    else await addAssignee(userId);
  };

  const displayName = (u?: OrgUser | null) => u?.full_name || u?.email || "Unknown";

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2">
          <Users className="h-4 w-4" /> Assignees
          {assignees.length > 0 && <Badge variant="secondary">{assignees.length}</Badge>}
        </h3>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button size="sm" variant="outline">
              <Plus className="h-4 w-4 mr-1" /> Add
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-0" align="end">
            <Command>
              <CommandInput placeholder="Search agents…" />
              <CommandList>
                <CommandEmpty>No users found.</CommandEmpty>
                <CommandGroup>
                  {orgUsers.map((u) => {
                    const checked = assigneeIds.has(u.user_id);
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

      {assignees.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No assignees yet. Add one or more agents to collaborate on this ticket.
        </p>
      ) : (
        <div className="space-y-1.5">
          {assignees.map((a: any) => {
            const u = userMap.get(a.user_id);
            return (
              <div
                key={a.id}
                className="flex items-center justify-between gap-2 rounded-md border bg-background/50 px-2 py-1.5"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {a.is_primary && (
                    <Star className="h-3.5 w-3.5 fill-primary text-primary shrink-0" />
                  )}
                  <span className="text-sm truncate">{displayName(u)}</span>
                  {a.is_primary && (
                    <Badge variant="outline" className="text-[10px] h-4 px-1">
                      Primary
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {!a.is_primary && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs"
                      onClick={() => setPrimary(a.id)}
                    >
                      Make primary
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => removeAssignee(a.id)}
                    aria-label="Remove assignee"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
