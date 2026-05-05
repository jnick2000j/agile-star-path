import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Building2,
  Users,
  Layers,
  FolderKanban,
  Package,
  CreditCard,
  Activity,
  Ban,
  RotateCcw,
  KeyRound,
  Archive,
  ArchiveRestore,
  Trash2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PlatformSSOQueue } from "@/components/sso/PlatformSSOQueue";
import { AuditLogViewer } from "@/components/admin/AuditLogViewer";
import { AuditRetentionPolicy } from "@/components/admin/AuditRetentionPolicy";
import { PlanManager } from "@/components/admin/PlanManager";
import { PlatformSupportQueue } from "@/components/admin/PlatformSupportQueue";
import { LicenseManager } from "@/components/admin/LicenseManager";
import { OrgSuspensionDialog } from "@/components/admin/OrgSuspensionDialog";
import { SuspensionHistory } from "@/components/admin/SuspensionHistory";
import { PlatformAIProviderSettings } from "@/components/admin/PlatformAIProviderSettings";
import { AICreditPackManager } from "@/components/billing/AICreditPackManager";
import { VerticalPacksManager } from "@/components/admin/VerticalPacksManager";
import { OrgVerticalDialog } from "@/components/admin/OrgVerticalDialog";
import { PlatformModuleToggles } from "@/components/admin/PlatformModuleToggles";
import { OrgOnboardingWizard } from "@/components/admin/OrgOnboardingWizard";
import { PlatformMigrationsManager } from "@/components/admin/PlatformMigrationsManager";
import { PlatformMigrationRequestsQueue } from "@/components/admin/PlatformMigrationRequestsQueue";
import { PlatformAdminsPanel } from "@/components/platform-admin/PlatformAdminsPanel";
import { Layers as LayersIcon, Briefcase } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

interface PlatformStats {
  totalOrgs: number;
  totalUsers: number;
  totalProgrammes: number;
  totalProjects: number;
  totalProducts: number;
  activeSubscriptions: number;
  trialingOrgs: number;
}

interface OrgOverview {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  is_suspended: boolean;
  suspension_kind: string | null;
  suspended_reason: string | null;
  user_count: number;
  programme_count: number;
  project_count: number;
  product_count: number;
  plan_name: string | null;
  sub_status: string | null;
  trial_ends_at: string | null;
  license_id: string | null;
  license_status: string | null;
  license_deployment_mode: string | null;
  license_customer_reference: string | null;
  industry_vertical: string | null;
  is_archived?: boolean;
}

export default function PlatformAdmin() {
  const [stats, setStats] = useState<PlatformStats>({
    totalOrgs: 0, totalUsers: 0, totalProgrammes: 0, totalProjects: 0,
    totalProducts: 0, activeSubscriptions: 0, trialingOrgs: 0,
  });
  const [orgs, setOrgs] = useState<OrgOverview[]>([]);
  const [loading, setLoading] = useState(true);
  const [suspensionTarget, setSuspensionTarget] = useState<OrgOverview | null>(null);
  const [verticalTarget, setVerticalTarget] = useState<OrgOverview | null>(null);
  const [onboardingTarget, setOnboardingTarget] = useState<OrgOverview | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<OrgOverview | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<OrgOverview | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const validTabs = [
    "overview","tenants","platform-admins","licenses","plans","ai","support","sso","verticals","modules","migration-requests","migrations","audit",
  ];
  const requestedTab = searchParams.get("tab");
  const activeTab = requestedTab && validTabs.includes(requestedTab) ? requestedTab : "overview";

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch counts in parallel
      const [orgsRes, usersRes, progsRes, projsRes, prodsRes, subsRes, licsRes] = await Promise.all([
        supabase.from("organizations").select("id, name, slug, created_at, is_suspended, suspension_kind, suspended_reason, industry_vertical, is_archived"),
        supabase.from("profiles").select("id", { count: "exact", head: true }).eq("archived", false),
        supabase.from("programmes").select("id", { count: "exact", head: true }),
        supabase.from("projects").select("id", { count: "exact", head: true }),
        supabase.from("products").select("id", { count: "exact", head: true }),
        supabase.from("organization_subscriptions").select("organization_id, status, plan_id, trial_ends_at, subscription_plans(name)"),
        supabase.from("organization_licenses").select("id, organization_id, status, deployment_mode, customer_reference, valid_from, valid_until, issued_at").eq("status", "active").order("issued_at", { ascending: false }),
      ]);

      const allOrgs = orgsRes.data || [];
      const subs = subsRes.data || [];
      const licenses = licsRes.data || [];

      setStats({
        totalOrgs: allOrgs.length,
        totalUsers: usersRes.count || 0,
        totalProgrammes: progsRes.count || 0,
        totalProjects: projsRes.count || 0,
        totalProducts: prodsRes.count || 0,
        activeSubscriptions: subs.filter(s => s.status === "active").length,
        trialingOrgs: subs.filter(s => s.status === "trialing").length,
      });

      // Build org overview with counts
      const orgOverviews: OrgOverview[] = await Promise.all(
        allOrgs.map(async (org: any) => {
          const [userCount, progCount, projCount, prodCount] = await Promise.all([
            supabase.from("user_organization_access").select("id", { count: "exact", head: true }).eq("organization_id", org.id),
            supabase.from("programmes").select("id", { count: "exact", head: true }).eq("organization_id", org.id),
            supabase.from("projects").select("id", { count: "exact", head: true }).eq("organization_id", org.id),
            supabase.from("products").select("id", { count: "exact", head: true }).eq("organization_id", org.id),
          ]);

          const sub = subs.find(s => s.organization_id === org.id);
          const lic = licenses.find((l: any) => {
            const now = new Date();
            const validFrom = l.valid_from ? new Date(l.valid_from) : null;
            const validUntil = l.valid_until ? new Date(l.valid_until) : null;
            return l.organization_id === org.id
              && (!validFrom || validFrom <= now)
              && (!validUntil || validUntil > now);
          }) as any;
          return {
            id: org.id,
            name: org.name,
            slug: org.slug,
            created_at: org.created_at,
            is_suspended: !!org.is_suspended,
            suspension_kind: org.suspension_kind ?? null,
            suspended_reason: org.suspended_reason ?? null,
            user_count: userCount.count || 0,
            programme_count: progCount.count || 0,
            project_count: projCount.count || 0,
            product_count: prodCount.count || 0,
            plan_name: (sub?.subscription_plans as any)?.name || null,
            sub_status: sub?.status || null,
            trial_ends_at: sub?.trial_ends_at || null,
            license_id: lic?.id ?? null,
            license_status: lic?.status ?? null,
            license_deployment_mode: lic?.deployment_mode ?? null,
            license_customer_reference: lic?.customer_reference ?? null,
            industry_vertical: (org as any).industry_vertical ?? null,
            is_archived: !!(org as any).is_archived,
          };
        })
      );

      setOrgs(orgOverviews.sort((a, b) => b.user_count - a.user_count));
    } catch (err) {
      console.error("Error fetching platform data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleArchive = async (org: OrgOverview, archive: boolean) => {
    setActionLoading(true);
    try {
      const { error } = await supabase.rpc("archive_organization", {
        _org_id: org.id,
        _archive: archive,
      });
      if (error) throw error;
      toast.success(archive ? `${org.name} archived` : `${org.name} restored`);
      setArchiveTarget(null);
      await fetchData();
    } catch (e: any) {
      toast.error(e.message ?? "Action failed");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (org: OrgOverview) => {
    setActionLoading(true);
    try {
      const { error } = await supabase.rpc("delete_organization_cascade", { _org_id: org.id });
      if (error) throw error;
      toast.success(`${org.name} permanently deleted`);
      setDeleteTarget(null);
      await fetchData();
    } catch (e: any) {
      toast.error(e.message ?? "Delete failed");
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadge = (status: string | null) => {
    if (!status) return <Badge variant="outline">No Plan</Badge>;
    const variants: Record<string, string> = {
      active: "bg-success text-success-foreground",
      trialing: "bg-warning/10 text-warning",
      past_due: "bg-destructive/10 text-destructive",
      canceled: "bg-muted text-muted-foreground",
    };
    return <Badge className={variants[status] || ""}>{status}</Badge>;
  };

  const statCards = [
    { label: "Organizations", value: stats.totalOrgs, icon: Building2, color: "text-primary" },
    { label: "Active Users", value: stats.totalUsers, icon: Users, color: "text-success" },
    { label: "Programmes", value: stats.totalProgrammes, icon: Layers, color: "text-accent-foreground" },
    { label: "Projects", value: stats.totalProjects, icon: FolderKanban, color: "text-warning" },
    { label: "Products", value: stats.totalProducts, icon: Package, color: "text-primary" },
    { label: "Active Subs", value: stats.activeSubscriptions, icon: CreditCard, color: "text-success" },
    { label: "Trialing", value: stats.trialingOrgs, icon: Activity, color: "text-warning" },
  ];

  return (
    <AppLayout title="Platform Admin" subtitle="Cross-tenant overview and management">
      <Tabs
        value={activeTab}
        onValueChange={(v) => {
          const next = new URLSearchParams(searchParams);
          if (v === "overview") next.delete("tab");
          else next.set("tab", v);
          setSearchParams(next, { replace: true });
        }}
        className="space-y-6"
      >
        <TabsList className="bg-secondary flex-wrap h-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="tenants">Tenant Management</TabsTrigger>
          <TabsTrigger value="platform-admins">Platform Admins</TabsTrigger>
          <TabsTrigger value="licenses">Licenses</TabsTrigger>
          <TabsTrigger value="plans">Subscription Plans</TabsTrigger>
          <TabsTrigger value="ai">AI &amp; Credits</TabsTrigger>
          <TabsTrigger value="support">Support Tickets</TabsTrigger>
          <TabsTrigger value="sso">SSO Queue</TabsTrigger>
          <TabsTrigger value="verticals">Industry Verticals</TabsTrigger>
          <TabsTrigger value="modules">Module Toggles</TabsTrigger>
          <TabsTrigger value="migrations">Migrations</TabsTrigger>
          <TabsTrigger value="audit">Audit Log</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          {/* Stats Grid */}
          <div className="grid gap-4 md:grid-cols-4 lg:grid-cols-7 mb-6">
            {statCards.map((stat) => (
              <Card key={stat.label} className="p-4">
                <div className="flex items-center gap-3">
                  <stat.icon className={`h-5 w-5 ${stat.color}`} />
                  <div>
                    <p className="text-2xl font-semibold">{loading ? "—" : stat.value}</p>
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* Top Tenants */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Top Tenants by Users</h3>
            <div className="space-y-3">
              {orgs.slice(0, 5).map((org) => (
                <div key={org.id} className="flex items-center gap-4">
                  <div className="h-8 w-8 rounded bg-primary/10 flex items-center justify-center">
                    <Building2 className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{org.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {org.user_count} users · {org.programme_count} programmes · {org.project_count} projects
                    </p>
                  </div>
                  {org.is_suspended && (
                    <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30">
                      Suspended
                    </Badge>
                  )}
                  {org.license_id && (
                    <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 gap-1">
                      <KeyRound className="h-3 w-3" />
                      {org.license_deployment_mode === "on_prem" ? "On-Prem" : "Licensed"}
                      {org.license_customer_reference ? ` · ${org.license_customer_reference}` : ""}
                    </Badge>
                  )}
                  {getStatusBadge(org.sub_status)}
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="tenants" className="space-y-6">
          <Card className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Organization</TableHead>
                  <TableHead>Users</TableHead>
                  <TableHead>Programmes</TableHead>
                  <TableHead>Projects</TableHead>
                  <TableHead>Products</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Access</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8">Loading...</TableCell>
                  </TableRow>
                ) : orgs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8">No organizations found</TableCell>
                  </TableRow>
                ) : (
                  orgs.map((org) => (
                    <TableRow key={org.id} className={org.is_archived ? "opacity-60" : org.is_suspended ? "bg-destructive/5" : undefined}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{org.name}</p>
                          <p className="text-xs text-muted-foreground">/{org.slug}</p>
                          {org.is_suspended && org.suspended_reason && (
                            <p className="text-xs text-destructive mt-1 line-clamp-1" title={org.suspended_reason}>
                              {org.suspension_kind?.replace("_", " ")}: {org.suspended_reason}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{org.user_count}</TableCell>
                      <TableCell>{org.programme_count}</TableCell>
                      <TableCell>{org.project_count}</TableCell>
                      <TableCell>{org.product_count}</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <Badge variant="outline">{org.plan_name || "None"}</Badge>
                          {org.license_id && (
                            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 gap-1 w-fit">
                              <KeyRound className="h-3 w-3" />
                              {org.license_deployment_mode === "on_prem" ? "On-Prem" : "Licensed"}
                              {org.license_customer_reference ? ` · ${org.license_customer_reference}` : ""}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(org.sub_status)}</TableCell>
                      <TableCell>
                        {org.is_suspended ? (
                          <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30">
                            Suspended
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-success/10 text-success border-success/30">
                            Active
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {new Date(org.created_at).toLocaleDateString()}
                      </TableCell>
                       <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2 flex-wrap">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setVerticalTarget(org)}
                            title="Assign industry vertical"
                          >
                            <LayersIcon className="h-3.5 w-3.5 mr-1" /> Vertical
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setOnboardingTarget(org)}
                            title="Run onboarding wizard"
                          >
                            <Briefcase className="h-3.5 w-3.5 mr-1" /> Setup
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className={org.is_suspended ? "" : "text-destructive hover:text-destructive"}
                            onClick={() => setSuspensionTarget(org)}
                          >
                            {org.is_suspended ? (
                              <><RotateCcw className="h-3.5 w-3.5 mr-1" /> Enable</>
                            ) : (
                              <><Ban className="h-3.5 w-3.5 mr-1" /> Disable</>
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setArchiveTarget(org)}
                            title={org.is_archived ? "Restore organization" : "Archive organization"}
                          >
                            {org.is_archived ? (
                              <><ArchiveRestore className="h-3.5 w-3.5 mr-1" /> Restore</>
                            ) : (
                              <><Archive className="h-3.5 w-3.5 mr-1" /> Archive</>
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setDeleteTarget(org)}
                            title="Permanently delete organization and all its content"
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>

          <SuspensionHistory limit={50} />
        </TabsContent>

        <TabsContent value="platform-admins">
          <PlatformAdminsPanel />
        </TabsContent>

        <TabsContent value="licenses">
          <LicenseManager />
        </TabsContent>

        <TabsContent value="plans">
          <PlanManager />
        </TabsContent>

        <TabsContent value="ai" className="space-y-6">
          <PlatformAIProviderSettings />
          <AICreditPackManager />
        </TabsContent>

        <TabsContent value="support">
          <PlatformSupportQueue />
        </TabsContent>

        <TabsContent value="sso">
          <PlatformSSOQueue />
        </TabsContent>

        <TabsContent value="verticals" className="space-y-6">
          <div className="flex items-center justify-between gap-3 rounded-lg border bg-card p-4">
            <div>
              <h3 className="text-base font-semibold flex items-center gap-2">
                <Briefcase className="h-4 w-4" /> Organization Onboarding Wizard
              </h3>
              <p className="text-sm text-muted-foreground">
                Walk an account through vertical setup — terminology, modules, dashboards and starter content.
              </p>
            </div>
            <Button onClick={() => setOnboardingTarget({ id: "", name: "", slug: "", created_at: "", is_suspended: false, suspension_kind: null, suspended_reason: null, user_count: 0, programme_count: 0, project_count: 0, product_count: 0, plan_name: null, sub_status: null, trial_ends_at: null, license_id: null, license_status: null, license_deployment_mode: null, license_customer_reference: null, industry_vertical: null })}>
              Launch wizard
            </Button>
          </div>
          <VerticalPacksManager />
        </TabsContent>

        <TabsContent value="modules" className="space-y-4">
          <PlatformModuleToggles />
        </TabsContent>

        <TabsContent value="migrations" className="space-y-4">
          <Tabs defaultValue="requests" className="space-y-4">
            <TabsList className="bg-secondary">
              <TabsTrigger value="requests">Migration Requests Queue</TabsTrigger>
              <TabsTrigger value="wizard">Migration Wizard</TabsTrigger>
            </TabsList>
            <TabsContent value="requests" className="space-y-4">
              <PlatformMigrationRequestsQueue />
            </TabsContent>
            <TabsContent value="wizard" className="space-y-4">
              <PlatformMigrationsManager />
            </TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent value="audit" className="space-y-4">
          <AuditRetentionPolicy scope="platform" />
          <AuditLogViewer scope="platform" />
        </TabsContent>
      </Tabs>

      {suspensionTarget && (
        <OrgSuspensionDialog
          open={!!suspensionTarget}
          onOpenChange={(o) => !o && setSuspensionTarget(null)}
          organization={suspensionTarget}
          onSuccess={() => { setSuspensionTarget(null); fetchData(); }}
        />
      )}

      <OrgVerticalDialog
        open={!!verticalTarget}
        onOpenChange={(o) => !o && setVerticalTarget(null)}
        organization={verticalTarget}
        onSuccess={() => { setVerticalTarget(null); fetchData(); }}
      />

      <OrgOnboardingWizard
        open={!!onboardingTarget}
        onOpenChange={(o) => !o && setOnboardingTarget(null)}
        organization={onboardingTarget && onboardingTarget.id ? { id: onboardingTarget.id, name: onboardingTarget.name, slug: onboardingTarget.slug, industry_vertical: onboardingTarget.industry_vertical } : null}
        onSuccess={() => { setOnboardingTarget(null); fetchData(); }}
      />

      <AlertDialog open={!!archiveTarget} onOpenChange={(o) => !o && setArchiveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {archiveTarget?.is_archived ? "Restore organization?" : "Archive organization?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {archiveTarget?.is_archived
                ? `Restore "${archiveTarget?.name}" — members will regain access and the org will be removed from archived state.`
                : `Archive "${archiveTarget?.name}" — the org and its data are preserved but hidden from active lists. You can restore it later.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={actionLoading}
              onClick={(e) => { e.preventDefault(); if (archiveTarget) void handleArchive(archiveTarget, !archiveTarget.is_archived); }}
            >
              {archiveTarget?.is_archived ? "Restore" : "Archive"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Permanently delete organization?</AlertDialogTitle>
            <AlertDialogDescription>
              This will <strong>permanently delete "{deleteTarget?.name}"</strong> and all its associated content
              ({deleteTarget?.user_count} members, {deleteTarget?.programme_count} programmes,{" "}
              {deleteTarget?.project_count} projects, {deleteTarget?.product_count} products and all related records).
              <br /><br />
              This action <strong>cannot be undone</strong>. Consider archiving instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={actionLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => { e.preventDefault(); if (deleteTarget) void handleDelete(deleteTarget); }}
            >
              Delete permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}

