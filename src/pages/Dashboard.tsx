import { AppLayout } from "@/components/layout/AppLayout";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { ProgrammeProgress } from "@/components/dashboard/ProgrammeProgress";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { RiskSummary } from "@/components/dashboard/RiskSummary";
import { UpcomingMilestones } from "@/components/dashboard/UpcomingMilestones";
import { BenefitsTracker } from "@/components/dashboard/BenefitsTracker";
import { OrganizationStats } from "@/components/dashboard/OrganizationStats";
import { PlanUsageBar } from "@/components/PlanUsageBar";
import { Layers, FolderKanban, AlertTriangle, Target, Package } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export default function Dashboard() {
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
    <AppLayout title="Dashboard" subtitle="Program portfolio overview">
      <PlanUsageBar />
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-5 mb-8">
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

      <div className="mb-8">
        <OrganizationStats />
      </div>

      <div className="grid gap-6 lg:grid-cols-3 mb-8">
        <div className="lg:col-span-2">
          <ProgrammeProgress />
        </div>
        <div>
          <RiskSummary />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3 mb-8">
        <div className="lg:col-span-2">
          <BenefitsTracker />
        </div>
        <div>
          <UpcomingMilestones />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-1">
        <RecentActivity />
      </div>
    </AppLayout>
  );
}
