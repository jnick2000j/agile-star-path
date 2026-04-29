import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, Box, Key, FileText, AlertTriangle, DollarSign } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { CreateAssetDialog } from "@/components/assets/CreateAssetDialog";
import { CreateLicenseDialog } from "@/components/assets/CreateLicenseDialog";
import { CreateContractDialog } from "@/components/assets/CreateContractDialog";
import { format, differenceInDays, parseISO } from "date-fns";

const STATUS_STYLES: Record<string, string> = {
  in_stock: "bg-muted text-foreground",
  deployed: "bg-success/10 text-success",
  in_repair: "bg-warning/20 text-warning",
  retired: "bg-muted text-muted-foreground",
  disposed: "bg-destructive/10 text-destructive",
  active: "bg-success/10 text-success",
  expired: "bg-destructive/10 text-destructive",
};

function expiryBadge(date: string | null) {
  if (!date) return null;
  const days = differenceInDays(parseISO(date), new Date());
  if (days < 0) return <Badge className="bg-destructive/10 text-destructive">Expired</Badge>;
  if (days <= 30) return <Badge className="bg-warning/20 text-warning">{days}d left</Badge>;
  return <Badge variant="outline">{format(parseISO(date), "MMM d, yyyy")}</Badge>;
}

export default function AssetManagement() {
  const { currentOrganization } = useOrganization();
  const [tab, setTab] = useState("assets");
  const [search, setSearch] = useState("");
  const [createAsset, setCreateAsset] = useState(false);
  const [createLicense, setCreateLicense] = useState(false);
  const [createContract, setCreateContract] = useState(false);

  const orgId = currentOrganization?.id;

  const { data: assets = [] } = useQuery({
    queryKey: ["assets", orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data } = await supabase.from("assets").select("*").eq("organization_id", orgId).order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!orgId,
  });

  const { data: licenses = [] } = useQuery({
    queryKey: ["licenses", orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data } = await supabase.from("software_licenses").select("*").eq("organization_id", orgId).order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!orgId,
  });

  const { data: contracts = [] } = useQuery({
    queryKey: ["contracts", orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data } = await supabase.from("asset_contracts").select("*").eq("organization_id", orgId).order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!orgId,
  });

  const { data: assignments = [] } = useQuery({
    queryKey: ["lic-assignments", orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data } = await supabase.from("license_assignments").select("license_id").eq("organization_id", orgId);
      return data ?? [];
    },
    enabled: !!orgId,
  });

  const seatsUsed = useMemo(() => {
    const m = new Map<string, number>();
    assignments.forEach((a: any) => m.set(a.license_id, (m.get(a.license_id) || 0) + 1));
    return m;
  }, [assignments]);

  const stats = useMemo(() => {
    const totalCost = assets.reduce((s: number, a: any) => s + Number(a.purchase_cost || 0), 0)
      + licenses.reduce((s: number, l: any) => s + Number(l.cost || 0), 0);
    const expiringSoon = [
      ...assets.filter((a: any) => a.warranty_expires_at && differenceInDays(parseISO(a.warranty_expires_at), new Date()) <= 30 && differenceInDays(parseISO(a.warranty_expires_at), new Date()) >= 0),
      ...licenses.filter((l: any) => l.expires_at && differenceInDays(parseISO(l.expires_at), new Date()) <= 30 && differenceInDays(parseISO(l.expires_at), new Date()) >= 0),
      ...contracts.filter((c: any) => c.renewal_date && differenceInDays(parseISO(c.renewal_date), new Date()) <= 30 && differenceInDays(parseISO(c.renewal_date), new Date()) >= 0),
    ].length;
    return { totalCost, expiringSoon, deployed: assets.filter((a: any) => a.status === "deployed").length };
  }, [assets, licenses, contracts]);

  const filterFn = (rows: any[], keys: string[]) => rows.filter((r) => !search || keys.some((k) => String(r[k] || "").toLowerCase().includes(search.toLowerCase())));

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Asset Management</h1>
            <p className="text-sm text-muted-foreground">Hardware, software licenses, and vendor contracts</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-4"><div className="flex items-center gap-3"><Box className="h-8 w-8 text-primary" /><div><p className="text-sm text-muted-foreground">Total Assets</p><p className="text-2xl font-bold">{assets.length}</p></div></div></Card>
          <Card className="p-4"><div className="flex items-center gap-3"><Key className="h-8 w-8 text-primary" /><div><p className="text-sm text-muted-foreground">Licenses</p><p className="text-2xl font-bold">{licenses.length}</p></div></div></Card>
          <Card className="p-4"><div className="flex items-center gap-3"><DollarSign className="h-8 w-8 text-success" /><div><p className="text-sm text-muted-foreground">Total Investment</p><p className="text-2xl font-bold">${stats.totalCost.toLocaleString()}</p></div></div></Card>
          <Card className="p-4"><div className="flex items-center gap-3"><AlertTriangle className="h-8 w-8 text-warning" /><div><p className="text-sm text-muted-foreground">Expiring (30d)</p><p className="text-2xl font-bold">{stats.expiringSoon}</p></div></div></Card>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..." className="pl-9" />
          </div>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <div className="flex items-center justify-between">
            <TabsList>
              <TabsTrigger value="assets">Assets</TabsTrigger>
              <TabsTrigger value="licenses">Licenses</TabsTrigger>
              <TabsTrigger value="contracts">Contracts</TabsTrigger>
            </TabsList>
            {tab === "assets" && <Button onClick={() => setCreateAsset(true)}><Plus className="h-4 w-4 mr-2" />New Asset</Button>}
            {tab === "licenses" && <Button onClick={() => setCreateLicense(true)}><Plus className="h-4 w-4 mr-2" />New License</Button>}
            {tab === "contracts" && <Button onClick={() => setCreateContract(true)}><Plus className="h-4 w-4 mr-2" />New Contract</Button>}
          </div>

          <TabsContent value="assets" className="mt-4">
            <Card>
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Tag</TableHead><TableHead>Name</TableHead><TableHead>Category</TableHead>
                  <TableHead>Status</TableHead><TableHead>Location</TableHead><TableHead>Cost</TableHead><TableHead>Warranty</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {filterFn(assets, ["asset_tag", "name", "serial_number", "model"]).map((a: any) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-mono text-xs">{a.asset_tag}</TableCell>
                      <TableCell className="font-medium">{a.name}</TableCell>
                      <TableCell><Badge variant="outline">{a.category}</Badge></TableCell>
                      <TableCell><Badge className={STATUS_STYLES[a.status]}>{a.status.replace("_", " ")}</Badge></TableCell>
                      <TableCell className="text-sm">{a.location || "—"}</TableCell>
                      <TableCell>{a.purchase_cost ? `$${Number(a.purchase_cost).toLocaleString()}` : "—"}</TableCell>
                      <TableCell>{expiryBadge(a.warranty_expires_at) || "—"}</TableCell>
                    </TableRow>
                  ))}
                  {assets.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No assets yet</TableCell></TableRow>}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          <TabsContent value="licenses" className="mt-4">
            <Card>
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Name</TableHead><TableHead>Software</TableHead><TableHead>Type</TableHead>
                  <TableHead>Seats</TableHead><TableHead>Cost</TableHead><TableHead>Expires</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {filterFn(licenses, ["name", "software_name", "vendor"]).map((l: any) => {
                    const used = seatsUsed.get(l.id) || 0;
                    return (
                      <TableRow key={l.id}>
                        <TableCell className="font-medium">{l.name}</TableCell>
                        <TableCell>{l.software_name}</TableCell>
                        <TableCell><Badge variant="outline">{l.license_type}</Badge></TableCell>
                        <TableCell><span className={used >= l.total_seats ? "text-destructive font-semibold" : ""}>{used} / {l.total_seats}</span></TableCell>
                        <TableCell>{l.cost ? `$${Number(l.cost).toLocaleString()}` : "—"}</TableCell>
                        <TableCell>{expiryBadge(l.expires_at) || "—"}</TableCell>
                      </TableRow>
                    );
                  })}
                  {licenses.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No licenses yet</TableCell></TableRow>}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          <TabsContent value="contracts" className="mt-4">
            <Card>
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Name</TableHead><TableHead>Type</TableHead><TableHead>Vendor</TableHead>
                  <TableHead>Cost</TableHead><TableHead>End Date</TableHead><TableHead>Renewal</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {filterFn(contracts, ["name", "vendor", "contract_number"]).map((c: any) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell><Badge variant="outline">{c.contract_type}</Badge></TableCell>
                      <TableCell>{c.vendor || "—"}</TableCell>
                      <TableCell>{c.cost ? `$${Number(c.cost).toLocaleString()}` : "—"}</TableCell>
                      <TableCell>{c.end_date ? format(parseISO(c.end_date), "MMM d, yyyy") : "—"}</TableCell>
                      <TableCell>{expiryBadge(c.renewal_date) || "—"}</TableCell>
                    </TableRow>
                  ))}
                  {contracts.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No contracts yet</TableCell></TableRow>}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>
        </Tabs>

        <CreateAssetDialog open={createAsset} onOpenChange={setCreateAsset} />
        <CreateLicenseDialog open={createLicense} onOpenChange={setCreateLicense} />
        <CreateContractDialog open={createContract} onOpenChange={setCreateContract} />
      </div>
    </AppLayout>
  );
}
