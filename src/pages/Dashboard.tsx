import { AppLayout } from "@/components/layout/AppLayout";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { ProgrammeProgress } from "@/components/dashboard/ProgrammeProgress";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { RiskSummary } from "@/components/dashboard/RiskSummary";
import { UpcomingMilestones } from "@/components/dashboard/UpcomingMilestones";
import { BenefitsTracker } from "@/components/dashboard/BenefitsTracker";
import { OrganizationStats } from "@/components/dashboard/OrganizationStats";
import { Layers, FolderKanban, AlertTriangle, Target } from "lucide-react";

export default function Dashboard() {
  return (
    <AppLayout title="Dashboard" subtitle="Program portfolio overview">
      {/* Metrics Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <MetricCard
          title="Active Programs"
          value={5}
          change={12}
          changeLabel="vs last quarter"
          icon={<Layers className="h-6 w-6" />}
          iconColor="primary"
        />
        <MetricCard
          title="Active Projects"
          value={23}
          change={8}
          changeLabel="vs last month"
          icon={<FolderKanban className="h-6 w-6" />}
          iconColor="info"
        />
        <MetricCard
          title="Open Risks"
          value={46}
          change={-5}
          changeLabel="vs last week"
          icon={<AlertTriangle className="h-6 w-6" />}
          iconColor="warning"
        />
        <MetricCard
          title="Benefits Realized"
          value="$1.05M"
          change={15}
          changeLabel="vs target"
          icon={<Target className="h-6 w-6" />}
          iconColor="success"
        />
      </div>

      {/* Organization Stats */}
      <div className="mb-8">
        <OrganizationStats />
      </div>

      {/* Main Content Grid */}
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
