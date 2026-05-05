import { useState, useEffect, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Plus, Rocket, GitMerge, CalendarDays, Search, ShieldCheck, Package,
  CheckCircle2, XCircle, Clock, ArrowUpRight, Trash2, FileText,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import { toast } from "sonner";
import { format, parseISO, isAfter, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from "date-fns";

type ReleaseStatus = "planning" | "in_development" | "code_freeze" | "in_testing" | "ready_for_release" | "released" | "rolled_back" | "cancelled";

interface Release {
  id: string;
  reference_number: string | null;
  name: string;
  version: string;
  description: string | null;
  release_type: string;
  status: ReleaseStatus;
  target_date: string | null;
  released_at: string | null;
  code_freeze_at: string | null;
  release_manager_id: string | null;
  release_notes: string | null;
  rollback_plan: string | null;
  is_hotfix: boolean;
  product_id: string;
  organization_id: string;
  created_at: string;
}

interface Product { id: string; name: string }
interface Environment {
  id: string; name: string; slug: string; display_order: number;
  is_production: boolean; requires_approval: boolean; auto_create_change_request: boolean;
  product_id: string;
}
interface Promotion {
  id: string; release_id: string; environment_id: string;
  status: string; started_at: string | null; completed_at: string | null;
  notes: string | null; change_request_id: string | null;
}
interface ScopeItem {
  id: string; release_id: string; item_type: "feature" | "work_package" | "task";
  feature_id: string | null; work_package_id: string | null; task_id: string | null;
  notes: string | null;
}
interface Gate {
  id: string; release_id: string; name: string; description: string | null;
  display_order: number; status: "pending" | "in_review" | "approved" | "rejected" | "waived";
  required: boolean; decision_notes: string | null; decided_at: string | null;
}

const STATUS_COLORS: Record<ReleaseStatus, string> = {
  planning: "bg-slate-500/15 text-slate-700 dark:text-slate-300",
  in_development: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  code_freeze: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  in_testing: "bg-purple-500/15 text-purple-700 dark:text-purple-300",
  ready_for_release: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  released: "bg-green-600/20 text-green-700 dark:text-green-300",
  rolled_back: "bg-red-500/15 text-red-700 dark:text-red-300",
  cancelled: "bg-muted text-muted-foreground",
};

const STATUS_OPTIONS: { value: ReleaseStatus; label: string }[] = [
  { value: "planning", label: "Planning" },
  { value: "in_development", label: "In Development" },
  { value: "code_freeze", label: "Code Freeze" },
  { value: "in_testing", label: "In Testing" },
  { value: "ready_for_release", label: "Ready for Release" },
  { value: "released", label: "Released" },
  { value: "rolled_back", label: "Rolled Back" },
  { value: "cancelled", label: "Cancelled" },
];

const RELEASE_TYPES = ["major", "minor", "patch", "hotfix", "preview"];

export default function ProductReleases() {
  const { user } = useAuth();
  const { currentOrganization: organization } = useOrganization();
  const [products, setProducts] = useState<Product[]>([]);
  const [releases, setReleases] = useState<Release[]>([]);
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [productFilter, setProductFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const [createOpen, setCreateOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [activeRelease, setActiveRelease] = useState<Release | null>(null);

  const loadAll = async () => {
    if (!organization?.id) return;
    setLoading(true);
    const [prodRes, relRes, envRes, promoRes] = await Promise.all([
      supabase.from("products").select("id,name").eq("organization_id", organization.id).order("name"),
      supabase.from("releases").select("*").eq("organization_id", organization.id).order("target_date", { ascending: true, nullsFirst: false }),
      supabase.from("release_environments").select("*").eq("organization_id", organization.id).order("display_order"),
      supabase.from("release_promotions").select("*").eq("organization_id", organization.id).order("created_at", { ascending: false }),
    ]);
    setProducts((prodRes.data ?? []) as Product[]);
    setReleases((relRes.data ?? []) as Release[]);
    setEnvironments((envRes.data ?? []) as Environment[]);
    setPromotions((promoRes.data ?? []) as Promotion[]);
    setLoading(false);
  };

  useEffect(() => { loadAll(); /* eslint-disable-next-line */ }, [organization?.id]);

  const ensureEnvironments = async (productId: string) => {
    const existing = environments.filter(e => e.product_id === productId);
    if (existing.length > 0) return;
    await supabase.rpc("seed_default_release_environments", { p_product_id: productId });
    const { data } = await supabase.from("release_environments").select("*")
      .eq("organization_id", organization!.id).order("display_order");
    setEnvironments((data ?? []) as Environment[]);
  };

  const filtered = useMemo(() => {
    return releases.filter(r => {
      if (productFilter !== "all" && r.product_id !== productFilter) return false;
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (search && !(r.name?.toLowerCase().includes(search.toLowerCase())
        || r.version?.toLowerCase().includes(search.toLowerCase())
        || r.reference_number?.toLowerCase().includes(search.toLowerCase()))) return false;
      return true;
    });
  }, [releases, productFilter, statusFilter, search]);

  const productName = (id: string) => products.find(p => p.id === id)?.name ?? "—";

  const upcoming = useMemo(() => filtered.filter(r =>
    r.target_date && isAfter(parseISO(r.target_date), new Date()) && r.status !== "released" && r.status !== "cancelled"
  ).slice(0, 6), [filtered]);

  const released = useMemo(() => filtered.filter(r => r.status === "released").length, [filtered]);
  const inFlight = useMemo(() => filtered.filter(r =>
    !["released", "cancelled", "rolled_back"].includes(r.status)
  ).length, [filtered]);

  return (
    <AppLayout title="Software Releases" subtitle="Plan, gate, promote and ship product releases">
      <div className="p-4 md:p-6 space-y-4">
        <div className="flex items-center justify-end">
          <Button onClick={() => setCreateOpen(true)} disabled={products.length === 0}>
            <Plus className="h-4 w-4 mr-2" /> New Release
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <StatCard icon={Package} label="Products" value={products.length} />
          <StatCard icon={Rocket} label="Releases" value={releases.length} />
          <StatCard icon={Clock} label="In Flight" value={inFlight} />
          <StatCard icon={CheckCircle2} label="Released" value={released} />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search releases…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={productFilter} onValueChange={setProductFilter}>
            <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Products</SelectItem>
              {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {STATUS_OPTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <Tabs defaultValue="list">
          <TabsList>
            <TabsTrigger value="list">List</TabsTrigger>
            <TabsTrigger value="train"><GitMerge className="h-4 w-4 mr-1" /> Release Train</TabsTrigger>
            <TabsTrigger value="calendar"><CalendarDays className="h-4 w-4 mr-1" /> Calendar</TabsTrigger>
          </TabsList>

          <TabsContent value="list">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Reference</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>Name / Version</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Target Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading && <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>}
                    {!loading && filtered.length === 0 && (
                      <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                        No releases yet. Create your first release to get started.
                      </TableCell></TableRow>
                    )}
                    {filtered.map(r => (
                      <TableRow key={r.id} className="cursor-pointer" onClick={() => { setActiveRelease(r); setDetailOpen(true); }}>
                        <TableCell className="font-mono text-xs">{r.reference_number}</TableCell>
                        <TableCell>{productName(r.product_id)}</TableCell>
                        <TableCell>
                          <div className="font-medium">{r.name}</div>
                          <div className="text-xs text-muted-foreground">v{r.version}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">{r.release_type}</Badge>
                          {r.is_hotfix && <Badge variant="destructive" className="ml-1">Hotfix</Badge>}
                        </TableCell>
                        <TableCell>{r.target_date ? format(parseISO(r.target_date), "MMM d, yyyy") : "—"}</TableCell>
                        <TableCell>
                          <Badge className={STATUS_COLORS[r.status]} variant="secondary">
                            {STATUS_OPTIONS.find(s => s.value === r.status)?.label}
                          </Badge>
                        </TableCell>
                        <TableCell><ArrowUpRight className="h-4 w-4 text-muted-foreground" /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="train">
            <ReleaseTrain
              releases={filtered}
              environments={environments}
              promotions={promotions}
              productName={productName}
              onOpen={(r) => { setActiveRelease(r); setDetailOpen(true); }}
            />
          </TabsContent>

          <TabsContent value="calendar">
            <ReleaseCalendar releases={filtered} productName={productName} onOpen={(r) => { setActiveRelease(r); setDetailOpen(true); }} />
          </TabsContent>
        </Tabs>

        {upcoming.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Upcoming Releases</CardTitle>
              <CardDescription>Next scheduled releases across all products</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {upcoming.map(r => (
                <div key={r.id} className="rounded-lg border p-3 cursor-pointer hover:bg-accent/50"
                  onClick={() => { setActiveRelease(r); setDetailOpen(true); }}>
                  <div className="text-xs text-muted-foreground">{productName(r.product_id)}</div>
                  <div className="font-medium">{r.name} <span className="text-muted-foreground">v{r.version}</span></div>
                  <div className="text-xs mt-1">{r.target_date ? format(parseISO(r.target_date), "MMM d") : ""}</div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      <CreateReleaseDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        products={products}
        userId={user?.id ?? null}
        organizationId={organization?.id ?? null}
        onCreated={async (productId) => { await ensureEnvironments(productId); await loadAll(); }}
      />

      <ReleaseDetailDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        release={activeRelease}
        environments={environments.filter(e => e.product_id === activeRelease?.product_id)}
        promotions={promotions.filter(p => p.release_id === activeRelease?.id)}
        productName={activeRelease ? productName(activeRelease.product_id) : ""}
        onChanged={loadAll}
      />
    </AppLayout>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: any; label: string; value: number }) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className="rounded-md bg-primary/10 p-2"><Icon className="h-5 w-5 text-primary" /></div>
        <div>
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="text-2xl font-semibold">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================
// CREATE DIALOG
// ============================================================
function CreateReleaseDialog({
  open, onOpenChange, products, userId, organizationId, onCreated,
}: {
  open: boolean; onOpenChange: (b: boolean) => void;
  products: Product[]; userId: string | null; organizationId: string | null;
  onCreated: (productId: string) => Promise<void>;
}) {
  const [productId, setProductId] = useState("");
  const [name, setName] = useState("");
  const [version, setVersion] = useState("");
  const [releaseType, setReleaseType] = useState("minor");
  const [targetDate, setTargetDate] = useState("");
  const [description, setDescription] = useState("");
  const [isHotfix, setIsHotfix] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setProductId(""); setName(""); setVersion(""); setReleaseType("minor");
      setTargetDate(""); setDescription(""); setIsHotfix(false);
    }
  }, [open]);

  const submit = async () => {
    if (!productId || !name || !version || !organizationId) {
      toast.error("Product, name and version are required");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("releases").insert({
      organization_id: organizationId,
      product_id: productId,
      name, version,
      release_type: releaseType,
      target_date: targetDate || null,
      description: description || null,
      is_hotfix: isHotfix,
      release_manager_id: userId,
      created_by: userId,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Release created");
    await onCreated(productId);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Create Release</DialogTitle>
          <DialogDescription>Plan a new software release for one of your products.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Product</Label>
            <Select value={productId} onValueChange={setProductId}>
              <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
              <SelectContent>
                {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Q4 launch" />
            </div>
            <div>
              <Label>Version</Label>
              <Input value={version} onChange={(e) => setVersion(e.target.value)} placeholder="1.4.0" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Type</Label>
              <Select value={releaseType} onValueChange={setReleaseType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {RELEASE_TYPES.map(t => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Target Date</Label>
              <Input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
          <div className="flex items-center justify-between rounded-md border p-2">
            <div>
              <Label className="text-sm">Hotfix</Label>
              <div className="text-xs text-muted-foreground">Out-of-band emergency release</div>
            </div>
            <Switch checked={isHotfix} onCheckedChange={setIsHotfix} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>{saving ? "Creating…" : "Create"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// DETAIL DIALOG
// ============================================================
function ReleaseDetailDialog({
  open, onOpenChange, release, environments, promotions, productName, onChanged,
}: {
  open: boolean; onOpenChange: (b: boolean) => void;
  release: Release | null;
  environments: Environment[];
  promotions: Promotion[];
  productName: string;
  onChanged: () => Promise<void> | void;
}) {
  const [scope, setScope] = useState<ScopeItem[]>([]);
  const [gates, setGates] = useState<Gate[]>([]);
  const [features, setFeatures] = useState<{ id: string; title: string }[]>([]);
  const [workPackages, setWorkPackages] = useState<{ id: string; name: string }[]>([]);
  const [tasks, setTasks] = useState<{ id: string; title: string }[]>([]);
  const [status, setStatus] = useState<ReleaseStatus>("planning");
  const [notes, setNotes] = useState("");
  const [rollback, setRollback] = useState("");
  const [busy, setBusy] = useState(false);

  // add scope/gate inputs
  const [addScopeType, setAddScopeType] = useState<"feature" | "work_package" | "task">("feature");
  const [addScopeId, setAddScopeId] = useState("");
  const [newGateName, setNewGateName] = useState("");

  useEffect(() => {
    if (!release) return;
    setStatus(release.status);
    setNotes(release.release_notes ?? "");
    setRollback(release.rollback_plan ?? "");
    (async () => {
      const [sc, gt, ft, wp, tk] = await Promise.all([
        supabase.from("release_scope_items").select("*").eq("release_id", release.id),
        supabase.from("release_gates").select("*").eq("release_id", release.id).order("display_order"),
        supabase.from("product_features").select("id,title").eq("product_id", release.product_id),
        supabase.from("work_packages").select("id,name").eq("organization_id", release.organization_id),
        supabase.from("tasks").select("id,title").eq("organization_id", release.organization_id).limit(500),
      ]);
      setScope((sc.data ?? []) as ScopeItem[]);
      setGates((gt.data ?? []) as Gate[]);
      setFeatures((ft.data ?? []) as any);
      setWorkPackages((wp.data ?? []) as any);
      setTasks((tk.data ?? []) as any);
    })();
  }, [release?.id]);

  if (!release) return null;

  const refresh = async () => {
    const [sc, gt] = await Promise.all([
      supabase.from("release_scope_items").select("*").eq("release_id", release.id),
      supabase.from("release_gates").select("*").eq("release_id", release.id).order("display_order"),
    ]);
    setScope((sc.data ?? []) as ScopeItem[]);
    setGates((gt.data ?? []) as Gate[]);
    await onChanged();
  };

  const saveDetails = async () => {
    setBusy(true);
    const { error } = await supabase.from("releases").update({
      status, release_notes: notes, rollback_plan: rollback,
    }).eq("id", release.id);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Release updated");
    await onChanged();
  };

  const addScope = async () => {
    if (!addScopeId) return;
    const payload: any = {
      organization_id: release.organization_id,
      release_id: release.id,
      item_type: addScopeType,
    };
    if (addScopeType === "feature") payload.feature_id = addScopeId;
    if (addScopeType === "work_package") payload.work_package_id = addScopeId;
    if (addScopeType === "task") payload.task_id = addScopeId;
    const { error } = await supabase.from("release_scope_items").insert(payload);
    if (error) { toast.error(error.message); return; }
    setAddScopeId("");
    await refresh();
  };

  const removeScope = async (id: string) => {
    await supabase.from("release_scope_items").delete().eq("id", id);
    await refresh();
  };

  const addGate = async () => {
    if (!newGateName.trim()) return;
    const { error } = await supabase.from("release_gates").insert({
      organization_id: release.organization_id,
      release_id: release.id,
      name: newGateName.trim(),
      display_order: gates.length + 1,
    });
    if (error) { toast.error(error.message); return; }
    setNewGateName("");
    await refresh();
  };

  const decideGate = async (gateId: string, decision: "approved" | "rejected" | "waived") => {
    const { error } = await supabase.from("release_gates").update({
      status: decision, decided_at: new Date().toISOString(),
    }).eq("id", gateId);
    if (error) { toast.error(error.message); return; }
    await refresh();
  };

  const promote = async (envId: string) => {
    setBusy(true);
    const { data: { session } } = await supabase.auth.getSession();
    const res = await supabase.functions.invoke("release-promote", {
      body: { release_id: release.id, environment_id: envId, status: "succeeded" },
      headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
    });
    setBusy(false);
    if (res.error) { toast.error(res.error.message); return; }
    toast.success("Promoted");
    const env = environments.find(e => e.id === envId);
    if (env?.auto_create_change_request) toast.info("Change Request auto-created");
    await onChanged();
  };

  const generateNotes = async () => {
    const featureLines = scope.filter(s => s.item_type === "feature")
      .map(s => `- ${features.find(f => f.id === s.feature_id)?.title ?? "Feature"}`);
    const wpLines = scope.filter(s => s.item_type === "work_package")
      .map(s => `- ${workPackages.find(w => w.id === s.work_package_id)?.name ?? "Work Package"}`);
    const taskLines = scope.filter(s => s.item_type === "task")
      .map(s => `- ${tasks.find(t => t.id === s.task_id)?.title ?? "Task"}`);
    const md = [
      `# ${release.name} — v${release.version}`,
      release.target_date ? `Target: ${format(parseISO(release.target_date), "MMM d, yyyy")}` : "",
      "",
      featureLines.length ? "## Features\n" + featureLines.join("\n") : "",
      wpLines.length ? "\n## Work Packages\n" + wpLines.join("\n") : "",
      taskLines.length ? "\n## Tasks\n" + taskLines.join("\n") : "",
    ].filter(Boolean).join("\n");
    setNotes(md);
    toast.success("Release notes drafted");
  };

  const lastPromoStatus = (envId: string) =>
    promotions.find(p => p.environment_id === envId)?.status ?? "—";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Rocket className="h-5 w-5 text-primary" />
            {release.name} <span className="text-muted-foreground font-normal">v{release.version}</span>
            {release.is_hotfix && <Badge variant="destructive">Hotfix</Badge>}
          </DialogTitle>
          <DialogDescription>
            {productName} · {release.reference_number}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="scope">Scope ({scope.length})</TabsTrigger>
            <TabsTrigger value="gates">Gates ({gates.length})</TabsTrigger>
            <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
            <TabsTrigger value="notes">Release Notes</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Status</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as ReleaseStatus)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Target Date</Label>
                <Input value={release.target_date ? format(parseISO(release.target_date), "yyyy-MM-dd") : ""} disabled />
              </div>
            </div>
            <div>
              <Label>Rollback Plan</Label>
              <Textarea value={rollback} onChange={(e) => setRollback(e.target.value)} rows={4}
                placeholder="Steps to revert if the release fails…" />
            </div>
            <div className="flex justify-end">
              <Button onClick={saveDetails} disabled={busy}>Save</Button>
            </div>
          </TabsContent>

          <TabsContent value="scope" className="space-y-3">
            <div className="flex gap-2 items-end flex-wrap">
              <div>
                <Label>Type</Label>
                <Select value={addScopeType} onValueChange={(v: any) => { setAddScopeType(v); setAddScopeId(""); }}>
                  <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="feature">Feature</SelectItem>
                    <SelectItem value="work_package">Work Package</SelectItem>
                    <SelectItem value="task">Task</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1 min-w-[240px]">
                <Label>Item</Label>
                <Select value={addScopeId} onValueChange={setAddScopeId}>
                  <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                  <SelectContent>
                    {addScopeType === "feature" && features.map(f =>
                      <SelectItem key={f.id} value={f.id}>{f.title}</SelectItem>)}
                    {addScopeType === "work_package" && workPackages.map(w =>
                      <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                    {addScopeType === "task" && tasks.map(t =>
                      <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={addScope}><Plus className="h-4 w-4 mr-1" /> Add</Button>
            </div>
            <Table>
              <TableHeader><TableRow>
                <TableHead>Type</TableHead><TableHead>Item</TableHead><TableHead className="w-12"></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {scope.map(s => {
                  const label = s.item_type === "feature" ? features.find(f => f.id === s.feature_id)?.title
                    : s.item_type === "work_package" ? workPackages.find(w => w.id === s.work_package_id)?.name
                    : tasks.find(t => t.id === s.task_id)?.title;
                  return (
                    <TableRow key={s.id}>
                      <TableCell><Badge variant="outline" className="capitalize">{s.item_type.replace("_", " ")}</Badge></TableCell>
                      <TableCell>{label ?? "—"}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => removeScope(s.id)}><Trash2 className="h-4 w-4" /></Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {scope.length === 0 && <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-6">No scope items yet</TableCell></TableRow>}
              </TableBody>
            </Table>
          </TabsContent>

          <TabsContent value="gates" className="space-y-3">
            <div className="flex gap-2">
              <Input placeholder="New gate name (e.g. QA sign-off)" value={newGateName} onChange={(e) => setNewGateName(e.target.value)} />
              <Button onClick={addGate}><Plus className="h-4 w-4 mr-1" /> Add Gate</Button>
            </div>
            <div className="space-y-2">
              {gates.map(g => (
                <div key={g.id} className="rounded-md border p-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <ShieldCheck className="h-4 w-4 text-primary shrink-0" />
                    <div className="min-w-0">
                      <div className="font-medium truncate">{g.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {g.required ? "Required" : "Optional"} · {g.status}
                        {g.decided_at && ` · ${format(parseISO(g.decided_at), "MMM d, yyyy")}`}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {g.status === "pending" || g.status === "in_review" ? (
                      <>
                        <Button size="sm" variant="outline" onClick={() => decideGate(g.id, "approved")}>
                          <CheckCircle2 className="h-4 w-4 mr-1" /> Approve
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => decideGate(g.id, "rejected")}>
                          <XCircle className="h-4 w-4 mr-1" /> Reject
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => decideGate(g.id, "waived")}>Waive</Button>
                      </>
                    ) : (
                      <Badge variant={g.status === "approved" ? "default" : g.status === "rejected" ? "destructive" : "secondary"}>
                        {g.status}
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
              {gates.length === 0 && (
                <div className="text-center text-muted-foreground py-6 text-sm">
                  No gates defined. Add Go/No-Go gates for QA, security, product sign-off, etc.
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="pipeline" className="space-y-3">
            <div className="text-sm text-muted-foreground">
              Promote this release through your product's environments. Promotion to environments marked
              &quot;auto-create change request&quot; will open a Change Management ticket automatically.
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {environments.length === 0 && (
                <div className="text-sm text-muted-foreground col-span-2 text-center py-6">
                  No environments configured for this product yet.
                </div>
              )}
              {environments.map(env => {
                const last = promotions.find(p => p.environment_id === env.id);
                return (
                  <Card key={env.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium flex items-center gap-2">
                            {env.name}
                            {env.is_production && <Badge variant="default">Prod</Badge>}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Last: {last ? `${last.status} · ${last.completed_at ? format(parseISO(last.completed_at), "MMM d") : "—"}` : "Never promoted"}
                          </div>
                          {env.auto_create_change_request && (
                            <div className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                              Auto-creates Change Request
                            </div>
                          )}
                        </div>
                        <Button size="sm" onClick={() => promote(env.id)} disabled={busy}>
                          <ArrowUpRight className="h-4 w-4 mr-1" /> Promote
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="notes" className="space-y-3">
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={generateNotes}>
                <FileText className="h-4 w-4 mr-1" /> Generate from scope
              </Button>
              <Button onClick={saveDetails} disabled={busy}>Save</Button>
            </div>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={16}
              className="font-mono text-sm" placeholder="Markdown release notes…" />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// RELEASE TRAIN
// ============================================================
function ReleaseTrain({
  releases, environments, promotions, productName, onOpen,
}: {
  releases: Release[]; environments: Environment[]; promotions: Promotion[];
  productName: (id: string) => string; onOpen: (r: Release) => void;
}) {
  const byProduct = useMemo(() => {
    const m = new Map<string, Release[]>();
    releases.forEach(r => {
      if (!m.has(r.product_id)) m.set(r.product_id, []);
      m.get(r.product_id)!.push(r);
    });
    return m;
  }, [releases]);

  return (
    <div className="space-y-4">
      {Array.from(byProduct.entries()).map(([pid, rs]) => {
        const envs = environments.filter(e => e.product_id === pid).sort((a, b) => a.display_order - b.display_order);
        return (
          <Card key={pid}>
            <CardHeader><CardTitle className="text-base">{productName(pid)}</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 pr-4">Release</th>
                      {envs.map(e => <th key={e.id} className="text-left py-2 px-2">{e.name}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {rs.map(r => (
                      <tr key={r.id} className="border-b cursor-pointer hover:bg-accent/40" onClick={() => onOpen(r)}>
                        <td className="py-2 pr-4">
                          <div className="font-medium">{r.name}</div>
                          <div className="text-xs text-muted-foreground">v{r.version} · {r.status}</div>
                        </td>
                        {envs.map(e => {
                          const p = promotions.find(pp => pp.release_id === r.id && pp.environment_id === e.id);
                          return (
                            <td key={e.id} className="py-2 px-2">
                              {p ? (
                                <Badge variant={p.status === "succeeded" ? "default" : p.status === "failed" ? "destructive" : "secondary"}>
                                  {p.status}
                                </Badge>
                              ) : <span className="text-muted-foreground">—</span>}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                    {rs.length === 0 && (
                      <tr><td colSpan={envs.length + 1} className="text-center text-muted-foreground py-4">No releases</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        );
      })}
      {byProduct.size === 0 && <div className="text-center text-muted-foreground py-10">No releases to display</div>}
    </div>
  );
}

// ============================================================
// CALENDAR
// ============================================================
function ReleaseCalendar({
  releases, productName, onOpen,
}: {
  releases: Release[]; productName: (id: string) => string; onOpen: (r: Release) => void;
}) {
  const [cursor, setCursor] = useState(new Date());
  const days = eachDayOfInterval({ start: startOfMonth(cursor), end: endOfMonth(cursor) });
  const releasesByDay = (d: Date) => releases.filter(r => r.target_date && isSameDay(parseISO(r.target_date), d));

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="text-base">{format(cursor, "MMMM yyyy")}</CardTitle>
        <div className="flex gap-1">
          <Button size="sm" variant="outline" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}>‹</Button>
          <Button size="sm" variant="outline" onClick={() => setCursor(new Date())}>Today</Button>
          <Button size="sm" variant="outline" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}>›</Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-1 text-xs text-muted-foreground mb-1">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => <div key={d} className="px-2 py-1">{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: days[0].getDay() }).map((_, i) => <div key={`pad-${i}`} />)}
          {days.map(d => {
            const items = releasesByDay(d);
            return (
              <div key={d.toISOString()} className="min-h-[88px] rounded-md border p-1.5 text-xs">
                <div className="font-medium mb-1">{format(d, "d")}</div>
                <div className="space-y-1">
                  {items.map(r => (
                    <div key={r.id} className="rounded bg-primary/10 hover:bg-primary/20 cursor-pointer p-1 truncate"
                      onClick={() => onOpen(r)}>
                      <div className="truncate font-medium">{r.name}</div>
                      <div className="truncate text-muted-foreground">{productName(r.product_id)}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
