import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { Users, Plus, Trash2, ChevronsUpDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface Mapping {
  id: string;
  scim_group_name: string;
  access_level: string;
  priority: number;
}

interface DiscoveredGroup {
  name: string;
  user_count: number;
}

export function SCIMGroupMappingsCard() {
  const { currentOrganization: selectedOrg } = useOrganization();
  const [rows, setRows] = useState<Mapping[]>([]);
  const [discovered, setDiscovered] = useState<DiscoveredGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [groupName, setGroupName] = useState("");
  const [level, setLevel] = useState("viewer");
  const [pickerOpen, setPickerOpen] = useState(false);

  const load = async () => {
    if (!selectedOrg) return;
    setLoading(true);

    const [{ data: mappings }, { data: syncRows }] = await Promise.all([
      supabase
        .from("scim_group_role_mappings")
        .select("id, scim_group_name, access_level, priority")
        .eq("organization_id", selectedOrg.id)
        .order("priority", { ascending: true }),
      supabase
        .from("scim_user_sync_state")
        .select("scim_groups")
        .eq("organization_id", selectedOrg.id)
        .eq("active", true),
    ]);

    setRows(mappings ?? []);

    // Aggregate discovered groups + counts from synced users
    const counts = new Map<string, number>();
    for (const row of (syncRows ?? []) as { scim_groups: string[] | null }[]) {
      for (const g of row.scim_groups ?? []) {
        counts.set(g, (counts.get(g) ?? 0) + 1);
      }
    }
    setDiscovered(
      Array.from(counts.entries())
        .map(([name, user_count]) => ({ name, user_count }))
        .sort((a, b) => b.user_count - a.user_count)
    );

    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOrg?.id]);

  const mappedNames = useMemo(() => new Set(rows.map((r) => r.scim_group_name)), [rows]);
  const unmappedDiscovered = useMemo(
    () => discovered.filter((g) => !mappedNames.has(g.name)),
    [discovered, mappedNames]
  );

  const add = async () => {
    if (!selectedOrg || !groupName.trim()) return;
    const { error } = await supabase.from("scim_group_role_mappings").insert({
      organization_id: selectedOrg.id,
      scim_group_name: groupName.trim(),
      access_level: level,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    setGroupName("");
    load();
  };

  const remove = async (id: string) => {
    await supabase.from("scim_group_role_mappings").delete().eq("id", id);
    load();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          SCIM group → role mappings
        </CardTitle>
        <CardDescription>
          Map identity provider group names to organization access levels. Highest privilege wins
          when a user belongs to multiple mapped groups.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1 flex-1 min-w-[240px]">
            <Label>IdP group name</Label>
            <div className="flex gap-1">
              <Input
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="e.g. eng-admins"
                className="flex-1"
              />
              <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    type="button"
                    title="Pick from discovered groups"
                  >
                    <ChevronsUpDown className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[320px] p-0" align="end">
                  <Command>
                    <CommandInput placeholder="Search discovered groups…" />
                    <CommandList>
                      <CommandEmpty>
                        {discovered.length === 0
                          ? "No groups discovered yet — provision users via SCIM first."
                          : "No matching groups."}
                      </CommandEmpty>
                      <CommandGroup heading={`Discovered (${unmappedDiscovered.length})`}>
                        {unmappedDiscovered.map((g) => (
                          <CommandItem
                            key={g.name}
                            value={g.name}
                            onSelect={() => {
                              setGroupName(g.name);
                              setPickerOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                groupName === g.name ? "opacity-100" : "opacity-0"
                              )}
                            />
                            <span className="font-mono text-sm flex-1 truncate">{g.name}</span>
                            <Badge variant="secondary" className="ml-2 text-[10px]">
                              {g.user_count} user{g.user_count === 1 ? "" : "s"}
                            </Badge>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <div className="space-y-1">
            <Label>Access level</Label>
            <Select value={level} onValueChange={setLevel}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="manager">Manager</SelectItem>
                <SelectItem value="editor">Editor</SelectItem>
                <SelectItem value="viewer">Viewer</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={add} disabled={!groupName.trim()}>
            <Plus className="mr-2 h-4 w-4" />
            Add
          </Button>
        </div>

        {discovered.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {discovered.length} group{discovered.length === 1 ? "" : "s"} discovered from SCIM —{" "}
            {unmappedDiscovered.length} unmapped.
          </p>
        )}

        {loading ? (
          <Skeleton className="h-24 w-full" />
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No mappings yet. New SCIM users default to Viewer.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Group name</TableHead>
                <TableHead>Access level</TableHead>
                <TableHead>Members</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const match = discovered.find((d) => d.name === r.scim_group_name);
                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-sm">{r.scim_group_name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{r.access_level}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {match ? `${match.user_count} synced` : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => remove(r.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
