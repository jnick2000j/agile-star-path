import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { LifeBuoy, Sparkles, BookOpen, Ticket, LogOut, Home, Package } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import { supabase } from "@/integrations/supabase/client";

export function CustomerPortalLayout() {
  const { user } = useAuth();
  const { currentOrganization } = useOrganization();
  const navigate = useNavigate();

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const link = (active: boolean) =>
    `flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
      active
        ? "bg-primary text-primary-foreground"
        : "text-foreground hover:bg-accent"
    }`;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b bg-card">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <LifeBuoy className="h-6 w-6 text-primary" />
            <div>
              <div className="font-semibold leading-tight">
                {currentOrganization?.name ?? "Support"} Portal
              </div>
              <div className="text-xs text-muted-foreground">
                Customer self-service
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground hidden sm:inline">
              {user?.email}
            </span>
            <Button variant="outline" size="sm" onClick={signOut}>
              <LogOut className="h-4 w-4 mr-2" /> Sign out
            </Button>
          </div>
        </div>
        <nav className="max-w-6xl mx-auto px-4 pb-2 flex gap-1 overflow-x-auto">
          <NavLink to="/portal" end className={({ isActive }) => link(isActive)}>
            <Home className="h-4 w-4" /> Dashboard
          </NavLink>
          <NavLink to="/portal/new" className={({ isActive }) => link(isActive)}>
            <Sparkles className="h-4 w-4" /> Get Help
          </NavLink>
          <NavLink to="/portal/catalog" className={({ isActive }) => link(isActive)}>
            <Package className="h-4 w-4" /> Service Catalog
          </NavLink>
          <NavLink to="/portal/tickets" className={({ isActive }) => link(isActive)}>
            <Ticket className="h-4 w-4" /> My Tickets
          </NavLink>
          <NavLink to="/portal/kb" className={({ isActive }) => link(isActive)}>
            <BookOpen className="h-4 w-4" /> Knowledge Base
          </NavLink>
        </nav>
      </header>
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-6">
        <Outlet />
      </main>
      <footer className="border-t bg-card py-4 text-center text-xs text-muted-foreground">
        Powered by {currentOrganization?.name ?? "your organization"}
      </footer>
    </div>
  );
}
