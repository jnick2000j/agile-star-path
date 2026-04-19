import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { NotificationBell } from "@/components/notifications/NotificationBell";

import { supabase } from "@/integrations/supabase/client";
import {
  LayoutDashboard,
  Wand2,
  FolderKanban,
  FileText,
  AlertTriangle,
  Users,
  Target,
  BarChart3,
  LogOut,
  BookOpen,
  ChevronDown,
  Layers,
  ClipboardList,
  TrendingUp,
  Calendar,
  Package,
  Building2,
  ListTodo,
  Flag,
  FileEdit,
  ClipboardCheck,
  Shield,
  CreditCard,
  Eye,
  Sparkles,
  Clock,
  Search,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  icon: React.ElementType;
  href?: string;
  children?: { label: string; href: string }[];
}

const navigation: NavItem[] = [
  { label: "Dashboard", icon: LayoutDashboard, href: "/" },
  { label: "Programs", icon: Layers, href: "/programmes" },
  { label: "Projects", icon: FolderKanban, href: "/projects" },
  { label: "Products", icon: Package, href: "/products" },
  { label: "Tasks", icon: ListTodo, href: "/tasks" },
  { label: "Timesheets", icon: Clock, href: "/timesheets" },
  { label: "Governance", icon: Shield, href: "/prince2" },
  { label: "Registers", icon: ClipboardList, href: "/registers" },
  { label: "Reporting", icon: BarChart3, children: [
    { label: "Reports", href: "/reports" },
    { label: "Updates", href: "/updates" },
    { label: "Governance & Comms", href: "/governance" },
  ]},
  // Stakeholder Portal moved to Dashboard quick action
  { label: "Principles", icon: BookOpen, href: "/documentation" },
  { label: "Project Teams", icon: Users, href: "/team" },
  { label: "Wizards", icon: Wand2, href: "/wizards" },
];

export function Sidebar() {
  const location = useLocation();
  const { user, userRole } = useAuth();
  const [expandedItems, setExpandedItems] = useState<string[]>([]);
  const [hasStakeholderAccess, setHasStakeholderAccess] = useState(false);

  useEffect(() => {
    if (!user) {
      setHasStakeholderAccess(false);
      return;
    }
    // Platform admins always see it
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

  const visibleNavigation = navigation;

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
        {/* Navigation */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4 pt-6">
          {visibleNavigation.map((item) => (
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
                  className={cn("nav-link", isActive(item.href!) && "nav-link-active")}
                >
                  <item.icon className="h-5 w-5" />
                  {item.label}
                </Link>
              )}
            </div>
          ))}
        </nav>

        {/* Footer: Notifications + Search */}
        <div className="border-t border-sidebar-border p-3 space-y-2">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-medium text-sidebar-foreground/70">Notifications</span>
            <NotificationBell />
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-sidebar-foreground/50" />
            <Input
              placeholder="Search programmes, projects..."
              className="pl-9 bg-sidebar-accent/40 border-sidebar-border text-sidebar-foreground placeholder:text-sidebar-foreground/50 focus-visible:ring-sidebar-ring"
            />
          </div>
        </div>
      </div>
    </aside>
  );
}
