import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { Users, Plus, Trash2 } from "lucide-react";

interface Mapping {
  id: string;
  scim_group_name: string;
  access_level: string;
  priority: number;
}

export function SCIMGroupMappingsCard() {
  const { currentOrganization: selectedOrg } = useOrganization();
  const [rows, setRows] = useState<Mapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [groupName, setGroupName] = useState("");
  const [level, setLevel] = useState("viewer");

  const load = async () => {
    if (!selectedOrg) return;
    setLoading(true);
    const { data } = await supabase
      .from("scim_group_role_mappings")
      .select("id, scim_group_name, access_level, priority")
      .eq("organization_id", selectedOrg.id)
      .order("priority", { ascending: true });
    setRows(data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [selectedOrg]);

  const add = async () => {
    if (!selectedOrg || !groupName.trim()) return;
    const { error } = await supabase.from("scim_group_role_mappings").insert({
      organization_id: selectedOrg.id,
      scim_group_name: groupName.trim(),
      access_level: level,
    });
    if (error) { toast.error(error.message); return; }
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
          <div className="space-y-1 flex-1 min-w-[200px]">
            <Label>IdP group name</Label>
            <Input value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="e.g. eng-admins" />
          </div>
          <div className="space-y-1">
            <Label>Access level</Label>
            <Select value={level} onValueChange={setLevel}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="manager">Manager</SelectItem>
                <SelectItem value="editor">Editor</SelectItem>
                <SelectItem value="viewer">Viewer</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={add}><Plus className="mr-2 h-4 w-4" />Add</Button>
        </div>

        {loading ? <Skeleton className="h-24 w-full" /> : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No mappings yet. New SCIM users default to Viewer.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Group name</TableHead>
                <TableHead>Access level</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-sm">{r.scim_group_name}</TableCell>
                  <TableCell><Badge variant="outline">{r.access_level}</Badge></TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => remove(r.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
