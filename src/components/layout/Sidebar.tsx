import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { OrganizationSelector } from "@/components/OrganizationSelector";
import {
  LayoutDashboard,
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
  Settings,
  Globe,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  icon: React.ElementType;
  href?: string;
  children?: { label: string; href: string }[];
  adminOnly?: boolean;
}

const navigation: NavItem[] = [
  { label: "Dashboard", icon: LayoutDashboard, href: "/" },
  { label: "Programs", icon: Layers, href: "/programmes" },
  { label: "Projects", icon: FolderKanban, href: "/projects" },
  { label: "Products", icon: Package, href: "/products" },
  { label: "Tasks", icon: ListTodo, href: "/tasks" },
  { label: "PRINCE2", icon: Shield, href: "/prince2" },
  { label: "Registers", icon: ClipboardList, href: "/registers" },
  { label: "Reporting", icon: BarChart3, children: [
    { label: "Reports", href: "/reports" },
    { label: "Weekly Updates", href: "/weekly-updates" },
  ]},
  { label: "Documentation", icon: BookOpen, href: "/documentation" },
  { label: "Project Teams", icon: Users, href: "/team" },
  { label: "Admin", icon: Settings, href: "/admin", adminOnly: true },
  { label: "Platform Admin", icon: Globe, href: "/platform-admin", adminOnly: true },
];

export function Sidebar() {
  const location = useLocation();
  const { user, signOut, userRole, userProfile } = useAuth();
  const [expandedItems, setExpandedItems] = useState<string[]>([]);

  const getDisplayName = () => {
    if (userProfile?.first_name && userProfile?.last_name) {
      return `${userProfile.first_name} ${userProfile.last_name}`;
    }
    if (userProfile?.full_name) {
      return userProfile.full_name;
    }
    return user?.email?.split("@")[0] || "User";
  };

  const getInitials = () => {
    if (userProfile?.first_name && userProfile?.last_name) {
      return `${userProfile.first_name[0]}${userProfile.last_name[0]}`.toUpperCase();
    }
    if (userProfile?.full_name) {
      const parts = userProfile.full_name.split(" ");
      return parts.length >= 2 
        ? `${parts[0][0]}${parts[1][0]}`.toUpperCase()
        : userProfile.full_name.substring(0, 2).toUpperCase();
    }
    return user?.email?.substring(0, 2).toUpperCase() || "U";
  };

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
        {/* Organization Selector */}
        <div className="flex h-16 items-center border-b border-sidebar-border px-3">
          <OrganizationSelector />
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {navigation
            .filter((item) => !item.adminOnly || userRole === "admin")
            .map((item) => (
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
              {getInitials()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-sidebar-foreground truncate">{getDisplayName()}</p>
              <p className="text-xs text-sidebar-foreground/60 truncate capitalize">{userRole?.replace("_", " ") || "User"}</p>
            </div>
            <button onClick={signOut} className="p-2 rounded-lg hover:bg-sidebar-accent transition-colors" title="Sign out">
              <LogOut className="h-4 w-4 text-sidebar-foreground/60" />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
