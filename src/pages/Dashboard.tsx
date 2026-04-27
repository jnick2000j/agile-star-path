import { AppLayout } from "@/components/layout/AppLayout";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { RiskSummary } from "@/components/dashboard/RiskSummary";
import { UpcomingMilestones } from "@/components/dashboard/UpcomingMilestones";
import { StatusIndicators } from "@/components/dashboard/StatusIndicators";
import { HelpdeskUsageCard } from "@/components/dashboard/HelpdeskUsageCard";
import { HelpdeskSummary } from "@/components/dashboard/HelpdeskSummary";
import { ChangeManagementSummary } from "@/components/dashboard/ChangeManagementSummary";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { MyWork } from "@/components/dashboard/MyWork";
import { PinnedAndRecents } from "@/components/dashboard/PinnedAndRecents";
import { ActionInbox } from "@/components/dashboard/ActionInbox";
import { NotificationsCard } from "@/components/dashboard/NotificationsCard";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Layers, FolderKanban, AlertTriangle, Target, Package, Eye, User, BarChart3 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "react-router-dom";
import { useDashboardPrefs } from "@/hooks/useDashboardPrefs";

export default function Dashboard() {
  const { user, userRole } = useAuth();
  const { prefs, update } = useDashboardPrefs();
  const [hasStakeholderAccess, setHasStakeholderAccess] = useState(false);

  useEffect(() => {
    if (!user) return;
    if (userRole === "admin") { setHasStakeholderAccess(true); return; }
    supabase
      .from("stakeholder_portal_access")
      .select("id")
      .eq("user_id", user.id)
      .limit(1)
      .then(({ data }) => setHasStakeholderAccess((data?.length ?? 0) > 0));
  }, [user, userRole]);

  const { data: metrics } = useQuery({
    queryKey: ["dashboard-metrics"],
    queryFn: async () => {
      const [programmes, projects, products, risks, benefits] = await Promise.all([
        supabase.from("programmes").select("id", { count: "exact", head: true }).eq("status", "active"),
        supabase.from("projects").select("id", { count: "exact", head: true }),
        supabase.from("products").select("id", { count: "exact", head: true }).eq("status", "active"),
        supabase.from("risks").select("id", { count: "exact", head: true }).in("status", ["open", "mitigating"]),
        supabase.from("benefits").select("realization"),
      ]);

      const avgRealization = benefits.data?.length
        ? Math.round(benefits.data.reduce((acc, b) => acc + (b.realization || 0), 0) / benefits.data.length)
        : 0;

      return {
        activeProgrammes: programmes.count ?? 0,
        activeProjects: projects.count ?? 0,
        activeProducts: products.count ?? 0,
        openRisks: risks.count ?? 0,
        avgRealization,
      };
    },
  });

  return (
    <AppLayout title="Dashboard" subtitle="Get a snapshot of your work and your portfolio">
      {hasStakeholderAccess && (
        <div className="mb-6 flex justify-end">
          <Button asChild>
            <Link to="/portal">
              <Eye className="h-4 w-4 mr-2" />
              Open Stakeholder Portal
            </Link>
          </Button>
        </div>
      )}

      <Tabs
        value={prefs.default_tab}
        onValueChange={(v) => update({ default_tab: v })}
        className="space-y-6"
      >
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="my-work" className="gap-2">
            <User className="h-4 w-4" /> My Work
          </TabsTrigger>
          <TabsTrigger value="portfolio" className="gap-2">
            <BarChart3 className="h-4 w-4" /> Portfolio
          </TabsTrigger>
        </TabsList>

        {/* MY WORK */}
        <TabsContent value="my-work" className="space-y-6 mt-6">
          <QuickActions />
          <div className="grid gap-6 lg:grid-cols-2">
            <ActionInbox />
            <NotificationsCard />
          </div>
          <MyWork />
          <PinnedAndRecents />
        </TabsContent>

        {/* PORTFOLIO (the original dashboard) */}
        <TabsContent value="portfolio" className="space-y-6 mt-6">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-5">
            <MetricCard
              title="Active Programs"
              value={metrics?.activeProgrammes ?? 0}
              icon={<Layers className="h-6 w-6" />}
              iconColor="primary"
            />
            <MetricCard
              title="Active Projects"
              value={metrics?.activeProjects ?? 0}
              icon={<FolderKanban className="h-6 w-6" />}
              iconColor="info"
            />
            <MetricCard
              title="Active Products"
              value={metrics?.activeProducts ?? 0}
              icon={<Package className="h-6 w-6" />}
              iconColor="info"
            />
            <MetricCard
              title="Open Risks"
              value={metrics?.openRisks ?? 0}
              icon={<AlertTriangle className="h-6 w-6" />}
              iconColor="warning"
            />
            <MetricCard
              title="Avg Benefit Realization"
              value={`${metrics?.avgRealization ?? 0}%`}
              icon={<Target className="h-6 w-6" />}
              iconColor="success"
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <RiskSummary />
            <UpcomingMilestones />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <HelpdeskSummary />
            <ChangeManagementSummary />
          </div>

          <StatusIndicators />
          <HelpdeskUsageCard />
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}
