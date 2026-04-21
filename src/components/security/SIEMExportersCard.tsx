import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { Cable, Plus, Send, Trash2, AlertCircle, CheckCircle2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface Exporter {
  id: string;
  name: string;
  destination_type: string;
  endpoint_url: string;
  format: string;
  event_categories: string[];
  is_active: boolean;
  last_delivery_at: string | null;
  last_delivery_status: string | null;
  consecutive_failures: number;
}

const CATEGORIES = ["auth", "sso", "admin", "data", "billing"];

export function SIEMExportersCard() {
  const { currentOrganization: selectedOrg } = useOrganization();
  const [exporters, setExporters] = useState<Exporter[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({
    name: "",
    destination_type: "webhook",
    endpoint_url: "",
    format: "json",
    auth_header_name: "Authorization",
    auth_secret_name: "",
    event_categories: ["auth", "sso", "admin"],
  });

  const load = async () => {
    if (!selectedOrg) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("siem_exporters")
      .select("*")
      .eq("organization_id", selectedOrg.id)
      .order("created_at", { ascending: false });
    if (error) toast.error("Failed to load exporters");
    setExporters(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [selectedOrg]);

  const create = async () => {
    if (!selectedOrg) return;
    const { error } = await supabase.from("siem_exporters").insert({
      organization_id: selectedOrg.id,
      ...draft,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Exporter created");
    setOpen(false);
    load();
  };

  const toggle = async (id: string, active: boolean) => {
    await supabase.from("siem_exporters").update({ is_active: active }).eq("id", id);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this exporter?")) return;
    await supabase.from("siem_exporters").delete().eq("id", id);
    load();
  };

  const send = async (id: string, dry_run = false) => {
    const { data, error } = await supabase.functions.invoke("siem-export", {
      body: { exporter_id: id, dry_run },
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    const result = data?.results?.[0];
    if (result?.status === "success") toast.success(`Delivered ${result.events} events`);
    else if (result?.status === "noop") toast.message("No new events to deliver");
    else toast.error("Delivery failed");
    load();
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Cable className="h-5 w-5" />
                SIEM exporters
              </CardTitle>
              <CardDescription>
                Stream audit events to your security tooling (Splunk, Datadog, generic webhook).
              </CardDescription>
            </div>
            <Button onClick={() => setOpen(true)} size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Add exporter
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-24 w-full" />
          ) : exporters.length === 0 ? (
            <p className="text-sm text-muted-foreground">No exporters configured.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Destination</TableHead>
                  <TableHead>Last delivery</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {exporters.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell>
                      <div className="font-medium text-sm">{e.name}</div>
                      <div className="text-xs text-muted-foreground">{e.format.toUpperCase()}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{e.destination_type}</Badge>
                      <div className="text-xs text-muted-foreground mt-1 truncate max-w-[20rem]">
                        {e.endpoint_url}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {e.last_delivery_at ? (
                        <div className="flex items-center gap-1">
                          {e.last_delivery_status === "success" ? (
                            <CheckCircle2 className="h-3 w-3 text-success" />
                          ) : (
                            <AlertCircle className="h-3 w-3 text-destructive" />
                          )}
                          <span className="text-muted-foreground">
                            {formatDistanceToNow(new Date(e.last_delivery_at), { addSuffix: true })}
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs">Never</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Switch checked={e.is_active} onCheckedChange={(c) => toggle(e.id, c)} />
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button variant="ghost" size="sm" onClick={() => send(e.id)}>
                        <Send className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => remove(e.id)}>
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New SIEM exporter</DialogTitle>
            <DialogDescription>
              Configure a destination to receive audit events. Auth secrets must be added via
              Lovable Cloud secrets first.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Name</Label>
              <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Type</Label>
                <Select
                  value={draft.destination_type}
                  onValueChange={(v) => setDraft({ ...draft, destination_type: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="webhook">Generic webhook</SelectItem>
                    <SelectItem value="datadog">Datadog</SelectItem>
                    <SelectItem value="splunk_hec">Splunk HEC</SelectItem>
                    <SelectItem value="s3">S3 bucket</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Format</Label>
                <Select value={draft.format} onValueChange={(v) => setDraft({ ...draft, format: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="json">JSON</SelectItem>
                    <SelectItem value="cef">CEF</SelectItem>
                    <SelectItem value="leef">LEEF</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Endpoint URL</Label>
              <Input
                value={draft.endpoint_url}
                onChange={(e) => setDraft({ ...draft, endpoint_url: e.target.value })}
                placeholder="https://intake.example.com/audit"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Auth header name</Label>
                <Input
                  value={draft.auth_header_name}
                  onChange={(e) => setDraft({ ...draft, auth_header_name: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>Secret name</Label>
                <Input
                  value={draft.auth_secret_name}
                  onChange={(e) => setDraft({ ...draft, auth_secret_name: e.target.value })}
                  placeholder="SIEM_DATADOG_KEY"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Event categories</Label>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((c) => {
                  const on = draft.event_categories.includes(c);
                  return (
                    <Badge
                      key={c}
                      variant={on ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() =>
                        setDraft({
                          ...draft,
                          event_categories: on
                            ? draft.event_categories.filter((x) => x !== c)
                            : [...draft.event_categories, c],
                        })
                      }
                    >
                      {c}
                    </Badge>
                  );
                })}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={create} disabled={!draft.name || !draft.endpoint_url}>
              Create exporter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
