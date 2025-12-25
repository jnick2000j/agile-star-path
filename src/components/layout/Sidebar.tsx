import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  FolderKanban,
  FileText,
  AlertTriangle,
  Users,
  Target,
  BarChart3,
  BookOpen,
  Settings,
  ChevronDown,
  Layers,
  ClipboardList,
  TrendingUp,
  Calendar,
  Mail,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  icon: React.ElementType;
  href?: string;
  children?: { label: string; href: string }[];
}

const navigation: NavItem[] = [
  { label: "Dashboard", icon: LayoutDashboard, href: "/" },
  {
    label: "Programmes",
    icon: Layers,
    children: [
      { label: "All Programmes", href: "/programmes" },
      { label: "Programme Blueprint", href: "/programmes/blueprint" },
      { label: "Tranches", href: "/programmes/tranches" },
    ],
  },
  {
    label: "Projects",
    icon: FolderKanban,
    children: [
      { label: "All Projects", href: "/projects" },
      { label: "Project Briefs", href: "/projects/briefs" },
      { label: "Work Packages", href: "/projects/work-packages" },
    ],
  },
  {
    label: "Registers",
    icon: ClipboardList,
    children: [
      { label: "Risk Register", href: "/registers/risks" },
      { label: "Issue Register", href: "/registers/issues" },
      { label: "Benefits Register", href: "/registers/benefits" },
      { label: "Stakeholder Register", href: "/registers/stakeholders" },
      { label: "Lessons Learned", href: "/registers/lessons" },
    ],
  },
  { label: "Reports", icon: BarChart3, href: "/reports" },
  { label: "Weekly Updates", icon: Calendar, href: "/weekly-updates" },
  { label: "Documentation", icon: BookOpen, href: "/documentation" },
  { label: "Team", icon: Users, href: "/team" },
  { label: "Settings", icon: Settings, href: "/settings" },
];

export function Sidebar() {
  const location = useLocation();
  const [expandedItems, setExpandedItems] = useState<string[]>(["Programmes", "Projects", "Registers"]);

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
        {/* Logo */}
        <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-primary">
            <Target className="h-5 w-5 text-sidebar-primary-foreground" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-sidebar-foreground">PIMP</h1>
            <p className="text-xs text-sidebar-foreground/60">Programme Management</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
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
                  className={cn("nav-link", isActive(item.href!) && "nav-link-active")}
                >
                  <item.icon className="h-5 w-5" />
                  {item.label}
                </Link>
              )}
            </div>
          ))}
        </nav>

        {/* User Section */}
        <div className="border-t border-sidebar-border p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-sidebar-accent text-sm font-medium text-sidebar-foreground">
              AD
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-sidebar-foreground truncate">Admin User</p>
              <p className="text-xs text-sidebar-foreground/60 truncate">Programme Owner</p>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
