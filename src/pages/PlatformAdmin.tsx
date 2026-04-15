import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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
  TrendingUp,
  CreditCard,
  Activity,
  AlertTriangle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

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
  user_count: number;
  programme_count: number;
  project_count: number;
  product_count: number;
  plan_name: string | null;
  sub_status: string | null;
  trial_ends_at: string | null;
}

export default function PlatformAdmin() {
  const [stats, setStats] = useState<PlatformStats>({
    totalOrgs: 0, totalUsers: 0, totalProgrammes: 0, totalProjects: 0,
    totalProducts: 0, activeSubscriptions: 0, trialingOrgs: 0,
  });
  const [orgs, setOrgs] = useState<OrgOverview[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch counts in parallel
      const [orgsRes, usersRes, progsRes, projsRes, prodsRes, subsRes] = await Promise.all([
        supabase.from("organizations").select("id, name, slug, created_at"),
        supabase.from("profiles").select("id", { count: "exact", head: true }).eq("archived", false),
        supabase.from("programmes").select("id", { count: "exact", head: true }),
        supabase.from("projects").select("id", { count: "exact", head: true }),
        supabase.from("products").select("id", { count: "exact", head: true }),
        supabase.from("organization_subscriptions").select("organization_id, status, plan_id, trial_ends_at, subscription_plans(name)"),
      ]);

      const allOrgs = orgsRes.data || [];
      const subs = subsRes.data || [];

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
        allOrgs.map(async (org) => {
          const [userCount, progCount, projCount, prodCount] = await Promise.all([
            supabase.from("user_organization_access").select("id", { count: "exact", head: true }).eq("organization_id", org.id),
            supabase.from("programmes").select("id", { count: "exact", head: true }).eq("organization_id", org.id),
            supabase.from("projects").select("id", { count: "exact", head: true }).eq("organization_id", org.id),
            supabase.from("products").select("id", { count: "exact", head: true }).eq("organization_id", org.id),
          ]);

          const sub = subs.find(s => s.organization_id === org.id);
          return {
            id: org.id,
            name: org.name,
            slug: org.slug,
            created_at: org.created_at,
            user_count: userCount.count || 0,
            programme_count: progCount.count || 0,
            project_count: projCount.count || 0,
            product_count: prodCount.count || 0,
            plan_name: (sub?.subscription_plans as any)?.name || null,
            sub_status: sub?.status || null,
            trial_ends_at: sub?.trial_ends_at || null,
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
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="bg-secondary">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="tenants">Tenant Management</TabsTrigger>
          <TabsTrigger value="plans">Subscription Plans</TabsTrigger>
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
                  {getStatusBadge(org.sub_status)}
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="tenants">
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
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">Loading...</TableCell>
                  </TableRow>
                ) : orgs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">No organizations found</TableCell>
                  </TableRow>
                ) : (
                  orgs.map((org) => (
                    <TableRow key={org.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{org.name}</p>
                          <p className="text-xs text-muted-foreground">/{org.slug}</p>
                        </div>
                      </TableCell>
                      <TableCell>{org.user_count}</TableCell>
                      <TableCell>{org.programme_count}</TableCell>
                      <TableCell>{org.project_count}</TableCell>
                      <TableCell>{org.product_count}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{org.plan_name || "None"}</Badge>
                      </TableCell>
                      <TableCell>{getStatusBadge(org.sub_status)}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {new Date(org.created_at).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="plans">
          <PlanManager />
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}

function PlanManager() {
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("subscription_plans")
      .select("*")
      .order("sort_order")
      .then(({ data }) => {
        setPlans(data || []);
        setLoading(false);
      });
  }, []);

  return (
    <div className="grid gap-6 md:grid-cols-3">
      {loading
        ? Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="p-6 animate-pulse h-64" />
          ))
        : plans.map((plan) => (
            <Card key={plan.id} className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold">{plan.name}</h3>
                <Badge variant={plan.is_active ? "default" : "secondary"}>
                  {plan.is_active ? "Active" : "Inactive"}
                </Badge>
              </div>
              <p className="text-muted-foreground text-sm mb-4">{plan.description}</p>

              <div className="text-3xl font-bold mb-1">
                ${plan.price_monthly}<span className="text-sm font-normal text-muted-foreground">/mo</span>
              </div>
              <p className="text-xs text-muted-foreground mb-4">
                or ${plan.price_yearly}/year
              </p>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Users</span>
                  <span className="font-medium">{plan.max_users === -1 ? "Unlimited" : plan.max_users}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Programmes</span>
                  <span className="font-medium">{plan.max_programmes === -1 ? "Unlimited" : plan.max_programmes}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Projects</span>
                  <span className="font-medium">{plan.max_projects === -1 ? "Unlimited" : plan.max_projects}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Products</span>
                  <span className="font-medium">{plan.max_products === -1 ? "Unlimited" : plan.max_products}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Storage</span>
                  <span className="font-medium">{plan.max_storage_mb === -1 ? "Unlimited" : `${plan.max_storage_mb} MB`}</span>
                </div>
              </div>

              {Array.isArray(plan.features) && plan.features.length > 0 && (
                <div className="mt-4 pt-4 border-t">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Features</p>
                  <div className="flex flex-wrap gap-1">
                    {plan.features.map((f: string, i: number) => (
                      <Badge key={i} variant="outline" className="text-xs">{f}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          ))}
    </div>
  );
}
