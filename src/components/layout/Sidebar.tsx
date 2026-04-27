import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import {
  LayoutDashboard,
  Wand2,
  FolderKanban,
  BarChart3,
  BookOpen,
  ChevronDown,
  Layers,
  ClipboardList,
  Package,
  ListTodo,
  Shield,
  Clock,
  Search,
  Bell,
  Sparkles,
  LifeBuoy,
  GitBranch,
  Workflow,
  HardHat,
  Briefcase,
  Star,
  StarOff,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useVertical } from "@/hooks/useVertical";
import { useDashboardPrefs } from "@/hooks/useDashboardPrefs";

interface NavItem {
  label: string;
  icon: React.ElementType;
  href?: string;
  children?: { label: string; href: string }[];
  badge?: number;
}

export function Sidebar() {
  const location = useLocation();
  const { user, userRole } = useAuth();
  const { hasModule, term } = useVertical();
  const [expandedItems, setExpandedItems] = useState<string[]>([]);
  const [hasStakeholderAccess, setHasStakeholderAccess] = useState(false);

  useEffect(() => {
    if (!user) {
      setHasStakeholderAccess(false);
      return;
    }
    if (userRole === "admin") {
      setHasStakeholderAccess(true);
      return;
    }
    supabase
      .from("stakeholder_portal_access")
      .select("id")
      .eq("user_id", user.id)
      .limit(1)
      .then(({ data }) => setHasStakeholderAccess((data?.length ?? 0) > 0));
  }, [user, userRole]);

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ["notifications-unread", user?.id],
    queryFn: async () => {
      if (!user) return 0;
      const { count } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("read", false);
      return count ?? 0;
    },
    enabled: !!user,
    refetchInterval: 30000,
  });

  const allNavigation: (NavItem & { module?: string })[] = [
    { label: "Dashboard", icon: LayoutDashboard, href: "/" },
    { label: "Ask the TaskMaster", icon: Search, href: "/search" },
    { label: "Notifications", icon: Bell, href: "/notifications", badge: unreadCount },
    { label: term("programme", "Programmes"), icon: Layers, href: "/programmes", module: "programmes" },
    { label: term("project", "Projects"), icon: FolderKanban, href: "/projects", module: "projects" },
    { label: "Products", icon: Package, href: "/products", module: "products" },
    { label: "Tasks", icon: ListTodo, href: "/tasks", module: "tasks" },
    { label: "Timesheets", icon: Clock, href: "/timesheets", module: "timesheets" },
    { label: "Governance", icon: Shield, href: "/prince2" },
    { label: "Change Management", icon: GitBranch, href: "/change-management", module: "change_management" },
    {
      label: "Helpdesk",
      icon: LifeBuoy,
      module: "helpdesk",
      children: [
        { label: "Tickets", href: "/support" },
        { label: "Workflows", href: "/support/workflows" },
      ],
    },
    {
      label: "Construction",
      icon: HardHat,
      module: "rfis",
      children: [
        { label: "Pursuit Pipeline", href: "/verticals/opportunities" },
        { label: "RFPs / RFQs / ITTs", href: "/verticals/rfps" },
        { label: "Bid / No-Bid Decisions", href: "/verticals/bid-no-go-decisions" },
        { label: "Prequalifications", href: "/verticals/qualifications-prequals" },
        { label: "Bids", href: "/verticals/bids" },
        { label: "Awards & Contracts", href: "/verticals/award-contracts" },
        { label: "Win / Loss Reviews", href: "/verticals/win-loss-reviews" },
        { label: "Lifecycle Phases", href: "/verticals/project-lifecycle-phases" },
        { label: "Preconstruction", href: "/verticals/preconstruction-checklist" },
        { label: "RFIs", href: "/construction/rfis" },
        { label: "Submittals", href: "/construction/submittals" },
        { label: "Daily Logs", href: "/construction/daily-logs" },
        { label: "Punch List", href: "/construction/punch-list" },
      ],
    },
    {
      label: "Client Services",
      icon: Briefcase,
      module: "engagements",
      children: [
        { label: "Engagements", href: "/services/engagements" },
        { label: "Retainers", href: "/services/retainers" },
      ],
    },
    { label: "Knowledgebase", icon: BookOpen, href: "/knowledgebase", module: "knowledgebase" },
    { label: "Registers", icon: ClipboardList, href: "/registers" },
    {
      label: "Reporting",
      icon: BarChart3,
      children: [
        { label: "Reports", href: "/reports" },
        { label: "Updates", href: "/updates" },
        { label: "Governance & Comms", href: "/governance" },
      ],
    },
    { label: "Principles", icon: BookOpen, href: "/documentation" },
    { label: "Wizards", icon: Wand2, href: "/wizards" },
    {
      label: "AI",
      icon: Sparkles,
      children: [
        { label: "AI Advisor", href: "/ai-advisor" },
        { label: "AI Insights", href: "/ai-insights" },
        { label: "AI Approvals", href: "/ai-approvals" },
      ],
    },
    { label: "Automations", icon: Workflow, href: "/admin/automations", module: "automations" },
  ];

  // Filter navigation by vertical's enabled modules. Items without a `module` key always show.
  const navigation = allNavigation.filter((item) => !item.module || hasModule(item.module));

  const toggleExpand = (label: string) => {
    setExpandedItems((prev) =>
      prev.includes(label) ? prev.filter((item) => item !== label) : [...prev, label]
    );
  };

  const isActive = (href: string) => location.pathname === href;
  const isParentActive = (children?: { label: string; href: string }[]) =>
    children?.some((child) => location.pathname === child.href);

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 bg-sidebar border-r border-sidebar-border">
      <div className="flex h-full flex-col">
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4 pt-6">
          {navigation.map((item) => (
            <div key={item.label}>
              {item.children ? (
                <>
                  <button
                    onClick={() => toggleExpand(item.label)}
                    className={cn(
                      "nav-link w-full justify-between",
                      isParentActive(item.children) && "text-sidebar-foreground"
                    )}
                  >
                    <span className="flex items-center gap-3">
                      <item.icon className="h-5 w-5" />
                      {item.label}
                    </span>
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 transition-transform",
                        expandedItems.includes(item.label) && "rotate-180"
                      )}
                    />
                  </button>
                  {expandedItems.includes(item.label) && (
                    <div className="ml-8 mt-1 space-y-1">
                      {item.children.map((child) => (
                        <Link
                          key={child.href}
                          to={child.href}
                          className={cn(
                            "block px-3 py-2 text-sm rounded-md transition-colors",
                            isActive(child.href)
                              ? "bg-sidebar-accent text-sidebar-foreground"
                              : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
                          )}
                        >
                          {child.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <Link
                  to={item.href!}
                  className={cn(
                    "nav-link justify-between",
                    isActive(item.href!) && "nav-link-active"
                  )}
                >
                  <span className="flex items-center gap-3">
                    <item.icon className="h-5 w-5" />
                    {item.label}
                  </span>
                  {item.badge && item.badge > 0 ? (
                    <span className="ml-auto inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full bg-destructive text-destructive-foreground text-xs font-medium">
                      {item.badge > 99 ? "99+" : item.badge}
                    </span>
                  ) : null}
                </Link>
              )}
            </div>
          ))}
        </nav>
      </div>
    </aside>
  );
}
