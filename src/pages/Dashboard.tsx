import { AppLayout } from "@/components/layout/AppLayout";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { RiskSummary } from "@/components/dashboard/RiskSummary";
import { UpcomingMilestones } from "@/components/dashboard/UpcomingMilestones";
import { StatusIndicators } from "@/components/dashboard/StatusIndicators";
import { HelpdeskSummary } from "@/components/dashboard/HelpdeskSummary";
import { ChangeManagementSummary } from "@/components/dashboard/ChangeManagementSummary";
import { BenefitsTracker } from "@/components/dashboard/BenefitsTracker";
import { OrganizationStats } from "@/components/dashboard/OrganizationStats";
import { ProgrammeProgress } from "@/components/dashboard/ProgrammeProgress";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { PinnedAndRecents } from "@/components/dashboard/PinnedAndRecents";
import { CustomWidgets } from "@/components/dashboard/CustomWidgets";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { MyWork } from "@/components/dashboard/MyWork";

import { ActionInbox } from "@/components/dashboard/ActionInbox";
import { NotificationsCard } from "@/components/dashboard/NotificationsCard";
import { AskTaskMasterCard } from "@/components/dashboard/AskTaskMasterCard";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Layers, FolderKanban, AlertTriangle, Target, Package, Eye, User, BarChart3, Settings2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "react-router-dom";
import { useDashboardPrefs } from "@/hooks/useDashboardPrefs";

type WidgetId =
  | "metrics"
  | "status-indicators"
  | "risk-summary"
  | "upcoming-milestones"
  | "helpdesk-summary"
  | "change-management-summary"
  | "benefits-tracker"
  | "organization-stats"
  | "programme-progress"
  | "recent-activity"
  | "pinned-recents";

const WIDGET_LABELS: Record<WidgetId, string> = {
  "metrics": "Portfolio Metrics",
  "status-indicators": "Status Indicators",
  "risk-summary": "Risk Summary",
  "upcoming-milestones": "Upcoming Milestones",
  "helpdesk-summary": "Helpdesk Summary",
  "change-management-summary": "Change Management Summary",
  "benefits-tracker": "Benefits Realization",
  "organization-stats": "Organization Stats",
  "programme-progress": "Programme Progress",
  "recent-activity": "Recent Activity",
  "pinned-recents": "Pinned & Recently Viewed",
};

const ALL_WIDGETS: WidgetId[] = [
  "metrics",
  "status-indicators",
  "risk-summary",
  "upcoming-milestones",
  "helpdesk-summary",
  "change-management-summary",
  "benefits-tracker",
  "organization-stats",
  "programme-progress",
  "recent-activity",
  "pinned-recents",
];

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

  const hidden = useMemo(() => new Set(prefs.hidden_widgets ?? []), [prefs.hidden_widgets]);
  const isVisible = (id: WidgetId) => !hidden.has(id);

  const toggleWidget = (id: WidgetId, show: boolean) => {
    const next = new Set(hidden);
    if (show) next.delete(id); else next.add(id);
    update({ hidden_widgets: Array.from(next) });
  };

  return (
    <AppLayout title="Dashboard" subtitle="Get a snapshot of your work and your portfolio">
      {hasStakeholderAccess && (
        <div className="mb-6 flex justify-end">
          <Button asChild>
            <Link to="/stakeholder-portal">
              <Eye className="h-4 w-4 mr-2" />
              Open Stakeholder Portal
            </Link>
          </Button>
        </div>
      )}

      <div className="mb-6">
        <AskTaskMasterCard compact />
      </div>

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
            <BarChart3 className="h-4 w-4" /> My Portfolio
          </TabsTrigger>
        </TabsList>

        {/* MY WORK */}
        <TabsContent value="my-work" className="space-y-6 mt-6">
          <QuickActions />
          <div className="grid gap-6 lg:grid-cols-3">
            <MyWork />
            <ActionInbox />
            <NotificationsCard />
          </div>
          <CustomWidgets scope="my-work" defaultMine />
        </TabsContent>

        {/* MY PORTFOLIO */}
        <TabsContent value="portfolio" className="space-y-6 mt-6">
          <div className="flex justify-end">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Settings2 className="h-4 w-4" />
                  Customize widgets
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-72">
                <div className="space-y-3">
                  <div>
                    <p className="font-medium text-sm">Show widgets</p>
                    <p className="text-xs text-muted-foreground">
                      Choose which cards appear on My Portfolio.
                    </p>
                  </div>
                  <div className="space-y-2">
                    {ALL_WIDGETS.map((id) => (
                      <div key={id} className="flex items-center gap-2">
                        <Checkbox
                          id={`widget-${id}`}
                          checked={isVisible(id)}
                          onCheckedChange={(c) => toggleWidget(id, c === true)}
                        />
                        <Label htmlFor={`widget-${id}`} className="text-sm font-normal cursor-pointer">
                          {WIDGET_LABELS[id]}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {isVisible("metrics") && (
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
          )}

          {isVisible("status-indicators") && <StatusIndicators />}

          {(isVisible("risk-summary") || isVisible("upcoming-milestones")) && (
            <div className="grid gap-6 lg:grid-cols-2">
              {isVisible("risk-summary") && <RiskSummary />}
              {isVisible("upcoming-milestones") && <UpcomingMilestones />}
            </div>
          )}

          {(isVisible("helpdesk-summary") || isVisible("change-management-summary")) && (
            <div className="grid gap-6 lg:grid-cols-2">
              {isVisible("helpdesk-summary") && <HelpdeskSummary />}
              {isVisible("change-management-summary") && <ChangeManagementSummary />}
            </div>
          )}

          {isVisible("organization-stats") && <OrganizationStats />}

          {isVisible("programme-progress") && <ProgrammeProgress />}

          {isVisible("benefits-tracker") && <BenefitsTracker />}

          {(isVisible("recent-activity") || isVisible("pinned-recents")) && (
            <div className="grid gap-6 lg:grid-cols-2">
              {isVisible("pinned-recents") && <PinnedAndRecents />}
              {isVisible("recent-activity") && <RecentActivity />}
            </div>
          )}

          {/* User-built widgets, formerly the "My Dashboard" tab */}
          <CustomWidgets scope="portfolio" heading="My Custom Widgets" />
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}
